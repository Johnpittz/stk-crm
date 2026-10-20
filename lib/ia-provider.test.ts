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

import { provedorIA, provedorVision, chamarModelo, chamarModeloVision } from './ia-provider'
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

  it('temperature baixa: resposta literal da base, sem improviso', async () => {
    // 03/10: com 0.7 a IA perguntava antes de responder o que já estava
    // cadastrado ('Prazo' virou 'qual serviço?'); 0.4 tende à resposta direta.
    const fetchMock = vi.fn(async () => respostaMimo('ok'))
    vi.stubGlobal('fetch', fetchMock)

    await chamarModelo('oi')

    const corpo = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(corpo.temperature).toBeLessThanOrEqual(0.4)
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

  it('MIMO empacotada: aborta a tentativa no limite (nunca estoura os 60s da Vercel)', async () => {
    // 19/10 — sem limite, a espera virava FUNCTION_INVOCATION_TIMEOUT e o
    // vendedor via um erro cru em vez de "tente de novo"
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url: string, init?: RequestInit) =>
      new Promise((_res, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const erro = chamarModelo('oi').then(() => null, (e) => e)
    await vi.advanceTimersByTimeAsync(45_000) // a tentativa aborta
    const e = await erro
    vi.useRealTimers()

    expect(e).toBeTruthy()
    // uma tentativa só: timeout propaga na hora (modal refaz)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('chamarModeloVision — mídia do cliente (conta por foto/PDF, 06/10)', () => {
  beforeEach(() => {
    vi.stubEnv('IA_PROVIDER', '')
    stubMimoEnv()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('monta content com texto + image_url (data URL) para a MIMO ler a foto', async () => {
    const fetchMock = vi.fn(async () => respostaMimo('{"achouConta":true,"valorConta":6300,"grupo":null}'))
    vi.stubGlobal('fetch', fetchMock)

    const texto = await chamarModeloVision('Leia a conta', 'data:image/png;base64,QUJD')

    expect(texto).toContain('valorConta')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${MIMO_URL}/chat/completions`)
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe('mimo-v2.6-flash')
    const conteudo = body.messages[0].content
    expect(Array.isArray(conteudo)).toBe(true)
    expect(conteudo[0]).toMatchObject({ type: 'text' })
    expect(conteudo[0].text).toContain('Leia a conta')
    expect(conteudo[1].type).toBe('image_url')
    expect(conteudo[1].image_url.url).toBe('data:image/png;base64,QUJD')
    expect(body.temperature).toBeLessThanOrEqual(0.4)
  })

  it('HTTP != 200 LANÇA (nunca resposta inventada)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => 'image not supported',
      json: async () => ({}),
    })))
    await expect(chamarModeloVision('oi', 'data:image/png;base64,QQ==')).rejects.toThrow(/400/)
  })

  it('resposta vazia da MIMO: repete uma vez antes de falhar', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respostaMimo(''))
      .mockResolvedValueOnce(respostaMimo('{"concessionaria":"CEMIG"}'))
    vi.stubGlobal('fetch', fetchMock)
    const r = await chamarModelo('qualquer prompt')
    expect(r).toContain('concessionaria')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('resposta vazia sempre: lança depois da segunda tentativa', async () => {
    const fetchMock = vi.fn(async () => respostaMimo(''))
    vi.stubGlobal('fetch', fetchMock)
    await expect(chamarModelo('qualquer prompt')).rejects.toThrow(/vazia/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('sem XIAOMI_API_KEY lança antes da rede', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubEnv('XIAOMI_API_KEY', '')
    await expect(chamarModeloVision('oi', 'data:image/png;base64,QQ==')).rejects.toThrow(/chave de IA|XIAOMI_API_KEY/)
    expect(fetchMock).not.toHaveBeenCalled()
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

  it('sem nenhuma chave no ambiente vira erro_ia (como antes)', async () => {
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

describe('provedorVision - quem le a fatura com imagem (Fase A)', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('com chave MIMO responde mimo', () => {
    vi.stubEnv('XIAOMI_API_KEY', 'x')
    vi.stubEnv('XIAOMI_BASE_URL', 'https://mimo.test')
    vi.stubEnv('GEMINI_API_KEY', 'g')
    expect(provedorVision(process.env)).toBe('mimo')
  })

  it('sem MIMO e com Gemini responde gemini', () => {
    vi.stubEnv('XIAOMI_API_KEY', '')
    vi.stubEnv('XIAOMI_BASE_URL', '')
    vi.stubEnv('GEMINI_API_KEY', 'g')
    expect(provedorVision(process.env)).toBe('gemini')
  })

  it('sem nenhuma chave lança (nada de ler fatura sem IA)', () => {
    vi.stubEnv('XIAOMI_API_KEY', '')
    vi.stubEnv('XIAOMI_BASE_URL', '')
    vi.stubEnv('GEMINI_API_KEY', '')
    expect(() => provedorVision(process.env)).toThrow()
  })
})
