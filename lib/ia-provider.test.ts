import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Opção A (João, 03/10) — a IA do atendimento passa a responder pela MIMO
 * (mimo-v2.6-flash, API compatível com OpenAI) em vez do Gemini.
 *
 * Motivo: `erro_ia` em produção — a chamada ao Gemini falhava (chave
 * ausente/inválida na Vercel) e TODO perguntava caía no fallback
 * "Deixa comigo...". A MIMO é a mesma API que já roda o Hermes: testada ao vivo
 * (HTTP 200) antes deste código.
 *
 * Regras:
 *  - provedor é escolhido por env: IA_PROVIDER explícito > MIMO quando há
 *    chave MIMO > Gemini como fallback legado;
 *  - o guardrail NÃO muda: resposta com [[ENCAMINHAR]] continua virando
 *    encaminhamento ao vendedor, e qualquer falha vira `erro_ia`;
 *  - GEMINI_API_URL permanece o caminho antigo, intacto.
 */

import { provedorIA, chamarModelo } from './ia-provider'
import { responderComBase } from './ai-assistant'
import { MARCADOR_ENCAMINHAR, type EntradaConhecimento } from './base-conhecimento'

const base: EntradaConhecimento[] = [
  {
    id: 'e1',
    categoria: 'Geral',
    titulo: 'teste viabilidade',
    conteudo: 'Vai chegar amanhã',
    palavras_chave: ['prazo'],
    ativo: true,
  },
]

const MIMO_URL = 'https://mimo.example/v1'
const MIMO_KEY = 'mimo-key-de-teste'

function stubMimoEnv(extra: Record<string, string> = {}) {
  vi.stubEnv('XIAOMI_BASE_URL', MIMO_URL)
  vi.stubEnv('XIAOMI_API_KEY', MIMO_KEY)
  vi.stubEnv('XIAOMI_MODEL', '')
  vi.stubEnv('GEMINI_API_KEY', '')
  for (const [k, v] of Object.entries(extra)) vi.stubEnv(k, v)
}

/** Resposta no formato OpenAI/MIMO. */
function respostaMimo(texto: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ model: 'mimo-v2.6-flash', choices: [{ message: { content: texto } }] }),
    text: async () => '',
  }
}

describe('provedorIA — quem responde o atendimento', () => {
  beforeEach(() => {
    vi.stubEnv('IA_PROVIDER', '')
    stubMimoEnv()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('usa MIMO quando há chave MIMO e nenhum override (padrão novo)', () => {
    expect(provedorIA()).toBe('mimo')
  })

  it('IA_PROVIDER explícito vence o detector automático', () => {
    stubMimoEnv({ IA_PROVIDER: 'gemini' })
    expect(provedorIA()).toBe('gemini')
  })

  it('cai para o Gemini quando só existe chave do Gemini (legado)', () => {
    vi.stubEnv('XIAOMI_API_KEY', '')
    vi.stubEnv('GEMINI_API_KEY', 'gemini-key')
    expect(provedorIA()).toBe('gemini')
  })

  it('sem nenhuma chave, segue como mimo (a falha vira erro_ia na chamada)', () => {
    vi.stubEnv('XIAOMI_API_KEY', '')
    vi.stubEnv('GEMINI_API_KEY', '')
    expect(provedorIA()).toBe('mimo')
  })
})

describe('chamarModelo — MIMO (compatível OpenAI)', () => {
  beforeEach(() => {
    vi.stubEnv('IA_PROVIDER', '')
    stubMimoEnv()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('POST em {base_url}/chat/completions com Bearer, model e o prompt', async () => {
    const fetchMock = vi.fn(async () => respostaMimo('Sim, entrega em 48h.'))
    vi.stubGlobal('fetch', fetchMock)

    const texto = await chamarModelo('Qual o prazo?')

    expect(texto).toBe('Sim, entrega em 48h.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${MIMO_URL}/chat/completions`)
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${MIMO_KEY}`)
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe('mimo-v2.6-flash')
    expect(body.messages[0].content).toContain('Qual o prazo?')
  })

  it('HTTP != 200 LANÇA (vira erro_ia no guardrail, não resposta inventada)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
      json: async () => ({}),
    })))

    await expect(chamarModelo('oi')).rejects.toThrow(/429/)
  })

  it('sem XIAOMI_API_KEY lança antes de chamar a rede', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('XIAOMI_API_KEY', '')

    await expect(chamarModelo('oi')).rejects.toThrow(/XIAOMI_API_KEY/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('resposta sem candidates/choices lança (não devolve texto vazio)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
    })))

    await expect(chamarModelo('oi')).rejects.toThrow()
  })
})

describe('responderComBase via MIMO — guardrail preservado', () => {
  beforeEach(() => {
    vi.stubEnv('IA_PROVIDER', '')
    stubMimoEnv()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('resposta normal da MIMO vira texto enviado ao cliente', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaMimo('Vai chegar amanhã!')))
    const r = await responderComBase({ mensagemCliente: 'Prazo?', base })
    expect(r.texto).toBe('Vai chegar amanhã!')
    expect(r.encaminhar).toBe(false)
  })

  it('[[ENCAMINHAR]] da MIMO continua caindo no guardrail (fora_da_base)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaMimo(MARCADOR_ENCAMINHAR)))
    const r = await responderComBase({ mensagemCliente: 'Prazo?', base })
    expect(r.texto).toBeNull()
    expect(r.encaminhar).toBe(true)
    expect(r.motivo).toBe('fora_da_base')
  })

  it('falha da API vira erro_ia (comportamento de produção de 03/10)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => 'invalid key',
      json: async () => ({}),
    })))
    const r = await responderComBase({ mensagemCliente: 'Prazo?', base })
    expect(r.texto).toBeNull()
    expect(r.encaminhar).toBe(true)
    expect(r.motivo).toBe('erro_ia')
  })

  it('sem chave nenhuma no ambiente vira erro_ia (como antes)', async () => {
    vi.stubEnv('XIAOMI_API_KEY', '')
    vi.stubEnv('GEMINI_API_KEY', '')
    const r = await responderComBase({ mensagemCliente: 'Prazo?', base })
    expect(r.motivo).toBe('erro_ia')
  })

  it('base vazia continua sendo base_vazia (não erro_ia)', async () => {
    const r = await responderComBase({ mensagemCliente: 'Prazo?', base: [] })
    expect(r.motivo).toBe('base_vazia')
  })
})
