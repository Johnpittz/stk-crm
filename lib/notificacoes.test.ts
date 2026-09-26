import { describe, it, expect, vi } from 'vitest'
import { criarNotificacao, TIPOS_NOTIFICACAO, CARGOS_NOTIFICACAO } from './notificacoes'

/**
 * F0.1 — esteira de notificações (docs/plano-acao-modulos.md).
 *
 * Bugs reais encontrados em 26/09/2026:
 *  - lib/chatbot/engine.ts e app/api/chatbot/route.ts inseriam SEM user_id
 *    (coluna NOT NULL) e com tipo fora do CHECK da migration 009.
 *  - app/api/webhooks/millennium/route.ts inseria `vendedor_id`, coluna que
 *    não existe em `notificacoes`.
 * Motivo da tabela aparecer vazia: scripts/limpar-atendimentos-teste.sql:40
 * apaga as notificações de atendimento (o TRIGGER da migration 009 funciona).
 */

function supabaseStub(opts: { perfis?: any[]; insertError?: any } = {}) {
  const inserts: any[] = []
  const perfis = opts.perfis ?? []
  return {
    inserts,
    from: (tabela: string) => {
      if (tabela === 'notificacoes') {
        return {
          insert: (linhas: any) => {
            inserts.push(linhas)
            return { error: opts.insertError ?? null }
          },
        }
      }
      if (tabela === 'profiles') {
        return {
          select: () => ({
            in: (col: string, vals: string[]) => ({
              data: perfis.filter((p) => vals.includes(p[col])),
              error: null,
            }),
          }),
        }
      }
      throw new Error(`tabela inesperada: ${tabela}`)
    },
  }
}

describe('criarNotificacao — F0.1 (esteira de notificações)', () => {
  it('RECUSA tipo fora do catálogo (CHECK do banco rejeitaria)', async () => {
    const sb = supabaseStub()
    const r = await criarNotificacao(sb as any, {
      tipo: 'isso_nao_existe' as any,
      titulo: 'x',
      mensagem: 'y',
    })
    expect(r.ok).toBe(false)
    expect(r.erro).toMatch(/^tipo_invalido/)
    expect(sb.inserts).toHaveLength(0)
  })

  it('sempre grava user_id — era o bug do chatbot', async () => {
    const sb = supabaseStub()
    const r = await criarNotificacao(sb as any, {
      userId: 'user-1',
      tipo: 'chatbot',
      titulo: 'Lead encaminhado',
      mensagem: 'motivo',
    })
    expect(r.ok).toBe(true)
    expect(sb.inserts).toHaveLength(1)
    expect(sb.inserts[0][0].user_id).toBe('user-1')
    expect(sb.inserts[0][0].tipo).toBe('chatbot')
    expect(sb.inserts[0][0].lida).toBe(false)
  })

  it('sem destinário explícito: notifica vendedores e admins', async () => {
    const sb = supabaseStub({ perfis: [{ id: 'v1', cargo: 'vendedor' }, { id: 'a1', cargo: 'admin' }] })
    const r = await criarNotificacao(sb as any, {
      tipo: 'chatbot',
      titulo: 'Lead',
      mensagem: 'm',
    })
    expect(r.ok).toBe(true)
    expect(r.enviadas).toBe(2)
    const ids = sb.inserts[0].map((l: any) => l.user_id)
    expect(ids.sort()).toEqual(['a1', 'v1'])
  })

  it('sem destinário e sem perfis: não insere nada e avisa', async () => {
    const sb = supabaseStub({ perfis: [] })
    const r = await criarNotificacao(sb as any, { tipo: 'chatbot', titulo: 'x', mensagem: 'y' })
    expect(r.ok).toBe(false)
    expect(r.erro).toBe('sem_destinatario')
    expect(sb.inserts).toHaveLength(0)
  })

  it('todo lote tem as MESMAS chaves (PostgREST exige)', async () => {
    const sb = supabaseStub({ perfis: [{ id: 'v1', cargo: 'vendedor' }, { id: 'v2', cargo: 'vendedor' }] })
    await criarNotificacao(sb as any, { tipo: 'chatbot', titulo: 'x', mensagem: 'y', dados: { a: 1 } })
    const chaves = sb.inserts[0].map((l: any) => Object.keys(l).sort().join(','))
    expect(new Set(chaves).size).toBe(1)
    expect(chaves[0].split(',')).toEqual(['dados', 'lida', 'mensagem', 'tipo', 'titulo', 'user_id'])
  })

  it('erro do banco vira { ok: false } sem lançar exceção', async () => {
    const sb = supabaseStub({ insertError: { message: 'violacao de check' } })
    const r = await criarNotificacao(sb as any, {
      userId: 'u',
      tipo: 'chatbot',
      titulo: 'x',
      mensagem: 'y',
    })
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('violacao de check')
  })

  it('catálogo cobre todos os tipos usados no código', () => {
    for (const t of ['atendimento_novo', 'atendimento_mensagem', 'tarefa_nova', 'transbordo', 'meta_alcancada', 'chatbot', 'meta_atingida']) {
      expect(TIPOS_NOTIFICACAO).toContain(t as any)
    }
    expect(CARGOS_NOTIFICACAO).toEqual(['vendedor', 'admin'])
  })
})
