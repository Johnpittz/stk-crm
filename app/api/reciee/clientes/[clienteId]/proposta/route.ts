import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function fmt(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function generatePropostaNumber(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${rand}`;
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

    // Load template
    const templateBytes = fs.readFileSync(templatePath);
    const templateDoc = await PDFDocument.load(templateBytes);

    // Create new document: copy pages 0-6 (template pages 1-7) + 2 new pages + pages 9-15 (template pages 10-16)
    const newDoc = await PDFDocument.create();

    // Copy template pages 1-7 (indices 0-6)
    const beforePages = await newDoc.copyPages(templateDoc, [0, 1, 2, 3, 4, 5, 6]);
    for (const pg of beforePages) newDoc.addPage(pg);

    // ===== CREATE PAGE 8: Proposta RECIEE =====
    const W = 1440;
    const H = 810;
    const page8 = newDoc.addPage([W, H]);

    const font = await newDoc.embedFont(StandardFonts.Helvetica);
    const bold = await newDoc.embedFont(StandardFonts.HelveticaBold);
    const italic = await newDoc.embedFont(StandardFonts.HelveticaOblique);
    const boldItalic = await newDoc.embedFont(StandardFonts.HelveticaBoldOblique);

    // Dark blue background for header area
    const darkBlue = rgb(15 / 255, 36 / 255, 62 / 255);
    const white = rgb(1, 1, 1);
    const black = rgb(0, 0, 0);

    // === HEADER BAR ===
    page8.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: darkBlue });
    page8.drawText("PROPOSTA RECIEE – RECUPERAÇÃO DE COBRANÇAS INDEVIDAS DE ENERGIA ELÉTRICA", {
      x: 350, y: H - 40, size: 20, font: bold, color: white,
    });

    // === LEFT COLUMN: How it works (RECIEE + GFAT) ===
    let ly = H - 90;

    // Como funciona o RECIEE
    page8.drawText("Como funciona o RECIEE", { x: 30, y: ly, size: 20, font: bold, color: darkBlue });
    ly -= 30;

    const recieeText = [
      "O RECIEE é um serviço especializado de auditoria administrativa",
      "profunda, criado para identificar e recuperar valores",
      "pagos indevidamente à distribuidora de energia elétrica, por meio de um processo 100%",
      "administrativo, realizamos uma análise técnica minuciosa de todo o histórico de",
      "faturamento da unidade consumidora, podendo abranger até 10 anos de contas já",
      "quitadas. Nossa metodologia atua com mais de 400 índices técnicos, tarifários,",
      "tributários e regulatórios, incluindo juros, multas e correções, garantindo que",
      "nenhum valor recuperável deixe de ser identificado. Valores pagos a maior são",
      "integralmente apurados, corrigidos e recuperados em favor do cliente em dinheiro.",
    ];
    for (const line of recieeText) {
      const isBold = line.includes("100%") || line.includes("integralmente apurados, corrigidos e recuperados");
      page8.drawText(line, { x: 30, y: ly, size: 14, font: isBold ? bold : font, color: black });
      ly -= 18;
    }
    ly -= 8;

    page8.drawText("A Sustentalski é remunerada exclusivamente sobre o", { x: 30, y: ly, size: 14, font, color: black });
    ly -= 18;
    page8.drawText("valor efetivamente recuperado, no percentual de", { x: 30, y: ly, size: 14, font, color: black });
    page8.drawText(" 45%", { x: 378, y: ly, size: 14, font: bold, color: black });
    page8.drawText(", garantindo total alinhamento de interesses:", { x: 410, y: ly, size: 14, font, color: black });
    ly -= 22;
    page8.drawText("Se não houver recuperação financeira, não há custo para o cliente.", { x: 30, y: ly, size: 14, font: italic, color: black });
    ly -= 35;

    // Como funciona o GFAT
    page8.drawText("Como funciona o GFAT – Gestão Técnica e Preventiva da Fatura de Energia", { x: 30, y: ly, size: 16, font: bold, color: darkBlue });
    ly -= 25;

    const gfatText = [
      "O GFAT é um serviço contínuo criado para manter, proteger e garantir as economias",
      "obtidas ao longo do tempo por meio de uma gestão mensal ativa da unidade",
      "consumidora, monitorando continuamente sob os 7 grupos que geram erros",
      "tarifários, tributários, de leitura, enquadramento contratual e aplicação de benefícios",
      "legais. Erros de faturamento podem voltar a ocorrer a qualquer momento, seja por",
      "mudanças operacionais da concessionária, falhas sistêmicas ou alterações de",
      "enquadramento. Por esse motivo, a economia gerada não se mantém sozinha.",
    ];
    for (const line of gfatText) {
      const isBold = line.includes("manter, proteger e garantir") || line.includes("não se mantém sozinha");
      page8.drawText(line, { x: 30, y: ly, size: 14, font: isBold ? bold : font, color: black });
      ly -= 18;
    }
    ly -= 8;

    page8.drawText("A remuneração do GFAT corresponde a um", { x: 30, y: ly, size: 14, font, color: black });
    page8.drawText("valor mensal fixo", { x: 417, y: ly, size: 14, font: bold, color: black });
    page8.drawText(", definido a partir da", { x: 571, y: ly, size: 14, font, color: black });
    ly -= 18;
    page8.drawText("economia obtida no momento da implantação. Durante a vigência contratual, o", { x: 30, y: ly, size: 14, font, color: black });
    ly -= 18;
    page8.drawText("cliente paga um valor fixo, equivalente a", { x: 30, y: ly, size: 14, font, color: black });
    page8.drawText(" 15% da economia mensal alcançada", { x: 404, y: ly, size: 14, font: bold, color: black });
    page8.drawText(".", { x: 700, y: ly, size: 14, font, color: black });
    ly -= 18;
    page8.drawText("A economia obtida permanece válida enquanto a unidade consumidora estiver ativa,", { x: 30, y: ly, size: 14, font, color: black });
    ly -= 18;
    page8.drawText("sem prazo de expiração.", { x: 30, y: ly, size: 14, font, color: black });
    ly -= 40;

    // Próximos Passos
    page8.drawText("Próximos Passos:", { x: 30, y: ly, size: 16, font: bold, color: darkBlue });
    ly -= 22;
    const proximosPassos = [
      "Aceitando a proposta, precisamos de",
      "um e-mail em seu nome, telefone, RG, CPF, Profissão,",
      "Estado civil e um documento pessoal com foto (PF) e",
      "contrato social (PJ) e caso de condomínios cópia do",
      "Estatuto Social e alterações, além da cópia da Ata de",
      "Assembleia ou Reunião de nomeação de Diretoria",
      "e/ou Administrador. Também será preciso do login e",
      "senha para acesso na Distribuidora.",
    ];
    for (const line of proximosPassos) {
      page8.drawText(line, { x: 30, y: ly, size: 13, font, color: black });
      ly -= 16;
    }

    // === RIGHT COLUMN: Proposal box ===
    const rx = 830;
    const ry = H - 90;

    // Proposal number + client
    page8.drawText(`Proposta nº: ${propostaNumber}`, { x: rx, y: ry, size: 17, font: bold, color: black });
    page8.drawText(`Cliente: ${clienteName.toUpperCase()}`, { x: rx, y: ry - 30, size: 17, font: bold, color: black });

    // Divider line
    page8.drawLine({ start: { x: rx, y: ry - 50 }, end: { x: rx + 500, y: ry - 50 }, thickness: 1, color: darkBlue });

    // Values
    let vy = ry - 80;
    page8.drawText("Valor atual da Conta:", { x: rx, y: vy, size: 16, font, color: black });
    page8.drawText(fmt(valorAtualConta), { x: rx + 320, y: vy, size: 16, font: bold, color: black });
    vy -= 35;

    page8.drawText("Estimativa de recuperação (RECIEE):", { x: rx, y: vy, size: 16, font, color: black });
    page8.drawText(fmt(totalRecuperacao), { x: rx + 420, y: vy, size: 16, font: bold, color: black });
    vy -= 35;

    page8.drawText("Ajuste contratual (GFAT):", { x: rx, y: vy, size: 16, font, color: black });
    page8.drawText(`${fmt(gfatEstimativa)}*`, { x: rx + 320, y: vy, size: 16, font: bold, color: black });
    vy -= 28;
    page8.drawText("* acumulados em", { x: rx + 300, y: vy, size: 11, font: italic, color: black });
    vy -= 16;
    page8.drawText("média de 3% de economia ao mês (aproximadamente)", { x: rx, y: vy, size: 12, font, color: black });
    vy -= 28;

    page8.drawText("Prazo para Recebimento:", { x: rx, y: vy, size: 16, font, color: black });
    page8.drawText("06 a 12 meses", { x: rx + 250, y: vy, size: 16, font: bold, color: black });
    vy -= 45;

    // Divergências
    page8.drawText("Exemplos de divergências:", { x: rx, y: vy, size: 16, font, color: black });
    vy -= 25;
    const divergencias = [
      "• Tarifação divergente diante o valor padrão proposto.",
      "• Tarifação divergente diante da variação das bandeiras",
      "• Descontos não aplicados por falta de fornecimento.",
      "• Descontos não aplicados por multas à distribuidora.",
      "• Divergência na alíquota de impostos de cada ano.",
      "• Desconsideração de Legislações específicas.",
    ];
    for (const d of divergencias) {
      page8.drawText(d, { x: rx, y: vy, size: 13, font, color: black });
      vy -= 18;
    }

    // ===== CREATE PAGE 9: Estimativas financeiras =====
    const page9 = newDoc.addPage([W, H]);
    const tableLeft = 50;
    const tableWidth = W - 100;
    const colW = tableWidth / 3;

    // Header
    page9.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: darkBlue });
    page9.drawText("ESTIMATIVA DE GANHO TOTAL EM 3 ANOS*", {
      x: W / 2 - 200, y: H - 40, size: 22, font: bold, color: white,
    });

    // Table
    let ty = H - 100;

    // Column headers
    const headerH = 50;
    page9.drawRectangle({ x: tableLeft, y: ty - headerH, width: tableWidth, height: headerH, color: darkBlue });
    page9.drawText("SERVIÇO", { x: tableLeft + 20, y: ty - 32, size: 16, font: bold, color: white });
    page9.drawText("ESTIMATIVA DE", { x: tableLeft + colW + 20, y: ty - 25, size: 14, font: bold, color: white });
    page9.drawText("RECUPERAÇÃO", { x: tableLeft + colW + 20, y: ty - 42, size: 14, font: bold, color: white });
    page9.drawText("ESTIMATIVA DE", { x: tableLeft + colW * 2 + 20, y: ty - 25, size: 14, font: bold, color: white });
    page9.drawText("ECONOMIA", { x: tableLeft + colW * 2 + 20, y: ty - 42, size: 14, font: bold, color: white });

    ty -= headerH;

    // Data rows
    const rows = [
      { label: "RECIEE*", recuperacao: totalRecuperacao, economia: null },
      { label: "GFAT (3%)*", recuperacao: null, economia: gfatEstimativa },
      { label: "GD* (30%)*", recuperacao: null, economia: 0 },
      { label: "ELETROPOSTO*", recuperacao: null, economia: 0 },
    ];

    const rowH = 55;
    for (const row of rows) {
      // Row background (alternating)
      page9.drawRectangle({ x: tableLeft, y: ty - rowH, width: tableWidth, height: rowH,
        color: row.label === "RECIEE*" ? rgb(240 / 255, 244 / 255, 255 / 255) : white });
      // Borders
      page9.drawRectangle({ x: tableLeft, y: ty - rowH, width: tableWidth, height: rowH,
        borderColor: rgb(200 / 255, 200 / 255, 200 / 255), borderWidth: 0.5, color: rgb(0, 0, 0) });

      // Service name
      page9.drawText(row.label, { x: tableLeft + 20, y: ty - 35, size: 16, font: bold, color: darkBlue });

      // Recuperação value
      if (row.recuperacao !== null && row.recuperacao > 0) {
        page9.drawText(fmt(row.recuperacao), { x: tableLeft + colW + 20, y: ty - 35, size: 18, font: bold, color: darkBlue });
      } else {
        page9.drawText("-", { x: tableLeft + colW + 80, y: ty - 35, size: 18, font, color: rgb(150 / 255, 150 / 255, 150 / 255) });
      }

      // Economia value
      if (row.economia !== null && row.economia > 0) {
        page9.drawText(fmt(row.economia), { x: tableLeft + colW * 2 + 20, y: ty - 35, size: 18, font: bold, color: darkBlue });
      } else {
        page9.drawText("-", { x: tableLeft + colW * 2 + 80, y: ty - 35, size: 18, font, color: rgb(150 / 255, 150 / 255, 150 / 255) });
      }

      ty -= rowH;
    }

    // Total row
    const totalBruto = totalRecuperacao + gfatEstimativa;
    const totalLiquido = totalBruto * 0.625;
    const totalRowH = 65;

    page9.drawRectangle({ x: tableLeft, y: ty - totalRowH, width: tableWidth, height: totalRowH, color: darkBlue });
    page9.drawText("TOTAL GERAL", { x: tableLeft + 20, y: ty - 28, size: 18, font: bold, color: white });
    page9.drawText(`TOTAL BRUTO: ${fmt(totalBruto)}`, { x: tableLeft + 20, y: ty - 52, size: 14, font, color: white });
    page9.drawText(`TOTAL LÍQUIDO: ${fmt(totalLiquido)}`, { x: tableLeft + 400, y: ty - 52, size: 14, font, color: white });

    ty -= totalRowH;

    // Notes
    ty -= 25;
    page9.drawText("* valores estimados sujeitos a confirmação após análise técnica detalhada.", { x: tableLeft, y: ty, size: 12, font: italic, color: rgb(100 / 255, 100 / 255, 100 / 255) });
    ty -= 18;
    page9.drawText("As estimativas são baseadas na legislação vigente e nos dados disponíveis.", { x: tableLeft, y: ty, size: 12, font: italic, color: rgb(100 / 255, 100 / 255, 100 / 255) });

    // === Copy template pages 10-16 (indices 9-15) ===
    const afterPages = await newDoc.copyPages(templateDoc, [9, 10, 11, 12, 13, 14, 15]);
    for (const pg of afterPages) newDoc.addPage(pg);

    // Save
    const pdfBytes = await newDoc.save();
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
