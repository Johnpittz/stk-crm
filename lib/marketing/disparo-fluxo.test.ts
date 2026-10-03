import { describe, it, expect, vi } from 'vitest'
import {
  limparBase64,
  ehTelefone,
  montarNumbers,
  prepararPassosDoFluxo,
  type PassoFluxo,
} from './disparo-fluxo'

/**
 * Bug 03/10 — imagem do disparo saía como ARQUIVO de 422 KB.
 *
 * Causa: a tela de Marketing > Campanhas gravava o passo de imagem com o
 * prefixo `data:image/jpeg;base64,` (FileReader) e SEM subir pro Storage —
 * o robô mandava esse valor pra WAHA, que exige base64 puro; a decodificação
 * saía corrompida (prova: fileLength 432548 com prefixo vs 432533 limpo).
 *
 * Aqui fica o contrato da preparação do fluxo: imagem sobe pro Storage e o
 * passo vira {type:'image', url}; o que sobrar sempre sai SEM prefixo.
 * Irmão: a lista `numbers` não pode mais conter a instância ('STK-3' virava
 * chatId '553@c.us' e a WAHA dava timeout).
 */

const dataUri = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='

describe('limparBase64 — a WAHA exige base64 puro', () => {
  it('remove o prefixo data:...;base64,', () => {
    expect(limparBase64(dataUri)).toBe('/9j/4AAQSkZJRgABAQ==')
  })

  it('aceita qualquer mimetype no prefixo', () => {
    expect(limparBase64('data:application/octet-stream;base64,QUJD')).toBe('QUJD')
  })

  it('base64 puro passa intacto', () => {
    expect(limparBase64('/9j/4AAQSkZJRgABAQ==')).toBe('/9j/4AAQSkZJRgABAQ==')
  })

  it('valor vazio não quebra', () => {
    expect(limparBase64('')).toBe('')
  })
})

describe('ehTelefone — a lista não pode conter a instância', () => {
  it("'STK-3' (instância) NÃO é contato", () => {
    expect(ehTelefone('STK-3')).toBe(false)
  })

  it('telefone com DDI e formatado são contatos', () => {
    expect(ehTelefone('556282735286')).toBe(true)
    expect(ehTelefone('(62) 99999-0000')).toBe(true)
  })

  it('curto/vazio não é contato', () => {
    expect(ehTelefone('553')).toBe(false)
    expect(ehTelefone('')).toBe(false)
  })
})

describe('montarNumbers — só contatos, nunca a instância', () => {
  it('descarta entradas que não são telefone', () => {
    const numbers = montarNumbers([
      'STK-3',
      { nome: 'João', telefone: '6282735286' },
      { nome: '', telefone: '553' },
    ])
    expect(numbers).toEqual([{ nome: 'João', telefone: '6282735286' }])
  })

  it('aceita contatos vindos como string', () => {
    expect(montarNumbers(['6282735286'])).toEqual([
      { nome: '', telefone: '6282735286' },
    ])
  })
})

describe('prepararPassosDoFluxo — imagem sobe pro Storage', () => {
  it('texto fica como está e a ordem é preservada', async () => {
    const upload = vi.fn(async () => 'https://cdn/x.jpg')
    const passos = await prepararPassosDoFluxo(
      [
        { type: 'text', content: 'antes' },
        { type: 'image', base64: dataUri, mimetype: 'image/jpeg' },
        { type: 'text', content: 'depois' },
      ],
      upload,
    )
    expect(passos.map((p) => p.type)).toEqual(['text', 'image', 'text'])
    expect(passos[0].content).toBe('antes')
    expect(passos[2].content).toBe('depois')
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('imagem vira {type:image, url, mimetype} e o upload recebe base64 LIMPO', async () => {
    const upload = vi.fn(async () => 'https://cdn/x.jpg')
    const passos = await prepararPassosDoFluxo(
      [{ type: 'image', base64: dataUri, mimetype: 'image/jpeg' }],
      upload,
    )
    expect(upload).toHaveBeenCalledWith('/9j/4AAQSkZJRgABAQ==', 'image/jpeg')
    expect(passos[0]).toEqual({
      type: 'image',
      url: 'https://cdn/x.jpg',
      mimetype: 'image/jpeg',
    })
    expect(passos[0].base64).toBeUndefined()
  })

  it('upload falhou: mantém o passo com base64 JÁ LIMPO (defesa do robô)', async () => {
    const upload = vi.fn(async () => null)
    const passos = await prepararPassosDoFluxo(
      [{ type: 'image', base64: dataUri, mimetype: 'image/jpeg' }],
      upload,
    )
    expect(passos[0].base64).toBe('/9j/4AAQSkZJRgABAQ==')
    expect(passos[0].mimetype).toBe('image/jpeg')
  })

  it('imagem que já tem url não faz upload', async () => {
    const upload = vi.fn(async () => 'https://cdn/novo.jpg')
    const passos = await prepararPassosDoFluxo(
      [{ type: 'image', url: 'https://cdn/velho.jpg', mimetype: 'image/png' }],
      upload,
    )
    expect(upload).not.toHaveBeenCalled()
    expect(passos[0].url).toBe('https://cdn/velho.jpg')
  })

  it('passo sem mimetype não sobe (upload precisa do tipo), mas sai limpo', async () => {
    const upload = vi.fn(async () => 'https://cdn/x.jpg')
    const passos = await prepararPassosDoFluxo(
      [{ type: 'image', base64: dataUri }] as PassoFluxo[],
      upload,
    )
    expect(upload).not.toHaveBeenCalled()
    expect(passos[0].base64).toBe('/9j/4AAQSkZJRgABAQ==')
  })
})
