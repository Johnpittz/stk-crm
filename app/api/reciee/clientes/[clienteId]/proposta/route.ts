import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";

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
  // Random 5 digits
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `${y}${m}${d}${h}${min}${s}${rand}`;
}

// Helper: draw white rect + new text to replace existing text on a page
function replaceTextOnPage(
  page: any,
  oldX: number,
  oldY: number,
  oldWidth: number,
  oldHeight: number,
  newText: string,
  font: any,
  fontSize: number,
  color: [number, number, number] = [0, 0, 0]
) {
  // Draw white rectangle over old text (PDF y is bottom-up, so we need to convert)
  const pageHeight = page.getHeight();
  const rectY = pageHeight - oldY - oldHeight;

  page.drawRectangle({
    x: oldX,
    y: rectY,
    width: oldWidth,
    height: oldHeight + 4,
    color: rgb(1, 1, 1),
  });

  // Draw new text
  const textY = pageHeight - oldY - fontSize;
  page.drawText(newText, {
    x: oldX,
    y: textY,
    size: fontSize,
    font,
    color: rgb(...color),
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
    const calibriFont = await pdfDoc.embedFont(StandardFonts.Helvetica); // Using Helvetica as Calibri substitute

    const pages = pdfDoc.getPages();

    // ===== PÁGINA 2 (index 1): Carta de apresentação =====
    // Replace client name in the introduction letter
    if (pages.length > 1) {
      const page2 = pages[1];
      const pageHeight = page2.getHeight();

      // Old client name: "AGROCENTRAL INDÚSTRIA E COMÉRCIO-NUTRIRAÇÃO."
      // Position: [168, 151] size=32 BoldItalic
      // We need to cover it and write new name
      const oldNameY = 151;
      const oldNameHeight = 35;

      // Draw white rectangle over old name
      page2.drawRectangle({
        x: 168,
        y: pageHeight - oldNameY - oldNameHeight,
        width: 800,
        height: oldNameHeight + 4,
        color: rgb(1, 1, 1),
      });

      // Draw new client name
      page2.drawText(clientName.toUpperCase() + ".", {
        x: 168,
        y: pageHeight - oldNameY - 28,
        size: 32,
        font: calibriFont,
        color: rgb(0.1, 0.1, 0.1),
      });
    }

    // ===== PÁGINA 8 (index 7): Proposta RECIEE =====
    if (pages.length > 7) {
      const page8 = pages[7];
      const pageHeight = page8.getHeight();

      // --- Client section (bottom right, the actual client data) ---
      // "Cliente: JOAOPEDROLG" at [886, 107] size=17 Helvetica-Bold
      const clienteLabelY = 107;
      page8.drawRectangle({
        x: 886,
        y: pageHeight - clienteLabelY - 20,
        width: 550,
        height: 24,
        color: rgb(1, 1, 1),
      });
      page8.drawText(`Cliente: ${clienteName.toUpperCase()}`, {
        x: 886,
        y: pageHeight - clienteLabelY - 14,
        size: 17,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      // "Valor atual da Conta:" + value at [887, 155] / [1180, 154]
      const valorContaY = 155;
      const valorContaStr = formatCurrency(valorAtualConta);
      page8.drawRectangle({
        x: 887,
        y: pageHeight - valorContaY - 20,
        width: 550,
        height: 24,
        color: rgb(1, 1, 1),
      });
      page8.drawText("Valor atual da Conta:", {
        x: 887,
        y: pageHeight - valorContaY - 14,
        size: 15,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      page8.drawText(valorContaStr, {
        x: 1180,
        y: pageHeight - valorContaY - 14,
        size: 16,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      // "Estimativa de recuperação (RECIEE):" + value at [887, 184] / [1260, 183]
      const recupY = 184;
      const recupStr = formatCurrency(totalRecuperacao);
      page8.drawRectangle({
        x: 887,
        y: pageHeight - recupY - 20,
        width: 550,
        height: 24,
        color: rgb(1, 1, 1),
      });
      page8.drawText("Estimativa de recuperação (RECIEE):", {
        x: 887,
        y: pageHeight - recupY - 14,
        size: 15,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      page8.drawText(recupStr, {
        x: 1260,
        y: pageHeight - recupY - 14,
        size: 16,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      // "Ajuste contratual (GFAT):" + value at [887, 213] / [1160, 212]
      const gfatY = 213;
      const gfatStr = formatCurrency(gfatEstimativa);
      page8.drawRectangle({
        x: 887,
        y: pageHeight - gfatY - 20,
        width: 550,
        height: 24,
        color: rgb(1, 1, 1),
      });
      page8.drawText("Ajuste contratual (GFAT):", {
        x: 887,
        y: pageHeight - gfatY - 14,
        size: 15,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });
      page8.drawText(`${gfatStr}*`, {
        x: 1160,
        y: pageHeight - gfatY - 14,
        size: 16,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      // "Proposta nº:" at [886, 78] size=17
      const propNumY = 78;
      page8.drawRectangle({
        x: 886,
        y: pageHeight - propNumY - 20,
        width: 300,
        height: 24,
        color: rgb(1, 1, 1),
      });
      page8.drawText(`Proposta nº: ${propostaNumber}`, {
        x: 886,
        y: pageHeight - propNumY - 14,
        size: 17,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });
    }

    // ===== PÁGINA 9 (index 8): Estimativas financeiras =====
    if (pages.length > 8) {
      const page9 = pages[8];
      const pageHeight = page9.getHeight();

      // RECIEE value at [468, 342] size=20 Helvetica-Bold
      const recieeY = 342;
      const recieeStr = formatCurrency(totalRecuperacao);
      page9.drawRectangle({
        x: 468,
        y: pageHeight - recieeY - 24,
        width: 250,
        height: 28,
        color: rgb(1, 1, 1),
      });
      page9.drawText(recieeStr, {
        x: 468,
        y: pageHeight - recieeY - 18,
        size: 20,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      // GFAT value at [803, 426] size=20 Helvetica-Bold
      const gfatTableY = 426;
      const gfatTableStr = formatCurrency(gfatEstimativa);
      page9.drawRectangle({
        x: 803,
        y: pageHeight - gfatTableY - 24,
        width: 250,
        height: 28,
        color: rgb(1, 1, 1),
      });
      page9.drawText(gfatTableStr, {
        x: 803,
        y: pageHeight - gfatTableY - 18,
        size: 20,
        font: helveticaBold,
        color: rgb(0, 0, 0),
      });

      // TOTAL GERAL values
      const totalBruto = totalRecuperacao + gfatEstimativa;
      const totalLiquido = totalBruto * 0.625; // After 37.5% deduction (simplified)

      // TOTAL BRUTO line at [508, 675]
      const totalY = 675;
      page9.drawRectangle({
        x: 508,
        y: pageHeight - totalY - 24,
        width: 700,
        height: 28,
        color: rgb(1, 1, 1),
      });
      page9.drawText(
        `TOTAL BRUTO: ${formatCurrency(totalBruto)} TOTAL LÍQUIDO: ${formatCurrency(totalLiquido)}`,
        {
          x: 508,
          y: pageHeight - totalY - 18,
          size: 32,
          font: calibriFont,
          color: rgb(0, 0, 0),
        }
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
