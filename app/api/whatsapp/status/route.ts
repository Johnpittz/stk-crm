/**
 * Rota para verificar status da conexão WhatsApp
 * 
 * Endpoint: GET /api/whatsapp/status
 */

import { NextRequest, NextResponse } from "next/server";
import { verificarStatusInstancia } from "@/lib/evolution-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const status = await verificarStatusInstancia();
    return NextResponse.json(status);
  } catch (error: any) {
    return NextResponse.json(
      { connected: false, state: "error", error: error.message },
      { status: 500 }
    );
  }
}
