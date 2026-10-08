/**
 * Fase 3 — dimensão PRODUTO no Dashboard.
 * Puro: cruza as 1ª respostas medidas com as oportunidades e a lista de
 * produtos e devolve uma linha por produto — tempo de resposta + números
 * comerciais (oportunidades, vendas, valor).
 *
 * Vínculo: oportunidade.produto_id (migration 095); a resposta entra no
 * produto da oportunidade do MESMO atendimento. Sem vínculo → "Sem produto".
 * "Venda" = resultado ganho (funil) ou sucesso (comissão paga).
 */
export interface RespostaAtendimento {
  atendimento_id: string;
  minutos: number;
}

export interface OportunidadeRef {
  id?: string;
  atendimento_id?: string | null;
  produto_id?: string | null;
  resultado?: string | null;
  valor_venda?: number | null;
}

export interface LinhaProduto {
  nome: string;
  media: number;
  n: number;
  pior: number;
  oportunidades: number;
  vendas: number;
  valor_venda: number;
}

export function dimensaoProdutos(entrada: {
  respostas: RespostaAtendimento[];
  oportunidades: OportunidadeRef[];
  produtos: Array<{ id: string; nome: string }>;
}): LinhaProduto[] {
  const { respostas, oportunidades, produtos } = entrada;

  const nomePorId = new Map(produtos.map((p) => [p.id, p.nome]));
  const nomeDe = (produtoId: string | null | undefined) =>
    (produtoId ? nomePorId.get(produtoId) : undefined) ?? "Sem produto";

  interface Grupo {
    minutos: number[];
    oportunidades: number;
    vendas: number;
    valor_venda: number;
  }
  const grupos = new Map<string, Grupo>();
  const grupoDe = (nome: string): Grupo => {
    let g = grupos.get(nome);
    if (!g) {
      g = { minutos: [], oportunidades: 0, vendas: 0, valor_venda: 0 };
      grupos.set(nome, g);
    }
    return g;
  };

  // oportunidades → produto (comercial)
  const produtoPorAtendimento = new Map<string, string | null>();
  for (const o of oportunidades) {
    const nome = nomeDe(o.produto_id);
    const g = grupoDe(nome);
    g.oportunidades += 1;
    if (o.resultado === "ganho" || o.resultado === "sucesso") {
      g.vendas += 1;
      g.valor_venda += Number(o.valor_venda || 0);
    }
    if (o.atendimento_id && o.produto_id) {
      produtoPorAtendimento.set(o.atendimento_id, o.produto_id);
    }
  }

  // respostas → produto (tempo)
  for (const r of respostas) {
    const produtoId = produtoPorAtendimento.get(r.atendimento_id) ?? null;
    grupoDe(nomeDe(produtoId)).minutos.push(r.minutos);
  }

  const linhas: LinhaProduto[] = [];
  grupos.forEach((g, nome) => {
    const soma = g.minutos.reduce((a, b) => a + b, 0);
    linhas.push({
      nome,
      media: g.minutos.length ? Math.round((soma / g.minutos.length) * 10) / 10 : 0,
      n: g.minutos.length,
      pior: g.minutos.length ? Math.max(...g.minutos) : 0,
      oportunidades: g.oportunidades,
      vendas: g.vendas,
      valor_venda: g.valor_venda,
    });
  });

  // do que responde mais devagar ao mais rápido
  return linhas.sort((a, b) => b.media - a.media);
}
