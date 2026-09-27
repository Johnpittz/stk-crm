import { describe, it, expect } from 'vitest'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { coberturaDaBase, MARCADOR_ENCAMINHAR, type EntradaConhecimento } from './base-conhecimento'
import { responderComBase } from './ai-assistant'

/**
 * M2 (Fase 4) — BATERIA DE CONVERSAS-TESTE.
 *
 * docs/plano-acao-modulos.md: "uma bateria de conversas-teste, cobrindo
 * pergunta esperada, o que a IA respondeu e o que era esperado — não só
 * 'passou'".
 *
 * São duas camadas:
 *  1. COBERTURA (sempre roda, sem rede): para cada pergunta, a base cobre?
 *     É o que dá feedback estável sobre a base cadastrada — se alguém editar
 *     a base e esquecer uma pergunta, este teste aponta qual.
 *  2. CONVERSA REAL com o Gemini (roda só com GEMINI_API_KEY definida):
 *     pergunta → o que a IA respondeu → o que era esperado.
 *
 * FIXTURE: lib/__fixtures__/base-conhecimento-fixture.json é um EXEMPLO de
 * base, não os dados da STK (a real é editada no painel).
 */

const fixture = JSON.parse(
  readFileSync('lib/__fixtures__/base-conhecimento-fixture.json', 'utf-8'),
)
const base: EntradaConhecimento[] = fixture.entradas as EntradaConhecimento[]
const bateria: Array<{ id: string; pergunta: string; esperado: 'coberta' | 'encaminhamento'; observacao: string }> =
  fixture.bateria

/**
 * Relatório da bateria: pergunta esperada × o que aconteceu, em texto E em
 * docs/relatorios/bateria-ia.md (o vitest engole stdout de teste que passa,
 * então o arquivo é a forma garantida de ler o resultado depois).
 */
function relatorio(linhas: Array<{ caso: any; resultado: string; bateu: boolean; detalhe: string }>, camada: string) {
  const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n))
  const cab = `${pad('ID', 5)} ${pad('PERGUNTA', 44)} ${pad('ESPERADO', 15)} ${pad('RESULTADO', 15)} OK`
  const corpo = linhas
    .map(
      (l) =>
        `${pad(l.caso.id, 5)} ${pad(l.caso.pergunta, 44)} ${pad(l.caso.esperado, 15)} ${pad(l.resultado, 15)} ${
          l.bateu ? '✓' : '✗'
        }\n      └ ${l.detalhe}`,
    )
    .join('\n')
  console.log(`\n── BATERIA DE CONVERSAS-TESTE — ${camada} (${linhas.length} casos) ──\n${cab}\n${corpo}\n`)

  // um arquivo por camada, sempre sobrescrito (nada de histórico infinito)
  const arquivo =
    camada.startsWith('camada 1')
      ? 'docs/relatorios/bateria-ia-cobertura.md'
      : 'docs/relatorios/bateria-ia-gemini.md'
  mkdirSync(dirname(arquivo), { recursive: true })
  const md = [
    `# Bateria de conversas-teste — ${camada}`,
    '',
    `> Gerado por \`lib/bateria-ia.test.ts\` (roda em \`npm test\`). Base: fixture de exemplo`,
    `> (\`lib/__fixtures__/base-conhecimento-fixture.json\`) — a base real é editada no painel.`,
    '',
    `| ${'ID'} | ${'Pergunta'} | Esperado | Resultado | OK | O que aconteceu |`,
    '| --- | --- | --- | --- | --- | --- |',
    ...linhas.map(
      (l) =>
        `| ${l.caso.id} | ${String(l.caso.pergunta).replace(/\|/g, '\\|')} | ${l.caso.esperado} | ${l.resultado} | ${
          l.bateu ? '✅' : '❌'
        } | ${l.detalhe.replace(/\|/g, '\\|')} |`,
    ),
    '',
    `Total: ${linhas.length} · bateram: ${linhas.filter((l) => l.bateu).length} · divergiram: ${linhas.filter((l) => !l.bateu).length}`,
    '',
  ].join('\n')

  writeFileSync(arquivo, md)
  return md
}

describe('bateria de conversas-teste — cobertura da base (sem rede)', () => {
  it('cobre exatamente as perguntas esperadas', () => {
    expect(bateria.length).toBeGreaterThanOrEqual(15)

    const linhas = bateria.map((caso) => {
      const achou = coberturaDaBase(caso.pergunta, base)
      const resultado = achou ? 'coberta' : 'encaminhamento'
      const bateu = resultado === caso.esperado
      return {
        caso,
        resultado,
        bateu,
        detalhe: achou
          ? `base: ${achou.categoria} › ${achou.titulo}`
          : 'sem entrada correspondente → IA devolve [[ENCAMINHAR]] e o vendedor assume',
      }
    })

    relatorio(linhas, 'camada 1 — cobertura da base (sem rede)')

    const falhas = linhas.filter((l) => !l.bateu)
    expect(falhas.map((f) => `${f.caso.id} "${f.caso.pergunta}" esperado=${f.caso.esperado}`)).toEqual([])
  })

  it('ignora entradas inativas (uma entrada desativada não pode ser citada)', () => {
    const inativas = base.filter((e) => !e.ativo)
    expect(inativas.length).toBeGreaterThan(0)

    // a pergunta sobre a lente só seria "coberta" se a entrada inativa fosse considerada
    const achou = coberturaDaBase('Qual a lente de 4mm?', base)
    expect(achou).toBeNull()
  })

  it('base vazia → nenhuma pergunta é coberta (IA encaminha tudo)', () => {
    expect(coberturaDaBase('Qual o prazo de entrega?', [])).toBeNull()
    expect(coberturaDaBase('Vocês vendem computador?', [])).toBeNull()
  })
})

// ─── Camada 2: conversa real com o Gemini (só com a chave no ambiente) ───

describe.skipIf(!process.env.GEMINI_API_KEY)(
  'bateria de conversas-teste — resposta real da IA (rede)',
  () => {
    it(
      'cada pergunta devolve o comportamento esperado',
      async () => {
        const linhas: Array<{ caso: any; resultado: string; bateu: boolean; detalhe: string }> = []

        for (const caso of bateria) {
          const r = await responderComBase({ mensagemCliente: caso.pergunta, base })
          const encaminhou = r.encaminhar || (r.texto ?? '').includes(MARCADOR_ENCAMINHAR)
          const resultado = encaminhou ? 'encaminhamento' : 'respondeu'
          const bateu = resultado === caso.esperado
          linhas.push({
            caso,
            resultado,
            bateu,
            detalhe: encaminhou
              ? `motivo=${r.motivo} — marcador ${MARCADOR_ENCAMINHAR}`
              : `resposta: ${(r.texto || '').replace(/\s+/g, ' ').slice(0, 110)}`,
          })
        }

        relatorio(linhas, 'camada 2 — resposta real do Gemini (rede)')
        expect(linhas.filter((l) => !l.bateu).map((l) => l.caso.id)).toEqual([])
      },
      180_000,
    )
  },
)
