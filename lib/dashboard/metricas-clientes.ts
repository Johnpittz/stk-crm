/**
 * ITEM 7 (16/10) — métricas do DASHBOARD por status, classificação e
 * origem dos clientes. Agrupamento puro (sem IO): o campo pedido vira
 * {valor → total}, vazio/nulo vai para o rótulo "sem informação",
 * ordenado do maior para o menor (desempate alfabético).
 */

export interface ContagemValor {
  valor: string;
  total: number;
}

export function agruparPorCampo<T extends Record<string, unknown>>(
  registros: T[],
  campo: keyof T & string,
  semInfo: string,
): ContagemValor[] {
  const contagens = new Map<string, number>();

  for (const registro of registros) {
    const bruto = registro[campo];
    const valor =
      bruto === null || bruto === undefined || String(bruto).trim() === ""
        ? semInfo
        : String(bruto).trim();
    contagens.set(valor, (contagens.get(valor) ?? 0) + 1);
  }

  return Array.from(contagens.entries())
    .map(([valor, total]) => ({ valor, total }))
    .sort((a, b) => (b.total - a.total) || a.valor.localeCompare(b.valor));
}
