/**
 * Rota para listar instâncias disponíveis no Evolution API
 * 
 * Endpoint: GET /api/instances
 */

import { NextRequest, NextResponse } from "next/server";
import { listarInstancias } from "@/lib/evolution-api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const instancias = await listarInstancias();
    
    // Retornar apenas dados relevantes
    const data = instancias.map(inst => ({
      id: inst.id,
      name: inst.name,
      number: inst.number,
      status: inst.connectionStatus,
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
