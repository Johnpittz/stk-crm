/**
 * M2 — BASE DE CONHECIMENTO (docs/plano-acao-modulos.md, Fase 4).
 *
 * A base é a fonte ÚNICA de verdade do chatbot da STK. O que não está aqui,
 * a IA não pode afirmar: ela emite o marcador [[ENCAMINHAR]] e o vendedor
 * assume, com registro do motivo (guardrail do M2, item 2).
 *
 * Funções puras de propósito: tudo aqui roda em teste sem rede e sem banco,
 * o que é o que permite a "bateria de conversas-teste" (M2, item 4).
 */

/** Marcador que a IA devolve quando a resposta NÃO está na base. */
export const MARCADOR_ENCAMINHAR = '[[ENCAMINHAR]]'

export interface EntradaConhecimento {
  id?: string
  categoria: string
  titulo: string
  conteudo: string
  /** text[] no Supabase, ou string "a, b, c" — aceita as duas formas. */
  palavras_chave?: string[] | string | null
  ativo?: boolean | null
}

/** Palavras comuns que não servem de sinal de cobertura. */
const STOPWORDS = new Set([
  'que','para','por','com','uma','uns','umas','dos','das','del','sua','seu','seus','suas',
  'tem','the','and','voces','voce','você','tudo','bem','ola','olá','oi','bom','boa','dia',
  'tarde','noite','queria','gostaria','favor','porfavor','sobre','ainda','quando','como','onde',
  'qual','quais','quem','esse','essa','isso','isto','aquilo','aqui','ali','la','lá','ja','já',
  'mais','menos','muito','pouco','todo','todos','cada','tambem','também','ser','estar','ter',
  'fazer','fazem','faz','sao','são','era','foi','ha','há','tem','possui','dá','dá','de','em',
  'no','na','nos','nas','o','a','os','as','um','e','ou','se','me','minha','meu','meus','minhas',
])

/** Normaliza para comparação: sem acento, caixa baixa, espaço colapsado. */
export function normalizarTexto(texto: string): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015\u2212]/g, '-') // travessões tipográficos → hífen simples
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Aceita text[] do Supabase e string "a, b, c". */
export function palavrasChaveDe(valor: string[] | string | null | undefined): string[] {
  if (!valor) return []
  if (Array.isArray(valor)) return valor.map((v) => String(v).trim()).filter(Boolean)
  return String(valor)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function entradaAtivaUtil(e: EntradaConhecimento): boolean {
  return e.ativo !== false && String(e.conteudo ?? '').trim().length > 0
}

/** true quando nenhuma entrada servível existe — a IA fica sem fonte. */
export function baseVazia(entradas: EntradaConhecimento[]): boolean {
  return !entradas?.some(entradaAtivaUtil)
}

/**
 * Bloco de texto injetado no prompt da IA: agrupado por categoria,
 * só entradas ativas e com conteúdo.
 */
export function montarBlocoConhecimento(entradas: EntradaConhecimento[]): string {
  const validas = (entradas ?? []).filter(entradaAtivaUtil)
  if (validas.length === 0) return ''

  const porCategoria = new Map<string, EntradaConhecimento[]>()
  for (const e of validas) {
    const cat = (e.categoria || 'Geral').trim()
    porCategoria.set(cat, [...(porCategoria.get(cat) ?? []), e])
  }

  const linhas: string[] = ['BASE DE CONHECIMENTO (fonte única de verdade):']
  for (const [cat, itens] of Array.from(porCategoria.entries())) {
    linhas.push(`\n[${cat}]`)
    for (const e of itens) {
      // 03/10: as palavras-chave vão no prompt — sem elas a IA não conseguia
      // casar "Prazo" com a entrada (o João cadastrou 'prazo' e ela perguntou
      // em vez de responder).
      const kw = palavrasChaveDe(e.palavras_chave)
      const sufixo = kw.length > 0 ? ` [${kw.join(', ')}]` : ''
      linhas.push(`- ${e.titulo.trim()}${sufixo}: ${String(e.conteudo).trim()}`)
    }
  }
  return linhas.join('\n')
}

/**
 * Guardrail: a IA sinalizou que a resposta não está na base.
 * Tolerante a caixa/espaces porque o modelo nem sempre imprime o marcador literal.
 */
export function detectarEncaminhamento(resposta: string | null | undefined): boolean {
  if (!resposta) return false
  const compacto = normalizarTexto(resposta).replace(/[\s\[\]]/g, '')
  return compacto.includes(MARCADOR_ENCAMINHAR.replace(/[\[\]]/g, '').toLowerCase())
}

function tokenizar(texto: string): string[] {
  return normalizarTexto(texto)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(' ')
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
}

/**
 * Heurística de COBERTURA — usada pela bateria de conversas-teste (M2, item 4)
 * para dizer, sem rede, se uma pergunta é respondível pela base cadastrada.
 *
 * Ela NÃO é o guardrail em produção (o guardrail real é o marcador que a IA
 * devolve): aqui o objetivo é auditar "a base cobre o que o cliente pergunta".
 *
 * Matching com corte de cauda ("entregam" → "entrega") e sem acento.
 */
export function coberturaDaBase(
  pergunta: string,
  entradas: EntradaConhecimento[],
): EntradaConhecimento | null {
  const tokensPergunta = tokenizar(pergunta)
  if (tokensPergunta.length === 0) return null

  let melhor: EntradaConhecimento | null = null
  let melhorNota = 0

  for (const e of entradas ?? []) {
    if (!entradaAtivaUtil(e)) continue
    const alvo = tokenizar(
      `${e.titulo} ${e.conteudo} ${palavrasChaveDe(e.palavras_chave).join(' ')}`,
    )

    // pontua quantas palavras da pergunta a entrada cobre: "valor do gravador"
    // fica com a entrada do gravador (2 palavras) em vez da que só cita "valor"
    let nota = 0
    for (const t of tokensPergunta) {
      if (alvo.some((a) => a.startsWith(t) || t.startsWith(a))) nota++
    }

    if (nota > melhorNota) {
      melhor = e
      melhorNota = nota
    }
  }

  return melhorNota > 0 ? melhor : null
}
