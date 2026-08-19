/**
 * Rota para enviar mensagem de texto via WhatsApp
 * 
 * Endpoint: POST /api/send/text
 * Body: { number: string, text: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { enviarMensagemWhatsApp } from "@/lib/evolution-api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { number, text } = body;

    if (!number || !text) {
      return NextResponse.json(
        { error: "number e text são obrigatórios" },
        { status: 400 }
      );
    }

    console.log(`[Send Text] Enviando para ${number}: ${text.substring(0, 50)}...`);

    const result = await enviarMensagemWhatsApp({
      telefone: number,
      mensagem: text,
    });

    if (!result.success) {
      console.error("[Send Text] Erro:", result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    console.log("[Send Text] Enviado com sucesso, message_id:", result.message_id);
    return NextResponse.json({
      success: true,
      message_id: result.message_id,
    });
  } catch (error: any) {
    console.error("[Send Text] Erro geral:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao enviar mensagem" },
      { status: 500 }
    );
  }
}
