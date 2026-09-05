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

    // Placeholder — trigger re-analysis logic here
    // For now, return success so the UI can proceed
    return NextResponse.json({
      success: true,
      message: `Re-análise iniciada para cliente ${clienteId}`,
    });
  } catch (error) {
    console.error("Erro na re-análise:", error);
    return NextResponse.json(
      { error: "Erro interno ao re-analisar" },
      { status: 500 }
    );
  }
}
