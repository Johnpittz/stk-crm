/**
 * Download de mídia do WhatsApp
 * 
 * Usa a Evolution API para descriptografar mídia (.enc)
 * e servir o arquivo original (ogg, jpeg, etc)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://2.25.192.248:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

// Map media_type to Evolution API messageType
const TYPE_MAP: Record<string, string> = {
  audio: "audioMessage",
  image: "imageMessage",
  video: "videoMessage",
  document: "documentMessage",
  sticker: "stickerMessage",
};

const MIME_MAP: Record<string, string> = {
  audio: "audio/ogg; codecs=opus",
  image: "image/jpeg",
  video: "video/mp4",
  document: "application/octet-stream",
  sticker: "image/webp",
};

// Nome do objeto na URL (fallback quando a mensagem não tem file_name)
function ultimoSegmento(url: string): string {
  try {
    const parte = url.split("?")[0];
    const seg = parte.substring(parte.lastIndexOf("/") + 1);
    return decodeURIComponent(seg || "arquivo");
  } catch {
    return "arquivo";
  }
}

// Content-Disposition seguro: ASCII limpo vai em filename="…";
// nome com acento/espaço exótico vai em filename*=UTF-8''…
function headerNome(nome: string): string {
  const limpo = nome.replace(/[\r\n"]/g, "_").trim() || "arquivo";
  if (/^[\x20-\x7E]+$/.test(limpo)) return `filename="${limpo}"`;
  return `filename*=UTF-8''${encodeURIComponent(limpo)}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const msgId = searchParams.get("msg_id");
  const mediaType = searchParams.get("type") || "audio";
  
  if (!msgId) {
    return NextResponse.json({ error: "msg_id required" }, { status: 400 });
  }
  
  if (!EVOLUTION_API_KEY) {
    return NextResponse.json({ error: "EVOLUTION_API_KEY not configured" }, { status: 500 });
  }
  
  try {
    const supabase = getSupabase();
    
    // Fetch message from DB
    const { data: msg, error } = await supabase
      .from("atendimento_mensagens")
      .select("media_url, media_type, file_name, whatsapp_message_id")
      .eq("id", msgId)
      .single();
    
    if (error || !msg) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    
    if (!msg.media_url) {
      return NextResponse.json({ error: "No media URL" }, { status: 404 });
    }
    
    // Arquivo já no Supabase Storage: SERVE o binário com o nome original.
    // (Redirecionar fazia o navegador baixar com o nome do objeto —
    // "1790391732596-r7mxiu.bin" — perdendo extensão e nome do arquivo.)
    if (!msg.media_url.includes("mmg.whatsapp.net") && !msg.media_url.includes("media.whatsapp.com")) {
      const resp = await fetch(msg.media_url);
      if (!resp.ok) {
        return NextResponse.json({ error: `Falha ao baixar arquivo (${resp.status})` }, { status: 502 });
      }
      const buf = await resp.arrayBuffer();
      const nome = msg.file_name || ultimoSegmento(msg.media_url);
      // Documento = download (attachment); áudio/imagem = inline (player do chat)
      const disposition = mediaType === "document" ? "attachment" : "inline";
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": MIME_MAP[mediaType] || "application/octet-stream",
          "Content-Disposition": `${disposition}; ${headerNome(nome)}`,
          "Cache-Control": "private, max-age=3600",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    
    // For WhatsApp CDN URLs, use Evolution API to decrypt
    // First, find the message in Evolution API by whatsapp_message_id
    const instances = ["STK-1", "STK-2", "STK-3"];
    const messageType = TYPE_MAP[mediaType] || "audioMessage";
    
    for (const instance of instances) {
      try {
        const evoRes = await fetch(`${EVOLUTION_API_URL}/chat/findMessages/${instance}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
          body: JSON.stringify({
            where: { key: { id: msg.whatsapp_message_id } },
            limit: 1,
            page: 1,
          }),
        });
        
        if (!evoRes.ok) continue;
        
        const data = await evoRes.json();
        const records = data?.messages?.records || [];
        
        if (records.length === 0) continue;
        
        const record = records[0];
        
        // Use getBase64FromMediaMessage to decrypt
        const decryptRes = await fetch(`${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${instance}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
          body: JSON.stringify({ message: record }),
        });
        
        if (!decryptRes.ok) continue;
        
        const decrypted = await decryptRes.json();
        
        if (decrypted.base64) {
          const buffer = Buffer.from(decrypted.base64, "base64");
          const mime = decrypted.mimetype || MIME_MAP[mediaType] || "application/octet-stream";
          
          console.log(`[MediaDownload] Decrypted via ${instance}: ${buffer.length}B (${mime})`);
          
          return new NextResponse(new Uint8Array(buffer), {
            headers: {
              "Content-Type": mime,
              "Cache-Control": "public, max-age=86400",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      } catch (err: any) {
        console.error(`[MediaDownload] ${instance} error:`, err.message);
        continue;
      }
    }
    
    // Fallback: try to serve the URL directly (might be unencrypted)
    const fallbackRes = await fetch(msg.media_url);
    if (fallbackRes.ok) {
      const buf = await fallbackRes.arrayBuffer();
      const mime = MIME_MAP[mediaType] || "application/octet-stream";
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }
    
    return NextResponse.json({ error: "Failed to decrypt media" }, { status: 500 });
    
  } catch (err: any) {
    console.error("[MediaDownload] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
