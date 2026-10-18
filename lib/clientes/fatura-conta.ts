/**
 * PARTE 11 (PPTX 17/10) — fatura anexada no cadastro/edição já cai em
 * GESTÃO DE FATURA. Puro e testável: do texto do
 * PDF acha valor/consumo e monta a linha da pasta.
 */
export interface DadosConta {
  valor: number | null;
  consumo: number | null;
}

/** Competência do mês corrente no formato AAAA-MM. */
export function competenciaAtual(d: Date = new Date()): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

/** Lê texto do PDF da conta: valor total a pagar e consumo (kWh). */
export function extrairDadosConta(texto: string): DadosConta {
  const t = texto || "";

  // Valor: "TOTAL A PAGAR R$ 1.234,56", "VALOR TOTAL: R$ 89.90"
  let valor: number | null = null;
  // 18/10: capas Equatorial trazem o valor mascarado ("R$*******4.687,56")
  // — aceita asteriscos/espaços entre o cifrão e o número
  const reValor = /(?:total\s+a\s+pagar|valor\s+total|total\s+da\s+fatura)[^\n$]*?r?\$?[\s*]*([\d.,]+)/i;
  const mv = t.match(reValor);
  if (mv) valor = paraNumero(mv[1]);
  // 18/10: sem rótulo na capa (só o cifrão protegido) — o único "R$***"
  // da fatura é o valor a pagar; a análise da IA completa o resto
  if (valor == null) {
    const mm = t.match(/r\$\s*\*+\s*([\d.,]+)/i);
    if (mm) valor = paraNumero(mm[1]);
  }

  // Consumo: "CONSUMO 342 kWh", "CONSUMO: 100 kWh"
  let consumo: number | null = null;
  const reConsumo = /consumo[^\n]*?([\d.,]+)\s*kwh/i;
  const mc = t.match(reConsumo);
  if (mc) consumo = paraNumero(mc[1]);

  return { valor, consumo };
}

/** "1.234,56" → 1234.56 | "89.90" → 89.9 | "342" → 342 */
export function paraNumero(bruto: string): number | null {
  let s = (bruto || "").trim();
  if (!s) return null;
  // formato brasileiro (1.234,56) → remove pontos, vírgula vira ponto
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Linha pronta pra inserir em cliente_pasta_linhas (Gestão de Fatura). */
export function montarLinhaGestaoFatura(entrada: {
  competencia: string;
  valor: number | null;
  consumo: number | null;
}): { linha: "gestao_fatura"; dados: Record<string, unknown> } {
  return {
    linha: "gestao_fatura",
    dados: {
      competencia: entrada.competencia,
      valor: entrada.valor,
      consumo_kwh: entrada.consumo,
      situacao: "Pendente",
    },
  };
}
