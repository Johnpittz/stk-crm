/**
 * Extensão de arquivo no upload de mídia.
 *
 * Bug real: o xlsx baixava como .docx (mimetype "…officedocument…" casava com
 * "document" antes de "spreadsheet") e documento recebido via webhook baixava
 * como .bin (application/octet-stream sem filename de fallback).
 */

import { describe, it, expect } from 'vitest'
import { extensaoArquivo } from './media-storage'

describe('extensaoArquivo', () => {
  it('xlsx: mimetype do openxml NÃO pode cair em docx', () => {
    expect(
      extensaoArquivo('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    ).toBe('xlsx')
  })

  it('usando o nome original quando o mimetype é genérico', () => {
    expect(extensaoArquivo('application/octet-stream', 'relatorio.xlsx')).toBe('xlsx')
    expect(extensaoArquivo('application/octet-stream', 'contrato.pdf')).toBe('pdf')
    expect(extensaoArquivo('', 'dados.csv')).toBe('csv')
  })

  it('txt e csv a partir do mimetype', () => {
    expect(extensaoArquivo('text/plain')).toBe('txt')
    expect(extensaoArquivo('text/csv')).toBe('csv')
  })

  it('mantém os formatos já conhecidos', () => {
    expect(extensaoArquivo('audio/ogg; codecs=opus')).toBe('ogg')
    expect(extensaoArquivo('image/jpeg')).toBe('jpg')
    expect(extensaoArquivo('application/pdf')).toBe('pdf')
    expect(extensaoArquivo('video/mp4')).toBe('mp4')
  })

  it('fallback bin quando não há pista nenhuma', () => {
    expect(extensaoArquivo('application/x-coisa')).toBe('bin')
  })
})
