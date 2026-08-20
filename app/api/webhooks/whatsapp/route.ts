/**
 * Webhook para receber mensagens do WhatsApp via Evolution API
 * 
 * Endpoint: POST /api/webhooks/whatsapp
 * 
 * Quando um cliente envia mensagem no WhatsApp, a Evolution API envia
 * um payload para este endpoint. O sistema:
 * 1. Identifica/cria o atendimento pelo telefone
 * 2. Insere a mensagem no chat (com suporte a mídia)
 * 3. Atualiza o status do atendimento
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";
import { telefoneParaDigitos } from "@/lib/evolution-api";
import { buscarVendedorPadrao } from "@/lib/roteamento";

export const dynamic = "force-dynamic";

// Cliente Supabase lazy (service_role para bypassar RLS)
let supabaseInstance: any = null;
function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase URL e Service Role Key são obrigatórios");
    }
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 60 webhooks por minuto
    const limit = rateLimit(request, { max: 60, windowMs: 60_000 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }

    // Parse do payload da Evolution API
    const payload = await request.json();

    // Log para debug
    console.log("[Webhook WhatsApp] Evento:", payload.event);
    console.log("[Webhook WhatsApp] Instance:", payload.instance);

    // Extrair dados do payload da Evolution API
    const dados = extrairDadosEvolutionAPI(payload);

    // Ignorar mensagens de GRUPO (remoteJid termina em @g.us)
    if (dados.remoteJid && dados.remoteJid.endsWith("@g.us")) {
      console.log("[Webhook WhatsApp] Mensagem de grupo ignorada:", dados.remoteJid);
      return NextResponse.json({ success: true, action: "ignored_group" });
    }

    if (!dados.telefone) {
      console.error("[Webhook WhatsApp] Telefone não encontrado no payload");
      return NextResponse.json(
        { error: "Telefone não encontrado no payload" },
        { status: 400 }
      );
    }

    const telefoneLimpo = telefoneParaDigitos(dados.telefone);
    const mensagem = dados.mensagem || "";
    const nomeCliente = dados.nome || null;

    // Verificar se tem mídia
    const temMidia = dados.mediaType !== null;
    const conteudoMensagem = temMidia ? `[${dados.mediaType}]` : mensagem;

    // Aceita mensagens vazias se tiver mídia
    if (!conteudoMensagem && !temMidia) {
      console.error("[Webhook WhatsApp] Mensagem vazia e sem mídia");
      return NextResponse.json(
        { error: "Mensagem vazia" },
        { status: 400 }
      );
    }

    // 1. Busca cliente pelo telefone
    const cliente = await buscarClientePorTelefone(telefoneLimpo);

    // 2. Busca atendimento aberto existente para este telefone
    const atendimentoExistente = await buscarAtendimentoAberto(telefoneLimpo);

    if (atendimentoExistente) {
      // Se atendimento não tem vendedor, tenta atribuir (cliente ou padrão)
      let vendedorUpdate = atendimentoExistente.vendedor_id;
      if (!vendedorUpdate) {
        vendedorUpdate = cliente?.vendedor_responsavel_id || await buscarVendedorPadrao() || null;
        console.log(`[Webhook WhatsApp] Atendimento ${atendimentoExistente.id} sem vendedor → atribuindo: ${vendedorUpdate}`);
      }

      await getSupabase()
        .from("atendimentos")
        .update({
          ultima_mensagem: conteudoMensagem,
          ultima_mensagem_data: new Date().toISOString(),
          ultima_mensagem_remetente: "cliente",
          nao_lido: true,
          nome_cliente: nomeCliente || atendimentoExistente.nome_cliente,
          cliente_id: cliente?.id || atendimentoExistente.cliente_id,
          vendedor_id: vendedorUpdate,
        })
        .eq("id", atendimentoExistente.id);

      // Insere mensagem no chat com mídia
      await getSupabase().from("atendimento_mensagens").insert({
        atendimento_id: atendimentoExistente.id,
        remetente: "cliente",
        conteudo: conteudoMensagem,
        enviada_por: null,
        media_url: dados.mediaUrl || null,
        media_type: dados.mediaType || null,
        file_name: dados.fileName || null,
      });

      console.log(`[Webhook WhatsApp] Mensagem adicionada ao atendimento ${atendimentoExistente.id}`);
      return NextResponse.json({ success: true, atendimento_id: atendimentoExistente.id, action: "updated" });
    }

    // 3. Cria novo atendimento
    const vendedorPadrao = await buscarVendedorPadrao();
    const vendedorFinal = cliente?.vendedor_responsavel_id || vendedorPadrao || null;
    
    console.log(`[Webhook WhatsApp] Roteamento: cliente_vendedor=${cliente?.vendedor_responsavel_id}, padrao=${vendedorPadrao}, final=${vendedorFinal}`);

    const { data: novoAtendimento, error: erroInsert } = await getSupabase()
      .from("atendimentos")
      .insert({
        cliente_id: cliente?.id || null,
        vendedor_id: vendedorFinal,
        canal: "whatsapp",
        telefone_cliente: telefoneLimpo,
        nome_cliente: nomeCliente || cliente?.nome_razao_social || "Cliente",
        status: "aberto",
        prioridade: cliente ? "normal" : "alta",
        assunto: conteudoMensagem.substring(0, 100),
        ultima_mensagem: conteudoMensagem,
        ultima_mensagem_data: new Date().toISOString(),
        ultima_mensagem_remetente: "cliente",
        nao_lido: true,
      })
      .select()
      .single();

    if (erroInsert) {
      console.error("[Webhook WhatsApp] Erro ao criar atendimento:", erroInsert);
      return NextResponse.json({ error: erroInsert.message }, { status: 500 });
    }

    // 4. Insere mensagem inicial no chat com mídia
    await getSupabase().from("atendimento_mensagens").insert({
      atendimento_id: novoAtendimento.id,
      remetente: "cliente",
      conteudo: conteudoMensagem,
      enviada_por: null,
      media_url: dados.mediaUrl || null,
      media_type: dados.mediaType || null,
      file_name: dados.fileName || null,
    });

    console.log(`[Webhook WhatsApp] Novo atendimento criado: ${novoAtendimento.id}`);
    return NextResponse.json({ success: true, atendimento_id: novoAtendimento.id, action: "created" });

  } catch (error: any) {
    console.error("[Webhook WhatsApp] Erro geral:", error);
    return NextResponse.json(
      { error: "Erro ao processar webhook", details: error.message },
      { status: 500 }
    );
  }
}

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Extrai dados do payload da Evolution API
 * Formato padrão: { event, instance, data: { key, message, pushName, ... } }
 */
