/**
 * POST /api/atendimentos/mensagens — o serviço de envio do chat.
 *
 * Bug real: anexos já são enviados por /api/send/media; a rota DEPOIS chamava
 * enviarTexto(conteudo) → cliente recebia "[document]"/"[Áudio]" como mensagem
 * de TEXTO extra + linha duplicada no banco. Mídia com media_url nunca deve
 * disparar enviarTexto.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { filaAtendimentos, inserts, updates, enviarTextoMock } = vi.hoisted(() => {
  const filaAtendimentos: any[] = []
  const inserts: any[] = []
  const updates: any[] = []
  const enviarTextoMock = vi.fn(async () => ({ success: true, message_id: 'waha-99' }))
  return { filaAtendimentos, inserts, updates, enviarTextoMock }
})

function builder(tabela: string) {
  const b: any = {}
  for (const m of ['select', 'eq', 'in', 'gte', 'or', 'order', 'limit', 'delete', 'upsert']) {
    b[m] = () => b
  }
  b.insert = (row: any) => {
    inserts.push({ tabela, row })
    return b
  }
  b.update = (row: any) => {
    updates.push({ tabela, row })
    return b
  }
  // .single() (select do atendimento) consome a fila; o await do update não
  const selecionar = async () => {
    if (tabela === 'atendimentos') {
      const e = filaAtendimentos.shift()
      return { data: e ?? null, error: null }
    }
    return { data: null, error: null }
  }
  b.single = selecionar
  b.maybeSingle = selecionar
  b.then = (res: any, rej: any) => Promise.resolve({ data: null, error: null }).then(res, rej)
  return b
}

const supabaseFake = { from: builder }

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    from: supabaseFake.from,
  }),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: supabaseFake.from }),
}))
vi.mock('@/lib/waha', () => ({
  enviarTexto: (...args: any[]) => enviarTextoMock(...args as []),
}))

import { POST } from './route'

process.env.WAHA_API_URL = 'http://waha.test:3000'

function req(body: any): NextRequest {
  return new NextRequest('http://localhost/api/atendimentos/mensagens', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  filaAtendimentos.length = 0
  inserts.length = 0
  updates.length = 0
  enviarTextoMock.mockClear()
})

describe('POST /api/atendimentos/mensagens', () => {
  it('texto puro: envia via WAHA e grava o id retornado', async () => {
    filaAtendimentos.push({ telefone_cliente: '5562999990000' })

    const res = await POST(req({
      atendimento_id: 'at-1',
      conteudo: 'Olá!',
      remetente: 'vendedor',
      instance: 'STK-1',
    }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(enviarTextoMock).toHaveBeenCalledTimes(1)
    expect(enviarTextoMock).toHaveBeenCalledWith({
      telefone: '5562999990000',
      mensagem: 'Olá!',
      session: 'STK-1',
    })
    // id do WAHA gravado na linha para o dedup do eco
    const updId = updates.find((u) => u.tabela === 'atendimento_mensagens' && 'whatsapp_message_id' in u.row)
    expect(updId?.row.whatsapp_message_id).toBe('waha-99')
  })

  it('ANEXO (media_url presente): NÃO envia de novo — o arquivo já saiu em /api/send/media', async () => {
    filaAtendimentos.push({ telefone_cliente: '5562999990000' })

    const res = await POST(req({
      atendimento_id: 'at-1',
      conteudo: '[document]',
      remetente: 'vendedor',
      media_url: 'https://storage.test/media/x.xlsx',
      media_type: 'document',
      file_name: 'relatorio.xlsx',
      whatsapp_message_id: 'true_5562999990000@c.us_1111',
    }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(enviarTextoMock).not.toHaveBeenCalled()
    // linha criada já com o id real do envio (dedup exato do eco)
    expect(inserts.find((i) => i.tabela === 'atendimento_mensagens')?.row.whatsapp_message_id)
      .toBe('true_5562999990000@c.us_1111')
    // fila intocada = o bloco de envio nem consultou o atendimento
    expect(filaAtendimentos).toHaveLength(1)
  })

  it('áudio gravado (media_url presente): também não envia texto extra', async () => {
    filaAtendimentos.push({ telefone_cliente: '5562999990000' })

    const res = await POST(req({
      atendimento_id: 'at-1',
      conteudo: '[Áudio]',
      remetente: 'vendedor',
      media_url: 'https://storage.test/media/a.ogg',
      media_type: 'audio',
    }))
    expect(res.status).toBe(200)
    expect(enviarTextoMock).not.toHaveBeenCalled()
  })
})
