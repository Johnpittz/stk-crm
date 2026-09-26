/**
 * Fase 2 / M1 — público de REMARKETING (docs/plano-acao-modulos.md).
 *
 * FONTE ÚNICA da régua do remarketing no lado web. O worker tem o espelho
 * desta regra em Python (`handler_remarketing_diario`); se uma mudar, muda
 * nos dois lados — nada de lógica duplicada.
 *
 * ⚠️ AS DUAS BASES NÃO SE CONFUNDEM (ajuste central do plano):
 *   C1 (CRM)      → CLIENTE falou por último e nós não respondemos há 24h
 *                   (lib/atendimentos/sem-resposta.ts)
 *   M1 (Marketing)→ NÓS falamos por último e o CLIENTE não respondeu há 24h
 *                   (este arquivo)
 * As duas são disjuntas: uma conversa nunca está nas duas listas.
 *
 * Regra (decisão D1 — janela de 24h):
 *   status IN ('aberto','em_andamento')
 *   E ultima_mensagem_remetente <> 'cliente' (e não nulo)
 *   E ultima_mensagem_data <= now() - JANELA
 *
 * Remetente nulo/não identificado NÃO entra: se não dá pra provar que
 * fomos nós, não arriscamos mandar mensagem no WhatsApp.
 */

export const JANELA_REMARKETING_HORAS = 24

/** Status em que a conversa está viva (as demais não recebem remarketing). */
export const STATUS_PUBLICO_ABERTO = ["aberto", "em_andamento"] as const

const REMETENTE_CLIENTE = "cliente"

export interface ConversaRemarketing {
  status: string | null;
  ultima_mensagem_remetente?: string | null;
  ultima_mensagem_data?: string | null;
}

/** Corte em UTC. `toISOString()` sai com "Z" e nunca com "+00:00"
 *  (sinal "+" na query string do PostgREST vira espaço — bug de 26/09). */
export function corteRemarketing(
  agora: Date,
  horas: number = JANELA_REMARKETING_HORAS
): string {
  return new Date(agora.getTime() - horas * 3_600_000).toISOString()
}

export function ehPublicoRemarketing(
  conversa: ConversaRemarketing | null | undefined,
  agora: Date = new Date(),
  horas: number = JANELA_REMARKETING_HORAS
): boolean {
  if (!conversa) return false
  if (!STATUS_PUBLICO_ABERTO.includes(conversa.status as any)) return false

  const remetente = (conversa.ultima_mensagem_remetente ?? "").trim()
  if (!remetente || remetente === REMETENTE_CLIENTE) return false

  const ms = Date.parse(conversa.ultima_mensagem_data ?? "")
  if (!Number.isFinite(ms)) return false

  return agora.getTime() - ms >= horas * 3_600_000
}

export function contarPublicoRemarketing(
  lista: readonly ConversaRemarketing[],
  agora: Date = new Date(),
  horas: number = JANELA_REMARKETING_HORAS
): number {
  return lista.filter((c) => ehPublicoRemarketing(c, agora, horas)).length
}

/** Query PostgREST mínima para a MESMA regra (leitura server-side / preview). */
interface QueryPublicoRemarketing {
  in: (coluna: string, valores: readonly string[]) => any;
  neq: (coluna: string, valor: string) => any;
  lte: (coluna: string, valor: string) => any;
}

export function aplicarFiltroPublicoRemarketing<T extends QueryPublicoRemarketing>(
  query: T,
  agora: Date = new Date(),
  horas: number = JANELA_REMARKETING_HORAS
): T {
  return query
    .in("status", [...STATUS_PUBLICO_ABERTO])
    .neq("ultima_mensagem_remetente", REMETENTE_CLIENTE)
    .lte("ultima_mensagem_data", corteRemarketing(agora, horas))
}

// ─── opt-out ───────────────────────────────────────────────────────────
// Quem pediu para parar entra em `remarketing_opt_out` e sai de TODO público,
// para sempre. O chatbot já detecta o pedido (ehPedidoDeParada) — é lá que a
// chamada de `registrarOptOut` acontece.

/** Só dígitos — é a chave de comparação do worker também. */
export function normalizarTelefone(valor: unknown): string {
  return String(valor ?? "").replace(/\D/g, "")
}

export interface ResultadoOptOut {
  ok: boolean;
  erro?: string;
}

type SupabaseLike = { from: (tabela: string) => any };

/**
 * Registra a recusa. Nunca lança exceção: se o insert falhar, o remarketing
 * ainda é bloqueado pela regra de "sem resposta" quando o cliente responder.
 */
/**
 * M1.6 — taxa de resposta pós-remarketing (%, 1 casa).
 * `null` quando ninguém foi enviado — "0%" seria mentira (não houve base).
 */
export function calcularTaxaResposta(enviados: unknown, respostas: unknown): number | null {
  const e = Number(enviados)
  const r = Number(respostas)
  if (!Number.isFinite(e) || e <= 0) return null
  if (!Number.isFinite(r) || r < 0) return null
  return Math.min(100, Math.round((r / e) * 1000) / 10)
}

export async function registrarOptOut(
  supabase: SupabaseLike,
  telefone: unknown,
  motivo: string = "pedido_do_cliente"
): Promise<ResultadoOptOut> {
  const digitos = normalizarTelefone(telefone)
  if (digitos.length < 8) {
    return { ok: false, erro: "telefone_invalido" }
  }
  try {
    const { error } = await supabase
      .from("remarketing_opt_out")
      .upsert(
        { telefone: digitos, motivo },
        { onConflict: "telefone", ignoreDuplicates: false }
      )
    if (error) return { ok: false, erro: error.message }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, erro: e?.message ?? String(e) }
  }
}
