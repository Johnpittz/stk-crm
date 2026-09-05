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

    // Placeholder — generate Excel report here
    // Return a minimal XLSX-like response so the UI download flow works
    return NextResponse.json(
      { error: "Geração de relatório ainda não implementada" },
      { status: 501 }
    );
  } catch (error) {
    console.error("Erro ao gerar relatório:", error);
    return NextResponse.json(
      { error: "Erro interno ao gerar relatório" },
      { status: 500 }
    );
  }
}
