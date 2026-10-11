/**
 * Extração de TEXTO de PDF — usada quando o cliente manda a conta por
 * WhatsApp como arquivo (06/10, IA de conta).
 *
 * Mesma biblioteca do módulo RECIEE (`pdf2json`, puro Node, sem browser).
 * LANÇA se o arquivo não for um PDF legível.
 */
export function extrairTextoPdf(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      /* eslint-disable @typescript-eslint/no-var-requires */
      const PDFParser = require('pdf2json')
      const parser = new PDFParser()
      let resolvido = false

      parser.on('pdfParser_dataReady', (data: any) => {
        if (resolvido) return
        resolvido = true
        try {
          const paginas: string[] = (data?.Pages ?? []).map((pg: any) =>
            (pg.Texts ?? [])
              .map((t: any) =>
                (t.R ?? [])
                  .map((r: any) => {
                    const bruto = String(r?.T ?? '')
                    try {
                      return decodeURIComponent(bruto)
                    } catch {
                      return bruto
                    }
                  })
                  .join(''),
              )
              .join(' '),
          )
          resolve(paginas.join('\n'))
        } catch (erro) {
          reject(erro)
        }
      })

      parser.on('pdfParser_dataError', (err: any) => {
        if (resolvido) return
        resolvido = true
        reject(new Error(`PDF ilegível: ${err?.parserError ?? 'erro ao ler o arquivo'}`))
      })

      parser.parseBuffer(buffer)
    } catch (erro) {
      reject(erro)
    }
  })
}
