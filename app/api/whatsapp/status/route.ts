/**
 * Rota para verificar status da conexão WhatsApp (WAHA)
 *
 * Endpoint: GET /api/whatsapp/status[?instance=STK-1]
 * Resposta: { connected: boolean, state: string } (contrato legado da UI/header)
 */

import { NextRequest, NextResponse } from "next/server";
import { listarSessoes, getWahaConfig } from "@/lib/waha";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sessaoAlvo =
      request.nextUrl.searchParams.get("instance") || getWahaConfig().session;

    const sessoes = await listarSessoes();
    const sessao = sessoes.find((s) => s.name === sessaoAlvo) || sessoes[0];

    return NextResponse.json({
      connected: sessao?.status === "open",
      state: sessao?.state || "unknown",
      session: sessao?.name || sessaoAlvo,
    });
  } catch (error: any) {
    return NextResponse.json(
      { connected: false, state: "error", error: error.message },
      { status: 500 }
    );
  }
}
