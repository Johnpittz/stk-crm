/**
 * 25/11/2026 — Fase1: proposta em PDF (estilo Reonic: cabeçalho, dados do
 * cliente, dimensionamento, componentes, validade60 dias).
 * Teste de fumaça: gera o documento e confere que tem conteúdo real.
 */
import { describe, it, expect } from "vitest";
import { gerarPropostaPdf } from "./proposta-pdf";
import type { EstudoUsina } from "./estudo";

const ESTUDO: EstudoUsina = {
  geradoEm: "2026-11-25T10:00:00.000Z",
  consumoMensalKwh: 1000,
  tarifaRpkwh: 0.95,
  metaPct: 100,
  modulo: { marca: "Honor Solar", modelo: "HB-M16R/132H-550", wp: 550 },
  inversor: { marca: "Solplanet", modelo: "ASW9100-S", kw: 9.1 },
  precoKitR: 40000,
  resultado: {
    kwpNecessario: 8,
    kwpInstalado: 8.25,
    numPaineis: 15,
    geracaoMensalKwh: 1031.25,
    cobrePct: 103.125,
    economiaMensalR: 979.6875,
    economiaAnualR: 11756.25,
    paybackAnos: 3.4024,
    co2EvitadoTons: 2.475,
    areaM2: 31.5,
  },
};

describe("gerarPropostaPdf", () => {
  it("gera um PDF com tamanho real (conteúdo de verdade)", () => {
    const doc = gerarPropostaPdf({
      clienteNome: "Maria Silva",
      clienteCidade: "São Paulo/SP",
      estudo: ESTUDO,
    });
    const buffer = doc.output("arraybuffer");
    expect(buffer.byteLength).toBeGreaterThan(2000);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("aceita estudo sem preço do kit (payback null) sem quebrar", () => {
    const semPreco: EstudoUsina = { ...ESTUDO, precoKitR: null };
    const doc = gerarPropostaPdf({ clienteNome: "João", estudo: semPreco });
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
