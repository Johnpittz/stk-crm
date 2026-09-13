import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!);
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
    const supabase = getSupabase();
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

    // Criar workbook
    const wb = XLSX.utils.book_new();

    // === Aba 1: Dados do Cliente ===
    const clienteData = [
      ["RELATÓRIO DE ANÁLISE RECIEE"],
      [""],
      ["DADOS DO CLIENTE"],
      ["Nome", cliente.nome || ""],
      ["CPF/CNPJ", cliente.cpf_cnpj || ""],
      ["UC", cliente.uc || ""],
      ["Estado", cliente.estado || ""],
      ["Distribuidora", cliente.distribuidora || ""],
      ["Grupo", cliente.grupo || ""],
      ["Subgrupo", cliente.subgrupo || ""],
      ["Modalidade", cliente.modalidade || ""],
      ["Classe", cliente.classe || ""],
      ["Tensão", cliente.tensao || ""],
      ["Regime Tributário", cliente.regime_tributario || ""],
      ["GD", cliente.gd ? "Sim" : "Não"],
      ["Telefone", cliente.telefone || ""],
      ["Endereço", cliente.endereco || ""],
      ["Cidade", cliente.cidade || ""],
      [""],
      [
        "Data do Relatório",
        new Date().toLocaleDateString("pt-BR"),
      ],
    ];
    const wsCliente = XLSX.utils.aoa_to_sheet(clienteData);
    wsCliente["!cols"] = [{ wch: 22 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsCliente, "Dados do Cliente");

    // === Aba 2: Faturas ===
    const faturasHeader = [
      "Competência",
      "Consumo (kWh)",
      "Tarifa Aplicada (R$/kWh)",
      "Valor Consumo (R$)",
      "ICMS Alíquota (%)",
      "ICMS Valor (R$)",
      "PIS (R$)",
      "COFINS (R$)",
      "Bandeira",
      "CIP (R$)",
      "Valor Total (R$)",
    ];
    const faturasRows = (faturas || []).map((f: any) => [
      f.competencia || "",
      f.consumo_kwh || 0,
      f.tarifa_aplicada || 0,
      f.valor_consumo || 0,
      f.icms_aliquota || 0,
      f.icms_valor || 0,
      f.pis_valor || 0,
      f.cofins_valor || 0,
      f.bandeira || "",
      f.cip || 0,
      f.valor_total || 0,
    ]);

    // Adicionar linha de totais
    const totais = ["TOTAL", "", "", "", "", "", "", "", "", "", ""];
    totais[3] = (faturas || []).reduce(
      (s: number, f: any) => s + (f.valor_consumo || 0),
      0
    );
    totais[5] = (faturas || []).reduce(
      (s: number, f: any) => s + (f.icms_valor || 0),
      0
    );
    totais[6] = (faturas || []).reduce(
      (s: number, f: any) => s + (f.pis_valor || 0),
      0
    );
    totais[7] = (faturas || []).reduce(
      (s: number, f: any) => s + (f.cofins_valor || 0),
      0
    );
    totais[9] = (faturas || []).reduce(
      (s: number, f: any) => s + (f.cip || 0),
      0
    );
    totais[10] = (faturas || []).reduce(
      (s: number, f: any) => s + (f.valor_total || 0),
      0
    );
    faturasRows.push(totais);

    const wsFaturas = XLSX.utils.aoa_to_sheet([
      faturasHeader,
      ...faturasRows,
    ]);
    wsFaturas["!cols"] = faturasHeader.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
    XLSX.utils.book_append_sheet(wb, wsFaturas, "Faturas");

    // === Aba 3: Análises ===
    const analisesHeader = [
      "Severidade",
      "Macro-Índice",
      "Código",
      "Descrição",
      "Período",
      "Valor Estimado (R$)",
    ];
    const analisesRows = (analises || []).map((a: any) => [
      (a.severidade || "").toUpperCase(),
      a.macro_indice || "",
      a.codigo || "",
      a.descricao || "",
      a.periodo || "",
      a.valor_estimado || 0,
    ]);

    // Adicionar total
    const totalRecuperacao = (analises || []).reduce(
      (s: number, a: any) => s + (a.valor_estimado || 0),
      0
    );
    analisesRows.push([
      "",
      "",
      "",
      "",
      "TOTAL RECUPERAÇÃO",
      totalRecuperacao,
    ]);

    const wsAnalises = XLSX.utils.aoa_to_sheet([
      analisesHeader,
      ...analisesRows,
    ]);
    wsAnalises["!cols"] = analisesHeader.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
    XLSX.utils.book_append_sheet(wb, wsAnalises, "Análises");

    // === Aba 4: Resumo ===
    const criticos = (analises || []).filter(
      (a: any) => a.severidade === "critico"
    ).length;
    const alertas = (analises || []).filter(
      (a: any) => a.severidade === "alerta"
    ).length;
    const infoCount = (analises || []).filter(
      (a: any) => a.severidade === "info" || a.severidade === "ok"
    ).length;

    const resumoData = [
      ["RESUMO DA ANÁLISE"],
      [""],
      ["Total de Faturas Analisadas", (faturas || []).length],
      ["Total de Análises", (analises || []).length],
      ["Críticos", criticos],
      ["Alertas", alertas],
      ["Info/OK", infoCount],
      [""],
      [
        "Estimativa Total de Recuperação (R$)",
        totalRecuperacao.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
        }),
      ],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
    wsResumo["!cols"] = [{ wch: 38 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    // Gerar buffer
    const buffer = XLSX.write(wb, {
      type: "buffer",
      bookType: "xlsx",
    });

    // Retornar como download
    const fileName = `relatorio_${(cliente.nome || "cliente").replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}_${new Date().toISOString().split("T")[0]}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: any) {
    console.error("Erro ao gerar relatório:", error);
    return NextResponse.json(
      { error: "Erro interno ao gerar relatório" },
      { status: 500 }
    );
  }
}
