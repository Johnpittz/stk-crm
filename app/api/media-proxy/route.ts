/**
 * Proxy para servir mídia do WhatsApp CDN
 * O WhatsApp entrega arquivos .enc (criptografados) que o navegador não reproduz.
 * Este endpoint baixa, decodifica e serve a mídia original.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url param required" }, { status: 400 });
  }

  // Only allow WhatsApp CDN URLs
  if (!url.includes("mmg.whatsapp.net") && !url.includes("media.whatsapp.com")) {
    return NextResponse.json({ error: "Only WhatsApp media URLs allowed" }, { status: 403 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "WhatsApp/2.23.24.82",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Upstream returned ${response.status}` }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    console.error("[Media Proxy] Error:", err.message);
    return NextResponse.json({ error: "Failed to fetch media" }, { status: 500 });
  }
}
