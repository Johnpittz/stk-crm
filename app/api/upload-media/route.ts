/**
 * API para upload de mídia (imagens) para Supabase Storage
 * 
 * POST /api/upload-media
 * Body: { base64: string, mimetype: string, prefix: string }
 * Returns: { url: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { uploadMediaToStorage } from "@/lib/media-storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { base64, mimetype, prefix } = body;

    if (!base64 || !mimetype) {
      return NextResponse.json(
        { error: "base64 e mimetype são obrigatórios" },
        { status: 400 }
      );
    }

    // Remove prefixo data:...;base64, se houver
    const base64Clean = base64.replace(/^data:[^;]+;base64,/, "");

    const url = await uploadMediaToStorage(base64Clean, mimetype, prefix || "media");

    if (!url) {
      return NextResponse.json(
        { error: "Falha ao fazer upload da mídia" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error("[Upload Media] Erro:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
