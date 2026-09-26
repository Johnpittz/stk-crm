import { describe, it, expect } from 'vitest'
import {
  normalizarTelefone,
  registrarOptOut,
  JANELA_REMARKETING_HORAS,
  ehPublicoRemarketing,
  contarPublicoRemarketing,
  corteRemarketing,
  aplicarFiltroPublicoRemarketing,
  type ConversaRemarketing,
} from './remarketing'
import { estaSemResposta } from '../atendimentos/sem-resposta'

/**
 * Fase 2 / M1 — público de REMARKETING (docs/plano-acao-modulos.md).
 *
 * Atenção às DUAS bases (foi o principal ajuste do plano, não confundir):
 *   C1  (CRM)      → cliente falou por último e nós não respondemos há 24h
 *   M1  (Marketing)→ NÓS falamos por último e o cliente não respondeu há 24h
 *
 * Guarda de honestidade: quem tem remetente desconhecido (null) NÃO entra —
 * se não dá pra provar que fomos nós, não arriscamos mandar mensagem.
 */

const AGORA = new Date('2026-09-26T12:00:00.000Z')
const horasAtras = (h: number) => new Date(AGORA.getTime() - h * 3_600_000).toISOString()

function conversa(parcial: Partial<ConversaRemarketing>): ConversaRemarketing {
  return {
    status: 'aberto',
    ultima_mensagem_remetente: 'vendedor',
    ultima_mensagem_data: horasAtras(30),
    ...parcial,
  }
}

describe('ehPublicoRemarketing — regra M1 (nós falamos por último, 24h sem resposta)', () => {
  it('FIXTURE 1: vendedor falou por último há 30h em conversa aberta → é público', () => {
    expect(ehPublicoRemarketing(conversa({}), AGORA)).toBe(true)
  })

  it('FIXTURE 2: operador/chatbot falaram por último → também conta como "nós"', () => {
    for (const remetente of ['operador', 'chatbot']) {
      expect(ehPublicoRemarketing(conversa({ ultima_mensagem_remetente: remetente }), AGORA)).toBe(true)
    }
  })

  it('FIXTURE 3: cliente falou por último → NÃO é público (essa é a fila do C1)', () => {
    expect(ehPublicoRemarketing(conversa({ ultima_mensagem_remetente: 'cliente' }), AGORA)).toBe(false)
  })

  it('FIXTURE 4: falamos há 2h → cliente ainda está na janela de resposta, não remarca', () => {
    expect(ehPublicoRemarketing(conversa({ ultima_mensagem_data: horasAtras(2) }), AGORA)).toBe(false)
  })

  it('conversa fechada/cancelada não entra', () => {
    for (const status of ['fechado', 'cancelado', 'resolvido']) {
      expect(ehPublicoRemarketing(conversa({ status }), AGORA)).toBe(false)
    }
  })

  it('remetente desconhecido (null) NÃO entra — se não sei que fomos nós, não envio', () => {
    expect(ehPublicoRemarketing(conversa({ ultima_mensagem_remetente: null }), AGORA)).toBe(false)
    expect(ehPublicoRemarketing(conversa({ ultima_mensagem_remetente: '' }), AGORA)).toBe(false)
  })

  it('sem data / data inválida não quebra', () => {
    expect(ehPublicoRemarketing(conversa({ ultima_mensagem_data: null }), AGORA)).toBe(false)
    expect(ehPublicoRemarketing(conversa({ ultima_mensagem_data: 'x' }), AGORA)).toBe(false)
    expect(ehPublicoRemarketing(null, AGORA)).toBe(false)
  })

  it('janela padrão é 24h (D1) e é configurável', () => {
    expect(JANELA_REMARKETING_HORAS).toBe(24)
    expect(ehPublicoRemarketing(conversa({}), AGORA, 48)).toBe(false)
    expect(ehPublicoRemarketing(conversa({ ultima_mensagem_data: horasAtras(30) }), AGORA, 12)).toBe(true)
  })

  it('NUNCA se cruza com o C1: público de remarketing e fila de resposta são disjuntos', () => {
    const exemplares: ConversaRemarketing[] = [
      conversa({}),
      conversa({ ultima_mensagem_remetente: 'chatbot' }),
      conversa({ ultima_mensagem_remetente: 'cliente' }),
      conversa({ ultima_mensagem_remetente: null }),
      conversa({ status: 'fechado' }),
      conversa({ ultima_mensagem_data: horasAtras(2) }),
    ]
    for (const c of exemplares) {
      expect(ehPublicoRemarketing(c, AGORA) && estaSemResposta(c, AGORA)).toBe(false)
    }
  })
})

