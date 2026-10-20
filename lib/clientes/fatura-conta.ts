/**
 * PARTE 11 (PPTX 17/10) — fatura anexada no cadastro/edição já cai em
 * GESTÃO DE FATURA. Puro e testável: do texto do
 * PDF acha valor/consumo e monta a linha da pasta.
 */
import { diaDeHoje } from "./analise-conta";
// 19/10 — "4.548" é milhar na conta; o Number() local lia 4,548
import { numeroBR } from "../ia/analisar-fatura";

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
/**
 * Card automático no kanban quando a fatura é inserida (pedido 18/10).
 * Cria em "recebeu_conta" só quando o cliente ainda não tem card lá —
 * cards em outras etapas (negociação avançada) não bloqueiam.
 */
export function deveCriarCardFatura(cards: { etapa?: string | null; [chave: string]: unknown }[]): boolean {
  return !cards.some((c) => c.etapa === "recebeu_conta");
}

export function montarLinhaGestaoFatura(entrada: {
  competencia: string;
  valor: number | null;
  consumo: number | null;
  /** 18/10 — dia em que a conta chegou (AAAA-MM-DD). Opcional: sem ele grava hoje. */
  dia?: string;
}): { linha: "gestao_fatura"; dados: Record<string, unknown> } {
  return {
    linha: "gestao_fatura",
    dados: {
      competencia: entrada.competencia,
      dia: entrada.dia || diaDeHoje(),
      valor: entrada.valor,
      consumo_kwh: entrada.consumo,
      situacao: "Pendente",
      // 18/10 — FLUXO ÚNICO: o botão é só "Análise da Fatura". A conta entra
      // no kanban de faturas como RECEBIDA e só vira ANALISADA quando a IA
      // termina de ler (aí guarda o resumo em resumo_analise).
      fluxo: "recebida",
      resumo_analise: null,
    },
  };
}

/**
 * 18/10 — segunda etapa do fluxo: a IA já leu a conta, então a linha do
 * kanban de faturas passa de RECEBIDA para ANALISADA guardando o resumo.
 * Valor/consumo vindos do PDF são preservados (a análise só completa o
 * que faltava — nunca sobrescreve dado já lido).
 */
export function marcarComoAnalisada(
  dados: Record<string, unknown>,
  resumo: {
    concessionaria: string | null;
    uc: string | null;
    titular: string | null;
    cnpj_cpf: string | null;
    vencimento: string | null;
    consumo: string | null;
    valor: string | null;
  }
): Record<string, unknown> {
  const valorAnalise = numeroBR(resumo.valor);
  const consumoAnalise = numeroBR(resumo.consumo);

  return {
    ...dados,
    valor: dados.valor ?? valorAnalise,
    consumo_kwh: dados.consumo_kwh ?? consumoAnalise,
    situacao: "Conferida",
    fluxo: "analise-concluida",
    resumo_analise: resumo,
  };
}
