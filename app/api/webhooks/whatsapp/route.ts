/**
 * Webhook para receber mensagens do BotConversa (WhatsApp)
 * 
 * Endpoint: POST /api/webhooks/whatsapp
 * 
 * Quando um cliente envia mensagem no WhatsApp, o BotConversa envia
 * um payload para este endpoint. O sistema:
 * 1. Identifica/cria o atendimento pelo telefone
 * 2. Insere a mensagem no chat
 * 3. Atualiza o status do atendimento
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";
import { telefoneParaDigitos } from "@/lib/botconversa";
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

    // Parse do payload do BotConversa
    const payload = await request.json();

    // Log para debug (verificar formato real do payload)
    console.log("[Webhook WhatsApp] Payload recebido:", JSON.stringify(payload, null, 2));
    console.log("[Webhook WhatsApp] Chaves do payload:", Object.keys(payload).join(", "));
    
    // Log de mídia se presente
    if (payload.media_type || payload.media_url) {
      console.log("[Webhook WhatsApp] 🎵 Mídia detectada:", JSON.stringify({
        media_type: payload.media_type,
        media_url: payload.media_url,
      }));
    }

    // O BotConversa pode enviar payloads em formatos diferentes
    // Vamos extrair os dados de forma flexível
    const dados = extrairDados(payload);

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
    const urlAudio = dados.url_audio || null;

    // Aceita mensagens vazias se tiver áudio
    if (!mensagem && !urlAudio) {
      console.error("[Webhook WhatsApp] Mensagem vazia e sem áudio");
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
          ultima_mensagem: mensagem,
          ultima_mensagem_data: new Date().toISOString(),
          ultima_mensagem_remetente: "cliente",
          nao_lido: true,
          nome_cliente: nomeCliente || atendimentoExistente.nome_cliente,
          cliente_id: cliente?.id || atendimentoExistente.cliente_id,
          vendedor_id: vendedorUpdate,
        })
        .eq("id", atendimentoExistente.id);

      // Insere mensagem no chat
      await getSupabase().from("atendimento_mensagens").insert({
        atendimento_id: atendimentoExistente.id,
        remetente: "cliente",
        conteudo: urlAudio ? "[Áudio]" : mensagem,
        enviada_por: null,
        url_audio: urlAudio || null,
      });

      console.log(`[Webhook WhatsApp] Mensagem adicionada ao atendimento ${atendimentoExistente.id} (audio: ${urlAudio || "nenhum"})`);
      return NextResponse.json({ success: true, atendimento_id: atendimentoExistente.id, action: "updated" });
    }

    // 3. Cria novo atendimento
    // Se cliente não tem vendedor no cadastro, usa vendedor padrão (roteamento)
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
        assunto: mensagem.substring(0, 100),
        ultima_mensagem: mensagem,
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

    // 4. Insere mensagem inicial no chat
    await getSupabase().from("atendimento_mensagens").insert({
      atendimento_id: novoAtendimento.id,
      remetente: "cliente",
      conteudo: urlAudio ? "[Áudio]" : mensagem,
      enviada_por: null,
      url_audio: urlAudio || null,
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
 * Extrai dados do payload do BotConversa de forma flexível
 * O formato pode variar dependendo de como o webhook foi configurado
 */
function extrairDados(payload: any): { telefone: string | null; mensagem: string | null; nome: string | null; url_audio: string | null } {
  // Helper: detecta URL de áudio (formato BotConversa: media_type + media_url)
  const detectarAudio = (obj: any): string | null => {
    if (!obj) return null;
    
    // Formato BotConversa: media_type="audio" e media_url="link"
    if (obj.media_type === "audio" && obj.media_url) {
      return obj.media_url;
    }
    
    // Outros formatos possíveis
    if (obj.url_audio || obj.audio_url || obj.audio || obj.url) {
      const val = obj.url_audio || obj.audio_url || obj.audio || obj.url;
      if (typeof val === "string" && (val.includes(".ogg") || val.includes(".mp3") || val.includes(".opus") || val.includes("audio") || val.includes("media"))) {
        return val;
      }
    }
    if (obj.type === "audio" || obj.message_type === "audio" || obj.mimetype?.startsWith("audio")) {
      return obj.url || obj.media_url || obj.audio || obj.url_audio || obj.value || null;
    }
    return null;
  };

  // Formato 1: Payload direto do BotConversa (automação)
  if (payload.phone || payload.telefone) {
    return {
      telefone: payload.phone || payload.telefone || null,
      mensagem: payload.message || payload.mensagem || payload.text || null,
      nome: payload.first_name || payload.name || payload.nome || null,
      url_audio: detectarAudio(payload),
    };
  }

  // Formato 2: Payload aninhado (webhook padrão)
  if (payload.data) {
    return {
      telefone: payload.data.phone || payload.data.telefone || null,
      mensagem: payload.data.message || payload.data.mensagem || payload.data.text || null,
      nome: payload.data.first_name || payload.data.name || payload.data.nome || null,
      url_audio: detectarAudio(payload.data),
    };
  }

  // Formato 3: Evento do BotConversa (varia conforme configuração)
  if (payload.event && payload.payload) {
    return {
      telefone: payload.payload.phone || payload.payload.telefone || null,
      mensagem: payload.payload.message || payload.payload.mensagem || payload.payload.text || null,
      nome: payload.payload.first_name || payload.payload.name || payload.payload.nome || null,
      url_audio: detectarAudio(payload.payload),
    };
  }

  // Formato 4: Mensagem do WhatsApp via BotConversa API
  if (payload.from) {
    return {
      telefone: payload.from,
      mensagem: payload.body || payload.text || payload.message || null,
      nome: payload.pushName || payload.notify_name || null,
      url_audio: detectarAudio(payload),
    };
  }

  // Fallback: tenta extrair qualquer campo que pareça telefone
  return {
    telefone: payload.phone_number || payload.number || payload.telefone || null,
    mensagem: payload.message || payload.mensagem || payload.text || payload.body || null,
    nome: payload.name || payload.nome || payload.first_name || null,
    url_audio: detectarAudio(payload),
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
