import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function generatePropostaNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `${y}${m}${d}${h}${min}${s}${rand}`;
}

/**
 * Covers old text with a white rectangle and draws new text.
 * fitzY = top-down Y from fitz (y=0 at top of page)
 * fitzHeight = height of the text bounding box
 * pdfLibY = bottom-up Y for pdf-lib (y=0 at bottom of page)
 */
function coverAndDraw(
  page: any,
  x: number,
  fitzY: number,
  fitzH: number,
  text: string,
  font: any,
  fontSize: number,
  pageHeight: number,
  textX?: number,
  color?: [number, number, number]
) {
  const pad = 6;
  // Convert fitz top-down coords to pdf-lib bottom-up coords
  const rectBottom = pageHeight - fitzY - fitzH - pad;
  const rectTop = pageHeight - fitzY + pad;

  // White rectangle to cover old text
  page.drawRectangle({
    x: x - 2,
    y: rectBottom,
    width: 600,
    height: rectTop - rectBottom,
    color: rgb(1, 1, 1),
  });

  // New text baseline: fitzY is top of text, baseline is ~80% down
  const baselineY = pageHeight - fitzY - fontSize * 0.75;
  page.drawText(text, {
    x: textX ?? x,
    y: baselineY,
    size: fontSize,
    font,
    color: color ? rgb(...color) : rgb(0, 0, 0),
  });
}

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

    // Buscar cliente
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes_reciee")
      .select("*")
      .eq("id", clienteId)
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json(
        { error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    // Buscar faturas
    const { data: faturas } = await supabase
      .from("faturas_reciee")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("competencia", { ascending: true });

    // Buscar análises
    const { data: analises } = await supabase
      .from("analises_reciee")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: true });

    // Calcular valores
    const totalRecuperacao = (analises || []).reduce(
      (s: number, a: any) => s + (a.valor_estimado || 0),
      0
    );
    const valorAtualConta =
      (faturas || []).reduce(
        (s: number, f: any) => s + (f.valor_total || 0),
        0
      ) / Math.max((faturas || []).length, 1);

    // GFAT: estimativa de 3% de economia mensal * 36 meses
    const gfatEstimativa = valorAtualConta * 0.03 * 36;

    const propostaNumber = generatePropostaNumber();
    const clienteName = cliente.nome || "CLIENTE";

    // Carregar template
    const templatePath = path.join(
      process.cwd(),
      "public",
      "templates",
      "proposta_template.pdf"
    );

    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { error: "Template de proposta não encontrado" },
        { status: 500 }
      );
    }

    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);

    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pages = pdfDoc.getPages();

    // ===== PÁGINA 2 (index 1): Carta de apresentação =====
    if (pages.length > 1) {
      const page2 = pages[1];
      const ph = page2.getHeight();

      // fitz: x=168, y=151, h=35, text="AGROCENTRAL INDÚSTRIA E COMÉRCIO-NUTRIRAÇÃO."
      coverAndDraw(
        page2, 168, 151, 35,
        clienteName.toUpperCase() + ".",
        helveticaFont, 32, ph,
        168, [0.1, 0.1, 0.1]
      );
    }

    // ===== PÁGINA 8 (index 7): Proposta RECIEE =====
    if (pages.length > 7) {
      const page8 = pages[7];
      const ph = page8.getHeight();

      // Proposta nº - fitz: x=886, y=78, h=23
      coverAndDraw(
        page8, 886, 78, 23,
        `Proposta nº: ${propostaNumber}`,
        helveticaBold, 17, ph,
        886
      );

      // Cliente - fitz: x=886, y=107, h=23
      coverAndDraw(
        page8, 886, 107, 23,
        `Cliente: ${clienteName.toUpperCase()}`,
        helveticaBold, 17, ph,
        886
      );

      // Valor atual da Conta label - fitz: x=887, y=155, h=21
      coverAndDraw(
        page8, 887, 155, 21,
        "Valor atual da Conta:",
        helveticaFont, 15, ph,
        887
      );
      // Valor atual da Conta value - fitz: x=1180, y=154, h=16
      const valorContaStr = formatCurrency(valorAtualConta);
      coverAndDraw(
        page8, 1180, 154, 16,
        valorContaStr,
        helveticaBold, 16, ph,
        1180
      );

      // Estimativa RECIEE label - fitz: x=887, y=184, h=21
      coverAndDraw(
        page8, 887, 184, 21,
        "Estimativa de recuperação (RECIEE):",
        helveticaFont, 15, ph,
        887
      );
      // Estimativa RECIEE value - fitz: x=1260, y=183, h=16
      const recupStr = formatCurrency(totalRecuperacao);
      coverAndDraw(
        page8, 1260, 183, 16,
        recupStr,
        helveticaBold, 16, ph,
        1260
      );

      // Ajuste GFAT label - fitz: x=887, y=213, h=21
      coverAndDraw(
        page8, 887, 213, 21,
        "Ajuste contratual (GFAT):",
        helveticaFont, 15, ph,
        887
      );
      // Ajuste GFAT value - fitz: x=1160, y=212, h=16
      const gfatStr = formatCurrency(gfatEstimativa);
      coverAndDraw(
        page8, 1160, 212, 16,
        `${gfatStr}*`,
        helveticaBold, 16, ph,
        1160
      );
    }

    // ===== PÁGINA 9 (index 8): Estimativas financeiras =====
    if (pages.length > 8) {
      const page9 = pages[8];
      const ph = page9.getHeight();

      // RECIEE value - fitz: x=468, y=342, h=16
      const recieeStr = formatCurrency(totalRecuperacao);
      coverAndDraw(
        page9, 468, 342, 16,
        recieeStr,
        helveticaBold, 20, ph,
        468
      );

      // GFAT value - fitz: x=803, y=426, h=16
      const gfatTableStr = formatCurrency(gfatEstimativa);
      coverAndDraw(
        page9, 803, 426, 16,
        gfatTableStr,
        helveticaBold, 20, ph,
        803
      );

      // TOTAL GERAL - fitz: x=508, y=675, h=32
      const totalBruto = totalRecuperacao + gfatEstimativa;
      const totalLiquido = totalBruto * 0.625;
      coverAndDraw(
        page9, 508, 675, 32,
        `TOTAL BRUTO: ${formatCurrency(totalBruto)} TOTAL LÍQUIDO: ${formatCurrency(totalLiquido)}`,
        helveticaFont, 20, ph,
        508
      );
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);

    const fileName = `PROPOSTA_RECIEE_${(cliente.nome || "cliente")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toUpperCase()}_${new Date()
      .toISOString()
      .replace(/[-:T]/g, "")
      .slice(0, 15)}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Erro ao gerar proposta:", error);
    return NextResponse.json(
      { error: "Erro interno ao gerar proposta" },
      { status: 500 }
    );
  }
}
