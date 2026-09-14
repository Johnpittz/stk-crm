import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/atendimentos/detectar-conta
 * 
 * Simplificado: qualquer imagem/PDF de cliente = sugere criar oportunidade
 * O vendedor decide se é conta ou não
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nome_arquivo, tipo_arquivo } = body;

    // Se tem arquivo (imagem ou PDF), sugerir
    const isArquivo = tipo_arquivo === "image" ||
                      tipo_arquivo === "document" ||
                      tipo_arquivo?.startsWith("image/") || 
                      tipo_arquivo === "application/pdf" || 
                      nome_arquivo?.endsWith(".pdf");

    if (isArquivo) {
      return NextResponse.json({
        detectou: true,
        confianca: 0.7,
        tipo: "arquivo",
        dados_extraidos: {},
        sugestao: "Arquivo recebido — pode ser conta de energia",
        motivos: [`Arquivo: ${nome_arquivo || "desconhecido"}`],
      });
    }

    return NextResponse.json({
      detectou: false,
      confianca: 0,
      tipo: "nenhum",
      dados_extraidos: {},
      sugestao: "Arquivo não detectado",
      motivos: [],
    });
  } catch (error: any) {
    console.error("[detectar-conta] Erro:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao analisar mensagem" },
      { status: 500 }
    );
  }
}
