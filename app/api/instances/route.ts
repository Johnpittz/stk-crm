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
    // Retry até 3 vezes para garantir que todas as instâncias apareçam
    let instancias: any[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      instancias = await listarInstancias();
      if (instancias.length >= 2) break;
      // Wait 1s before retry
      await new Promise(r => setTimeout(r, 1000));
    }
    
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
