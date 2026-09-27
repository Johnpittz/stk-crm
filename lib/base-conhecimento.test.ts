import { describe, it, expect } from 'vitest'
import {
  montarBlocoConhecimento,
  detectarEncaminhamento,
  coberturaDaBase,
  palavrasChaveDe,
  normalizarTexto,
  baseVazia,
  MARCADOR_ENCAMINHAR,
  type EntradaConhecimento,
} from './base-conhecimento'

/**
 * Fase 4 / M2 — base de conhecimento editável (docs/plano-acao-modulos.md).
 *
 * Regras do M2:
 *  - a base é a ÚNICA fonte de verdade da IA: se não está na base, não existe;
 *  - fora da base, a IA emite o marcador e cai no fallback do vendedor,
 *    com registro do motivo;
 *  - D7 (decisão do João em 27/09): a IA responde dúvidas E puxa assunto
 *    (sugere produtos/planos) dentro do que a base permite.
 */

const base: EntradaConhecimento[] = [
  {
    id: 'e1',
    categoria: 'Produtos',
    titulo: 'Câmera IP 4MP',
    conteudo: 'Câmera IP 4MP dome, visão noturna, R$ 389,00 à vista.',
    palavras_chave: 'câmera, camera, 4mp, preço, valor',
    ativo: true,
  },
  {
    id: 'e2',
    categoria: 'Entrega',
    titulo: 'Prazo de entrega',
    conteudo: 'Entregamos em até 48h úteis na região metropolitana.',
    palavras_chave: ['prazo', 'entrega', 'quando chega'],
    ativo: true,
  },
  {
    id: 'e3',
    categoria: 'Produtos',
    titulo: 'Gravador descontinuado',
    conteudo: 'Gravador de 8 canais — item fora de linha.',
    palavras_chave: 'gravador',
    ativo: false,
  },
]

describe('montarBlocoConhecimento — injetado no prompt da IA', () => {
  it('inclui título, conteúdo e categoria das entradas ativas', () => {
    const bloco = montarBlocoConhecimento(base)
    expect(bloco).toContain('Câmera IP 4MP')
    expect(bloco).toContain('R$ 389,00')
    expect(bloco).toContain('Entrega')
    expect(bloco).toContain('48h úteis')
  })

  it('NÃO inclui entradas desativadas (nada de informação obsoleta)', () => {
    expect(montarBlocoConhecimento(base)).not.toContain('fora de linha')
  })

  it('lista vazia gera bloco vazio — a IA fica sem fonte', () => {
    expect(montarBlocoConhecimento([])).toBe('')
    expect(baseVazia([])).toBe(true)
    expect(baseVazia(base)).toBe(false)
  })

  it('ignora entradas incompletas (sem conteúdo) em vez de poluir o prompt', () => {
    const comVazia: EntradaConhecimento[] = [
      ...base,
      { id: 'e4', categoria: 'X', titulo: 'Rascunho', conteudo: '   ', ativo: true },
    ]
    expect(montarBlocoConhecimento(comVazia)).not.toContain('Rascunho')
  })
})

describe('palavrasChaveDe — aceita text[] (Supabase) e string com vírgula', () => {
  it('aceita array', () => {
    expect(palavrasChaveDe(['prazo', 'entrega'])).toEqual(['prazo', 'entrega'])
  })

  it('aceita string separada por vírgula', () => {
    expect(palavrasChaveDe('prazo, entrega ,  ')).toEqual(['prazo', 'entrega'])
  })

  it('aceita null/undefined sem quebrar', () => {
    expect(palavrasChaveDe(null)).toEqual([])
    expect(palavrasChaveDe(undefined)).toEqual([])
  })
})

describe('normalizarTexto — comparar sem acento/caixa', () => {
  it('remove acento e baixa caixa', () => {
    expect(normalizarTexto('Câmera IP — Preço?')).toBe('camera ip - preco?')
  })
})

describe('detectarEncaminhamento — guardrail "fora da base"', () => {
  it('detecta o marcador devolvido pela IA', () => {
    expect(detectarEncaminhamento(`Não tenho isso na base. ${MARCADOR_ENCAMINHAR}`)).toBe(true)
  })

  it('é tolerante a caixa e espaços (o modelo às vezes faz " [encaminhar] ")', () => {
    expect(detectarEncaminhamento('desculpe, não sei  [ [Encaminhar] ] ')).toBe(true)
  })

  it('resposta normal não dispara o guardrail', () => {
    expect(detectarEncaminhamento('A entrega leva 48h úteis. Posso ajudar em mais algo?')).toBe(
      false,
    )
  })
})

describe('coberturaDaBase — desempate', () => {
  it('prefere a entrada que cobre mais palavras da pergunta', () => {
    const baseDesempate: EntradaConhecimento[] = [
      {
        id: 'd1',
        categoria: 'Produtos',
        titulo: 'Câmera IP 4MP',
        conteudo: 'Câmera IP 4MP dome por R$ 389,00; o valor é consultado com o vendedor.',
        palavras_chave: 'camera, preco, valor',
        ativo: true,
      },
      {
        id: 'd2',
        categoria: 'Produtos',
        titulo: 'Gravador DVR 8 canais',
        conteudo: 'Gravador DVR 8 canais por R$ 749,00.',
        palavras_chave: 'gravador, dvr, canais',
        ativo: true,
      },
      {
        id: 'd3',
        categoria: 'Contato',
        titulo: 'Horário de atendimento',
        conteudo: 'Segunda a sexta, das 8h às 18h.',
        palavras_chave: 'horario, contato',
        ativo: true,
      },
      {
        id: 'd4',
        categoria: 'Cobertura',
        titulo: 'Área de atendimento',
        conteudo: 'Atendemos toda a região metropolitana.',
        palavras_chave: 'area, atendimento, cidade',
        ativo: true,
      },
    ]
    expect(coberturaDaBase('Qual o valor do gravador de 8 canais?', baseDesempate)?.titulo).toBe(
      'Gravador DVR 8 canais',
    )
    expect(coberturaDaBase('Qual o horário de atendimento?', baseDesempate)?.titulo).toBe('Horário de atendimento')
  })
})

describe('coberturaDaBase — bateria de conversas-teste', () => {
  it('pergunta que bate com palavra-chave tem entrada correspondente', () => {
    const achada = coberturaDaBase('Qual o prazo de entrega?', base)
    expect(achada?.titulo).toBe('Prazo de entrega')
  })

  it('pergunta sem nenhuma cobertura devolve null (IA deveria encaminhar)', () => {
    expect(coberturaDaBase('Vocês fazem instalação de alarme sonoro condominial?', base)).toBe(null)
  })

  it('ignora entradas inativas ao calcular cobertura', () => {
    expect(coberturaDaBase('Tem gravador de 8 canais?', base)).toBe(null)
  })

  it('entende acento: "voce entregam?" casa com "entrega"', () => {
    const achada = coberturaDaBase('Vocês entregam amanhã?', base)
    expect(achada?.titulo).toBe('Prazo de entrega')
  })
})
