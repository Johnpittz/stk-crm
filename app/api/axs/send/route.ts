import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VPS_AXS_URL = "http://2.25.192.248:8080/axs-api";

/**
 * POST /api/axs/send
 * Envia dados do cliente para o VPS executar Playwright
 * Body: { cliente_id, dados_proposta }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { cliente_id, dados_proposta } = body;

  if (!cliente_id || !dados_proposta) {
    return NextResponse.json(
      { error: "cliente_id e dados_proposta são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    // Chamar VPS AXS API para executar Playwright
    const res = await fetch(`${VPS_AXS_URL}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados_proposta),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[AXS Send] VPS error:", err);
      return NextResponse.json(
        { error: "Erro ao comunicar com VPS" },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      success: true,
      job_id: data.job_id,
      message: "Proposta sendo processada via Playwright",
    });
  } catch (err: any) {
    console.error("[AXS Send] Erro:", err);
    return NextResponse.json(
      { error: "Erro ao enviar proposta AXS" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/axs/send?job_id=xxx
 * Verifica status de uma job em andamento
 */
export async function GET(request: NextRequest) {
  const job_id = request.nextUrl.searchParams.get("job_id");

  if (!job_id) {
    return NextResponse.json(
      { error: "job_id é obrigatório" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${VPS_AXS_URL}/status/${job_id}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Job não encontrada" },
        { status: 404 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Erro ao verificar status" },
      { status: 500 }
    );
  }
}
