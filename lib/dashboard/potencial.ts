/**
 * PEDIDO 1 (11/10) — Potencial de Vendas do vendedor.
 *
 * Agrupa as vendas CONFIRMADAS (`resultado = sucesso`, já filtradas pela
 * rota com a janela de período) por vendedor e monta, dentro de cada um,
 * o MIX por produto — "o que ele vendeu mais" — para a gestão direcionar
 * mais demanda daquele produto.
 *
 * Puro e sem rede: entradas = linhas de `oportunidades` + mapas de nomes
 * (profiles) e de produtos (id → nome).
 */

export interface VendaConfirmada {
  vendedor_id: string | null;
  produto_id: string | null;
  /** `valor_venda` pode vir nulo quando a venda foi sem valor fechado. */
  valor_venda: number | string | null;
}

export interface MixProduto {
  produto_id: string | null;
  produto_nome: string;
  qtd: number;
  valor_total: number;
}

export interface PotencialVendedor {
  vendedor_id: string;
  nome: string;
  total_vendas: number;
  valor_total: number;
  /** Do MAIS vendido ao menos (qtd → valor → nome como desempate). */
  mix: MixProduto[];
  /** O que ele vendeu mais — o produto para direcionar demanda. */
  produto_lider: MixProduto | null;
  /** Participação % no valor total de todos os vendedores (1 casa). */
  participacao: number;
}

function numero(v: VendaConfirmada["valor_venda"]): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function arredonda(n: number): number {
  return Math.round(n * 10) / 10;
}

export function montarPotencial(
  vendas: VendaConfirmada[],
  nomes: Record<string, string>,
  produtos: Record<string, string>,
): PotencialVendedor[] {
  const porVendedor = new Map<string, VendaConfirmada[]>();
  for (const v of vendas) {
    if (!v.vendedor_id) continue; // venda sem vendedor não entra
    const lista = porVendedor.get(v.vendedor_id);
    if (lista) lista.push(v);
    else porVendedor.set(v.vendedor_id, [v]);
  }

  const linhas: PotencialVendedor[] = [];
  porVendedor.forEach((lista, vendedor_id) => {
    const porProduto = new Map<string, MixProduto>();
    let valor_total = 0;
    for (const v of lista) {
      const valor = numero(v.valor_venda);
      valor_total += valor;
      const chave = v.produto_id || "";
      const atual = porProduto.get(chave) || {
        produto_id: v.produto_id,
        produto_nome: (v.produto_id && produtos[v.produto_id]) || "Sem produto",
        qtd: 0,
        valor_total: 0,
      };
      atual.qtd += 1;
      atual.valor_total += valor;
      porProduto.set(chave, atual);
    }

    const mix = Array.from(porProduto.values()).sort(
      (a, b) => b.qtd - a.qtd || b.valor_total - a.valor_total || a.produto_nome.localeCompare(b.produto_nome),
    );

    linhas.push({
      vendedor_id,
      nome: nomes[vendedor_id] || "Conta sem cadastro",
      total_vendas: lista.length,
      valor_total,
      mix,
      produto_lider: mix[0] || null,
      participacao: 0, // preenchido no final (depende do total geral)
    });
  });

  const geral = linhas.reduce((soma, l) => soma + l.valor_total, 0);
  for (const l of linhas) {
    l.participacao = geral > 0 ? arredonda((l.valor_total / geral) * 100) : 0;
  }

  return linhas.sort((a, b) => b.valor_total - a.valor_total || b.total_vendas - a.total_vendas);
}