describe('contarPublicoRemarketing', () => {
  it('conta só quem bate com a regra', () => {
    const lista = [
      conversa({}),                                             // público (30h)
      conversa({ ultima_mensagem_data: horasAtras(1) }),        // ainda na janela
      conversa({ ultima_mensagem_remetente: 'cliente' }),       // é o C1
      conversa({ status: 'fechado' }),                          // encerrada
      conversa({ ultima_mensagem_remetente: 'operador' }),      // público (30h)
    ]
    expect(contarPublicoRemarketing(lista, AGORA)).toBe(2)
  })
})

describe('aplicarFiltroPublicoRemarketing — consulta única exportável (worker reusa)', () => {
  function queryFake() {
    const calls: Array<[string, ...unknown[]]> = []
    const q: any = {}
    for (const metodo of ['in', 'neq', 'lte', 'order', 'limit']) {
      q[metodo] = (...args: unknown[]) => {
        calls.push([metodo, ...args])
        return q
      }
    }
    return { q, calls }
  }

  it('monta exatamente a regra do plano: status abertos, remetente != cliente, data <= corte', () => {
    const { q, calls } = queryFake()
    aplicarFiltroPublicoRemarketing(q, AGORA)
    expect(calls).toContainEqual(['in', 'status', ['aberto', 'em_andamento']])
    expect(calls).toContainEqual(['neq', 'ultima_mensagem_remetente', 'cliente'])
    expect(calls).toContainEqual(['lte', 'ultima_mensagem_data', horasAtras(24)])
  })

  it('corte sai em "...Z" e nunca com sinal de mais (bug do PostgREST de 26/09)', () => {
    const corte = corteRemarketing(AGORA)
    expect(corte).toBe(horasAtras(24))
    expect(corte).not.toContain('+')
    expect(corte.endsWith('Z')).toBe(true)
  })

  it('devolve a MESMA query encadeada (serve de builder p/ o servidor)', () => {
    const { q } = queryFake()
    expect(aplicarFiltroPublicoRemarketing(q, AGORA)).toBe(q)
  })
})


describe('opt-out (remarketing_opt_out)', () => {
  function supabaseStub(erro: any = null) {
    const inserts: any[] = []
    return {
      inserts,
      from: (tabela: string) => ({
        upsert: (linha: any, opts: any) => {
          expect(tabela).toBe('remarketing_opt_out')
          expect(opts?.onConflict).toBe('telefone')
          inserts.push(linha)
          return { error: erro }
        },
      }),
    }
  }

  it('normaliza qualquer formato para só dígitos (mesma chave do worker)', () => {
    expect(normalizarTelefone('(62) 99999-0000')).toBe('62999990000')
    expect(normalizarTelefone('5562999990000')).toBe('5562999990000')
    expect(normalizarTelefone(undefined)).toBe('')
    expect(normalizarTelefone(null)).toBe('')
  })

  it('grava o telefone normalizado com o motivo', async () => {
    const sb = supabaseStub()
    const r = await registrarOptOut(sb as any, '(62) 9 1111-2222', 'chatbot:pedido_de_parada')
    expect(r.ok).toBe(true)
    expect(sb.inserts[0]).toEqual({
      telefone: '62911112222',
      motivo: 'chatbot:pedido_de_parada',
    })
  })

  it('telefone inválido não toca no banco', async () => {
    const sb = supabaseStub()
    const r = await registrarOptOut(sb as any, 'abc')
    expect(r.ok).toBe(false)
    expect(r.erro).toBe('telefone_invalido')
    expect(sb.inserts).toHaveLength(0)
  })

  it('erro do banco vira { ok: false } sem lançar exceção', async () => {
    const r = await registrarOptOut(supabaseStub({ message: 'sem tabela' }) as any, '62999990000')
    expect(r.ok).toBe(false)
    expect(r.erro).toContain('sem tabela')
  })
})
