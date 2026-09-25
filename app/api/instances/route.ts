/**
 * Rota para listar sessões WhatsApp disponíveis no WAHA
 *
 * Endpoint: GET /api/instances
 * Resposta: { instancias: [{ id, name, number, status }] } (contrato legado da UI)
 */

import { NextRequest, NextResponse } from "next/server";
import { listarSessoes } from "@/lib/waha";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sessoes = await listarSessoes();

    const data = sessoes.map((s) => ({
      id: s.id,
      name: s.name,
      number: s.number,
      status: s.status,
    }));

    return NextResponse.json({ instancias: data });
  } catch (error: any) {
    console.error("[Instances] Erro:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao listar instâncias" },
      { status: 500 }
    );
  }
}
