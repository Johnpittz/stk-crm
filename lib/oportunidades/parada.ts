/**
 * Fase 1 / C2 — "oportunidade parada" no funil (docs/plano-acao-modulos.md).
 *
 * FONTE ÚNICA no lado web (badge de coluna do kanban). O worker tem o
 * espelho desta régua em Python — se uma mudar, muda a outra.
 *
 * Regra:
 *   etapa diferente de ETAPA_FINAL (comissao_paga)
 *   E updated_at mais velho que o limite da etapa
 *
 * Limite da etapa: por_etapa[etapa] ?? parada_horas ?? PARADA_HORAS_PADRAO.
 * Os parâmetros vêm de worker_rotinas.config (rotina preparacao_alerta_kanban),
 * então dá para ajustar sem deploy.
 */

export const PARADA_HORAS_PADRAO = 72

/** Última coluna do funil: oportunidade concluída, nunca gera alerta. */
export const ETAPA_FINAL = "comissao_paga"

export interface RegraParada {
  parada_horas?: number | null;
  por_etapa?: Record<string, number | null> | null;
}

export interface OportunidadeParavel {
  id?: string;
  etapa?: string | null;
  updated_at?: string | null;
}

function normalizarHoras(valor: unknown): number | null {
  const n = typeof valor === "string" ? Number(valor) : (valor as number)
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null
  return n
}

export function horasDaEtapa(
  etapa: string | null | undefined,
  regra: RegraParada = {}
): number {
  const porEtapa =
    regra.por_etapa && typeof regra.por_etapa === "object" ? regra.por_etapa : {}
  const custom = etapa ? normalizarHoras(porEtapa[etapa]) : null
  if (custom !== null) return custom
  return normalizarHoras(regra.parada_horas) ?? PARADA_HORAS_PADRAO
}

export function estaParada(
  oportunidade: OportunidadeParavel | null | undefined,
  agora: Date = new Date(),
  regra: RegraParada = {}
): boolean {
  if (!oportunidade) return false
  if ((oportunidade.etapa ?? "") === ETAPA_FINAL) return false

  const ms = Date.parse(oportunidade.updated_at ?? "")
  if (!Number.isFinite(ms)) return false

  return agora.getTime() - ms >= horasDaEtapa(oportunidade.etapa, regra) * 3_600_000
}

/** Mapa { etapa: n° de paradas } — só etapas com parada entram (badge some). */
export function contarParadasPorEtapa(
  lista: readonly OportunidadeParavel[],
  agora: Date = new Date(),
  regra: RegraParada = {}
): Record<string, number> {
  const mapa: Record<string, number> = {}
  for (const o of lista) {
    if (!estaParada(o, agora, regra)) continue
    const etapa = o.etapa || "sem_etapa"
    mapa[etapa] = (mapa[etapa] ?? 0) + 1
  }
  return mapa
}
