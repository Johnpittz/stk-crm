/**
 * F0.1 — Esteira única de notificações.
 *
 * Toda insert em `notificacoes` passa por aqui. Motivo: a tabela tem
 * `user_id NOT NULL` e CHECK de `tipo` (migration 009) — inserts "cruzos"
 * morrem em silêncio no PostgREST e o sino nunca acende.
 *
 * Regras:
 *  - tipo fora do catálogo é RECUSADO aqui (o CHECK do banco recusaria depois);
 *  - sem destinário explícito, notifica a audiência padrão (vendedores + admins);
 *  - lote com as MESMAS chaves em todos os objetos (exigência do PostgREST);
 *  - nunca lança exceção: retorna { ok, enviadas, erro? }.
 */

export const TIPOS_NOTIFICACAO = [
  'atendimento_novo',
  'atendimento_mensagem',
  'tarefa_nova',
  'transbordo',
  'meta_alcancada',
  'chatbot',
  'meta_atingida',
] as const

export type TipoNotificacao = (typeof TIPOS_NOTIFICACAO)[number]

/** Cargos que recebem notificação quando não há destinário explícito. */
export const CARGOS_NOTIFICACAO = ['vendedor', 'admin']

export interface NovoNotificacao {
  /** Destinário único (quando já se sabe quem). */
  userId?: string | null
  /** Vários destinários conhecidos (pula a busca em profiles). */
  userIds?: string[] | null
  tipo: TipoNotificacao
  titulo: string
  mensagem: string
  dados?: Record<string, unknown>
}

export interface ResultadoNotificacao {
  ok: boolean
  enviadas: number
  erro?: string
}

type SupabaseLike = {
  from: (tabela: string) => any
}

export async function criarNotificacao(
  supabase: SupabaseLike,
  params: NovoNotificacao
): Promise<ResultadoNotificacao> {
  if (!TIPOS_NOTIFICACAO.includes(params.tipo)) {
    return { ok: false, enviadas: 0, erro: `tipo_invalido:${String(params.tipo)}` }
  }
  if (!params.titulo || !params.mensagem) {
    return { ok: false, enviadas: 0, erro: 'titulo_mensagem_obrigatorios' }
  }

  // 1. Destinatários
  let destinatarios: string[] = []
  if (params.userId) {
    destinatarios = [params.userId]
  } else if (Array.isArray(params.userIds) && params.userIds.length) {
    destinatarios = params.userIds
  } else {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id,cargo')
        .in('cargo', CARGOS_NOTIFICACAO)
      if (error) {
        return { ok: false, enviadas: 0, erro: `profiles:${error.message}` }
      }
      destinatarios = (data ?? []).map((p: { id: string }) => p.id)
    } catch (e: any) {
      return { ok: false, enviadas: 0, erro: `profiles:${e?.message ?? e}` }
    }
  }

  if (!destinatarios.length) {
    return { ok: false, enviadas: 0, erro: 'sem_destinatario' }
  }

  // 2. Lote com chaves idênticas (PostgREST: "All object keys must match")
  const base = {
    tipo: params.tipo,
    titulo: params.titulo,
    mensagem: params.mensagem,
    lida: false,
  }
  const linhas = destinatarios.map((user_id) => ({
    user_id,
    ...base,
    dados: params.dados ?? {},
  }))

  // 3. Insert
  try {
    const { error } = await supabase.from('notificacoes').insert(linhas)
    if (error) {
      return { ok: false, enviadas: 0, erro: error.message }
    }
    return { ok: true, enviadas: linhas.length }
  } catch (e: any) {
    return { ok: false, enviadas: 0, erro: e?.message ?? String(e) }
  }
}
