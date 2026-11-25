/**
 * 25/11/2026 — Fase 1 do estudo de usina (ideia da demo Reonic).
 * Cálculo puro do dimensionamento: consumo → kWp → nº de painéis → geração →
 * cobre % → economia → payback → CO₂. Nada de UI/banco aqui: função pura.
 */
import { describe, it, expect } from "vitest";
import {
  dimensionar,
  CATALOGO_MODULOS,
  CATALOGO_INVERSORES,
} from "./dimensionamento";

const ENTRADA = {
  consumoMensalKwh: 1000,
  tarifaRpkwh: 0.95,
  metaPct: 100,
  moduloWp: 550,
};

describe("dimensionar — regras básicas", () => {
  it("kWp = consumo anual / fator de produção (1000 kWh/mês, meta 100%)", () => {
    const r = dimensionar(ENTRADA);
    //12.000 kWh/ano ÷1.500 kWh/kWp =8 kWp
    expect(r.kwpNecessario).toBeCloseTo(8, 5);
  });

  it("nº de painéis arredonda para CIMA (nunca fraciona painel)", () => {
    const r = dimensionar(ENTRADA);
    //8 kWp ÷550 Wp =14.54 →15 painéis
    expect(r.numPaineis).toBe(15);
    expect(r.kwpInstalado).toBeCloseTo(8.25, 5);
  });

  it("geração mensal, cobertura % e arredondamentos", () => {
    const r = dimensionar(ENTRADA);
    //8,25 kWp ×1.500 ÷12 =1.031,25 kWh/mês → cobre103,125%
    expect(r.geracaoMensalKwh).toBeCloseTo(1031.25, 2);
    expect(r.cobrePct).toBeCloseTo(103.125, 3);
  });

  it("meta de acúmulo (120%) pede mais painéis que meta de100%", () => {
    const base = dimensionar(ENTRADA);
    const acumulo = dimensionar({ ...ENTRADA, metaPct: 120 });
    expect(acumulo.kwpNecessario).toBeGreaterThan(base.kwpNecessario);
    expect(acumulo.numPaineis).toBeGreaterThan(base.numPaineis);
  });
});

describe("dimensionar — economia e payback", () => {
  it("economia = energia usada × tarifa + excedente × crédito (padrão100%)", () => {
    const r = dimensionar(ENTRADA);
    // usada1.000 + excedente31,25 =1.031,25 kWh × R$0,95 = R$979,69/mês
    expect(r.economiaMensalR).toBeCloseTo(979.6875, 3);
    expect(r.economiaAnualR).toBeCloseTo(11756.25, 3);
  });

  it("crédito configurável: valor 50% desconta o excedente pela metade", () => {
    const r = dimensionar({ ...ENTRADA, creditoPct: 0.5 });
    //1.000×0,95 +31,25×0,475 =950 +14,84 =964,84
    expect(r.economiaMensalR).toBeCloseTo(964.84375, 3);
  });

  it("sem preço do kit não há payback (null) — preço digitado gera payback em anos", () => {
    expect(dimensionar(ENTRADA).paybackAnos).toBeNull();
    const comPreco = dimensionar({ ...ENTRADA, precoKitR: 40000 });
    //40.000 ÷11.756,25 =3,40 anos
    expect(comPreco.paybackAnos).toBeCloseTo(3.4, 2);
  });

  it("CO₂ evitado:0,2 t por MWh gerado", () => {
    const r = dimensionar(ENTRADA);
    //8,25 ×1.500 =12.375 kWh =12,375 MWh ×0,2 =2,475 t
    expect(r.co2EvitadoTons).toBeCloseTo(2.475, 3);
  });

  it("área estimada do telhado = painéis ×2,1 m²", () => {
    expect(dimensionar(ENTRADA).areaM2).toBeCloseTo(31.5, 3);
  });
});

describe("dimensionar — validação", () => {
  it("recusa consumo ≤0, tarifa ≤0, meta fora de50–200 e módulo ≤0", () => {
    expect(dimensionar({ ...ENTRADA, consumoMensalKwh: 0 }).erros.length).toBeGreaterThan(0);
    expect(dimensionar({ ...ENTRADA, tarifaRpkwh: -1 }).erros.length).toBeGreaterThan(0);
    expect(dimensionar({ ...ENTRADA, metaPct: 30 }).erros[0]).toMatch(/meta/i);
    expect(dimensionar({ ...ENTRADA, metaPct: 300 }).erros[0]).toMatch(/meta/i);
    expect(dimensionar({ ...ENTRADA, moduloWp: 0 }).erros.length).toBeGreaterThan(0);
  });

  it("com erro, resultados numéricos vêm zerados (a UI mostra os erros, não números)", () => {
    const r = dimensionar({ ...ENTRADA, consumoMensalKwh: -5 });
    expect(r.kwpNecessario).toBe(0);
    expect(r.numPaineis).toBe(0);
    expect(r.economiaAnualR).toBe(0);
  });
});

describe("catálogo placeholder (preço a definir)", () => {
  it("tem módulos e inversores com marca/modelo/potência", () => {
    expect(CATALOGO_MODULOS.length).toBeGreaterThanOrEqual(3);
    expect(CATALOGO_INVERSORES.length).toBeGreaterThanOrEqual(2);
    for (const m of CATALOGO_MODULOS) {
      expect(m.wp).toBeGreaterThan(0);
      expect(m.marca).toBeTruthy();
      expect(m.modelo).toBeTruthy();
    }
    for (const i of CATALOGO_INVERSORES) {
      expect(i.kw).toBeGreaterThan(0);
    }
  });
});
