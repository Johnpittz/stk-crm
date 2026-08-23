/**
 * Rota para enviar mídia via WhatsApp
 * 
 * Endpoint: POST /api/send/media
 * Body: { number, mediatype, mimetype, media (base64), fileName?, instance? }
 */

import { NextRequest, NextResponse } from "next/server";
import { enviarMidiaWhatsApp, enviarAudioWhatsApp } from "@/lib/evolution-api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { number, mediatype, mimetype, media, fileName, instance } = body;

    if (!number || !media) {
      return NextResponse.json(
        { error: "number e media são obrigatórios" },
        { status: 400 }
      );
    }

    console.log(`[Send Media] Enviando ${mediatype || 'image'} para ${number} via ${instance || 'padrão'}`);

    // Se for áudio, usar endpoint especial de áudio (ptt)
    if (mediatype === 'audio') {
      const result = await enviarAudioWhatsApp({
        telefone: number,
        audio: media,
        instance,
      });

      if (!result.success) {
        console.error("[Send Media] Erro áudio:", result.error);
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      console.log("[Send Media] Áudio enviado com sucesso");
      return NextResponse.json({
        success: true,
        message_id: result.message_id,
      });
    }

    // Para outros tipos de mídia
    const result = await enviarMidiaWhatsApp({
      telefone: number,
      mediatype: mediatype || 'image',
      mimetype: mimetype || 'image/jpeg',
      media,
      fileName,
      instance,
    });

    if (!result.success) {
      console.error("[Send Media] Erro:", result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log("[Send Media] Enviado com sucesso");
    return NextResponse.json({
      success: true,
      message_id: result.message_id,
    });
  } catch (error: any) {
    console.error("[Send Media] Erro geral:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao enviar mídia" },
      { status: 500 }
    );
  }
}
