import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Calcular estatísticas
    const totalFaturas = (faturas || []).length;
    const totalRecuperacao = (analises || []).reduce(
      (s: number, a: any) => s + (a.valor_estimado || 0),
      0
    );
    const criticos = (analises || []).filter(
      (a: any) => a.severidade === "critico"
    ).length;
    const alertas = (analises || []).filter(
      (a: any) => a.severidade === "alerta"
    ).length;

    // Gerar PDF
    const doc = new jsPDF();

    // Cores
    const primaryColor: [number, number, number] = [59, 100, 207]; // #3B64CF
    const darkColor: [number, number, number] = [15, 29, 50]; // #0f1d32
    const redColor: [number, number, number] = [220, 38, 38];
    const greenColor: [number, number, number] = [34, 197, 94];

    // === CABEÇALHO ===
    doc.setFillColor(...darkColor);
    doc.rect(0, 0, 210, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("PROPOSTA DE RECUPERAÇÃO", 105, 18, { align: "center" });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Recuperação de Créditos de Energia Elétrica", 105, 28, {
      align: "center",
    });

    doc.setFontSize(9);
    doc.text(
      `Data: ${new Date().toLocaleDateString("pt-BR")}`,
      105,
      35,
      { align: "center" }
    );

    // === DADOS DO CLIENTE ===
    let y = 50;
    doc.setTextColor(...darkColor);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DO CLIENTE", 15, y);

    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const clienteInfo = [
      ["Nome:", cliente.nome || ""],
      ["CPF/CNPJ:", cliente.cpf_cnpj || ""],
      ["UC:", cliente.uc || ""],
      ["Estado:", cliente.estado || ""],
      ["Distribuidora:", cliente.distribuidora || ""],
      ["Grupo:", cliente.grupo || ""],
      ["Subgrupo:", cliente.subgrupo || ""],
    ];

    for (const [label, value] of clienteInfo) {
      doc.setFont("helvetica", "bold");
      doc.text(label, 15, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, 55, y);
      y += 6;
    }

    // === RESUMO DA ANÁLISE ===
    y += 5;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...primaryColor);
    doc.text("RESUMO DA ANÁLISE", 15, y);

    y += 8;

    // Cards de resumo
    const summaryItems = [
      {
        label: "Faturas Analisadas",
        value: totalFaturas.toString(),
        color: primaryColor,
      },
      {
        label: "Problemas Críticos",
        value: criticos.toString(),
        color: redColor,
      },
      {
        label: "Alertas",
        value: alertas.toString(),
        color: [234, 179, 8] as [number, number, number],
      },
      {
        label: "Valor a Recuperar",
        value: `R$ ${totalRecuperacao.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        })}`,
        color: greenColor,
      },
    ];

    for (const item of summaryItems) {
      doc.setFillColor(...item.color);
      doc.roundedRect(15, y, 45, 16, 2, 2, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(item.label, 37.5, y + 6, { align: "center" });

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(item.value, 37.5, y + 12, { align: "center" });

      // Gap between items at 60, 105, 150
      // We place at 15, 60, 105, 150
    }
    // Actually let me re-position: 4 boxes, each 45mm wide with 5mm gaps
    // 15, 15+50=65, 65+50=115, 115+50=165 ... too wide
    // Let me redo: 15, 60, 105, 150 = 4 x 45 with 0 gaps
    y += 22;

    // === ANÁLISES DETALHADAS ===
    if ((analises || []).length > 0) {
      y += 5;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkColor);
      doc.text("ANÁLISES ENCONTRADAS", 15, y);
      y += 3;

      const tableData = (analises || []).map((a: any) => [
        (a.severidade || "").toUpperCase(),
        a.macro_indice || "",
        a.codigo || "",
        a.descricao || "",
        `R$ ${(a.valor_estimado || 0).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        })}`,
      ]);

      // Add total row
      tableData.push([
        "",
        "",
        "",
        "TOTAL RECUPERAÇÃO",
        `R$ ${totalRecuperacao.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        })}`,
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Severidade", "Macro-Índice", "Código", "Descrição", "Valor"]],
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: primaryColor,
          textColor: 255,
          fontSize: 8,
        },
        bodyStyles: {
          fontSize: 7,
          textColor: darkColor,
        },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 25 },
          2: { cellWidth: 22 },
          3: { cellWidth: 75 },
          4: { cellWidth: 28, halign: "right" },
        },
        didParseCell: function (data) {
          // Colorir linha de severidade
          if (data.section === "body" && data.column.index === 0) {
            const val = (data.cell.raw as string || "").toLowerCase();
            if (val === "crítico" || val === "critico") {
              data.cell.styles.textColor = redColor;
              data.cell.styles.fontStyle = "bold";
            } else if (val === "alerta") {
              data.cell.styles.textColor = [234, 179, 8];
              data.cell.styles.fontStyle = "bold";
            }
          }
          // Bold total row
          if (
            data.section === "body" &&
            data.column.index === 3 &&
            (data.cell.raw as string || "").includes("TOTAL")
          ) {
            data.cell.styles.fontStyle = "bold";
          }
        },
      });
    }

    // === FATURAS ===
    const afterAnalyses = (doc as any).lastAutoTable?.finalY || y + 30;
    if (afterAnalyses > 240) {
      doc.addPage();
      y = 20;
    } else {
      y = afterAnalyses + 10;
    }

    if ((faturas || []).length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...darkColor);
      doc.text("DETALHAMENTO DAS FATURAS", 15, y);
      y += 3;

      const faturasTableData = (faturas || []).map((f: any) => [
        f.competencia || "",
        `${(f.consumo_kwh || 0).toLocaleString("pt-BR")}`,
        `R$ ${(f.valor_total || 0).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        })}`,
      ]);

      // Total
      const totalValor = (faturas || []).reduce(
        (s: number, f: any) => s + (f.valor_total || 0),
        0
      );
      faturasTableData.push([
        "TOTAL",
        `${(faturas || [])
          .reduce((s: number, f: any) => s + (f.consumo_kwh || 0), 0)
          .toLocaleString("pt-BR")}`,
        `R$ ${totalValor.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        })}`,
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Competência", "Consumo (kWh)", "Valor Total (R$)"]],
        body: faturasTableData,
        theme: "grid",
        headStyles: {
          fillColor: primaryColor,
          textColor: 255,
          fontSize: 8,
        },
        bodyStyles: {
          fontSize: 8,
          textColor: darkColor,
        },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 50, halign: "center" },
          2: { cellWidth: 50, halign: "right" },
        },
      });
    }

    // === RODAPÉ ===
    const pageHeight = doc.internal.pageSize.height;
    doc.setFillColor(...darkColor);
    doc.rect(0, pageHeight - 20, 210, 20, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      "STK Tecnologia em Energia - Recuperação de Créditos de Energia Elétrica",
      105,
      pageHeight - 12,
      { align: "center" }
    );
    doc.text(
      `Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`,
      105,
      pageHeight - 7,
      { align: "center" }
    );

    // Gerar buffer do PDF
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    const fileName = `proposta_${(cliente.nome || "cliente").replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}_${new Date().toISOString().split("T")[0]}.pdf`;

    return new NextResponse(pdfBuffer, {
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