function extrairDadosEvolutionAPI(payload: any): {
  telefone: string | null;
  mensagem: string | null;
  nome: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  fileName: string | null;
  remoteJid: string | null;
} {
  // Formato Evolution API: { event: 'messages.upsert', data: { key, message, pushName } }
  if (payload.event && payload.data) {
    const data = payload.data;
    const message = data.message || {};
    const key = data.key || {};

    // Extrair texto da mensagem
    let mensagem = null;
    if (message.conversation) {
      mensagem = message.conversation;
    } else if (message.extendedTextMessage?.text) {
      mensagem = message.extendedTextMessage.text;
    } else if (message.buttonsResponseMessage?.selectedButtonId) {
      mensagem = message.buttonsResponseMessage.selectedButtonId;
    } else if (message.listResponseMessage?.singleSelectReply?.selectedRowId) {
      mensagem = message.listResponseMessage.singleSelectReply.selectedRowId;
    }

    // Extrair mídia
    let mediaType = null;
    let mediaUrl = null;
    let fileName = null;

    if (message.imageMessage) {
      mediaType = "image";
      // Com webhookBase64, o campo "file" contém o base64; senão usa a URL do CDN
      mediaUrl = message.imageMessage.file || message.imageMessage.url || null;
    } else if (message.audioMessage) {
      mediaType = "audio";
      mediaUrl = message.audioMessage.file || message.audioMessage.url || null;
    } else if (message.videoMessage) {
      mediaType = "video";
      mediaUrl = message.videoMessage.file || message.videoMessage.url || null;
    } else if (message.documentMessage) {
      mediaType = "document";
      mediaUrl = message.documentMessage.file || message.documentMessage.url || null;
      fileName = message.documentMessage.fileName || null;
    } else if (message.stickerMessage) {
      mediaType = "sticker";
      mediaUrl = message.stickerMessage.file || message.stickerMessage.url || null;
    }

    // Extrair telefone (remove @s.whatsapp.net)
    const telefone = key.remoteJid?.replace("@s.whatsapp.net", "") || null;

    return {
      telefone,
      mensagem,
      nome: data.pushName || null,
      mediaType,
      mediaUrl,
      fileName,
      remoteJid: key.remoteJid || null,
    };
  }

  // Fallback: tenta extrair de outros formatos
  return {
    telefone: payload.phone || payload.telefone || payload.number || null,
    mensagem: payload.message || payload.mensagem || payload.text || null,
    nome: payload.name || payload.nome || payload.pushName || null,
    mediaType: payload.media_type || null,
    mediaUrl: payload.media_url || null,
    fileName: payload.file_name || null,
    remoteJid: null,
  };
}

