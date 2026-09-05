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
 * Draws multiple overlapping white rectangles to ensure full coverage,
 * then draws new text on top. Uses fitz top-down coordinates.
 *
 * @param fitzX - X position from fitz (left edge)
 * @param fitzY - Y position from fitz (top edge of text)
 * @param fitzW - Width from fitz
 * @param fitzH - Height from fitz
 */
function eraseAndWrite(
  page: any,
  fitzX: number,
  fitzY: number,
  fitzW: number,
  fitzH: number,
  text: string,
  font: any,
  fontSize: number,
  pageHeight: number,
  opts?: { textX?: number; color?: [number, number, number]; bold?: boolean }
) {
  const pad = 10;
  // Multiple overlapping white rectangles for full coverage
  const layers = [
    // Main coverage area
    { x: fitzX - pad, y: pageHeight - fitzY - fitzH - pad, w: fitzW + pad * 3, h: fitzH + pad * 2 },
    // Extra horizontal coverage
    { x: fitzX - pad * 2, y: pageHeight - fitzY - fitzH, w: fitzW + pad * 5, h: fitzH + pad },
    // Bottom overlap
    { x: fitzX, y: pageHeight - fitzY - fitzH - pad * 2, w: fitzW + pad * 2, h: fitzH + pad * 3 },
  ];

  for (const r of layers) {
    page.drawRectangle({
      x: r.x,
      y: r.y,
      width: r.w,
      height: r.h,
      color: rgb(1, 1, 1),
      borderColor: rgb(1, 1, 1),
      borderWidth: 0,
    });
  }

  // Draw new text
  const baselineY = pageHeight - fitzY - fontSize * 0.72;
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
      eraseAndWrite(page2, 168, 151, 650, 35,
        clienteName.toUpperCase() + ".",
        helveticaFont, 32, ph,
        { textX: 168, color: [0.1, 0.1, 0.1] }
      );
    }

    // ===== PÁGINA 8 (index 7): Proposta RECIEE =====
    if (pages.length > 7) {
      const page8 = pages[7];
      const ph = page8.getHeight();

      // Proposta nº: fitz x=886, y=78, w=247, h=23
      eraseAndWrite(page8, 886, 78, 350, 23,
        `Proposta nº: ${propostaNumber}`,
        helveticaBold, 17, ph, { textX: 886 }
      );

      // Cliente: fitz x=886, y=107, w=199, h=23
      const clienteText = `Cliente: ${clienteName.toUpperCase()}`;
      eraseAndWrite(page8, 886, 107, 500, 23,
        clienteText,
        helveticaBold, 17, ph, { textX: 886 }
      );

      // Valor atual da Conta: fitz x=887, y=155, w=141, h=21 + value at x=1180
      eraseAndWrite(page8, 887, 155, 550, 21,
        `Valor atual da Conta:`,
        helveticaFont, 15, ph, { textX: 887 }
      );
      eraseAndWrite(page8, 1180, 154, 200, 16,
        formatCurrency(valorAtualConta),
        helveticaBold, 16, ph, { textX: 1180 }
      );

      // Estimativa de recuperação (RECIEE): fitz x=887, y=184, w=252, h=21 + value at x=1260
      eraseAndWrite(page8, 887, 184, 550, 21,
        `Estimativa de recuperação (RECIEE):`,
        helveticaFont, 15, ph, { textX: 887 }
      );
      eraseAndWrite(page8, 1260, 183, 200, 16,
        formatCurrency(totalRecuperacao),
        helveticaBold, 16, ph, { textX: 1260 }
      );

      // Ajuste contratual (GFAT): fitz x=887, y=213, w=170, h=21 + value at x=1160
      eraseAndWrite(page8, 887, 213, 550, 21,
        `Ajuste contratual (GFAT):`,
        helveticaFont, 15, ph, { textX: 887 }
      );
      eraseAndWrite(page8, 1160, 212, 200, 16,
        `${formatCurrency(gfatEstimativa)}*`,
        helveticaBold, 16, ph, { textX: 1160 }
      );
    }

    // ===== PÁGINA 9 (index 8): Estimativas financeiras =====
    if (pages.length > 8) {
      const page9 = pages[8];
      const ph = page9.getHeight();

      // RECIEE value: fitz x=468, y=342, w=~150, h=16
      eraseAndWrite(page9, 468, 342, 250, 20,
        formatCurrency(totalRecuperacao),
        helveticaBold, 20, ph, { textX: 468 }
      );

      // GFAT value: fitz x=803, y=426, w=~150, h=16
      eraseAndWrite(page9, 803, 426, 250, 20,
        formatCurrency(gfatEstimativa),
        helveticaBold, 20, ph, { textX: 803 }
      );

      // TOTAL line: fitz x=508, y=675, w=~700, h=32
      const totalBruto = totalRecuperacao + gfatEstimativa;
      const totalLiquido = totalBruto * 0.625;
      eraseAndWrite(page9, 508, 675, 800, 35,
        `TOTAL BRUTO: ${formatCurrency(totalBruto)} TOTAL LÍQUIDO: ${formatCurrency(totalLiquido)}`,
        helveticaFont, 20, ph, { textX: 508 }
      );
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
