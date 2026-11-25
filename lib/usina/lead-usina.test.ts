/**
 * 25/11/2026 — Fase2-A: regra do LEAD da landing (validação + payload).
 *
 * Puro de propósito: a rota pública só valida rate-limit e grava; tudo que
 * pode ser testado mora aqui. A landing pede GASTO EM REAIS (como a Reonic),
 * não kWh — então o consumo entra por estimativa com a tarifa padrão quando
 * o visitante não informar kWh.
 */
import { describe, it, expect } from "vitest";
import { montarLeadUsina, TARIFA_PADRAO_RKWH } from "./lead-usina";

describe("montarLeadUsina", () => {
  it("valida nome (mínimo2 letras) e telefone (mínimo10 dígitos)", () => {
    expect(montarLeadUsina({ nome: "A", telefone: "11987654321", gastoMensalR: 500 }).erros).toContain(
      "nome"
    );
    expect(montarLeadUsina({ nome: "Maria", telefone: "123", gastoMensalR: 500 }).erros).toContain(
      "telefone"
    );
    expect(montarLeadUsina({ nome: "Maria Silva", telefone: "(11) 98765-4321", gastoMensalR: 500 }).erros).toEqual([]);
  });

  it("exige gasto mensal OU consumo em kWh", () => {
    const semNada = montarLeadUsina({ nome: "Maria", telefone: "11987654321" });
    expect(semNada.erros).toContain("gasto");
    const comKwh = montarLeadUsina({ nome: "Maria", telefone: "11987654321", consumoKwh: 900 });
    expect(comKwh.erros).toEqual([]);
  });

  it("sem kWh, estima consumo = gasto / tarifa padrão", () => {
    const lead = montarLeadUsina({ nome: "Maria", telefone: "11987654321", gastoMensalR: 950 });
    expect(lead.erros).toEqual([]);
    expect(lead.consumoMensalKwh).toBeCloseTo(950 / TARIFA_PADRAO_RKWH, 3);
  });

  it("com kWh informado, ele manda (gasto só serve pro score)", () => {
    const lead = montarLeadUsina({
      nome: "Maria",
      telefone: "11987654321",
      gastoMensalR: 950,
      consumoKwh: 800,
    });
    expect(lead.consumoMensalKwh).toBe(800);
  });

  it("payload pronto pro banco: origem site + notas com a estimativa", () => {
    const lead = montarLeadUsina({
      nome: "Maria Silva",
      telefone: "11987654321",
      cidade: "São Paulo",
      gastoMensalR: 950,
    });
    expect(lead.payload.nome).toBe("Maria Silva");
    expect(lead.payload.telefone).toBe("11987654321");
    expect(lead.payload.origem).toBe("site");
    expect(lead.payload.status).toBe("novo");
    expect(typeof lead.payload.score).toBe("number");
    const notas = JSON.parse(lead.payload.notas);
    expect(notas.fonte).toBe("landing_usina");
    expect(notas.cidade).toBe("São Paulo");
    expect(notas.gastoMensalR).toBe(950);
    expect(notas.consumoMensalKwh).toBeCloseTo(950 / TARIFA_PADRAO_RKWH, 3);
    expect(notas.kwp).toBeGreaterThan(0);
    expect(notas.numPaineis).toBeGreaterThan(0);
  });

  it("telefone vira só dígitos no payload", () => {
    const lead = montarLeadUsina({
      nome: "Maria",
      telefone: "(11) 98765-4321",
      gastoMensalR: 500,
    });
    expect(lead.payload.telefone).toBe("11987654321");
  });
});
