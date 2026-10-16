/**
 * ITEM 5 (16/10) — edição de oportunidade no KANBAN para qualquer card.
 * Montagem do PATCH /api/oportunidades: título, descrição, prioridade,
 * etapa (coluna do funil) e valor da venda (moeda BR → número).
 */

export interface FormEdicaoOportunidade {
  titulo: string;
  descricao: string;
  prioridade: string;
  valorVenda: string;
  etapa: string;
}

/** "1.234,56" → 1234.56 | "1500" → 1500 | vazio/inválido → null */
export function parseValorMoeda(bruto: string): number | null {
  const limpo = (bruto || "").trim();
  if (!limpo) return null;
  const numero = parseFloat(limpo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

export function montarCorpoEdicao(
  id: string,
  form: FormEdicaoOportunidade,
): Record<string, unknown> {
  const corpo: Record<string, unknown> = {
    id,
    titulo: form.titulo,
    descricao: form.descricao,
    prioridade: form.prioridade,
  };

  const etapa = (form.etapa || "").trim();
  if (etapa) corpo.etapa = etapa;

  const valor = parseValorMoeda(form.valorVenda);
  if (valor !== null) corpo.valor_venda = valor;

  return corpo;
}
