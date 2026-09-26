/**
 * Fase 1 / C1 — "conversa sem resposta" (docs/plano-acao-modulos.md).
 *
 * FONTE ÚNICA da régua de 24h. Quem consome esta regra:
 *  - filtro "Sem resposta" da lista lateral de atendimentos;
 *  - badge de linha (relógio âmbar);
 *  - remarketing do M1 (Fase 2) — via aplicarFiltroSemResposta, sem
 *    reescrever a lógica do lado de lá.
 *
 * Regra:
 *   status aberto/em_andamento
 *   E cliente foi o último a falar
 *   E já se passaram JANELA_SEM_RESPOSTA_HORAS desde a última mensagem.
 */

export const JANELA_SEM_RESPOSTA_HORAS = 24

/** Status em que a conversa está viva (e portanto pode estar nos devendo). */
export const STATUS_CONVERSA_ABERTA = ["aberto", "em_andamento"] as const

/** Remetentes que significam "a bola está com o cliente". */
const REMETENTE_CLIENTE = "cliente"

export interface Conversa {
  status: string | null;
  ultima_mensagem_remetente?: string | null;
  ultima_mensagem_data?: string | null;
}

/** Corte em UTC. `toISOString()` sai com "Z" e nunca com "+00:00"
 *  (sinal "+" na query string do PostgREST vira espaço — bug de 26/09). */
export function corteSemResposta(
  agora: Date,
  horas: number = JANELA_SEM_RESPOSTA_HORAS
): string {
  return new Date(agora.getTime() - horas * 3_600_000).toISOString()
}

export function estaSemResposta(
  conversa: Conversa | null | undefined,
  agora: Date = new Date(),
  horas: number = JANELA_SEM_RESPOSTA_HORAS
): boolean {
  if (!conversa) return false
  if (!STATUS_CONVERSA_ABERTA.includes(conversa.status as any)) return false
  if (conversa.ultima_mensagem_remetente !== REMETENTE_CLIENTE) return false

  const ms = Date.parse(conversa.ultima_mensagem_data ?? "")
  if (!Number.isFinite(ms)) return false

  return agora.getTime() - ms >= horas * 3_600_000
}

/**
 * Horas inteiras de espera — é o número do badge (ex.: "25h", do exemplo
 * do plano), não o "24h+" genérico. `null` com data inválida = sem badge.
 */
export function horasDeEspera(
  conversa: Conversa | null | undefined,
  agora: Date = new Date()
): number | null {
  const ms = Date.parse(conversa?.ultima_mensagem_data ?? "")
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.floor((agora.getTime() - ms) / 3_600_000))
}

export function filtrarSemResposta<T extends Conversa>(
  lista: readonly T[],
  agora: Date = new Date(),
  horas: number = JANELA_SEM_RESPOSTA_HORAS
): T[] {
  return lista.filter((c) => estaSemResposta(c, agora, horas))
}

export function contarSemResposta(
  lista: readonly Conversa[],
  agora: Date = new Date(),
  horas: number = JANELA_SEM_RESPOSTA_HORAS
): number {
  return filtrarSemResposta(lista, agora, horas).length
}

/** Query PostgREST mínima para a MESMA regra (leitura server-side). */
interface QuerySemResposta {
  in: (coluna: string, valores: readonly string[]) => any;
  eq: (coluna: string, valor: string) => any;
  gte: (coluna: string, valor: string) => any;
}

export function aplicarFiltroSemResposta<T extends QuerySemResposta>(
  query: T,
  agora: Date = new Date(),
  horas: number = JANELA_SEM_RESPOSTA_HORAS
): T {
  return query
    .in("status", [...STATUS_CONVERSA_ABERTA])
    .eq("ultima_mensagem_remetente", REMETENTE_CLIENTE)
    .gte("ultima_mensagem_data", corteSemResposta(agora, horas))
}
