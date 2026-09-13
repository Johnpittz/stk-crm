import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/oportunidades/resumo?periodo=dia&data=2026-07-16
 * GET /api/oportunidades/resumo?periodo=mes&data=2026-07-01
 * GET /api/oportunidades/resumo?periodo=ano&data=2026-01-01
 *
 * Retorna:
 * - total_vendas: soma de valor_venda (etapa = comissao_paga)
 * - quantidade_vendas: quantidade de oportunidades fechadas
 * - ticket_medio: total / quantidade
 * - total_oportunidades: total no período
 * - oportunidades_por_etapa: contagem por etapa
 * - pipeline: valor total em andamento (sem fechar)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const periodo = searchParams.get("periodo") || "dia";
    const dataParam = searchParams.get("data") || new Date().toISOString().split("T")[0];

    // Verifica se é gestor
    const { data: meuPerfil } = await supabase
      .from("profiles")
      .select("cargo")
      .eq("id", user.id)
      .single();
    const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");

    // Usa service_role para queries agregadas
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Calcula período
    let dataInicio: string;
    let dataFim: string;

    if (periodo === "dia") {
      dataInicio = dataParam + "T00:00:00.000Z";
      dataFim = dataParam + "T23:59:59.999Z";
    } else if (periodo === "mes") {
      const [ano, mes] = dataParam.split("-").map(Number);
      dataInicio = `${ano}-${String(mes).padStart(2, "0")}-01T00:00:00.000Z`;
      const ultimoDia = new Date(ano, mes, 0).getDate();
      dataFim = `${ano}-${String(mes).padStart(2, "0")}-${ultimoDia}T23:59:59.999Z`;
    } else if (periodo === "ano") {
      const ano = dataParam.split("-")[0];
      dataInicio = `${ano}-01-01T00:00:00.000Z`;
      dataFim = `${ano}-12-31T23:59:59.999Z`;
    } else {
      dataInicio = dataParam + "T00:00:00.000Z";
      dataFim = dataParam + "T23:59:59.999Z";
    }

    // Query base
    let baseQuery = supabaseAdmin
      .from("oportunidades")
      .select("*")
      .gte("created_at", dataInicio)
      .lte("created_at", dataFim);

    if (!isGestor) {
      baseQuery = baseQuery.eq("vendedor_id", user.id);
    }

    const { data: oportunidades, error } = await baseQuery;

    if (error) {
      console.warn("[API resumo oportunidades] Query falhou:", error.message);
      return NextResponse.json({
        periodo,
        total_vendas: 0,
        quantidade_vendas: 0,
        ticket_medio: 0,
        total_oportunidades: 0,
        oportunidades_por_etapa: {},
        pipeline: 0,
      });
    }

    const lista = oportunidades || [];

    // Métricas
    const fechadas = lista.filter((o) => o.etapa === "comissao_paga" || o.resultado === "sucesso");
    const totalVendas = fechadas.reduce((sum, o) => sum + (parseFloat(o.valor_venda) || 0), 0);
    const quantidadeVendas = fechadas.length;
    const ticketMedio = quantidadeVendas > 0 ? totalVendas / quantidadeVendas : 0;

    // Oportunidades por etapa
    const porEtapa: Record<string, number> = {};
    for (const o of lista) {
      porEtapa[o.etapa] = (porEtapa[o.etapa] || 0) + 1;
    }

    // Pipeline (valor total em andamento)
    const emAndamento = lista.filter((o) => 
      o.etapa !== "comissao_paga" && o.resultado !== "insucesso" && o.resultado !== "perdida"
    );
    const pipeline = emAndamento.reduce((sum, o) => sum + (parseFloat(o.valor_proposta) || 0), 0);

    return NextResponse.json({
      periodo,
      total_vendas: totalVendas,
      quantidade_vendas: quantidadeVendas,
      ticket_medio: ticketMedio,
      total_oportunidades: lista.length,
      oportunidades_por_etapa: porEtapa,
      pipeline,
    });
  } catch (err: any) {
    console.error("[API resumo oportunidades] Erro:", err);
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
