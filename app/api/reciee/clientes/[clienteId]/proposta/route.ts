import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DARK = rgb(15 / 255, 29 / 255, 50 / 255);
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);
const BLUE = rgb(59 / 255, 100 / 255, 207 / 255);
const GRAY = rgb(100 / 255, 100 / 255, 100 / 255);
const LTGRAY = rgb(230 / 255, 230 / 255, 230 / 255);

function fmt(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function genNum(): string {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}${Math.floor(10000 + Math.random() * 90000)}`;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { clienteId: string } }
) {
  try {
    const { clienteId } = params;
    if (!clienteId) return NextResponse.json({ error: "clienteId required" }, { status: 400 });

    const { data: cliente } = await supabase.from("clientes_reciee").select("*").eq("id", clienteId).single();
    if (!cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    const { data: faturas } = await supabase.from("faturas_reciee").select("*").eq("cliente_id", clienteId).order("competencia");
    const { data: analises } = await supabase.from("analises_reciee").select("*").eq("cliente_id", clienteId);

    const totalRec = (analises || []).reduce((s: number, a: any) => s + (a.valor_estimado || 0), 0);
    const avgBill = (faturas || []).length > 0
      ? (faturas || []).reduce((s: number, f: any) => s + (f.valor_total || 0), 0) / (faturas || []).length : 0;
    const gfat = avgBill * 0.03 * 36;
    const propNum = genNum();
    const cName = (cliente.nome || "CLIENTE").toUpperCase();

    const tplPath = path.join(process.cwd(), "public", "templates", "proposta_template.pdf");
    if (!fs.existsSync(tplPath)) return NextResponse.json({ error: "Template não encontrado" }, { status: 500 });

    const doc = await PDFDocument.load(fs.readFileSync(tplPath));
    const hv = await doc.embedFont(StandardFonts.Helvetica);
    const hb = await doc.embedFont(StandardFonts.HelveticaBold);
    const hi = await doc.embedFont(StandardFonts.HelveticaOblique);
    const pages = doc.getPages();
    const PW = 1440, PH = 810;

    // ===================== PAGE 2: Replace client name =====================
    if (pages.length > 1) {
      const p = pages[1];
      p.drawRectangle({ x: 160, y: PH - 190, width: 700, height: 40, color: WHITE });
      p.drawText(cName + ".", { x: 168, y: PH - 182, size: 32, font: hv, color: BLACK });
    }

    // ===================== PAGE 8: Only replace RIGHT COLUMN =====================
    if (pages.length > 7) {
      const p = pages[7];

      // Erase only the right-side proposal box (x >= 870, y from ~80 to ~280)
      // Start below the header to preserve title
      p.drawRectangle({ x: 870, y: PH - 310, width: PW - 860, height: 250, color: WHITE });

      // Draw right column content with proper alignment
      const rx = 890;
      let ry = PH - 68;

      // Proposta nº
      p.drawText(`Proposta nº: ${propNum}`, { x: rx, y: ry, size: 16, font: hb, color: BLACK });

      // Cliente
      ry -= 26;
      p.drawText(`Cliente: ${cName}`, { x: rx, y: ry, size: 16, font: hb, color: BLACK });

      // Separator
      ry -= 14;
      p.drawLine({ start: { x: rx, y: ry }, end: { x: rx + 400, y: ry }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

      // Valor atual
      ry -= 24;
      p.drawText("Valor atual da Conta:", { x: rx, y: ry, size: 14, font: hv, color: BLACK });
      p.drawText(fmt(avgBill), { x: rx + 280, y: ry, size: 14, font: hb, color: BLACK });

      // Estimativa RECIEE
      ry -= 22;
      p.drawText("Estimativa de recuperação", { x: rx, y: ry, size: 14, font: hv, color: BLACK });
      p.drawText(`(RECIEE):`, { x: rx, y: ry - 16, size: 14, font: hv, color: BLACK });
      p.drawText(fmt(totalRec), { x: rx + 280, y: ry - 8, size: 14, font: hb, color: BLACK });

      // GFAT
      ry -= 42;
      p.drawText("Ajuste contratual", { x: rx, y: ry, size: 14, font: hv, color: BLACK });
      p.drawText(`(GFAT):`, { x: rx, y: ry - 16, size: 14, font: hv, color: BLACK });
      p.drawText(`${fmt(gfat)}*`, { x: rx + 280, y: ry - 8, size: 14, font: hb, color: BLACK });

      // Notas
      ry -= 40;
      p.drawText("* acumulados em", { x: rx + 280, y: ry, size: 10, font: hi, color: GRAY });
      ry -= 14;
      p.drawText("média de 3% de economia ao mês", { x: rx, y: ry, size: 10, font: hv, color: GRAY });
      p.drawText("(aproximadamente)", { x: rx + 260, y: ry, size: 10, font: hv, color: GRAY });

      // Prazo
      ry -= 22;
      p.drawText("Prazo para Recebimento:", { x: rx, y: ry, size: 14, font: hv, color: BLACK });
      p.drawText("06 a 12 meses", { x: rx + 200, y: ry, size: 14, font: hb, color: BLACK });
    }

    // ===================== PAGE 9: Regenerated matching original colors =====================
    if (pages.length > 8) {
      const p = pages[8];

      // White background
      p.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: WHITE });

      // Dark blue header bar
      p.drawRectangle({ x: 0, y: PH - 90, width: PW, height: 90, color: DARK });
      p.drawText("ESTIMATIVA DE GANHO TOTAL EM 3 ANOS*", {
        x: PW / 2, y: PH - 55, size: 28, font: hb, color: WHITE
      });

      // Table dimensions
      const mx = 60;
      const tblW = PW - mx * 2;
      const col1 = mx + 10;
      const col2 = mx + tblW * 0.38;
      const col3 = mx + tblW * 0.68;

      let ty = PH - 130;

      // Table header row (dark blue)
      p.drawRectangle({ x: mx, y: ty - 45, width: tblW, height: 45, color: DARK });
      p.drawText("SERVIÇO", { x: col1, y: ty - 30, size: 14, font: hb, color: WHITE });
      p.drawText("ESTIMATIVA DE RECUPERAÇÃO", { x: col2, y: ty - 30, size: 14, font: hb, color: WHITE });
      p.drawText("ESTIMATIVA DE ECONOMIA", { x: col3, y: ty - 30, size: 14, font: hb, color: WHITE });

      ty -= 45;

      // Table rows
      const rows = [
        { label: "RECIEE*", rec: fmt(totalRec), eco: "-" },
        { label: "GFAT (3%)*", rec: "-", eco: fmt(gfat) },
        { label: "GD* (30%)*", rec: "-", eco: "R$ -" },
        { label: "ELETROPOSTO*", rec: "-", eco: "R$ -" },
      ];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowH = 80;
        const bgColor = i % 2 === 0 ? WHITE : LTGRAY;

        p.drawRectangle({ x: mx, y: ty - rowH, width: tblW, height: rowH, color: bgColor });
        p.drawLine({ start: { x: mx, y: ty - rowH }, end: { x: mx + tblW, y: ty - rowH }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });

        p.drawText(row.label, { x: col1, y: ty - 32, size: 13, font: hb, color: DARK });
        p.drawText(row.rec, { x: col2, y: ty - 32, size: 13, font: hb, color: BLUE });
        p.drawText(row.eco, { x: col3, y: ty - 32, size: 13, font: hb, color: BLUE });

        ty -= rowH;
      }

      // Total row (dark blue background)
      const totalBruto = totalRec + gfat;
      const totalLiq = totalBruto * 0.625;
      const totalRowH = 65;
      p.drawRectangle({ x: mx, y: ty - totalRowH, width: tblW, height: totalRowH, color: DARK });

      p.drawText("TOTAL GERAL", { x: col1, y: ty - 32, size: 14, font: hb, color: WHITE });
      p.drawText(`TOTAL BRUTO: ${fmt(totalBruto)}`, { x: col2, y: ty - 32, size: 13, font: hb, color: WHITE });
      p.drawText(`TOTAL LÍQUIDO: ${fmt(totalLiq)}`, { x: col3, y: ty - 32, size: 13, font: hb, color: WHITE });

      ty -= totalRowH + 30;

      // Notes
      p.drawText("* valores estimados sujeitos a confirmação após análise técnica detalhada.", { x: mx, y: ty, size: 10, font: hi, color: GRAY });
      ty -= 16;
      p.drawText("As estimativas são baseadas na legislação vigente e nos dados disponíveis.", { x: mx, y: ty, size: 10, font: hi, color: GRAY });
    }

    const buf = Buffer.from(await doc.save());
    const fn = `PROPOSTA_RECIEE_${(cliente.nome || "cliente").replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}_${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 15)}.pdf`;
    return new NextResponse(buf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fn}"` } });
  } catch (error: any) {
    console.error("Erro ao gerar proposta:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
