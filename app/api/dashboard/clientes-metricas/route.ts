import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { agruparPorCampo } from "@/lib/dashboard/metricas-clientes";

export const dynamic = "force-dynamic";

/**
 * ITEM 7 (16/10) — DASHBOARD: status, classificação e origem dos clientes.
 * Agrega tudo no servidor (a rota /api/clientes limita em 100 por página),
 * lendo só as 3 colunas em blocos de 1000.
 */
const TAMANHO_BLOCO = 1000;
const LIMITE_MAXIMO = 20000;

type Linha = { status: string | null; classificacao: string | null; origem: string | null };

export async function GET() {
  try {
    const supabase = createAdminClient();
    const clientes: Linha[] = [];

    for (let inicio = 0; inicio < LIMITE_MAXIMO; inicio += TAMANHO_BLOCO) {
      const { data, error } = await supabase
        .from("clientes")
        .select("status, classificacao, origem")
        .order("created_at", { ascending: false })
        .range(inicio, inicio + TAMANHO_BLOCO - 1);

      if (error) throw error;
      clientes.push(...(data || []));
      if (!data || data.length < TAMANHO_BLOCO) break;
    }

    return NextResponse.json({
      total: clientes.length,
      porStatus: agruparPorCampo(clientes, "status", "Não informado"),
      porClassificacao: agruparPorCampo(clientes, "classificacao", "Sem classificação"),
      porOrigem: agruparPorCampo(clientes, "origem", "Não informada"),
    });
  } catch (error) {
    console.error("[dashboard/clientes-metricas]", error);
    return NextResponse.json({ erro: "Erro ao montar métricas de clientes" }, { status: 500 });
  }
}
