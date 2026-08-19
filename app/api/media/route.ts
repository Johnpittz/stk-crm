/**
 * Proxy de mídia para servir arquivos do WhatsApp/Evolution API
 * 
 * Endpoint: GET /api/media?url=xxx&type=image
 * 
 * Resolve problemas de Mixed Content (HTTPS→HTTP) e
 * detecta o Content-Type correto via magic bytes
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const type = request.nextUrl.searchParams.get("type") || "image";

  if (!url) {
    return NextResponse.json({ error: "URL parameter required" }, { status: 400 });
  }

  try {
    // Buscar o conteúdo da mídia
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      console.error("[Media Proxy] Failed to fetch:", response.status, url);
      return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 });
    }

    const buffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(buffer.slice(0, 16));

    // Detectar Content-Type via magic bytes
    let contentType = "application/octet-stream";

    // JPEG: FF D8 FF
    if (uint8[0] === 0xff && uint8[1] === 0xd8 && uint8[2] === 0xff) {
      contentType = "image/jpeg";
    }
    // PNG: 89 50 4E 47
    else if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4e && uint8[3] === 0x47) {
      contentType = "image/png";
    }
    // WebP: 52 49 46 46 ... 57 45 42 50
    else if (uint8[0] === 0x52 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x46 &&
             uint8[8] === 0x57 && uint8[9] === 0x45 && uint8[10] === 0x42 && uint8[11] === 0x50) {
      contentType = "image/webp";
    }
    // GIF: 47 49 46 38
    else if (uint8[0] === 0x47 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x38) {
      contentType = "image/gif";
    }
    // MP4: ... 66 74 79 70
    else if (uint8[4] === 0x66 && uint8[5] === 0x74 && uint8[6] === 0x79 && uint8[7] === 0x70) {
      contentType = "video/mp4";
    }
    // OGG/Opus: 4F 67 67 53
    else if (uint8[0] === 0x4f && uint8[1] === 0x67 && uint8[2] === 0x67 && uint8[3] === 0x53) {
      contentType = "audio/ogg";
    }
    // MP3: FF FB ou FF F3 ou 49 44 33
    else if ((uint8[0] === 0xff && (uint8[1] === 0xfb || uint8[1] === 0xf3)) ||
             (uint8[0] === 0x49 && uint8[1] === 0x44 && uint8[2] === 0x33)) {
      contentType = "audio/mpeg";
    }
    // PDF: 25 50 44 46
    else if (uint8[0] === 0x25 && uint8[1] === 0x50 && uint8[2] === 0x44 && uint8[3] === 0x46) {
      contentType = "application/pdf";
    }
    // ZIP/DOCX: 50 4B 03 04
    else if (uint8[0] === 0x50 && uint8[1] === 0x4b && uint8[2] === 0x03 && uint8[3] === 0x04) {
      contentType = "application/zip";
    }
    // Fallback baseado no type parameter
    else {
      const typeMap: Record<string, string> = {
        image: "image/jpeg",
        audio: "audio/ogg",
        video: "video/mp4",
        document: "application/octet-stream",
        sticker: "image/webp",
      };
      contentType = typeMap[type] || "application/octet-stream";
    }

    // Retornar com headers adequados
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    console.error("[Media Proxy] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch media", details: error.message },
      { status: 500 }
    );
  }
}
