import { describe, it, expect } from 'vitest'
import {
  PARADA_HORAS_PADRAO,
  ETAPA_FINAL,
  horasDaEtapa,
  estaParada,
  contarParadasPorEtapa,
  type OportunidadeParavel,
} from './parada'

/**
 * Fase 1 / C2 — docs/plano-acao-modulos.md
 *
 * Regra (fonte única do lado web; o worker tem o espelho em Python):
 *   oportunidade "parada" = etapa diferente de ETAPA_FINAL
 *                           E updated_at mais velho que o limite da etapa
 *   limite por etapa: por_etapa[etapa] ?? parada_horas (padrão 72h)
 */

const AGORA = new Date('2026-09-26T12:00:00.000Z')
const horasAtras = (h: number) => new Date(AGORA.getTime() - h * 3_600_000).toISOString()

function oportunidade(parcial: Partial<OportunidadeParavel>): OportunidadeParavel {
  return {
    id: 'opp-1',
    etapa: 'recebeu_conta',
    updated_at: horasAtras(80),
    ...parcial,
  }
}

describe('horasDaEtapa — parâmetros configuráveis por etapa', () => {
  it('padrão 72h quando não há regra', () => {
    expect(PARADA_HORAS_PADRAO).toBe(72)
    expect(horasDaEtapa('recebeu_conta', {})).toBe(72)
  })

  it('aceita parada_horas global e por_etapa individual', () => {
    const regra = { parada_horas: 48, por_etapa: { contrato_enviado: 24 } }
    expect(horasDaEtapa('recebeu_conta', regra)).toBe(48)
    expect(horasDaEtapa('contrato_enviado', regra)).toBe(24)
  })

  it('valor inválido não zera a régua (cai no padrão)', () => {
    expect(horasDaEtapa('x', { parada_horas: 0 })).toBe(72)
    expect(horasDaEtapa('x', { parada_horas: -5 })).toBe(72)
    expect(horasDaEtapa('x', { parada_horas: 'abc' as any })).toBe(72)
    expect(horasDaEtapa('x', { por_etapa: { x: 0 } })).toBe(72)
  })
})

describe('estaParada — régua por etapa', () => {
  it('parada há 80h (padrão 72h) → true', () => {
    expect(estaParada(oportunidade({}), AGORA)).toBe(true)
  })

  it('parada há 10h → ainda não', () => {
    expect(estaParada(oportunidade({ updated_at: horasAtras(10) }), AGORA)).toBe(false)
  })

  it('etapa final (comissao_paga) NUNCA conta, mesmo velha', () => {
    expect(
      estaParada(oportunidade({ etapa: ETAPA_FINAL, updated_at: horasAtras(500) }), AGORA)
    ).toBe(false)
  })

  it('limite da etapa é aplicado por coluna', () => {
    const regra = { parada_horas: 72, por_etapa: { recebeu_conta: 24 } }
    // 30h parado: estoura o limite de 24h da etapa, mas não o de 72h das outras
    expect(estaParada(oportunidade({ etapa: 'recebeu_conta', updated_at: horasAtras(30) }), AGORA, regra)).toBe(true)
    expect(estaParada(oportunidade({ etapa: 'proposta_feita', updated_at: horasAtras(30) }), AGORA, regra)).toBe(false)
  })

  it('sem updated_at não dá para julgar → não marca como parada', () => {
    expect(estaParada(oportunidade({ updated_at: null }), AGORA)).toBe(false)
    expect(estaParada(oportunidade({ updated_at: 'lixo' }), AGORA)).toBe(false)
  })
})

describe('contarParadasPorEtapa — badge de coluna', () => {
  it('conta por coluna e ignora etapa final/nao-paradas', () => {
    const lista: OportunidadeParavel[] = [
      oportunidade({ id: '1', etapa: 'recebeu_conta' }),
      oportunidade({ id: '2', etapa: 'recebeu_conta', updated_at: horasAtras(10) }),
      oportunidade({ id: '3', etapa: 'proposta_feita', updated_at: horasAtras(100) }),
      oportunidade({ id: '4', etapa: 'comissao_paga', updated_at: horasAtras(999) }),
    ]
    expect(contarParadasPorEtapa(lista, AGORA)).toEqual({
      recebeu_conta: 1,
      proposta_feita: 1,
    })
  })

  it('colunas sem parada não aparecem no mapa (badge fica oculto)', () => {
    expect(contarParadasPorEtapa([], AGORA)).toEqual({})
  })
})
