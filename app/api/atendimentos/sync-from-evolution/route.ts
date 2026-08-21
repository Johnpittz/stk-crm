/**
 * Sync de mensagens do WhatsApp via Evolution API REST
 * 
 * Busca mensagens recentes da Evolution API via POST /chat/findMessages
 * e salva no Supabase. Resolve o problema de mensagens enviadas do
 * celular não aparecerem no chat do CRM.
 * 
 * POST /api/atendimentos/sync-from-evolution
 * Body: { "telefone": "556291889764" } (opcional)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://2.25.192.248:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || "minha-conexao";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

/**
 * Busca mensagens via POST /chat/findMessages/{instance}
 * Endpoint correto da Evolution API v2
 */
async function fetchMessagesFromEvolution(phoneNumber: string, limit = 50): Promise<any[]> {
  if (!EVOLUTION_API_KEY) {
    console.error("[Sync] Evolution API key não configurada");
    return [];
  }

  const jid = `${phoneNumber}@s.whatsapp.net`;

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/chat/findMessages/${EVOLUTION_INSTANCE}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          where: {
            key: {
              remoteJid: jid,
            },
          },
          limit,
          page: 1,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("[Sync] Evolution API error:", response.status, text.substring(0, 200));
      return [];
    }

    const data = await response.json();
    // Evolution API v2 retorna { messages: { total, records: [...] } }
    const records = data?.messages?.records || data?.records || [];
    console.log(`[Sync] Evolution API retornou ${records.length} mensagens para ${phoneNumber} (total: ${data?.messages?.total || records.length})`);
    return records;
  } catch (err: any) {
    console.error("[Sync] Erro ao buscar mensagens:", err.message);
    return [];
  }
}

/** Extrai telefone do remoteJid */
function extrairTelefone(remoteJid: string): string {
  return (remoteJid || "").replace("@s.whatsapp.net", "").replace("@lid", "");
}

/** Extrai conteúdo da mensagem da Evolution API */
function extrairConteudo(msg: any): { conteudo: string; mediaType: string | null; mediaUrl: string | null } {
  const message = msg.message || {};

  // Texto simples
  if (message.conversation) {
    return { conteudo: message.conversation, mediaType: null, mediaUrl: null };
  }
  if (message.extendedTextMessage?.text) {
    return { conteudo: message.extendedTextMessage.text, mediaType: null, mediaUrl: null };
  }

  // Mídia (sem base64 via REST, só placeholders)
  if (message.imageMessage) {
    return { conteudo: "[Imagem]", mediaType: "image", mediaUrl: message.imageMessage.url || null };
  }
  if (message.audioMessage) {
    return { conteudo: "[Áudio]", mediaType: "audio", mediaUrl: message.audioMessage.url || null };
  }
  if (message.videoMessage) {
    return { conteudo: "[Vídeo]", mediaType: "video", mediaUrl: message.videoMessage.url || null };
  }
  if (message.documentMessage) {
    return { conteudo: `[Documento] ${message.documentMessage.fileName || ""}`, mediaType: "document", mediaUrl: message.documentMessage.url || null };
  }
  if (message.stickerMessage) {
    return { conteudo: "[Sticker]", mediaType: "sticker", mediaUrl: message.stickerMessage.url || null };
  }

  // Buttons / Lists
  if (message.buttonsResponseMessage?.selectedButtonId) {
    return { conteudo: message.buttonsResponseMessage.selectedButtonId, mediaType: null, mediaUrl: null };
  }
  if (message.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return { conteudo: message.listResponseMessage.singleSelectReply.selectedRowId, mediaType: null, mediaUrl: null };
  }

  // Fallback para messageType
  const msgType = msg.messageType || "";
  if (msgType.includes("image")) return { conteudo: "[Imagem]", mediaType: "image", mediaUrl: null };
  if (msgType.includes("audio")) return { conteudo: "[Áudio]", mediaType: "audio", mediaUrl: null };
  if (msgType.includes("video")) return { conteudo: "[Vídeo]", mediaType: "video", mediaUrl: null };
  if (msgType.includes("sticker")) return { conteudo: "[Sticker]", mediaType: "sticker", mediaUrl: null };
  if (msgType.includes("document")) return { conteudo: "[Documento]", mediaType: "document", mediaUrl: null };

  return { conteudo: "", mediaType: null, mediaUrl: null };
}

