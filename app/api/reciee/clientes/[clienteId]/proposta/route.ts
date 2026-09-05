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
  const pad = (n: number) => String(n).padStart(2, "0");
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${rand}`;
}

/**
 * Erase a region on the page by drawing a white rectangle,
 * then draw new text at the specified position.
 * Uses fitz top-down coordinates (y=0 at top of page).
 */
function erase(
  page: any,
  fitzX: number,
  fitzY: number,
  fitzW: number,
  fitzH: number,
  pageHeight: number
) {
  const pad = 12;
  const rectX = fitzX - pad;
  const rectY = pageHeight - fitzY - fitzH - pad;
  const rectW = fitzW + pad * 3;
  const rectH = fitzH + pad * 2;

  page.drawRectangle({
    x: rectX,
    y: rectY,
    width: rectW,
    height: rectH,
    color: rgb(1, 1, 1),
  });
}

function drawText(
  page: any,
  fitzX: number,
  fitzY: number,
  text: string,
  font: any,
  fontSize: number,
  pageHeight: number,
  color?: [number, number, number]
) {
  const baselineY = pageHeight - fitzY - fontSize * 0.72;
  page.drawText(text, {
    x: fitzX,
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
      return NextResponse.json({ error: "clienteId is required" }, { status: 400 });
    }

    const { data: cliente, error: clienteError } = await supabase
      .from("clientes_reciee")
      .select("*")
      .eq("id", clienteId)
      .single();

    if (clienteError || !cliente) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const { data: faturas } = await supabase
      .from("faturas_reciee")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("competencia", { ascending: true });

    const { data: analises } = await supabase
      .from("analises_reciee")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: true });

    const totalRecuperacao = (analises || []).reduce((s: number, a: any) => s + (a.valor_estimado || 0), 0);
    const valorAtualConta = (faturas || []).reduce((s: number, f: any) => s + (f.valor_total || 0), 0) / Math.max((faturas || []).length, 1);
    const gfatEstimativa = valorAtualConta * 0.03 * 36;
    const propostaNumber = generatePropostaNumber();
    const clienteName = cliente.nome || "CLIENTE";

    const templatePath = path.join(process.cwd(), "public", "templates", "proposta_template.pdf");
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: "Template de proposta não encontrado" }, { status: 500 });
    }

    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);

    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pages = pdfDoc.getPages();

    // ===== PÁGINA 2 (index 1): Carta de apresentação =====
    if (pages.length > 1) {
      const page2 = pages[1];
      const ph = page2.getHeight();

      // fitz: "AGROCENTRAL INDÚSTRIA E COMÉRCIO-NUTRIRAÇÃO." at x=168, y=151, w=~600, h=35
      erase(page2, 168, 151, 650, 35, ph);
      drawText(page2, 168, 151, clienteName.toUpperCase() + ".", helveticaFont, 32, ph, [0.1, 0.1, 0.1]);
    }

    // ===== PÁGINA 8 (index 7): Proposta RECIEE =====
    if (pages.length > 7) {
      const page8 = pages[7];
      const ph = page8.getHeight();

      // Erase ALL fields first, then draw all text
      // Proposta nº: fitz x=886, y=78, w=350, h=23
      erase(page8, 886, 78, 350, 23, ph);
      // Cliente: fitz x=886, y=107, w=500, h=23
      erase(page8, 886, 107, 500, 23, ph);
      // Valor atual da Conta (label + value): fitz x=887, y=155, w=550, h=21
      erase(page8, 887, 155, 550, 21, ph);
      // Estimativa RECIEE (label + value): fitz x=887, y=184, w=550, h=21
      erase(page8, 887, 184, 550, 21, ph);
      // Ajuste GFAT (label + value): fitz x=887, y=213, w=550, h=21
      erase(page8, 887, 213, 550, 21, ph);

      // Now draw all text
      drawText(page8, 886, 78, `Proposta nº: ${propostaNumber}`, helveticaBold, 17, ph);
      drawText(page8, 886, 107, `Cliente: ${clienteName.toUpperCase()}`, helveticaBold, 17, ph);

      // Valor: label at x=887, value at x=~1180
      drawText(page8, 887, 155, "Valor atual da Conta:", helveticaFont, 15, ph);
      drawText(page8, 1180, 155, formatCurrency(valorAtualConta), helveticaBold, 16, ph);

      // Estimativa: label at x=887, value at x=~1260
      drawText(page8, 887, 184, "Estimativa de recuperação (RECIEE):", helveticaFont, 15, ph);
      drawText(page8, 1260, 184, formatCurrency(totalRecuperacao), helveticaBold, 16, ph);

      // GFAT: label at x=887, value at x=~1160
      drawText(page8, 887, 213, "Ajuste contratual (GFAT):", helveticaFont, 15, ph);
      drawText(page8, 1160, 213, `${formatCurrency(gfatEstimativa)}*`, helveticaBold, 16, ph);
    }

    // ===== PÁGINA 9 (index 8): Estimativas financeiras =====
    if (pages.length > 8) {
      const page9 = pages[8];
      const ph = page9.getHeight();

      // Erase first
      erase(page9, 468, 342, 250, 20, ph);
      erase(page9, 803, 426, 250, 20, ph);

      const totalBruto = totalRecuperacao + gfatEstimativa;
      const totalLiquido = totalBruto * 0.625;
      erase(page9, 508, 675, 800, 35, ph);

      // Then draw
      drawText(page9, 468, 342, formatCurrency(totalRecuperacao), helveticaBold, 20, ph);
      drawText(page9, 803, 426, formatCurrency(gfatEstimativa), helveticaBold, 20, ph);
      drawText(page9, 508, 675, `TOTAL BRUTO: ${formatCurrency(totalBruto)} TOTAL LÍQUIDO: ${formatCurrency(totalLiquido)}`, helveticaFont, 20, ph);
    }

    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);

    const fileName = `PROPOSTA_RECIEE_${(cliente.nome || "cliente")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toUpperCase()}_${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15)}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Erro ao gerar proposta:", error);
    return NextResponse.json({ error: "Erro interno ao gerar proposta" }, { status: 500 });
  }
}
