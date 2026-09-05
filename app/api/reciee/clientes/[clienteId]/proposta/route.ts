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
 * Replace text at exact fitz coordinates.
 * fitzX, fitzY = top-left of text bbox (fitz coords, y=0 at top)
 * fitzW, fitzH = text bbox dimensions
 * New text is drawn at the SAME position as the old text.
 */
function replaceText(
  page: any,
  fitzX: number, fitzY: number, fitzW: number, fitzH: number,
  newText: string, font: any, fontSize: number, pageHeight: number,
  newTextX?: number
) {
  const pad = 3;
  // White rectangle covering exact bbox
  page.drawRectangle({
    x: fitzX - pad,
    y: pageHeight - fitzY - fitzH - pad,
    width: fitzW + pad * 2,
    height: fitzH + pad * 2,
    color: rgb(1, 1, 1),
  });

  // Baseline calculation for Helvetica:
  // fitzH ≈ fontSize * 1.375 (bbox height ratio)
  // Cap height ≈ fontSize * 0.714
  // Baseline offset from top = fitzH - capHeight = fontSize * (1.375 - 0.714) = fontSize * 0.661
  const baselineY = pageHeight - fitzY - fontSize * 0.661;
  page.drawText(newText, {
    x: newTextX ?? fitzX,
    y: baselineY,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
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
      .from("clientes_reciee").select("*").eq("id", clienteId).single();
    if (clienteError || !cliente) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    }

    const { data: faturas } = await supabase
      .from("faturas_reciee").select("*").eq("cliente_id", clienteId)
      .order("competencia", { ascending: true });

    const { data: analises } = await supabase
      .from("analises_reciee").select("*").eq("cliente_id", clienteId)
      .order("created_at", { ascending: true });

    const totalRecuperacao = (analises || []).reduce((s: number, a: any) => s + (a.valor_estimado || 0), 0);
    const valorAtualConta = (faturas || []).length > 0
      ? (faturas || []).reduce((s: number, f: any) => s + (f.valor_total || 0), 0) / (faturas || []).length
      : 0;
    const gfatEstimativa = valorAtualConta * 0.03 * 36;
    const propostaNumber = generatePropostaNumber();
    const clienteName = cliente.nome || "CLIENTE";

    const templatePath = path.join(process.cwd(), "public", "templates", "proposta_template.pdf");
    if (!fs.existsSync(templatePath)) {
      return NextResponse.json({ error: "Template não encontrado" }, { status: 500 });
    }

    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    // ===== PÁGINA 2 (index 1) =====
    if (pages.length > 1) {
      const p = pages[1];
      const H = p.getHeight();
      // fitz bbox: x=168, y=151, w=650, h=35 (size=32)
      replaceText(p, 168, 151, 650, 35,
        clienteName.toUpperCase() + ".", font, 32, H, 168);
    }

    // ===== PÁGINA 8 (index 7) =====
    if (pages.length > 7) {
      const p = pages[7];
      const H = p.getHeight();

      // Proposta nº: fitz bbox x=886, y=77.8, w=247, h=23.4 (size=17)
      replaceText(p, 886, 77.8, 247, 23.4,
        `Proposta nº: ${propostaNumber}`, bold, 17, H, 886);

      // Cliente: fitz bbox x=886, y=106.8, w=199, h=23.4 (size=17)
      replaceText(p, 886, 106.8, 199, 23.4,
        `Cliente: ${clienteName.toUpperCase()}`, bold, 17, H, 886);

      // Valor value ONLY: fitz bbox x=1180, y=153.9, w=87, h=22 (size=16)
      replaceText(p, 1180, 153.9, 87, 22,
        formatCurrency(valorAtualConta), bold, 16, H, 1180);

      // Estimativa value ONLY: fitz bbox x=1260, y=182.9, w=87, h=22 (size=16)
      replaceText(p, 1260, 182.9, 87, 22,
        formatCurrency(totalRecuperacao), bold, 16, H, 1260);

      // GFAT value ONLY: fitz bbox x=1160, y=211.9, w=87, h=22 (size=16)
      replaceText(p, 1160, 211.9, 87, 22,
        `${formatCurrency(gfatEstimativa)}*`, bold, 16, H, 1160);
    }

    // ===== PÁGINA 9 (index 8) =====
    if (pages.length > 8) {
      const p = pages[8];
      const H = p.getHeight();

      // RECIEE value: fitz bbox x=468, y=341.6, w=109, h=28 (size=20)
      replaceText(p, 468, 341.6, 109, 28,
        formatCurrency(totalRecuperacao), bold, 20, H, 468);

      // GFAT value: fitz bbox x=803, y=425.6, w=109, h=28 (size=20)
      replaceText(p, 803, 425.6, 109, 28,
        formatCurrency(gfatEstimativa), bold, 20, H, 803);

      // TOTAL BRUTO/LÍQUIDO: fitz bbox x=508, y=677.5, w=670, h=28 (size=20)
      const totalBruto = totalRecuperacao + gfatEstimativa;
      const totalLiquido = totalBruto * 0.625;
      replaceText(p, 508, 677.5, 670, 28,
        `TOTAL BRUTO: ${formatCurrency(totalBruto)} TOTAL LÍQUIDO: ${formatCurrency(totalLiquido)}`,
        font, 20, H, 508);
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
