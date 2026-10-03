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
const inserts: any[] = []

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
      insert: (row: any) => {
        inserts.push(row)
        return {
          select: (s: string) => {
            selects.push(s)
            return { single: () => Promise.resolve({ data: { id: 'c1' }, error: null }) }
          },
        }
      },
    }),
  }),
}))

// Upload das imagens do fluxo (o passo vira {type:'image', url} no banco)
const uploads: Array<{ base64: string; mimetype: string }> = []
vi.mock('@/lib/media-storage', () => ({
  uploadMediaToStorage: vi.fn(async (base64: string, mimetype: string) => {
    uploads.push({ base64, mimetype })
    return `https://cdn.supabase.co/storage/v1/object/public/media/disparos/x.${mimetype.includes('png') ? 'png' : 'jpg'}`
  }),
}))

function req(url: string) {
  return new NextRequest(url)
}

beforeEach(() => {
  selects.length = 0
  inserts.length = 0
  uploads.length = 0
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

describe('POST /api/bulk/campaigns — upload das imagens do fluxo', () => {
  it('sobe a imagem sem prefixo e guarda o passo com url + mimetype', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/bulk/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Disparo com fluxo',
          numbers: ['5562999990000'],
          fluxo_mensagens: [
            { type: 'text', content: 'antes' },
            { type: 'image', base64: 'data:image/png;base64,AAAABBBB', mimetype: 'image/png' },
          ],
        }),
      }),
    )
    expect(res.status).toBe(200)

    // o upload recebe base64 PURO (a WAHA exige; com prefixo a imagem sai corrompida)
    expect(uploads).toHaveLength(1)
    expect(uploads[0].base64).toBe('AAAABBBB')
    expect(uploads[0].mimetype).toBe('image/png')

    // o passo gravado tem url E mimetype (mimetype não pode sumir no caminho)
    const fluxoGravado = inserts[0].fluxo_mensagens
    expect(fluxoGravado[0]).toEqual({ type: 'text', content: 'antes' })
    expect(fluxoGravado[1]).toEqual({
      type: 'image',
      url: expect.stringContaining('/media/disparos/'),
      mimetype: 'image/png',
    })
  })
})
