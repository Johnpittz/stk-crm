import { describe, it, expect } from 'vitest'
import {
  JANELA_SEM_RESPOSTA_HORAS,
  STATUS_CONVERSA_ABERTA,
  estaSemResposta,
  horasDeEspera,
  contarSemResposta,
  filtrarSemResposta,
  aplicarFiltroSemResposta,
  type Conversa,
} from './sem-resposta'

/**
 * Fase 1 / C1 — docs/plano-acao-modulos.md
 *
 * Regra de negócio (fonte única, usada pelo filtro lateral, pelo badge de
 * linha e — na Fase 2 — pelo remarketing do M1):
 *
 *   conversa "sem resposta" = status aberto/em_andamento
 *                             E cliente foi o último a falar
 *                             E já se passaram JANELA_SEM_RESPOSTA_HORAS
 */

const AGORA = new Date('2026-09-26T12:00:00.000Z')
const horasAtras = (h: number) => new Date(AGORA.getTime() - h * 3_600_000).toISOString()

function conversa(parcial: Partial<Conversa>): Conversa {
  return {
    status: 'aberto',
    ultima_mensagem_remetente: 'cliente',
    ultima_mensagem_data: horasAtras(30),
    ...parcial,
  }
}

describe('estaSemResposta — regra C1 (24h)', () => {
  it('FIXTURE 1: cliente falou por último há 30h em conversa aberta → sem resposta', () => {
    expect(estaSemResposta(conversa({}), AGORA)).toBe(true)
  })

  it('FIXTURE 2: cliente falou por último há 2h → ainda dentro da janela', () => {
    expect(estaSemResposta(conversa({ ultima_mensagem_data: horasAtras(2) }), AGORA)).toBe(false)
  })

  it('FIXTURE 3: quem falou por último fomos NÓS → nunca é "sem resposta"', () => {
    // 48h parado, mas a bola com o cliente. Vendedor/operador contam como "nós",
    // e resposta automática (chatbot/IA) TAMBÉM conta como resposta nossa —
    // decisão técnica do C1: remarketing não cai em cima de quem acabou de receber resposta.
    for (const remetente of ['vendedor', 'operador', 'chatbot', null]) {
      expect(
        estaSemResposta(
          conversa({ ultima_mensagem_remetente: remetente, ultima_mensagem_data: horasAtras(48) }),
          AGORA
        )
      ).toBe(false)
    }
  })

  it('FIXTURE 4: conversa fechada não entra na régua', () => {
    expect(
      estaSemResposta(
        conversa({ status: 'fechado', ultima_mensagem_data: horasAtras(48) }),
        AGORA
      )
    ).toBe(false)
  })

  it('casos-limite: sem data, data inválida e status desconhecido não quebram', () => {
    expect(estaSemResposta(conversa({ ultima_mensagem_data: null }), AGORA)).toBe(false)
    expect(estaSemResposta(conversa({ ultima_mensagem_data: 'nao-e-data' }), AGORA)).toBe(false)
    expect(estaSemResposta(conversa({ status: 'cancelado' }), AGORA)).toBe(false)
  })

  it('janela padrão é 24h e a linha do tempo é configurável', () => {
    expect(JANELA_SEM_RESPOSTA_HORAS).toBe(24)
    expect(STATUS_CONVERSA_ABERTA).toContain('aberto')
    expect(estaSemResposta(conversa({}), AGORA, 48)).toBe(false)
    expect(estaSemResposta(conversa({ ultima_mensagem_data: horasAtras(30) }), AGORA, 12)).toBe(true)
  })
})

describe('horasDeEspera — número exibido no badge da linha', () => {
  it('mostra as horas reais de espera (exemplo do plano: "25h")', () => {
    expect(horasDeEspera(conversa({ ultima_mensagem_data: horasAtras(25.9) }), AGORA)).toBe(25)
    expect(horasDeEspera(conversa({ ultima_mensagem_data: horasAtras(24) }), AGORA)).toBe(24)
  })

  it('sem data ou data inválida: null (badge não aparece)', () => {
    expect(horasDeEspera(conversa({ ultima_mensagem_data: null }), AGORA)).toBeNull()
    expect(horasDeEspera(conversa({ ultima_mensagem_data: 'x' }), AGORA)).toBeNull()
    expect(horasDeEspera(null, AGORA)).toBeNull()
  })

  it('nunca volta negativo mesmo com data no futuro', () => {
    expect(horasDeEspera(conversa({ ultima_mensagem_data: horasAtras(-5) }), AGORA)).toBe(0)
  })
})

describe('contarSemResposta / filtrarSemResposta', () => {
  const lista: Conversa[] = [
    conversa({}),                                            // sem resposta (30h)
    conversa({ ultima_mensagem_data: horasAtras(1) }),       // na janela
    conversa({ ultima_mensagem_remetente: 'vendedor' }),     // fomos nós
    conversa({ status: 'fechado' }),                         // fechada
    conversa({ ultima_mensagem_data: horasAtras(72) }),      // sem resposta (72h)
  ]

  it('conta apenas as que batem com a regra', () => {
    expect(contarSemResposta(lista, AGORA)).toBe(2)
  })

  it('filtra preservando a ordem original', () => {
    const filtradas = filtrarSemResposta(lista, AGORA)
    expect(filtradas).toHaveLength(2)
    expect(filtradas[0]).toBe(lista[0])
    expect(filtradas[1]).toBe(lista[4])
  })
})

describe('aplicarFiltroSemResposta — consulta única exportável (M1 reusa)', () => {
  function queryFake() {
    const calls: Array<[string, ...unknown[]]> = []
    const q: any = {}
    for (const metodo of ['in', 'eq', 'gte', 'order', 'limit']) {
      q[metodo] = (...args: unknown[]) => {
        calls.push([metodo, ...args])
        return q
      }
    }
    return { q, calls }
  }

  it('monta a MESMA regra no PostgREST (status, remetente cliente e corte)', () => {
    const { q, calls } = queryFake()
    aplicarFiltroSemResposta(q, AGORA)
    expect(calls).toContainEqual(['in', 'status', [...STATUS_CONVERSA_ABERTA]])
    expect(calls).toContainEqual(['eq', 'ultima_mensagem_remetente', 'cliente'])
    const corte = calls.find((c) => c[0] === 'gte')?.[2] as string
    expect(corte).toBe(horasAtras(24))
  })

  it('corte sai em formato "Z" sem "+00:00" (sinal + quebra a query string)', () => {
    const { q, calls } = queryFake()
    aplicarFiltroSemResposta(q, AGORA, 12)
    const corte = calls.find((c) => c[0] === 'gte')?.[2] as string
    expect(corte).not.toContain('+')
    expect(corte.endsWith('Z')).toBe(true)
    expect(corte).toBe(horasAtras(12))
  })

  it('é encadeável — devolve a própria query', () => {
    const { q } = queryFake()
    expect(aplicarFiltroSemResposta(q, AGORA)).toBe(q)
  })
})
