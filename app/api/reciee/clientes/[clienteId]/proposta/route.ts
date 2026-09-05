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
 * Erase ONLY a specific text span's bounding box and draw new text.
 * Uses exact fitz bbox coordinates (x0, y0 top-left, w, h).
 */
function replaceSpan(
  page: any,
  x0: number, y0: number, w: number, h: number,
  newText: string, font: any, fontSize: number, pageHeight: number,
  newTextX?: number
) {
  const pad = 4;
  // White rectangle: only covers the exact text bbox
  page.drawRectangle({
    x: x0 - pad,
    y: pageHeight - y0 - h - pad,
    width: w + pad * 2,
    height: h + pad * 2,
    color: rgb(1, 1, 1),
  });

  // Text baseline: y0 is top of text box, baseline ≈ top + fontSize * 0.22
  const baselineY = pageHeight - y0 - fontSize * 0.22;
  page.drawText(newText, {
    x: newTextX ?? x0,
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
      // "AGROCENTRAL INDÚSTRIA E COMÉRCIO-NUTRIRAÇÃO." x=168 y=151 w=650 h=35
      replaceSpan(p, 168, 151, 650, 35,
        clienteName.toUpperCase() + ".", font, 32, H, 168);
    }

    // ===== PÁGINA 8 (index 7) =====
    if (pages.length > 7) {
      const p = pages[7];
      const H = p.getHeight();

      // --- Proposta nº: x=886 y=77.8 w=247 h=23.4 (size 17) ---
      replaceSpan(p, 886, 77.8, 247, 23.4,
        `Proposta nº: ${propostaNumber}`, bold, 17, H, 886);

      // --- Cliente: x=886 y=106.8 w=199 h=23.4 (size 17) ---
      replaceSpan(p, 886, 106.8, 199, 23.4,
        `Cliente: ${clienteName.toUpperCase()}`, bold, 17, H, 886);

      // --- Valor atual: LABEL at x=887 y=154.9 w=141 h=20.6 + VALUE at x=1180 y=153.9 w=87 h=22 ---
      // Don't erase the label, only erase and replace the VALUE
      replaceSpan(p, 1180, 153.9, 87, 22,
        formatCurrency(valorAtualConta), bold, 16, H, 1180);

      // --- Estimativa: LABEL at x=887 y=183.9 + VALUE at x=1260 y=182.9 w=87 h=22 ---
      replaceSpan(p, 1260, 182.9, 87, 22,
        formatCurrency(totalRecuperacao), bold, 16, H, 1260);

      // --- GFAT: LABEL at x=887 y=212.9 + VALUE at x=1160 y=211.9 w=87 h=22 ---
      replaceSpan(p, 1160, 211.9, 87, 22,
        `${formatCurrency(gfatEstimativa)}*`, bold, 16, H, 1160);
    }

    // ===== PÁGINA 9 (index 8) =====
    if (pages.length > 8) {
      const p = pages[8];
      const H = p.getHeight();

      // RECIEE value: TWO spans to replace:
      //   Size 32: x=467 y=339.3 w=171 h=32
      //   Size 20: x=468 y=341.6 w=109 h=28
      replaceSpan(p, 467, 339.3, 171, 32,
        formatCurrency(totalRecuperacao), bold, 32, H, 467);

      // GFAT value: TWO spans:
      //   Size 32: x=802.7 y=423.3 w=170 h=32
      //   Size 20: x=803 y=425.6 w=109 h=28
      replaceSpan(p, 802.7, 423.3, 170, 32,
        formatCurrency(gfatEstimativa), bold, 32, H, 803);

      // TOTAL GERAL line: x=508.3 y=675.3 w=759 h=32 (size 32)
      const totalBruto = totalRecuperacao + gfatEstimativa;
      const totalLiquido = totalBruto * 0.625;
      replaceSpan(p, 508.3, 675.3, 759, 32,
        `TOTAL BRUTO: ${formatCurrency(totalBruto)} TOTAL LÍQUIDO: ${formatCurrency(totalLiquido)}`,
        font, 22, H, 508.3);
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
