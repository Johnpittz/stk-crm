/**
 * Sync de mensagens do WhatsApp via Evolution API REST (OTIMIZADO)
 * 
 * Batch queries ao invés de N+1. Max 60 segundos de execução.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://2.25.192.248:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";
const SYNC_TIMEOUT_MS = 60_000;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

async function listarInstancias(): Promise<Array<{ name: string; number: string }>> {
  if (!EVOLUTION_API_KEY) return [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`${EVOLUTION_API_URL}/instance/fetchInstances`, {
      headers: { apikey: EVOLUTION_API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return [];
    const data = await response.json();
    return (data || []).map((i: any) => ({ name: i.name || "", number: i.number || "" }));
  } catch {
    return [];
  }
}

async function fetchMessages(phoneNumber: string, instanceName: string, limit = 30): Promise<any[]> {
  if (!EVOLUTION_API_KEY) return [];
  const jid = `${phoneNumber}@s.whatsapp.net`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
      body: JSON.stringify({ where: { key: { remoteJid: jid } }, limit, page: 1 }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return [];
    const data = await response.json();
    return data?.messages?.records || data?.records || [];
  } catch {
    return [];
  }
}

function extrairTelefone(remoteJid: string): string {
  return (remoteJid || "").replace("@s.whatsapp.net", "").replace("@lid", "");
}

function extrairConteudo(msg: any): { conteudo: string; mediaType: string | null; mediaUrl: string | null } {
  const message = msg.message || {};
  if (message.conversation) return { conteudo: message.conversation, mediaType: null, mediaUrl: null };
  if (message.extendedTextMessage?.text) return { conteudo: message.extendedTextMessage.text, mediaType: null, mediaUrl: null };
  if (message.imageMessage) return { conteudo: "[Imagem]", mediaType: "image", mediaUrl: message.imageMessage.url || null };
  if (message.audioMessage) return { conteudo: "[Áudio]", mediaType: "audio", mediaUrl: message.audioMessage.url || null };
  if (message.videoMessage) return { conteudo: "[Vídeo]", mediaType: "video", mediaUrl: message.videoMessage.url || null };
  if (message.documentMessage) return { conteudo: `[Documento] ${message.documentMessage.fileName || ""}`, mediaType: "document", mediaUrl: message.documentMessage.url || null };
  if (message.stickerMessage) return { conteudo: "[Sticker]", mediaType: "sticker", mediaUrl: message.stickerMessage.url || null };
  if (message.buttonsResponseMessage?.selectedButtonId) return { conteudo: message.buttonsResponseMessage.selectedButtonId, mediaType: null, mediaUrl: null };
  if (message.listResponseMessage?.singleSelectReply?.selectedRowId) return { conteudo: message.listResponseMessage.singleSelectReply.selectedRowId, mediaType: null, mediaUrl: null };
  const msgType = msg.messageType || "";
  if (msgType.includes("image")) return { conteudo: "[Imagem]", mediaType: "image", mediaUrl: null };
  if (msgType.includes("audio")) return { conteudo: "[Áudio]", mediaType: "audio", mediaUrl: null };
  if (msgType.includes("video")) return { conteudo: "[Vídeo]", mediaType: "video", mediaUrl: null };
  if (msgType.includes("sticker")) return { conteudo: "[Sticker]", mediaType: "sticker", mediaUrl: null };
  if (msgType.includes("document")) return { conteudo: "[Documento]", mediaType: "document", mediaUrl: null };
  return { conteudo: "", mediaType: null, mediaUrl: null };
}

async function buscarAtendimento(supabase: any, telefoneLimpo: string, instancia: string) {
  const { data } = await supabase
    .from("atendimentos")
    .select("id, telefone_cliente, nome_cliente, cliente_id, vendedor_id, instancia")
    .eq("telefone_cliente", telefoneLimpo)
    .eq("instancia", instancia)
    .eq("status", "aberto")
    .limit(1)
    .single();
  return data || null;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json().catch(() => ({}));
    const telefoneEspecifico = body.telefone || null;
    const supabase = getSupabase();
    
    let totalInseridas = 0;
    let totalIgnoradas = 0;
    const erros: string[] = [];

    const instancias = await listarInstancias();
    console.log(`[Sync] Instâncias: ${instancias.map(i => i.name).join(", ")}`);

    if (telefoneEspecifico) {
      const telefoneLimpo = telefoneEspecifico.replace(/\D/g, "");
      
      for (const inst of instancias) {
        if (Date.now() - startTime > SYNC_TIMEOUT_MS) {
          console.log(`[Sync] Timeout atingido, parando`);
          break;
        }
        
        const msgs = await fetchMessages(telefoneLimpo, inst.name, 30);
        console.log(`[Sync] ${inst.name}: ${msgs.length} msgs`);
        
        if (msgs.length === 0) continue;
        
        const atendimento = await buscarAtendimento(supabase, telefoneLimpo, inst.name);
        if (!atendimento) {
          totalIgnoradas += msgs.length;
          continue;
        }
        
        // Batch: buscar IDs já existentes (1 query por instância)
        const waMsgIds = msgs.map((m: any) => m.key?.id).filter(Boolean);
        let existentes = new Set<string>();
        if (waMsgIds.length > 0) {
          const { data } = await supabase
            .from("atendimento_mensagens")
            .select("whatsapp_message_id")
            .eq("atendimento_id", atendimento.id)
            .in("whatsapp_message_id", waMsgIds);
          existentes = new Set((data || []).map((r: any) => r.whatsapp_message_id));
        }
        
        // Preparar mensagens para batch insert
        const novasMsgs: any[] = [];
        for (const msg of msgs) {
          const waMsgId = msg.key?.id || null;
          
          if (waMsgId && existentes.has(waMsgId)) {
            totalIgnoradas++;
            continue;
          }
          
          const remoteJid = msg.key?.remoteJid || "";
          if (remoteJid.endsWith("@g.us") || remoteJid.endsWith("@newsletter")) {
            totalIgnoradas++;
            continue;
          }
          
          const { conteudo, mediaType, mediaUrl } = extrairConteudo(msg);
          if (!conteudo && !mediaType) {
            totalIgnoradas++;
            continue;
          }
          
          const fromMe = !!msg.key?.fromMe;
          const conteudoFinal = mediaType ? `[${mediaType}]` : conteudo;
          
          novasMsgs.push({
            atendimento_id: atendimento.id,
            remetente: fromMe ? "vendedor" : "cliente",
            conteudo: conteudoFinal,
            media_url: mediaUrl || null,
            media_type: mediaType || null,
            enviada_por: fromMe ? (atendimento.vendedor_id || null) : null,
            whatsapp_message_id: waMsgId,
          });
        }
        
        // Batch insert (1 query!)
        if (novasMsgs.length > 0) {
          const { error } = await supabase
            .from("atendimento_mensagens")
            .insert(novasMsgs);
          
          if (error) {
            console.error(`[Sync] Insert error:`, error.message);
            erros.push(error.message);
          } else {
            totalInseridas += novasMsgs.length;
          }
          
          // Atualizar preview (1 query!)
          const ultima = novasMsgs[novasMsgs.length - 1];
          await supabase
            .from("atendimentos")
            .update({
              ultima_mensagem: ultima.conteudo,
              ultima_mensagem_data: new Date().toISOString(),
              ultima_mensagem_remetente: ultima.remetente,
              nao_lido: ultima.remetente === "cliente",
            })
            .eq("id", atendimento.id);
        }
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Sync] OK em ${elapsed}ms: ${totalInseridas} inseridas, ${totalIgnoradas} ignoradas`);

    return NextResponse.json({
      success: true,
      inseridas: totalInseridas,
      ignoradas: totalIgnoradas,
      tempo_ms: elapsed,
      erros: erros.length > 0 ? erros.slice(0, 5) : undefined,
    });
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Sync] Erro (${elapsed}ms):`, error.message);
    return NextResponse.json({ error: error.message, tempo_ms: elapsed }, { status: 500 });
  }
}
