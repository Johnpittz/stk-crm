import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: { clienteId: string } }
) {
  try {
    const { clienteId } = params;

    if (!clienteId) {
      return NextResponse.json(
        { error: "clienteId is required" },
        { status: 400 }
      );
    }

    // Placeholder — generate PDF proposal here
    return NextResponse.json(
      { error: "Geração de proposta ainda não implementada" },
      { status: 501 }
    );
  } catch (error) {
    console.error("Erro ao gerar proposta:", error);
    return NextResponse.json(
      { error: "Erro interno ao gerar proposta" },
      { status: 500 }
    );
  }
}
