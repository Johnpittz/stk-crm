import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/funil — dados do funil do dashboard (22/10).
 *
 * O dashboard leria `/api/tarefas`, mas a tabela `tarefas` está vazia e sem
 * as colunas do funil (migration 103 pendente). Os dados REAIS do funil
 * (recebeu_conta → comissao_paga) são as etapas de `oportunidades` — a
 * mesma fonte do Kanban. Devolve o formato `{ tarefas }` que a página já
 * consome, com `etapa` mapeada para `coluna_kanban`.
 *
 * `?vendedor_id=` filtra por vendedor (gestores escolhem quem olhar;
 * vendedor comum continua vendo só o dele — mesma regra de /api/tarefas).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const vendedorPedido = searchParams.get("vendedor_id");

  // 02/11 (varredura de lentidão): UMA única leitura de profile serve para
  // decidir o filtro de cargo — antes havia até 2 chamadas de profile +
  // 1 de nomes (roundtrips de rede eram ~1s do tempo do F5).
  const { data: meuPerfil } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .maybeSingle();
  const gestor = ["diretor", "admin", "gerente_comercial"].includes(
    meuPerfil?.cargo || ""
  );

  let alvoVendedor: string | null = null;
  if (vendedorPedido && vendedorPedido !== user.id && gestor) {
    alvoVendedor = vendedorPedido;
  }

  let query = supabase
    .from("oportunidades")
    .select(
      // embed da FK: nome do vendedor vem NA MESMA roundtrip (eliminava
      // uma 3ª chamada só para popular vendedor_nome)
      "id, titulo, etapa, valor_venda, created_at, vendedor_id, clientes(id, nome_razao_social), profiles:vendedor_id(nome_completo)"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (alvoVendedor) {
    query = query.eq("vendedor_id", alvoVendedor);
  } else if (!vendedorPedido && !gestor) {
    // sem filtro explícito: gestores veem tudo; vendedor vê o dele
    query = query.eq("vendedor_id", user.id);
  }

  let oportunidades: any[] = [];
  try {
    const { data, error } = await query;
    if (error) {
      console.warn("[API dashboard/funil] query falhou:", error.message);
    } else {
      oportunidades = data || [];
    }
  } catch (err: any) {
    console.warn("[API dashboard/funil] exceção:", err?.message);
  }

  // nome do vendedor vem do embed profiles:vendedor_id (mesma roundtrip)
  const nomes: Record<string, string> = {};
  for (const o of oportunidades) {
    if (o.vendedor_id && o.profiles?.nome_completo) {
      nomes[o.vendedor_id] = o.profiles.nome_completo;
    }
  }

  const tarefas = oportunidades.map((o) => ({
    id: o.id,
    titulo: o.titulo,
    // etapa de oportunidade já é a coluna do funil do dashboard
    coluna_kanban: o.etapa,
    valor_venda: o.valor_venda,
    created_at: o.created_at,
    vendedor_id: o.vendedor_id,
    vendedor_nome: o.vendedor_id ? nomes[o.vendedor_id] || null : null,
    cliente_nome: o.clientes?.nome_razao_social || null,
  }));

  return NextResponse.json({ tarefas });
}
