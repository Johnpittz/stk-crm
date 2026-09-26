import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * M1.6 — taxa de resposta pós-remarketing.
 *
 * Pergunta real: de quem recebeu a mensagem, quantos voltaram a falar?
 * Regra: cliente que falou por último com data >= criação da campanha.
 */

const { campanha, respostasCount } = vi.hoisted(() => ({
  campanha: { current: null as any },
  respostasCount: { current: 0 },
}))

function builder(tabela: string) {
  const b: any = {}
  for (const m of ['select', 'eq', 'in', 'gte', 'order', 'limit']) {
    b[m] = () => b
  }
  b.maybeSingle = async () => ({ data: campanha.current, error: null })
  b.then = (res: any, rej: any) =>
    Promise.resolve({ count: respostasCount.current, data: null, error: null }).then(res, rej)
  void tabela
  return b
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    from: (t: string) => builder(t),
  }),
}))

import { GET } from './route'

function req(query = 'id=abc') {
  return new NextRequest(`http://local/api/bulk/resultado-remarketing?${query}`)
}

describe('GET /api/bulk/resultado-remarketing — taxa de resposta (M1.6)', () => {
  beforeEach(() => {
    campanha.current = {
      id: 'abc',
      name: 'Remarketing 26/09',
      tipo: 'remarketing',
      numbers: [{ nome: 'Maria', telefone: '5562999990000' }, { nome: 'João', telefone: '5562988887777' }],
      created_at: '2026-09-26T12:00:00+00:00',
      sent: 2,
      failed: 0,
      status: 'completed',
    }
    respostasCount.current = 1
  })

  it('calcula taxa de resposta em porcentagem', async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.enviados).toBe(2)
    expect(body.respostas).toBe(1)
    expect(body.taxa).toBe(50)
  })

  it('sem ninguém que enviou → taxa nula (não 0% falso)', async () => {
    campanha.current = { ...campanha.current, sent: 0 }
    respostasCount.current = 0
    const body = await (await GET(req())).json()
    expect(body.taxa).toBeNull()
  })

  it('campanha avulsa não tem métrica de remarketing', async () => {
    campanha.current = { ...campanha.current, tipo: 'avulso' }
    const res = await GET(req())
    expect(res.status).toBe(400)
  })

  it('campanha inexistente → 404', async () => {
    campanha.current = null
    expect((await GET(req())).status).toBe(404)
  })

  it('sem id → 400', async () => {
    expect((await GET(req('x=1'))).status).toBe(400)
  })
})
