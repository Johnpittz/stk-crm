/**
 * Sync de mensagens do WhatsApp via Evolution API REST
 * 
 * Busca mensagens recentes da Evolution API e salva no Supabase.
 * Resolve o problema de mensagens enviadas do celular não aparecerem no chat.
 * 
 * POST /api/atendimentos/sync-from-evolution
 * Body: { "telefone": "556291889764" } (opcional - sem telefone sincroniza todos)
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

/** Busca mensagens recentes da Evolution API para um número específico */
async function fetchMessagesFromEvolution(phoneNumber: string): Promise<any[]> {
  if (!EVOLUTION_API_KEY) {
    console.error("[Sync] Evolution API key não configurada");
    return [];
  }

  const jid = `${phoneNumber}@s.whatsapp.net`;

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/findMany/${EVOLUTION_INSTANCE}`,
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
          limit: 50,
          orderBy: {
            messageTimestamp: "desc",
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("[Sync] Evolution API error:", response.status, await response.text());
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : data.records || data.messages || [];
  } catch (err: any) {
    console.error("[Sync] Erro ao buscar mensagens:", err.message);
    return [];
  }
}

/** Busca todas as conversas ativas da Evolution API */
async function fetchChatsFromEvolution(): Promise<any[]> {
  if (!EVOLUTION_API_KEY) return [];

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/chat/findMany/${EVOLUTION_INSTANCE}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          where: {
            key: {
              remoteJid: {
                like: "%@s.whatsapp.net",
              },
            },
          },
          limit: 100,
          orderBy: {
            messageTimestamp: "desc",
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("[Sync] Chats API error:", response.status);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : data.records || data.chats || [];
  } catch (err: any) {
    console.error("[Sync] Erro ao buscar chats:", err.message);
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
  const base64 = message.base64 || null;

  // Texto
  if (message.conversation) {
    return { conteudo: message.conversation, mediaType: null, mediaUrl: null };
  }
  if (message.extendedTextMessage?.text) {
    return { conteudo: message.extendedTextMessage.text, mediaType: null, mediaUrl: null };
  }

  // Imagem
  if (message.imageMessage) {
    const url = base64
      ? `data:${message.imageMessage.mimetype || "image/jpeg"};base64,${base64}`
      : message.imageMessage.url || null;
    return { conteudo: "[Imagem]", mediaType: "image", mediaUrl: url };
  }

  // Áudio
  if (message.audioMessage) {
    const url = base64
      ? `data:${message.audioMessage.mimetype || "audio/ogg; codecs=opus"};base64,${base64}`
      : message.audioMessage.url || null;
    return { conteudo: "[Áudio]", mediaType: "audio", mediaUrl: url };
  }

  // Vídeo
  if (message.videoMessage) {
    const url = base64
      ? `data:${message.videoMessage.mimetype || "video/mp4"};base64,${base64}`
      : message.videoMessage.url || null;
    return { conteudo: "[Vídeo]", mediaType: "video", mediaUrl: url };
  }

  // Documento
  if (message.documentMessage) {
    const url = base64
      ? `data:${message.documentMessage.mimetype || "application/octet-stream"};base64,${base64}`
      : message.documentMessage.url || null;
    return { conteudo: `[Documento] ${message.documentMessage.fileName || ""}`, mediaType: "document", mediaUrl: url };
  }

  // Sticker
  if (message.stickerMessage) {
    const url = base64
      ? `data:${message.stickerMessage.mimetype || "image/webp"};base64,${base64}`
      : message.stickerMessage.url || null;
    return { conteudo: "[Sticker]", mediaType: "sticker", mediaUrl: url };
  }

  // Buttons / Lists
  if (message.buttonsResponseMessage?.selectedButtonId) {
    return { conteudo: message.buttonsResponseMessage.selectedButtonId, mediaType: null, mediaUrl: null };
  }
  if (message.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return { conteudo: message.listResponseMessage.singleSelectReply.selectedRowId, mediaType: null, mediaUrl: null };
  }

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
    let totalSincronizadas = 0;
    let totalAtualizadas = 0;
    const erros: string[] = [];

    if (telefoneEspecifico) {
      // Sincronizar um número específico
      const telefoneLimpo = telefoneEspecifico.replace(/\D/g, "");
      const msgs = await fetchMessagesFromEvolution(telefoneLimpo);
      console.log(`[Sync] ${msgs.length} mensagens encontradas para ${telefoneLimpo}`);

      for (const msg of msgs) {
        try {
          const resultado = await processarMensagem(supabase, msg);
          if (resultado === "inserida") totalSincronizadas++;
          else if (resultado === "atualizada") totalAtualizadas++;
        } catch (err: any) {
          erros.push(err.message);
        }
      }
    } else {
      // Sincronizar todas as conversas ativas
      const chats = await fetchChatsFromEvolution();
      console.log(`[Sync] ${chats.length} chats encontrados`);

      for (const chat of chats) {
        const telefone = extrairTelefone(chat.key?.remoteJid || chat.remoteJid || "");
        if (!telefone || telefone.length < 8) continue;

        const msgs = await fetchMessagesFromEvolution(telefone);
        for (const msg of msgs.slice(0, 20)) { // Limita a 20 por conversa
          try {
            const resultado = await processarMensagem(supabase, msg);
            if (resultado === "inserida") totalSincronizadas++;
            else if (resultado === "atualizada") totalAtualizadas++;
          } catch (err: any) {
            erros.push(err.message);
          }
        }
      }
    }

    console.log(`[Sync] Concluído: ${totalSincronizadas} inseridas, ${totalAtualizadas} atualizadas, ${erros.length} erros`);

    return NextResponse.json({
      success: true,
      inseridas: totalSincronizadas,
      atualizadas: totalAtualizadas,
      erros: erros.length > 0 ? erros.slice(0, 10) : undefined,
    });
  } catch (error: any) {
    console.error("[Sync] Erro geral:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function processarMensagem(supabase: any, msg: any): Promise<"inserida" | "atualizada" | "ignorada"> {
  const remoteJid = msg.key?.remoteJid || "";
  
  // Ignorar grupos
  if (remoteJid.endsWith("@g.us")) return "ignorada";

  // Ignorar mensagens de canal
  if (remoteJid.endsWith("@newsletter")) return "ignorada";

  const telefoneLimpo = extrairTelefone(remoteJid);
  if (!telefoneLimpo || telefoneLimpo.length < 8) return "ignorada";

  const fromMe = !!msg.key?.fromMe;
  const pushName = msg.pushName || null;
  const timestamp = msg.messageTimestamp;
  const messageId = msg.key?.id || "";

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

  // Verificar se mensagem já existe (dedup por conteúdo + timestamp)
  const { data: existente } = await supabase
    .from("atendimento_mensagens")
    .select("id")
    .eq("atendimento_id", atendimento.id)
    .eq("conteudo", conteudoFinal)
    .limit(1);

  if (existente && existente.length > 0) return "ignorada";

  // Determinar remetente
  const remetente = fromMe ? "operador" : "cliente";
  const dataMsg = timestamp
    ? new Date(timestamp * 1000).toISOString()
    : new Date().toISOString();

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
    console.error("[Sync] Erro insert mensagem:", insertError.message);
    throw new Error(insertError.message);
  }

  // Atualizar preview no atendimento
  const remetenteUltima = fromMe ? "operador" : "cliente";
  await supabase
    .from("atendimentos")
    .update({
      ultima_mensagem: conteudoFinal,
      ultima_mensagem_data: dataMsg,
      ultima_mensagem_remetente: remetenteUltima,
      nao_lido: !fromMe,
      nome_cliente: pushName || atendimento.nome_cliente,
    })
    .eq("id", atendimento.id);

  return "inserida";
}
