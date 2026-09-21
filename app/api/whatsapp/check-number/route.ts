/**
 * Rota para verificar se números existem no WhatsApp
 * 
 * Endpoint: POST /api/whatsapp/check-number
 * Body: { numbers: string[], instance?: string }
 * 
 * Retorna para cada número se existe ou não no WhatsApp
 */

import { NextRequest, NextResponse } from "next/server";
import { checkWhatsAppNumbers } from "@/lib/evolution-api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { numbers, instance } = body;

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return NextResponse.json(
        { error: "Campo 'numbers' é obrigatório e deve ser um array" },
        { status: 400 }
      );
    }

    // Limitar a 20 números por requisição
    if (numbers.length > 20) {
      return NextResponse.json(
        { error: "Máximo de 20 números por requisição" },
        { status: 400 }
      );
    }

    console.log(`[Check Numbers] Verificando ${numbers.length} números...`);

    const result = await checkWhatsAppNumbers({ numbers, instance });

    if (!result.success) {
      console.error("[Check Numbers] Erro:", result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    console.log(`[Check Numbers] Resultado:`, result.results.map(r => 
      `${r.number}: ${r.exists ? '✅' : '❌'}`
    ).join(', '));

    return NextResponse.json({
      success: true,
      results: result.results,
    });
  } catch (error: any) {
    console.error("[Check Numbers] Erro geral:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao verificar números" },
      { status: 500 }
    );
  }
}
