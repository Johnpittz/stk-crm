import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from './route'

/**
 * Lentidão do Marketing (mapeada em 26/09): `GET /api/bulk/campaigns` devolvia
 * `select("*")` — 28,6 MB em 9,9–11,9 s, porque `fluxo_mensagens` guarda as
 * imagens dos passos EM BASE64 dentro do banco (28,46 MB das 28,6 MB).
 *
 * A tela já busca o fluxo separadamente, só quando o detalhe abre
 * (`page.tsx` linha ~107: `.select('fluxo_mensagens').eq('id', ...)`), então a
 * LISTA não precisa dessa coluna.
 *
 * Regra: nem o GET (lista) nem o POST (retorno da criação) podem pedir
 * `fluxo_mensagens`.
 */

const selects: string[] = []

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (_t: string) => ({
      select: (s: string) => {
        selects.push(s)
        const registro = {
          order: () => Promise.resolve({ data: [{ id: 'c1' }], error: null }),
          single: () => Promise.resolve({ data: { id: 'c1' }, error: null }),
        }
        // await .select(...)  (sem .order())
        ;(registro as any).then = (ok: any, bad: any) =>
          Promise.resolve({ data: [{ id: 'c1' }], error: null }).then(ok, bad)
        return registro
      },
      insert: () => ({
        select: (s: string) => {
          selects.push(s)
          return { single: () => Promise.resolve({ data: { id: 'c1' }, error: null }) }
        },
      }),
    }),
  }),
}))

function req(url: string) {
  return new NextRequest(url)
}

beforeEach(() => {
  selects.length = 0
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projeto.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave-de-teste'
})

describe('GET /api/bulk/campaigns — lista sem o blob de imagens', () => {
  it('NÃO pede fluxo_mensagens (o pesado, 28 MB)', async () => {
    const res = await GET(req('http://localhost/api/bulk/campaigns'))
    expect(res.status).toBe(200)

    const daLista = selects[0]
    expect(daLista).toBeTruthy()
    expect(daLista).not.toContain('fluxo_mensagens')
    // ainda assim precisa das colunas que a tela usa
    for (const col of ['id', 'name', 'message', 'numbers', 'status', 'created_at', 'tipo']) {
      expect(daLista).toContain(col)
    }
    // e continua trazendo os vínculos de campanha e promoção
    expect(daLista).toContain('campanha:campanhas')
    expect(daLista).toContain('promocao:promocoes_marketing')
  })

  it('responde com a lista de campanhas', async () => {
    const res = await GET(req('http://localhost/api/bulk/campaigns'))
    const json = await res.json()
    expect(json.campaigns).toBeDefined()
    expect(Array.isArray(json.campaigns)).toBe(true)
  })
})

describe('POST /api/bulk/campaigns — retorno da criação', () => {
  it('também não devolve fluxo_mensagens', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/bulk/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Disparo de teste', numbers: ['5562999990000'], message: 'oi' }),
      }),
    )
    expect(res.status).toBe(200)

    // o retorno do insert não pode trazer o blob
    expect(selects.some((s) => s.includes('fluxo_mensagens'))).toBe(false)
    const deCriacao = selects.find((s) => s.includes('name'))
    expect(deCriacao).toBeTruthy()
  })
})
