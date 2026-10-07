/**
 * Fase 1 — TEMPO DE RESPOSTA (docs/plano-dashboard-fases.md).
 *
 * Regra aprovada pelo João (06/10): PRIMEIRA resposta do vendedor ao
 * cliente, contada SÓ em horário comercial (seg–sex, 08:00–18:00,
 * Brasília/UTC-3 — mesma janela do chatbot). Fuso fixo: o Brasil não tem
 * horário de verão desde 2019.
 */

export interface MensagemRef {
  remetente: string;
  created_at: string;
  enviada_por?: string | null;
}

export interface Resposta {
  inicio: string;
  fim: string;
  minutos: number;
  /** id de quem respondeu (enviada_por) — usado pelo ranking Fase 2 */
  responsavel?: string | null;
}

const OFFSET_SP_MIN = 180; // UTC-3
const INICIO_UTIL_MIN = 8 * 60; // 08:00
const FIM_UTIL_MIN = 18 * 60; // 18:00

/**
 * Minutos ÚTEIS entre dois instantes (seg–sex, 08:00–18:00 SP).
 * Ex.: sex 17:00 → seg 09:00 = 60 + 60 = 120 (não 64h).
 */
export function minutosEmHorarioComercial(inicioIso: string, fimIso: string): number {
  const a = Date.parse(inicioIso);
  const b = Date.parse(fimIso);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;

  const aMin = Math.floor(a / 60000) - OFFSET_SP_MIN;
  const bMin = Math.floor(b / 60000) - OFFSET_SP_MIN;

  let total = 0;
  for (let d = Math.floor(aMin / 1440); d <= Math.floor(bMin / 1440); d++) {
    const inicioDiaUtc = (d * 1440 + OFFSET_SP_MIN) * 60000; // 00:00 SP do dia
    const meioDiaUtc = inicioDiaUtc + 12 * 60 * 60000; // 12:00 SP (para o weekday)
    const diaSemana = new Date(meioDiaUtc).getUTCDay(); // 0=domingo
    if (diaSemana === 0 || diaSemana === 6) continue;

    const ini = Math.max(a, inicioDiaUtc + INICIO_UTIL_MIN * 60000);
    const fim = Math.min(b, inicioDiaUtc + FIM_UTIL_MIN * 60000);
    if (fim > ini) total += Math.round((fim - ini) / 60000);
  }
  return total;
}

/**
 * Primeira espera de um atendimento: 1ª mensagem do cliente → 1ª resposta
 * do vendedor HUMANO (`enviada_por` preenchido; automação/chatbot não
 * conta). Null quando não houve resposta.
 */
export function primeiraResposta(mensagens: MensagemRef[]): Resposta | null {
  const ordenadas = [...mensagens].sort((a, b) =>
    a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0,
  );

  let inicio: string | null = null;
  for (const m of ordenadas) {
    if (inicio === null) {
      if (m.remetente === "cliente") inicio = m.created_at;
      continue;
    }
    if (m.remetente === "vendedor" && m.enviada_por) {
      return {
        inicio,
        fim: m.created_at,
        minutos: minutosEmHorarioComercial(inicio, m.created_at),
        responsavel: m.enviada_por,
      };
    }
  }
  return null;
}

export interface Resumo {
  media: number;
  n: number;
}

function media(valores: number[]): Resumo {
  if (valores.length === 0) return { media: 0, n: 0 };
  const soma = valores.reduce((acc, v) => acc + v, 0);
  return { media: Math.round((soma / valores.length) * 10) / 10, n: valores.length };
}

/** Data civil (YYYY-MM-DD) de Brasília para um instante. */
export function diaSp(iso: string): string {
  const sp = (Date.parse(iso) / 60000 - OFFSET_SP_MIN) * 60000;
  return new Date(sp).toISOString().slice(0, 10);
}

/** Resumo geral + de HOJE (dia de SP do fim da resposta). */
export function resumoTempoResposta(
  respostas: Array<{ fim: string; minutos: number }>,
  agoraIso: string,
): { geral: Resumo; hoje: Resumo } {
  const hoje = diaSp(agoraIso);
  const geral = media(respostas.map((r) => r.minutos));
  const deHoje = media(
    respostas.filter((r) => diaSp(r.fim) === hoje).map((r) => r.minutos),
  );
  return { geral, hoje: deHoje };
}