/**
 * Busca cliente pelo telefone no banco de dados
 */
async function buscarClientePorTelefone(telefoneLimpo: string) {
  const { data: clientesCandidatos } = await getSupabase()
    .from("clientes")
    .select("id, vendedor_responsavel_id, nome_razao_social, telefone, celular")
    .or(`telefone.ilike.%${telefoneLimpo.substring(0, 6)}%,celular.ilike.%${telefoneLimpo.substring(0, 6)}%`)
    .limit(50);

  if (!clientesCandidatos || clientesCandidatos.length === 0) return null;

  // Filtra comparando só dígitos
  return clientesCandidatos.find((c: any) => {
    const telLimpo = (c.telefone || "").replace(/\D/g, "");
    const celLimpo = (c.celular || "").replace(/\D/g, "");
    return (
      telLimpo === telefoneLimpo ||
      celLimpo === telefoneLimpo ||
      telLimpo.endsWith(telefoneLimpo) ||
      celLimpo.endsWith(telefoneLimpo) ||
      telefoneLimpo.endsWith(telLimpo) ||
      telefoneLimpo.endsWith(celLimpo)
    );
  }) || null;
}

/**
 * Busca atendimento aberto existente para o telefone
 * Faz busca tolerante a formatos diferentes (com/sem 9, com/sem código país, etc.)
 */
async function buscarAtendimentoAberto(telefoneLimpo: string) {
  // Primeiro: busca exata (rápida)
  const { data: exato } = await getSupabase()
    .from("atendimentos")
    .select("id, nome_cliente, cliente_id, vendedor_id")
    .eq("telefone_cliente", telefoneLimpo)
    .eq("status", "aberto")
    .limit(1)
    .single();

  if (exato) return exato;

  // Segundo: busca ampla — compara apenas os últimos 8 dígitos (tolerante a formatos)
  const ultimos8 = telefoneLimpo.slice(-8);
  if (ultimos8.length < 8) return null;

  const { data: candidatos } = await getSupabase()
    .from("atendimentos")
    .select("id, nome_cliente, cliente_id, vendedor_id, telefone_cliente")
    .eq("status", "aberto")
    .order("ultima_mensagem_data", { ascending: false })
    .limit(50);

  if (!candidatos || candidatos.length === 0) return null;

  const encontrado = candidatos.find((a: any) => {
    const telBanco = (a.telefone_cliente || "").replace(/\D/g, "");
    const ultimos8Banco = telBanco.slice(-8);
    return ultimos8Banco === ultimos8 && ultimos8Banco.length >= 8;
  });

  return encontrado || null;
}
