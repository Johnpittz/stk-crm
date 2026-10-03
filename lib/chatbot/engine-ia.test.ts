import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { interpretarRespostaIA } from './engine'

/**
 * Opção A (João, 03/10) — a INTERPRETAÇÃO de resposta livre do chatbot também
 * passa a usar o provedor único (`lib/ia-provider`, MIMO por padrão).
 *
 * Antes: a engine travava em `!GEMINI_API_KEY` (lido no load do módulo) e,
 * sem chave do Google, sempre caía no match simples — mesmo com a MIMO
 * disponível. Os casos abaixo fixam os 4 comportamentos:
 *   1. sem credencial → match direto, SEM chamar rede;
 *   2. MIMO respondendo → JSON interpretado;
 *   3. MIMO com erro de HTTP → match direto (não lança);
 *   4. modelo devolvendo "nenhuma" → match direto.
 */

const opcoes = [
  { chave: 'residencial', texto: 'Minha residência' },
  { chave: 'empresa', texto: 'Minha empresa' },
]

const promptEsperado = 'Você é um interpretador de respostas de chatbot'

function respostaMimo(texto: string) {
  return {
    ok: true,
    json: async () => ({ choices: [{ message: { content: texto } }] }),
    text: async () => '',
  }
}

let fetchMock: ReturnType<typeof vi.fn>

function stubMimoEnv(extra: Record<string, string> = {}) {
  vi.stubEnv('IA_PROVIDER', 'mimo')
  vi.stubEnv('XIAOMI_BASE_URL', 'https://mimo.example/v1')
  vi.stubEnv('XIAOMI_API_KEY', 'key-mimo')
  vi.stubEnv('GEMINI_API_KEY', '')
  for (const [k, v] of Object.entries(extra)) vi.stubEnv(k, v)
}

function semCredencial() {
  vi.stubEnv('IA_PROVIDER', '')
  vi.stubEnv('XIAOMI_API_KEY', '')
  vi.stubEnv('XIAOMI_BASE_URL', '')
  vi.stubEnv('GEMINI_API_KEY', '')
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('interpretarRespostaIA — provedor único (MIMO)', () => {
  it('sem credencial: cai no match direto SEM chamar rede', async () => {
    semCredencial()
    const r = await interpretarRespostaIA('Qual uso?', '1', opcoes)
    expect(r).toEqual({ chave: 'residencial', confianca: 0.9 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('MIMO disponível: interpreta a resposta devolvida pelo modelo', async () => {
    stubMimoEnv()
    fetchMock.mockResolvedValue(
      respostaMimo('{"chave": "empresa", "confianca": 0.93}'),
    )

    const r = await interpretarRespostaIA('Qual uso?', 'minha empresa', opcoes)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('https://mimo.example/v1/chat/completions')
    expect(String(init.headers.Authorization)).toContain('Bearer key-mimo')
    expect(String(init.body)).toContain(promptEsperado)
    expect(r).toEqual({ chave: 'empresa', confianca: 0.93 })
  })

  it('erro HTTP do MIMO: cai no match direto (não lança)', async () => {
    stubMimoEnv()
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
      json: async () => ({}),
    })

    const r = await interpretarRespostaIA('Qual uso?', '1', opcoes)
    expect(r).toEqual({ chave: 'residencial', confianca: 0.9 })
  })

  it('modelo devolvendo "nenhuma": cai no match direto', async () => {
    stubMimoEnv()
    fetchMock.mockResolvedValue(
      respostaMimo('{"chave": "nenhuma", "confianca": 0.2}'),
    )

    const r = await interpretarRespostaIA('Qual uso?', 'xyz abc', opcoes)
    expect(r.chave).toBe('xyz abc') // match simples não achou → devolve o texto
    expect(r.confianca).toBeLessThan(0.5)
  })
})
