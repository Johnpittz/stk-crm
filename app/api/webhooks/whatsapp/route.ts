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
    
    // Log detalhado do payload para debug de mídia
    if (payload.data?.message) {
      const msg = payload.data.message;
      const hasBase64 = !!msg.base64;
      const mediaTypes = ['imageMessage', 'audioMessage', 'videoMessage', 'stickerMessage', 'documentMessage'];
      const foundMedia = mediaTypes.find(t => msg[t]);
      console.log("[Webhook WhatsApp] hasBase64:", hasBase64, "| mediaType:", foundMedia || "none");
      if (hasBase64) {
        console.log("[Webhook WhatsApp] base64 length:", msg.base64.length);
      }
    }

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

      const remetente = dados.fromMe ? "vendedor" : "cliente";
      const naoLido = dados.fromMe ? false : true;

      await getSupabase()
        .from("atendimentos")
        .update({
          ultima_mensagem: conteudoMensagem,
          ultima_mensagem_data: new Date().toISOString(),
          ultima_mensagem_remetente: remetente,
          nao_lido: naoLido,
          // Só atualiza nome se veio do CLIENTE (pushName do operador é o próprio nome)
          ...(nomeCliente && !dados.fromMe ? { nome_cliente: nomeCliente } : {}),
          cliente_id: cliente?.id || atendimentoExistente.cliente_id,
          vendedor_id: vendedorUpdate,
          instancia: dados.instance || atendimentoExistente.instancia || "minha-conexao",
        })
        .eq("id", atendimentoExistente.id);

      // Insere mensagem no chat com mídia (usa whatsapp_message_id para dedup)
      const waMsgId = dados.messageId || null;
      if (waMsgId) {
        const { data: jaExiste } = await getSupabase()
          .from("atendimento_mensagens")
          .select("id")
          .eq("whatsapp_message_id", waMsgId)
          .limit(1);
        if (jaExiste && jaExiste.length > 0) {
          console.log(`[Webhook WhatsApp] Mensagem duplicada (wa_id=${waMsgId}), ignorando`);
          return NextResponse.json({ success: true, action: "duplicate" });
        }
      }
      await getSupabase().from("atendimento_mensagens").insert({
        atendimento_id: atendimentoExistente.id,
        remetente: remetente,
        conteudo: conteudoMensagem,
        enviada_por: dados.fromMe ? (vendedorUpdate || null) : null,
        media_url: dados.mediaUrl || null,
        media_type: dados.mediaType || null,
        file_name: dados.fileName || null,
        whatsapp_message_id: waMsgId,
      });

      console.log(`[Webhook WhatsApp] Mensagem adicionada ao atendimento ${atendimentoExistente.id}`);
      return NextResponse.json({ success: true, atendimento_id: atendimentoExistente.id, action: "updated" });
    }

    // 3. Cria novo atendimento
    const vendedorPadrao = await buscarVendedorPadrao();
    const vendedorFinal = cliente?.vendedor_responsavel_id || vendedorPadrao || null;
    const remetente = dados.fromMe ? "vendedor" : "cliente";
    
    console.log(`[Webhook WhatsApp] Roteamento: cliente_vendedor=${cliente?.vendedor_responsavel_id}, padrao=${vendedorPadrao}, final=${vendedorFinal}`);

    const { data: novoAtendimento, error: erroInsert } = await getSupabase()
      .from("atendimentos")
      .insert({
        cliente_id: cliente?.id || null,
        vendedor_id: vendedorFinal,
        canal: "whatsapp",
        telefone_cliente: telefoneLimpo,
        // Só usa pushName se veio do CLIENTE; operador = "Cliente" ou nome do cadastro
        nome_cliente: (!dados.fromMe && nomeCliente) || cliente?.nome_razao_social || "Cliente",
        status: "aberto",
        prioridade: cliente ? "normal" : "alta",
        assunto: conteudoMensagem.substring(0, 100),
        ultima_mensagem: conteudoMensagem,
        ultima_mensagem_data: new Date().toISOString(),
        ultima_mensagem_remetente: remetente,
        nao_lido: !dados.fromMe,
        instancia: dados.instance || "minha-conexao",
      })
      .select()
      .single();

    if (erroInsert) {
      console.error("[Webhook WhatsApp] Erro ao criar atendimento:", erroInsert);
      return NextResponse.json({ error: erroInsert.message }, { status: 500 });
    }

    // 4. Insere mensagem inicial no chat com mídia (com dedup)
    const waMsgId2 = dados.messageId || null;
    if (waMsgId2) {
      const { data: jaExiste2 } = await getSupabase()
        .from("atendimento_mensagens")
        .select("id")
        .eq("whatsapp_message_id", waMsgId2)
        .limit(1);
      if (jaExiste2 && jaExiste2.length > 0) {
        console.log(`[Webhook WhatsApp] Mensagem duplicada (wa_id=${waMsgId2}), ignorando`);
        return NextResponse.json({ success: true, action: "duplicate" });
      }
    }
    await getSupabase().from("atendimento_mensagens").insert({
      atendimento_id: novoAtendimento.id,
      remetente: remetente,
      conteudo: conteudoMensagem,
      enviada_por: dados.fromMe ? (vendedorFinal || null) : null,
      media_url: dados.mediaUrl || null,
      media_type: dados.mediaType || null,
      file_name: dados.fileName || null,
      whatsapp_message_id: waMsgId2,
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
  fromMe: boolean;
  messageId: string | null;
  instance: string | null;
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

    // Extrair base64 (campo "message.base64" adicionado pela Evolution API com webhookBase64)
    const base64Data = message.base64 || null;

    if (message.imageMessage) {
      mediaType = "image";
      // Prioriza base64 decodificado, senão usa URL do CDN
      mediaUrl = base64Data
        ? `data:${message.imageMessage.mimetype || "image/jpeg"};base64,${base64Data}`
        : message.imageMessage.url || null;
    } else if (message.audioMessage) {
      mediaType = "audio";
      mediaUrl = base64Data
        ? `data:${message.audioMessage.mimetype || "audio/ogg; codecs=opus"};base64,${base64Data}`
        : message.audioMessage.url || null;
    } else if (message.videoMessage) {
      mediaType = "video";
      mediaUrl = base64Data
        ? `data:${message.videoMessage.mimetype || "video/mp4"};base64,${base64Data}`
        : message.videoMessage.url || null;
    } else if (message.documentMessage) {
      mediaType = "document";
      mediaUrl = base64Data
        ? `data:${message.documentMessage.mimetype || "application/octet-stream"};base64,${base64Data}`
        : message.documentMessage.url || null;
      fileName = message.documentMessage.fileName || null;
    } else if (message.stickerMessage) {
      mediaType = "sticker";
      mediaUrl = base64Data
        ? `data:${message.stickerMessage.mimetype || "image/webp"};base64,${base64Data}`
        : message.stickerMessage.url || null;
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
      fromMe: !!key.fromMe,
      messageId: key.id || null,
      instance: payload.instance || null,
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
    fromMe: false,
    messageId: payload.messageId || payload.id || null,
    instance: payload.instance || null,
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
    .select("id, nome_cliente, cliente_id, vendedor_id, instancia")
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
    .select("id, nome_cliente, cliente_id, vendedor_id, telefone_cliente, instancia")
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
