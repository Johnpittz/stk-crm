/**
 * Passo 1 (06/10) — FORA DO HORÁRIO o cliente ficava no silêncio.
 *
 * O engine compõe a cortesia ("...fora do horário de atendimento.
 * Retornaremos em breve!") no branch `fora_horario`, mas quem chama
 * (`integrarChatbot`) só lê `action` — a mensagem nunca saía. Nenhum outro
 * caminho envia nada (IA bloqueada pela precedência do chatbot), então o
 * cliente mandava mensagem às 22h e não recebia resposta nenhuma.
 *
 * Este teste RED fixa o contrato novo: o branch ENVIA a cortesia via
 * enviarMensagem (mesmo mecanismo dos demais passos do engine) e mantém
 * o retorno { action: 'fora_horario', mensagem }.
 *
 * Controle: em horário comercial o fluxo normal segue (sessão criada +
 * pergunta enviada) e NÃO manda cortesia.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const enviarTexto = vi.fn()

let fluxoRow: any
let sessaoAtivaRow: any
let sessaoNovaRow: any
let etapaRow: any
const inserts: Array<{ tabela: string; row: any }> = []

function criarClienteFake() {
  let tabela = ''
  const b: any = {
    select: () => b,
    eq: () => b,
    in: () => b,
    gte: () => b,
    order: () => b,
    limit: () => b,
    insert(row: any) {
      inserts.push({ tabela, row })
      return b
    },
    update(row: any) {
      inserts.push({ tabela, row: { __update: true, ...row } })
      return b
    },
    maybeSingle: async () => {
      if (tabela === 'chatbot_sessions') return { data: sessaoAtivaRow, error: null }
      if (tabela === 'chatbot_flows') return { data: fluxoRow, error: null }
      if (tabela === 'chatbot_gatilho_numeros') return { data: null, error: null }
      return { data: null, error: null }
    },
    single: async () => {
      if (tabela === 'chatbot_sessions' && sessaoNovaRow) return { data: sessaoNovaRow, error: null }
      if (tabela === 'chatbot_flow_steps') return { data: etapaRow, error: null }
      return { data: null, error: null }
    },
    then: (res: any, rej: any) =>
      Promise.resolve({ data: [], error: null }).then(res, rej),
  }
  return { from: (t: string) => { tabela = t; return b } }
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => criarClienteFake(),
}))
vi.mock('@/lib/waha', () => ({ enviarTexto: (args: any) => enviarTexto(args) }))
vi.mock('@/lib/notificacoes', () => ({ criarNotificacao: vi.fn() }))
vi.mock('@/lib/marketing/remarketing', () => ({ registrarOptOut: vi.fn() }))
vi.mock('@/lib/ia-provider', () => ({
  chamarModelo: vi.fn(),
  temChaveIA: () => false,
}))

import { processarMensagemChatbot } from './engine'

beforeEach(() => {
  enviarTexto.mockReset().mockResolvedValue({ success: true, message_id: 'm1' })
  inserts.length = 0
  sessaoAtivaRow = null
  etapaRow = {
    id: 'st1', flow_id: 'flow-1', ordem: 1, chave: 'inicio', tipo: 'pergunta',
    pergunta: 'Olá! Qual seu nome?', opcoes: null, redirecionar: null,
    usar_ia: false, campo_resposta: 'nome', condicao: null,
  }
  sessaoNovaRow = {
    id: 'sess-1', telefone: '5511999998888', flow_id: 'flow-1', step_atual: 'inicio',
    respostas: {}, status: 'ativa', instancia: 'STK-3', nome_lead: null,
  }
  fluxoRow = {
    id: 'flow-1', nome: 'Geral', ativo: true, gatilho: 'todos', instancia: 'STK-3',
    horario_comercial: { seg_sexta: '08:00-18:00', sabado: '08:00-12:00' },
    mensagem_inicial: 'Olá, {{nome}}! Bem-vindo!',
    // engine usa `delay_min || 7` (zero é falsy!) → 0.001s, não 0
    delay_min: 0.001, delay_max: 0.001,
  }
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://teste.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-teste')
  vi.stubEnv('WAHA_API_URL', 'https://waha.test')
  // Só o Date é controlado: terça 06/10/2026, 22:00 em Brasília.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-07T01:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('processarMensagemChatbot — fora do horário comercial', () => {
  it('ENVIa a cortesia via WAHA antes de retornar fora_horario', async () => {
    const r = await processarMensagemChatbot('5511999998888', 'oi', 'STK-3')

    expect(r.action).toBe('fora_horario')
    expect(enviarTexto).toHaveBeenCalledTimes(1)
    expect(enviarTexto.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        telefone: '5511999998888',
        session: 'STK-3',
        mensagem: expect.stringContaining('Retornaremos em breve'),
      }),
    )
    // a cortesia não abre sessão
    expect(inserts.filter((i) => i.tabela === 'chatbot_sessions')).toHaveLength(0)
  })

  it('controle: em horário comercial segue o fluxo e NÃO manda cortesia', async () => {
    vi.setSystemTime(new Date('2026-10-07T14:00:00Z')) // 11:00 (Brasília), quarta

    const r = await processarMensagemChatbot('5511999998888', 'oi', 'STK-3')

    expect(r.action).toBe('bot_responde')
    const mensagens = enviarTexto.mock.calls.map((c) => String(c[0].mensagem))
    expect(mensagens.length).toBeGreaterThan(0)
    expect(mensagens.some((m) => m.includes('Bem-vindo!'))).toBe(true)
    expect(mensagens.some((m) => m.includes('fora do horário'))).toBe(false)
    expect(inserts.some((i) => i.tabela === 'chatbot_sessions')).toBe(true)
  })
})
