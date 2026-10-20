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

/** Provedor de VISÃO (leitura de fatura): MIMO se houver chave, senão
 * Gemini, senão lança. A produção pode ter só uma das duas — a leitura da
 * conta não pode morrer por isso (Fase A, 18/10). */
export function provedorVision(env: Env = process.env): ProvedorIA {
  if (valor(env, 'XIAOMI_API_KEY') && valor(env, 'XIAOMI_BASE_URL')) return 'mimo'
  if (valor(env, 'GEMINI_API_KEY')) return 'gemini'
  throw new Error('Nenhuma chave de IA no ambiente (mimo nem gemini)')
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

/**
 * Chama a MIMO com IMAGEM (conta por foto/PDF, 06/10) — `mimo-v2.6-flash`
 * aceita entrada multimodal (URL ou data URL até 50MB, documentação da API).
 * LANÇA em qualquer falha, igual ao caminho de texto.
 */
export async function chamarModeloVision(
  prompt: string,
  imagemDataUrl: string,
  env: Env = process.env,
): Promise<string> {
  return provedorVision(env) === 'mimo'
    ? chamarMimoVision(prompt, imagemDataUrl, env)
    : chamarGeminiVision(prompt, imagemDataUrl, env)
}

async function chamarMimoVision(
  prompt: string,
  imagemDataUrl: string,
  env: Env,
): Promise<string> {
  const chave = valor(env, 'XIAOMI_API_KEY')
  const base = valor(env, 'XIAOMI_BASE_URL').replace(/\/+$/, '')
  if (!chave) throw new Error('XIAOMI_API_KEY ausente (IA_PROVIDER=mimo)')
  if (!base) throw new Error('XIAOMI_BASE_URL ausente (IA_PROVIDER=mimo)')

  const controller = new AbortController()
  // 18/10: 30s -> 60s (com o retry a resposta pode demorar o dobro)
  const limite = setTimeout(() => controller.abort(), 60000)
  try {
    const umaTentativa = async (): Promise<string> => {
      const response = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        Authorization: `Bearer ${chave}`,
        },
        body: JSON.stringify({
          model: valor(env, 'XIAOMI_MODEL') || MIMO_MODEL_PADRAO,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imagemDataUrl } },
              ],
            },
          ],
          temperature: 0.4,
          max_tokens: 800,
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const detalhe = await response.text().catch(() => '')
        throw new Error(`MIMO HTTP ${response.status}: ` + detalhe.slice(0, 300))
      }
      const data = await response.json()
      const texto = data?.choices?.[0]?.message?.content
      return texto && String(texto).trim() ? String(texto).trim() : ''
    }
    // 18/10: a MIMO às vezes devolve content vazio (instabilidade) — repete UMA vez
    const primeira = await umaTentativa()
    if (primeira) return primeira
    const segunda = await umaTentativa()
    if (segunda) return segunda
    throw new Error('MIMO devolveu resposta vazia')
  } finally {
    clearTimeout(limite)
  }
}

async function chamarMimo(prompt: string, env: Env, limiteMs = 45000): Promise<string> {
  const chave = valor(env, 'XIAOMI_API_KEY')
  const base = valor(env, 'XIAOMI_BASE_URL').replace(/\/+$/, '')
  if (!chave) throw new Error('XIAOMI_API_KEY ausente (IA_PROVIDER=mimo)')
  if (!base) throw new Error('XIAOMI_BASE_URL ausente (IA_PROVIDER=mimo)')

  // 19/10 — este caminho NÃO tinha timeout: a MIMO empacotada segurava a
  // função até a Vercel cortar aos 60s (FUNCTION_INVOCATION_TIMEOUT e o
  // vendedor via "An error o..." no lugar de "tente de novo").
  // Limite POR tentativa: duas tentativas cabem nos 60s da função.
  const umaTentativa = async (): Promise<string> => {
    const controller = new AbortController()
    const limite = setTimeout(() => controller.abort(), limiteMs)
    try {
      const response = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        Authorization: "Bearer " + chave,
        },
        body: JSON.stringify({
          model: valor(env, 'XIAOMI_MODEL') || MIMO_MODEL_PADRAO,
          messages: [{ role: 'user', content: prompt }],
          // 03/10: temperature baixa = resposta literal da base, sem improviso
          temperature: 0.4,
          // 19/10 — reasoning era o tempo: ~1500 tokens de raciocínio
          // antes do JSON = 45s+ e a Vercel cortava. MINIMAL desliga o
          // peso; 1500 de folga cobre o JSON (nunca 800 — aí o reasoning
          // esgota e content fica vazio, bug do 18/10).
          max_tokens: 1500,
          reasoning_effort: 'minimal',
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const detalhe = await response.text().catch(() => '')
        throw new Error(`MIMO HTTP ${response.status}: ` + detalhe.slice(0, 300))
      }
      const data = await response.json()
      const texto = data?.choices?.[0]?.message?.content
      return texto && String(texto).trim() ? String(texto).trim() : ''
    } finally {
      clearTimeout(limite)
    }
  }
  // 18/10: content vazio = instabilidade da MIMO — repete UMA vez.
  // 19/10 — UMA tentativa de 45s: duas curtas perdiam pra MIMO lenta
  // (>26s por chamada) e duas de 45s estourariam os 60s da Vercel.
  // Timeout propaga como erro amigável (o modal refaz sozinho); o retry
  // só roda quando a resposta vem vazia — aí ainda sobra tempo.
  const primeira = await umaTentativa()
  if (primeira) return primeira
  const segunda = await umaTentativa()
  if (segunda) return segunda
  throw new Error('MIMO devolveu resposta vazia')
}

async function chamarGeminiVision(
  prompt: string,
  imagemDataUrl: string,
  env: Env,
): Promise<string> {
  const chave = valor(env, 'GEMINI_API_KEY')
  if (!chave) throw new Error('GEMINI_API_KEY ausente (visão gemini)')
  const corte = imagemDataUrl.indexOf(',')
  if (corte < 0) throw new Error('data URL de imagem inválida')
  const cabecalho = imagemDataUrl.slice(0, corte)
  const mime = cabecalho.slice(5, cabecalho.indexOf(';')) || 'image/png'
  const dados = imagemDataUrl.slice(corte + 1)
  const controller = new AbortController()
  const limite = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${chave}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mime, data: dados } },
            ],
          },
        ],
        generationConfig: { temperature: 0.4 },
      }),
      signal: controller.signal,
    })
    if (!response.ok) {
      const detalhe = await response.text().catch(() => '')
      throw new Error(`GEMINI HTTP ${response.status}: ${detalhe.slice(0, 300)}`)
    }
    const data = await response.json()
    const texto = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p?.text ?? '')
      .join('')
      .trim()
    if (!texto) throw new Error('Gemini devolveu resposta vazia')
    return texto
  } finally {
    clearTimeout(limite)
  }
}

/** MIMO — API compatível com OpenAI (`{base}/chat/completions`). */

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