/** Busca atendimento aberto por telefone (tolerante a formatos) */
async function buscarAtendimento(supabase: any, telefoneLimpo: string) {
  // Busca exata
  const { data: exato } = await supabase
    .from("atendimentos")
    .select("id, telefone_cliente, nome_cliente, cliente_id, vendedor_id")
    .eq("telefone_cliente", telefoneLimpo)
    .eq("status", "aberto")
    .limit(1)
    .single();

  if (exato) return exato;

  // Busca fuzzy (últimos 8 dígitos)
  if (telefoneLimpo.length < 8) return null;
  const ultimos8 = telefoneLimpo.slice(-8);

  const { data: candidatos } = await supabase
    .from("atendimentos")
    .select("id, telefone_cliente, nome_cliente, cliente_id, vendedor_id")
    .eq("status", "aberto")
    .order("ultima_mensagem_data", { ascending: false })
    .limit(100);

  if (!candidatos) return null;

  return candidatos.find((a: any) => {
    const telBanco = (a.telefone_cliente || "").replace(/\D/g, "");
    return telBanco.slice(-8) === ultimos8 && telBanco.length >= 8;
  }) || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const telefoneEspecifico = body.telefone || null;

    const supabase = getSupabase();
    let totalInseridas = 0;
    let totalIgnoradas = 0;
    const erros: string[] = [];

    if (telefoneEspecifico) {
      // Sincronizar um número específico
      const telefoneLimpo = telefoneEspecifico.replace(/\D/g, "");
      console.log(`[Sync] Buscando mensagens para ${telefoneLimpo}`);
      
      const msgs = await fetchMessagesFromEvolution(telefoneLimpo);

      for (const msg of msgs) {
        try {
          const resultado = await processarMensagem(supabase, msg);
          if (resultado === "inserida") totalInseridas++;
          else totalIgnoradas++;
        } catch (err: any) {
          erros.push(err.message);
          console.error("[Sync] Erro processando mensagem:", err.message);
        }
      }
    } else {
      // Sincronizar todas as conversas ativas do Supabase
      const { data: atendimentos } = await supabase
        .from("atendimentos")
        .select("id, telefone_cliente")
        .eq("status", "aberto")
        .not("telefone_cliente", "is", null)
        .limit(50);

      if (atendimentos) {
        for (const at of atendimentos) {
          const telefoneLimpo = (at.telefone_cliente || "").replace(/\D/g, "");
          if (telefoneLimpo.length < 8) continue;

          const msgs = await fetchMessagesFromEvolution(telefoneLimpo, 20);
          for (const msg of msgs) {
            try {
              const resultado = await processarMensagem(supabase, msg);
              if (resultado === "inserida") totalInseridas++;
              else totalIgnoradas++;
            } catch (err: any) {
              erros.push(err.message);
            }
          }
        }
      }
    }

    console.log(`[Sync] Concluído: ${totalInseridas} inseridas, ${totalIgnoradas} ignoradas, ${erros.length} erros`);

    return NextResponse.json({
      success: true,
      inseridas: totalInseridas,
      ignoradas: totalIgnoradas,
      erros: erros.length > 0 ? erros.slice(0, 10) : undefined,
    });
  } catch (error: any) {
    console.error("[Sync] Erro geral:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function processarMensagem(supabase: any, msg: any): Promise<"inserida" | "ignorada"> {
  const remoteJid = msg.key?.remoteJid || "";

  // Ignorar grupos e canais
  if (remoteJid.endsWith("@g.us")) return "ignorada";
  if (remoteJid.endsWith("@newsletter")) return "ignorada";

  const telefoneLimpo = extrairTelefone(remoteJid);
  if (!telefoneLimpo || telefoneLimpo.length < 8) return "ignorada";

  const fromMe = !!msg.key?.fromMe;
  const pushName = msg.pushName || null;
  const messageTimestamp = msg.messageTimestamp;

  // Extrair conteúdo
  const { conteudo, mediaType, mediaUrl } = extrairConteudo(msg);
  if (!conteudo && !mediaType) return "ignorada";

  const conteudoFinal = mediaType ? `[${mediaType}]` : conteudo;

  // Buscar atendimento existente
  const atendimento = await buscarAtendimento(supabase, telefoneLimpo);
  if (!atendimento) {
    console.log(`[Sync] Atendimento não encontrado para ${telefoneLimpo}`);
    return "ignorada";
  }

  // Dedup: verificar se já existe mensagem com mesmo conteúdo + mesmo remetente
  const remetente = fromMe ? "vendedor" : "cliente";
  const { data: existente } = await supabase
    .from("atendimento_mensagens")
    .select("id")
    .eq("atendimento_id", atendimento.id)
    .eq("conteudo", conteudoFinal)
    .eq("remetente", remetente)
    .limit(1);

  if (existente && existente.length > 0) return "ignorada";

  // Inserir mensagem
  const { error: insertError } = await supabase.from("atendimento_mensagens").insert({
    atendimento_id: atendimento.id,
    remetente,
    conteudo: conteudoFinal,
    media_url: mediaUrl || null,
    media_type: mediaType || null,
    enviada_por: fromMe ? (atendimento.vendedor_id || null) : null,
  });

  if (insertError) {
    throw new Error(`Insert failed: ${insertError.message}`);
  }

  // Atualizar preview no atendimento
  const dataMsg = messageTimestamp
    ? new Date(messageTimestamp * 1000).toISOString()
    : new Date().toISOString();

  await supabase
    .from("atendimentos")
    .update({
      ultima_mensagem: conteudoFinal,
      ultima_mensagem_data: dataMsg,
      ultima_mensagem_remetente: remetente,
      nao_lido: !fromMe,
      nome_cliente: pushName || atendimento.nome_cliente,
    })
    .eq("id", atendimento.id);

  console.log(`[Sync] Mensagem inserida: ${remetente} | ${conteudoFinal.substring(0, 40)} | atendimento ${atendimento.id.substring(0, 8)}`);
  return "inserida";
}
// Thu Aug 20 21:59:20 -03 2026
