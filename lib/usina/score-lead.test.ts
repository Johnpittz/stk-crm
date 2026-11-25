/**
 * 25/11/2026 — Fase2-A: score do lead que chega pela LANDING pública
 * "quanto posso economizar" (estudo Reonic → captação com pontuação).
 *
 * Regra simples e explicável pro vendedor (o que o painel mostra é o
 * número daqui, não uma caixa-preta):
 *   - faixa do gasto mensal com energia (quanto maior, mais quente);
 *   - bônus por ter WhatsApp válido (dá para chamar);
 *   - teto em100.
 */
import { describe, it, expect } from "vitest";
import { calcularScoreLead, faixaDoGasto } from "./score-lead";

describe("calcularScoreLead", () => {
  it("gasto baixo (<200) começa em30", () => {
    expect(calcularScoreLead({ gastoMensalR: 150 })).toBe(30);
  });

  it("faixas de gasto sobem por degrau", () => {
    expect(calcularScoreLead({ gastoMensalR: 250 })).toBe(50); //200–499
    expect(calcularScoreLead({ gastoMensalR: 700 })).toBe(70); //500–999
    expect(calcularScoreLead({ gastoMensalR: 1500 })).toBe(85); //>=1000
  });

  it("WhatsApp válido soma +10 (sem passar de100)", () => {
    expect(calcularScoreLead({ gastoMensalR: 1500, telefone: "11987654321" })).toBe(95);
    expect(calcularScoreLead({ gastoMensalR: 4000, telefone: "(11) 98765-4321" })).toBe(100);
  });

  it("telefone incompleto/inválido não dá bônus", () => {
    expect(calcularScoreLead({ gastoMensalR: 700, telefone: "123" })).toBe(70);
    expect(calcularScoreLead({ gastoMensalR: 700, telefone: "" })).toBe(70);
    expect(calcularScoreLead({ gastoMensalR: 700 })).toBe(70);
  });

  it("sem gasto informado: piso de20 (lead frio, mas não zera)", () => {
    expect(calcularScoreLead({})).toBe(20);
    expect(calcularScoreLead({ gastoMensalR: 0 })).toBe(20);
    expect(calcularScoreLead({ gastoMensalR: -10 })).toBe(20);
  });
});

describe("faixaDoGasto (rótulo pro painel)", () => {
  it("nomeia a faixa em pt-BR", () => {
    expect(faixaDoGasto(150)).toBe("baixo");
    expect(faixaDoGasto(700)).toBe("medio");
    expect(faixaDoGasto(1500)).toBe("alto");
    expect(faixaDoGasto(undefined)).toBe("nao_informado");
  });
});
