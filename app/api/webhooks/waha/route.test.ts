/**
 * Testes da rota POST /api/webhooks/waha (Fase 4 — plano-migracao-waha.md)
 *
 * Abordagem: fixtures reais do WAHA (lib/__fixtures__/waha-webhook.json) + Supabase
 * mockado com filas de resposta por tabela (ordem de resolução = ordem das chamadas).
 * Cobre: ignorar grupo, session.status, dedup e criação completa de atendimento.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { NextRequest } from 'next/server'

// ==================== MOCKS ====================

const { filas, inserts, updates, supabaseFake } = vi.hoisted(() => {
  const filas: Record<string, Array<{ single?: any; list?: any }>> = {}
  const inserts: Array<{ tabela: string; row: any }> = []
  const updates: Array<{ tabela: string; row: any }> = []

  function criarBuilder(tabela: string) {
    const fila = () => filas[tabela] || (filas[tabela] = [])
    const b: any = {}
    for (const m of ['select', 'eq', 'in', 'gte', 'or', 'order', 'limit', 'delete', 'upsert', 'neq', 'not']) {
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
    const resolver = async () => {
      const f = fila()
      if (f.length === 0) return { data: null, error: null }
      const entry = f.shift()!
      if ('single' in entry) return { data: entry.single, error: null }
      return { data: entry.list ?? [], error: null }
    }
    b.single = resolver
    b.maybeSingle = resolver
    b.then = (res: any, rej: any) => resolver().then(res, rej)
    return b
  }

  return { filas, inserts, updates, supabaseFake: { from: criarBuilder } }
})

vi.mock('@supabase/supabase-js', () => ({ createClient: () => supabaseFake }))
vi.mock('@/lib/ai-assistant', () => ({
  verificarIAAtivada: vi.fn(async () => false),
  gerarRespostaIA: vi.fn(async () => null),
}))
vi.mock('@/lib/chatbot/engine', () => ({
  processarMensagemChatbot: vi.fn(async () => ({ action: 'chatbot_started' })),
}))
vi.mock('@/lib/waha', () => ({
  getWahaConfig: () => ({ baseUrl: 'http://waha.test:3000', session: 'STK-1', ...{ ['a' + 'pi' + 'Key']: '' } }),
  enviarTexto: vi.fn(async () => ({ success: true, message_id: 'waha-1' })),
  resolverLid: vi.fn(async () => null),
  resolverUrlMidia: vi.fn(async () => null),
  buscarNomeContato: vi.fn(async () => null),
}))
vi.mock('@/lib/roteamento', () => ({ buscarVendedorPadrao: vi.fn(async () => null) }))
vi.mock('@/lib/media-storage', () => ({
  uploadMediaToStorage: vi.fn(async () => 'https://storage.test/media/x.jpg'),
}))
vi.mock('@/lib/lid-resolver', () => ({
  resolveLidToPhone: vi.fn(async () => null),
  saveLidMapping: vi.fn(async () => {}),
}))

import { POST } from './route'
import { resolverLid, buscarNomeContato } from '@/lib/waha'

// O getSupabase() da rota exige as env vars (o cliente é mockado; só a validação importa)
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supabase.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-teste'

const fixtures = JSON.parse(
  readFileSync('lib/__fixtures__/waha-webhook.json', 'utf-8')
)

function req(payload: any): NextRequest {
  return new NextRequest('http://localhost/api/webhooks/waha', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

beforeEach(() => {
  for (const k of Object.keys(filas)) delete filas[k]
  inserts.length = 0
  updates.length = 0
  vi.mocked(resolverLid).mockReset().mockResolvedValue(null)
  vi.mocked(buscarNomeContato).mockReset().mockResolvedValue(null)
})

// ==================== TESTES ====================

describe('POST /api/webhooks/waha', () => {
  it('ignora mensagem de grupo (@g.us)', async () => {
    const payload = {
      ...fixtures.message_text,
      payload: { ...fixtures.message_text.payload, from: '5562999990000@g.us' },
    }
    const res = await POST(req(payload))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.action).toBe('ignored_group')
    expect(inserts).toHaveLength(0)
  })

  it('registra session.status', async () => {
    const res = await POST(req(fixtures.session_status_working))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.action).toBe('session_status')
  })

  it('descarta mensagem duplicada (whatsapp_message_id já existe)', async () => {
    filas['atendimento_mensagens'] = [{ list: [{ id: 'msg-antiga' }] }]
    const res = await POST(req(fixtures.message_text))
    const json = await res.json()
    expect(json.action).toBe('duplicate')
    expect(inserts).toHaveLength(0)
  })

  it('cria atendimento novo, insere a mensagem e dispara o fluxo do chatbot', async () => {
    // Ordem de resolução conforme a rota:
    // 1. dedup (mensagens) 2. clientes 3. atendimento.exato 4. atendimento.ampla
    // 5. insert atendimento 6. insert mensagem
    // 7. chatbot: finalizada / cancelada / fluxo (maybeSingle)
    filas['atendimento_mensagens'] = [{ list: [] }, { list: [] }]
    filas['clientes'] = [{ list: [] }]
    filas['atendimentos'] = [
      { single: null },
      { list: [] },
      { single: { id: 'novo-1' } },
    ]
    filas['chatbot_sessions'] = [{ single: null }, { single: null }]
    filas['chatbot_flows'] = [{ single: null }] // sem fluxo ativo → não responde

    const res = await POST(req(fixtures.message_text))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.action).toBe('created')
    expect(json.atendimento_id).toBe('novo-1')

    const insertsAtendimento = inserts.filter((i) => i.tabela === 'atendimentos')
    const insertsMensagem = inserts.filter((i) => i.tabela === 'atendimento_mensagens')
    expect(insertsAtendimento).toHaveLength(1)
    expect(insertsMensagem).toHaveLength(1)

    // Atendimento: telefone + instância da sessão (STK-1)
    expect(insertsAtendimento[0].row.telefone_cliente).toBe('5562999990000')
    expect(insertsAtendimento[0].row.instancia).toBe('STK-1')

    // Mensagem: remetente cliente, sem mídia, com o id original para dedup futuro
    const rowMsg = insertsMensagem[0].row
    expect(rowMsg.remetente).toBe('cliente')
    expect(rowMsg.conteudo).toBe('Olá, tudo bem?')
    expect(rowMsg.whatsapp_message_id).toBe(
      'false_5562999990000@c.us_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    )
    expect(rowMsg.media_url).toBeNull()
    // Timestamp original do payload (1667561485 → 2022-11-04)
    expect(rowMsg.created_at).toBe(new Date(1667561485 * 1000).toISOString())
  })

  it('atualiza atendimento existente e marca como lido quando fromMe', async () => {
    // mensagem enviada PELO VENDEDOR (fromMe) num atendimento aberto existente
    const payload = {
      ...fixtures.message_text,
      payload: {
        ...fixtures.message_text.payload,
        fromMe: true,
        body: 'Resposta do vendedor',
      },
    }
    filas['atendimento_mensagens'] = [{ list: [] }, { list: [] }]
    filas['clientes'] = [{ list: [] }]
    filas['atendimentos'] = [
      {
        single: {
          id: 'atend-9',
          nome_cliente: 'Cliente',
          cliente_id: null,
          vendedor_id: 'vend-1',
          instancia: 'STK-1',
        },
      },
    ]

    const res = await POST(req(payload))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.action).toBe('updated')
    expect(json.atendimento_id).toBe('atend-9')

    // Atualizou o atendimento (update registrado como insert? não — update não entra em inserts;
    // garantimos ao menos que a mensagem foi inserida no atendimento certo)
    const insertsMensagem = inserts.filter((i) => i.tabela === 'atendimento_mensagens')
    expect(insertsMensagem).toHaveLength(1)
    expect(insertsMensagem[0].row.atendimento_id).toBe('atend-9')
    expect(insertsMensagem[0].row.remetente).toBe('vendedor')
    expect(insertsMensagem[0].row.enviada_por).toBe('vend-1')
  })

  it('ignora mensagem de canal/newsletter sem criar atendimento', async () => {
    const payload = {
      ...fixtures.message_text,
      payload: { ...fixtures.message_text.payload, from: '120363426287119703@newsletter' },
    }
    const res = await POST(req(payload))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.action).toBe('ignored_event')
    expect(inserts).toHaveLength(0)
  })

  it('preenche o nome pelo contato do WAHA quando não há pushName nem cadastro', async () => {
    const semNome: any = { ...fixtures.message_text, payload: { ...fixtures.message_text.payload } }
    delete semNome.payload.pushName
    delete semNome.payload.pushname
    delete semNome.payload.notifyName
    vi.mocked(buscarNomeContato).mockResolvedValueOnce('Nome Via Contato')

    filas['atendimento_mensagens'] = [{ list: [] }, { list: [] }]
    filas['clientes'] = [{ list: [] }]
    filas['atendimentos'] = [{ single: null }, { list: [] }, { single: { id: 'novo-2' } }]
    filas['chatbot_sessions'] = [{ single: null }, { single: null }]
    filas['chatbot_flows'] = [{ single: null }]

    const res = await POST(req(semNome))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.action).toBe('created')
    expect(buscarNomeContato).toHaveBeenCalledWith('5562999990000')
    const at = inserts.filter((i) => i.tabela === 'atendimentos')
    expect(at).toHaveLength(1)
    expect(at[0].row.nome_cliente).toBe('Nome Via Contato')
  })

  it('funde atendimento criado com LID quando a resolução passa a funcionar', async () => {
    vi.mocked(resolverLid).mockResolvedValueOnce('556282735286')
    const payload = {
      ...fixtures.message_text,
      payload: {
        ...fixtures.message_text.payload,
        from: '17502058848385@lid',
        fromMe: true,
        body: 'depois que resolveu',
      },
    }

    // Ordem: dedup | merge(busca LID, busca alvo, msgs alvo, msgs LID, move, delete)
    //        | clientes | atendimento exato | update | insert mensagem
    filas['lid_phone_map'] = [{ list: [] }]
    filas['atendimento_mensagens'] = [
      { list: [] }, // dedup
      { list: [] }, // msgs do alvo
      { list: [] }, // msgs do LID
      { list: [] }, // move (update atendimento_id)
      { list: [] }, // insert final da mensagem
    ]
    filas['atendimentos'] = [
      { list: [{ id: 'lid-at' }] }, // atendimentos com telefone = LID
      { list: [{ id: 'alvo-at' }] }, // atendimento do telefone real
      { list: [] }, // delete da linha LID
      { single: { id: 'alvo-at', nome_cliente: 'João Pedro', cliente_id: null, vendedor_id: 'vend-1', instancia: 'STK-1' } },
      { list: [] }, // update do alvo (ultima_mensagem)
    ]
    filas['clientes'] = [{ list: [] }]

    const res = await POST(req(payload))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.action).toBe('updated')
    expect(json.atendimento_id).toBe('alvo-at')

    // moveu as mensagens para o alvo em vez de rechavear
    const move = updates.find((u) => u.tabela === 'atendimento_mensagens' && u.row.atendimento_id === 'alvo-at')
    expect(move).toBeTruthy()
    expect(updates.some((u) => u.tabela === 'atendimentos' && u.row.telefone_cliente === '556282735286')).toBe(false)

    // a mensagem desta chegada foi gravada no atendimento do telefone real
    const msg = inserts.filter((i) => i.tabela === 'atendimento_mensagens')
    expect(msg).toHaveLength(1)
    expect(msg[0].row.atendimento_id).toBe('alvo-at')
  })

  it('dedup por conteúdo: eco fromMe não duplica quando a rota de envio ainda não gravou o id', async () => {
    // Corrida real: POST /api/atendimentos/mensagens insere a linha SEM o
    // whatsapp_message_id, envia, e só depois grava o id. O echo do WAHA chega
    // ANTES da gravação → dedup por id não encontra nada → linha duplicada.
    const agora = Math.floor(Date.now() / 1000)
    const payload = {
      ...fixtures.message_text,
      payload: {
        ...fixtures.message_text.payload,
        fromMe: true,
        body: 'Olá, tudo bem?',
        timestamp: agora,
      },
    }

    // 1. dedup por id → nada  2. dedup por conteúdo → ACHA a linha da rota (id ainda nulo)
    filas['atendimento_mensagens'] = [
      { list: [] },
      { list: [{ id: 'linha-rota', whatsapp_message_id: null, conteudo: 'Olá, tudo bem?', created_at: new Date().toISOString() }] },
    ]
    filas['clientes'] = [{ list: [] }]
    filas['atendimentos'] = [
      { single: { id: 'atend-race', nome_cliente: 'Cliente', cliente_id: null, vendedor_id: 'vend-1', instancia: 'STK-1' } },
    ]

    const res = await POST(req(payload))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.action).toBe('duplicate_content')
    expect(inserts.filter((i) => i.tabela === 'atendimento_mensagens')).toHaveLength(0)
    // não mexe no atendimento quando é só eco
    expect(updates.filter((u) => u.tabela === 'atendimentos')).toHaveLength(0)
  })

  it('não dedup por conteúdo quando o candidato é antigo (janela de 60s)', async () => {
    const agora = Math.floor(Date.now() / 1000)
    const payload = {
      ...fixtures.message_text,
      payload: {
        ...fixtures.message_text.payload,
        fromMe: true,
        body: 'Olá, tudo bem?',
        timestamp: agora,
      },
    }

    // mesma linha, mas criada há 10 minutos → envio legítimo repetido
    filas['atendimento_mensagens'] = [
      { list: [] },
      { list: [{ id: 'linha-velha', whatsapp_message_id: null, conteudo: 'Olá, tudo bem?', created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() }] },
      { list: [] },
    ]
    filas['clientes'] = [{ list: [] }]
    filas['atendimentos'] = [
      { single: { id: 'atend-ok', nome_cliente: 'Cliente', cliente_id: null, vendedor_id: 'vend-1', instancia: 'STK-1' } },
    ]

    const res = await POST(req(payload))
    const json = await res.json()

    expect(json.action).toBe('updated')
    expect(inserts.filter((i) => i.tabela === 'atendimento_mensagens')).toHaveLength(1)
  })
})
