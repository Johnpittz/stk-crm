import { describe, it, expect } from 'vitest'
import { decidirOrdemResposta, montarEncaminhamentoIA } from './orquestrador'

/**
 * M2 — item 3: a ordem de resposta (chatbot > IA > humano) estava escrita em
 * 3 lugares: webhook WAHA (atendimento existente), webhook WAHA (novo) e
 * webhook Evolution legado. Cada cópia podia divergir e produzir resposta
 * dupla (chatbot E IA respondendo a mesma mensagem).
 *
 * Aqui a ordem vira UMA função pura, testada, usada pelos três caminhos.
 */

describe('decidirOrdemResposta — chatbot > IA > humano', () => {
  it('chatbot trata → chatbot, mesmo com IA ligada (nunca responde junto)', () => {
    const d = decidirOrdemResposta({ chatbotTrata: true, iaAtivada: true })
    expect(d.responsavel).toBe('chatbot')
    expect(d.motivo).toContain('chatbot')
  })

  it('chatbot não trata e IA ligada → IA', () => {
    const d = decidirOrdemResposta({ chatbotTrata: false, iaAtivada: true })
    expect(d.responsavel).toBe('ia')
  })

  it('nada automático → humano (silêncio, sem resposta inventada)', () => {
    const d = decidirOrdemResposta({ chatbotTrata: false, iaAtivada: false })
    expect(d.responsavel).toBe('humano')
    expect(d.motivo).toContain('humano')
  })

  it('chatbot com sessão encerrada não reativa: se não trata, pode ir pra IA', () => {
    const d = decidirOrdemResposta({ chatbotTrata: false, iaAtivada: true })
    expect(d.responsavel).not.toBe('chatbot')
  })

  it('cada decisão tem motivo legível (auditoria do porquê)', () => {
    for (const caso of [
      { chatbotTrata: true, iaAtivada: true },
      { chatbotTrata: false, iaAtivada: true },
      { chatbotTrata: false, iaAtivada: false },
    ]) {
      const d = decidirOrdemResposta(caso)
      expect(d.motivo.length).toBeGreaterThan(10)
    }
  })
})

describe('montarEncaminhamentoIA — registro do motivo (M2, item 2)', () => {
  it('gera notificação com a pergunta que a base não cobriu', () => {
    const n = montarEncaminhamentoIA({
      telefone: '5511999990000',
      atendimentoId: 'att-1',
      pergunta: 'Vocês fazem instalação de alarme?',
      motivo: 'fora_da_base',
    })
    expect(n.tipo).toBe('chatbot')
    expect(n.mensagem).toContain('fora_da_base')
    expect(n.dados.pergunta).toBe('Vocês fazem instalação de alarme?')
    expect(n.dados.telefone).toBe('5511999990000')
    expect(n.dados.atendimento_id).toBe('att-1')
  })

  it('motivo é obrigatório — sem motivo não há registro', () => {
    expect(() =>
      montarEncaminhamentoIA({
        telefone: '5511999990000',
        pergunta: 'oi',
        motivo: '',
      }),
    ).toThrow()
  })
})
