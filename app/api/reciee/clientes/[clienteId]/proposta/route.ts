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
 * Erase a fitz-coordinate region with a white rectangle, then draw text.
 * Uses the exact fitz bbox coordinates for precise replacement.
 */
function eraseAndDraw(
  page: any,
  fitzX: number, fitzY: number, fitzW: number, fitzH: number,
  text: string, font: any, fontSize: number, pageHeight: number,
  opts?: { textX?: number; color?: [number, number, number] }
) {
  const pad = 8;
  // White rectangle covering the old text area
  page.drawRectangle({
    x: fitzX - pad,
    y: pageHeight - fitzY - fitzH - pad,
    width: fitzW + pad * 3,
    height: fitzH + pad * 2,
    color: rgb(1, 1, 1),
  });

  // New text: baseline = pageHeight - fitzY - fontSize * capHeightRatio
  // capHeightRatio ≈ 0.28 for Helvetica (cap height is ~72% of font size)
  const baselineY = pageHeight - fitzY - fontSize * 0.28;
  page.drawText(text, {
    x: opts?.textX ?? fitzX,
    y: baselineY,
    size: fontSize,
    font,
    color: opts?.color ? rgb(...opts.color) : rgb(0, 0, 0),
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

    // ===== PÁGINA 2 (index 1): Carta de apresentação =====
    if (pages.length > 1) {
      const p = pages[1];
      const H = p.getHeight();
      // fitz: "AGROCENTRAL INDÚSTRIA E COMÉRCIO-NUTRIRAÇÃO." x=168 y=151 w=650 h=35
      eraseAndDraw(p, 168, 151, 650, 35,
        clienteName.toUpperCase() + ".", font, 32, H,
        { textX: 168, color: [0.1, 0.1, 0.1] });
    }

    // ===== PÁGINA 8 (index 7): Proposta RECIEE =====
    if (pages.length > 7) {
      const p = pages[7];
      const H = p.getHeight();

      // Proposta nº: fitz x=886 y=77.8 w=247 h=23.4
      eraseAndDraw(p, 886, 77.8, 350, 24,
        `Proposta nº: ${propostaNumber}`, bold, 17, H, { textX: 886 });

      // Cliente: fitz x=886 y=106.8 w=500 h=23.4
      eraseAndDraw(p, 886, 106.8, 500, 24,
        `Cliente: ${clienteName.toUpperCase()}`, bold, 17, H, { textX: 886 });

      // Valor label: fitz x=887 y=154.9 w=141 h=20.6
      eraseAndDraw(p, 887, 154.9, 141, 21,
        "Valor atual da Conta:", font, 15, H, { textX: 887 });
      // Valor value: fitz x=1180 y=153.9 w=87 h=22
      eraseAndDraw(p, 1180, 153.9, 120, 22,
        formatCurrency(valorAtualConta), bold, 16, H, { textX: 1180 });

      // Estimativa label: fitz x=887 y=183.9 w=252 h=20.6
      eraseAndDraw(p, 887, 183.9, 252, 21,
        "Estimativa de recuperação (RECIEE):", font, 15, H, { textX: 887 });
      // Estimativa value: fitz x=1260 y=182.9 w=87 h=22
      eraseAndDraw(p, 1260, 182.9, 120, 22,
        formatCurrency(totalRecuperacao), bold, 16, H, { textX: 1260 });

      // GFAT label: fitz x=887 y=212.9 w=170 h=20.6
      eraseAndDraw(p, 887, 212.9, 170, 21,
        "Ajuste contratual (GFAT):", font, 15, H, { textX: 887 });
      // GFAT value: fitz x=1160 y=211.9 w=87 h=22
      eraseAndDraw(p, 1160, 211.9, 130, 22,
        `${formatCurrency(gfatEstimativa)}*`, bold, 16, H, { textX: 1160 });
    }

    // ===== PÁGINA 9 (index 8): Estimativas financeiras =====
    if (pages.length > 8) {
      const p = pages[8];
      const H = p.getHeight();

      // RECIEE value: fitz x=468 y=342 w=150 h=20
      eraseAndDraw(p, 468, 342, 200, 20,
        formatCurrency(totalRecuperacao), bold, 20, H, { textX: 468 });

      // GFAT value: fitz x=803 y=426 w=150 h=20
      eraseAndDraw(p, 803, 426, 200, 20,
        formatCurrency(gfatEstimativa), bold, 20, H, { textX: 803 });

      const totalBruto = totalRecuperacao + gfatEstimativa;
      const totalLiquido = totalBruto * 0.625;
      // TOTAL BRUTO: fitz x=508 y=675 w=700 h=32
      eraseAndDraw(p, 508, 675, 750, 35,
        `TOTAL BRUTO: ${formatCurrency(totalBruto)} TOTAL LÍQUIDO: ${formatCurrency(totalLiquido)}`,
        font, 20, H, { textX: 508 });
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
