import { describe, it, expect } from 'vitest'
import {
  montarBlocoConhecimento,
  detectarEncaminhamento,
  coberturaDaBase,
  palavrasChaveDe,
  normalizarTexto,
  baseVazia,
  filtrarBasePorVendedor,
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

  it('03/10: as palavras-chave vão junto no bloco (sem elas a IA não casa a pergunta)', () => {
    // O João cadastrou 'prazo' como palavra-chave, mas ela NÃO ia pro prompt —
    // a IA via só 'teste viabilidade: Vai chegar amanhã' e perguntou em vez de
    // responder (conversa real de 03/10 03:26).
    const bloco = montarBlocoConhecimento([
      {
        id: 'e9',
        categoria: 'Geral',
        titulo: 'Teste viabilidade',
        conteudo: 'Vai chegar amanhã',
        palavras_chave: ['prazo', 'entrega'],
        ativo: true,
      },
    ])
    expect(bloco).toContain('Teste viabilidade')
    expect(bloco).toContain('prazo')
    expect(bloco).toContain('entrega')
    expect(bloco).toContain('Vai chegar amanhã')
  })

  it('entrada sem palavra-chave continua normal (sem colchete vazio)', () => {
    const bloco = montarBlocoConhecimento([
      { id: 'e10', categoria: 'Geral', titulo: 'Horário', conteudo: '8h às 18h', ativo: true },
    ])
    expect(bloco).toContain('Horário: 8h às 18h')
    expect(bloco).not.toContain('[]')
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

describe('filtrarBasePorVendedor (PEDIDO 2 — base do vendedor, 11/10)', () => {
  const global: EntradaConhecimento = {
    id: 'g1', categoria: 'Geral', titulo: 'Sobre a STK', conteudo: 'Somos de Goiânia.', ativo: true,
  }
  const daJoana: EntradaConhecimento = {
    id: 'j1', categoria: 'Minha', titulo: 'Tabela da Joana', conteudo: 'Desconto especial 10%.', ativo: true,
    vendedor_id: 'ven-joana',
  }
  const doPedro: EntradaConhecimento = {
    id: 'p1', categoria: 'Minha', titulo: 'Tabela do Pedro', conteudo: 'Frete grátis região sul.', ativo: true,
    vendedor_id: 'ven-pedro',
  }
  const todos = [global, daJoana, doPedro]

  it('vendedor vê as globais + as dele (e não as dos outros)', () => {
    const r = filtrarBasePorVendedor(todos, 'ven-joana')
    expect(r.map((e) => e.id)).toEqual(['g1', 'j1'])
  })

  it('conversa sem vendedor dono → só as globais (nunca vaza base de alguém)', () => {
    expect(filtrarBasePorVendedor(todos, null).map((e) => e.id)).toEqual(['g1'])
    expect(filtrarBasePorVendedor(todos, undefined).map((e) => e.id)).toEqual(['g1'])
  })

  it('linha antiga sem o campo vendedor_id conta como global', () => {
    const antiga = { id: 'a1', categoria: 'Geral', titulo: 'Antiga', conteudo: 'ok', ativo: true }
    expect(filtrarBasePorVendedor([antiga, daJoana], 'ven-x').map((e) => e.id)).toEqual(['a1'])
  })

  it('lista vazia devolve vazia', () => {
    expect(filtrarBasePorVendedor([], 'ven-x')).toEqual([])
  })
})
