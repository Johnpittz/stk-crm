/**
 * PEDIDO 2 (11/10) — BASE DE CONHECIMENTO DO VENDEDOR.
 *
 * A IA do atendimento passa a receber a base do VENDEDOR dono da
 * conversa somada às entradas globais (decisão do João em 11/10:
 * "IA usa a base do vendedor dono da conversa"). As entradas de
 * OUTROS vendedores nunca entram no prompt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./ia-provider', () => ({
  chamarModelo: vi.fn(async () => 'Resposta vinda da base'),
}))

import { chamarModelo } from './ia-provider'
import { carregarBaseConhecimento, responderComBase } from './ai-assistant'

const linhasBanco = [
  { id: 'g1', categoria: 'Geral', titulo: 'Sobre a STK', conteudo: 'Somos de Goiânia.', palavras_chave: [], ativo: true, vendedor_id: null },
  { id: 'j1', categoria: 'Minha', titulo: 'Tabela da Joana', conteudo: 'Desconto especial 10%.', palavras_chave: [], ativo: true, vendedor_id: 'ven-joana' },
  { id: 'p1', categoria: 'Minha', titulo: 'Tabela do Pedro', conteudo: 'Frete grátis sul.', palavras_chave: [], ativo: true, vendedor_id: 'ven-pedro' },
]

/** Stub de Supabase que devolve as linhas acima (select + 2 order). */
function supabaseStub(linhas = linhasBanco) {
  const resultado = Promise.resolve({ data: linhas, error: null })
  const ordenado = { order: () => ({ order: () => resultado }) }
  return { from: () => ({ select: () => ordenado }) }
}

beforeEach(() => vi.mocked(chamarModelo).mockClear())
afterEach(() => vi.unstubAllGlobals())

describe('carregarBaseConhecimento — base por vendedor', () => {
  it('com vendedor: devolve globais + as dele (e não as de terceiros)', async () => {
    const r = await carregarBaseConhecimento(supabaseStub(), 'ven-joana')
    expect(r?.map((e) => e.id)).toEqual(['g1', 'j1'])
  })

  it('sem vendedor (atendimento sem dono): só globais', async () => {
    const r = await carregarBaseConhecimento(supabaseStub(), null)
    expect(r?.map((e) => e.id)).toEqual(['g1'])
  })
})

describe('responderComBase — a IA responde com a base do dono da conversa', () => {
  it('o prompt leva a entrada do vendedor dono e NÃO a de outro vendedor', async () => {
    const r = await responderComBase({
      mensagemCliente: 'Tem desconto?',
      supabase: supabaseStub(),
      vendedorId: 'ven-joana',
    })
    expect(r.encaminhar).toBe(false)
    expect(chamarModelo).toHaveBeenCalledTimes(1)
    const prompt = vi.mocked(chamarModelo).mock.calls[0][0]
    expect(prompt).toContain('Tabela da Joana')
    expect(prompt).toContain('Sobre a STK')
    expect(prompt).not.toContain('Tabela do Pedro')
  })

  it('falha do modelo continua virando encaminhar (guardrail intacto)', async () => {
    vi.mocked(chamarModelo).mockRejectedValueOnce(new Error('HTTP 500'))
    const r = await responderComBase({
      mensagemCliente: 'oi',
      supabase: supabaseStub(),
      vendedorId: 'ven-joana',
    })
    expect(r.encaminhar).toBe(true)
    expect(r.motivo).toBe('erro_ia')
  })
})
