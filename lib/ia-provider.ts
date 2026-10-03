/**
 * Provedor de IA do atendimento — Opção A (João, 03/10).
 *
 * Motivo: em produção TODA pergunta caía no fallback "Deixa comigo..." com
 * motivo `erro_ia`, porque a chamada ao Gemini falhava (chave ausente/inválida
 * na Vercel). Decisão: passar a responder pela MIMO (`mimo-v2.6-flash`), a
 * mesma API OpenAI-compatível que roda o Hermes — validada ao vivo com
 * HTTP 200 antes deste código.
 *
 * O guardrail NÃO muda: este módulo só devolve o TEXTO do modelo.
 * `lib/ai-assistant.ts` continua dono de:
 *   - prompt com a base de conhecimento,
 *   - detecção de [[ENCAMINHAR]] → encaminhar ao vendedor,
 *   - qualquer falha → `erro_ia` (nunca resposta inventada).
 *
 * Escolha do provedor (em ordem):
 *   1. `IA_PROVIDER=mimo|gemini` (override explícito)
 *   2. há `XIAOMI_API_KEY` + `XIAOMI_BASE_URL` → mimo (padrão novo)
 *   3. há `GEMINI_API_KEY` → gemini (caminho legado, intacto)
 *   4. sem chave nenhuma → mimo (a chamada lança e vira `erro_ia`)
 */

export type ProvedorIA = 'mimo' | 'gemini'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const MIMO_MODEL_PADRAO = 'mimo-v2.6-flash'

type Env = Record<string, string | undefined>

function valor(env: Env, chave: string): string {
  return String(env[chave] ?? '').trim()
}

/** Quem responde? Ver docstring do módulo para a ordem de precedência. */
export function provedorIA(env: Env = process.env): ProvedorIA {
  const explicito = valor(env, 'IA_PROVIDER').toLowerCase()
  if (explicito === 'mimo' || explicito === 'gemini') return explicito
  if (valor(env, 'XIAOMI_API_KEY') && valor(env, 'XIAOMI_BASE_URL')) return 'mimo'
  if (valor(env, 'GEMINI_API_KEY')) return 'gemini'
  return 'mimo'
}

/** true quando o provedor escolhido tem credencial no ambiente. */
export function temChaveIA(env: Env = process.env): boolean {
  if (provedorIA(env) === 'mimo') {
    return !!(valor(env, 'XIAOMI_API_KEY') && valor(env, 'XIAOMI_BASE_URL'))
  }
  return !!valor(env, 'GEMINI_API_KEY')
}

/**
 * Chama o modelo configurado e devolve o texto puro.
 * LANÇA em qualquer falha (HTTP != 200, resposta vazia, sem chave) — o
 * chamador transforma em `erro_ia`.
 */
export async function chamarModelo(prompt: string, env: Env = process.env): Promise<string> {
  return provedorIA(env) === 'mimo' ? chamarMimo(prompt, env) : chamarGemini(prompt, env)
}

/** MIMO — API compatível com OpenAI (`{base}/chat/completions`). */
async function chamarMimo(prompt: string, env: Env): Promise<string> {
  const chave = valor(env, 'XIAOMI_API_KEY')
  const base = valor(env, 'XIAOMI_BASE_URL').replace(/\/+$/, '')
  if (!chave) throw new Error('XIAOMI_API_KEY ausente (IA_PROVIDER=mimo)')
  if (!base) throw new Error('XIAOMI_BASE_URL ausente (IA_PROVIDER=mimo)')

  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${chave}`,
    },
    body: JSON.stringify({
      model: valor(env, 'XIAOMI_MODEL') || MIMO_MODEL_PADRAO,
      messages: [{ role: 'user', content: prompt }],
      // 03/10: temperature baixa = resposta literal da base, sem improviso
      // (com 0.7 a IA perguntava antes de responder o que já estava cadastrado)
      temperature: 0.4,
      max_tokens: 800,
    }),
  })

  if (!response.ok) {
    const detalhe = await response.text().catch(() => '')
    throw new Error(`MIMO HTTP ${response.status}: ${detalhe.slice(0, 300)}`)
  }

  const data = await response.json()
  const texto = data?.choices?.[0]?.message?.content
  if (!texto || !String(texto).trim()) {
    throw new Error('MIMO devolveu resposta vazia')
  }
  return String(texto).trim()
}

/** Gemini — caminho legado (Fase 4), mantido como fallback. */
async function chamarGemini(prompt: string, env: Env): Promise<string> {
  const chave = valor(env, 'GEMINI_API_KEY')
  if (!chave) throw new Error('GEMINI_API_KEY ausente (IA_PROVIDER=gemini)')

  const response = await fetch(`${GEMINI_API_URL}?key=${chave}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
    }),
  })

  if (!response.ok) {
    const detalhe = await response.text().catch(() => '')
    throw new Error(`Gemini HTTP ${response.status}: ${detalhe.slice(0, 300)}`)
  }

  const data = await response.json()
  const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!texto || !String(texto).trim()) {
    throw new Error('Gemini devolveu resposta vazia')
  }
  return String(texto).trim()
}
