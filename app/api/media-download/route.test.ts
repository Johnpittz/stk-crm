/**
 * GET /api/media-download — branch de arquivos já no Supabase Storage.
 *
 * Bug real: redirecionava para a URL pública do objeto → o navegador baixava
 * com o nome do objeto ("1790391732596-r7mxiu.bin"). Precisa servir o arquivo
 * com Content-Disposition usando o file_name original da mensagem.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { msgFake } = vi.hoisted(() => {
  // a rota lê EVOLUTION_API_KEY no load do módulo → tem que existir antes do import
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-teste'
  process.env.EVOLUTION_API_KEY = 'evo-teste'
  return { msgFake: { media_url: '', media_type: 'document', file_name: '' } as any }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const b: any = {}
      b.select = () => b
      b.eq = () => b
      b.single = async () => ({ data: { ...msgFake }, error: null })
      return b
    },
  }),
}))

import { GET } from './route'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-teste'
process.env.EVOLUTION_API_KEY = 'evo-teste'

const CONTEUDO = 'conteudo-do-xlsx'

beforeEach(() => {
  msgFake.media_url = 'https://proj.supabase.co/storage/v1/object/public/media/document/1790391732596-r7mxiu.bin'
  msgFake.media_type = 'document'
  msgFake.file_name = 'Acougues_Goiania_250.xlsx'
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    arrayBuffer: async () => new TextEncoder().encode(CONTEUDO).buffer,
  })))
})

describe('GET /api/media-download (arquivo no Storage)', () => {
  it('serve o arquivo com o nome original (attachment + file_name)', async () => {
    const res = await GET(new NextRequest('http://localhost/api/media-download?msg_id=m1&type=document'))

    expect(res.status).toBe(200)
    const cd = res.headers.get('content-disposition') || ''
    expect(cd).toContain('attachment')
    expect(cd).toContain('Acougues_Goiania_250.xlsx')
    const body = new TextDecoder().decode(await res.arrayBuffer())
    expect(body).toBe(CONTEUDO)
  })

  it('mantém inline para áudio (o player do chat depende disso)', async () => {
    msgFake.media_type = 'audio'
    msgFake.file_name = 'nota-voz.ogg'
    msgFake.media_url = 'https://proj.supabase.co/storage/v1/object/public/media/audio/1790-a1b2c3.ogg'

    const res = await GET(new NextRequest('http://localhost/api/media-download?msg_id=m1&type=audio'))
    const cd = res.headers.get('content-disposition') || ''
    expect(res.status).toBe(200)
    expect(cd).toContain('inline')
    expect(cd).toContain('nota-voz.ogg')
  })
})
