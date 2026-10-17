/**
 * PARTE 11 (PPTX 17/10) — ORIGEM do cliente: tipo (vendedor/parceiro/
 * marketing), subtipo, vendedor vinculado ou nome do parceiro.
 * Puro e testado: opções, validação e payload.
 */
import { describe, it, expect } from "vitest";
import {
  validarOrigem,
  montarCamposOrigem,
  OPÇÕES_ORIGEM,
} from "./origem-cliente";

describe("OPÇÕES_ORIGEM", () => {
  it("tem os 3 tipos com os subtipos combinados", () => {
    expect(OPÇÕES_ORIGEM.vendedor.subtipos).toEqual(["interno", "externo"]);
    expect(OPÇÕES_ORIGEM.parceiro.subtipos).toEqual(["comercial", "institucional"]);
    expect(OPÇÕES_ORIGEM.marketing.subtipos).toEqual(["trafego_pago", "outras_acoes"]);
  });
});

describe("validarOrigem", () => {
  it("sem origem escolhida → ok (campo opcional)", () => {
    expect(validarOrigem({})).toEqual([]);
  });

  it("vendedor exige subtipo e o vendedor vinculado", () => {
    expect(validarOrigem({ origem_tipo: "vendedor" })).toHaveLength(2);
    expect(
      validarOrigem({ origem_tipo: "vendedor", origem_subtipo: "interno" })
    ).toHaveLength(1);
    expect(
      validarOrigem({
        origem_tipo: "vendedor",
        origem_subtipo: "interno",
        vendedor_responsavel_id: "abc-123",
      })
    ).toEqual([]);
  });

  it("parceiro exige subtipo e o nome do parceiro", () => {
    expect(
      validarOrigem({ origem_tipo: "parceiro", origem_subtipo: "comercial" })
    ).toHaveLength(1);
    expect(
      validarOrigem({
        origem_tipo: "parceiro",
        origem_subtipo: "comercial",
        origem_indicacao_nome: "Maria",
      })
    ).toEqual([]);
  });

  it("marketing exige só o subtipo", () => {
    expect(validarOrigem({ origem_tipo: "marketing" })).toHaveLength(1);
    expect(
      validarOrigem({ origem_tipo: "marketing", origem_subtipo: "trafego_pago" })
    ).toEqual([]);
  });

  it("subtipo que não pertence ao tipo vira erro", () => {
    const erros = validarOrigem({
      origem_tipo: "marketing",
      origem_subtipo: "interno",
    });
    expect(erros.length).toBeGreaterThan(0);
  });
});

describe("montarCamposOrigem", () => {
  it("vendedor vinculado vira payload com origem_lead=tipo (compat dashboard)", () => {
    const p = montarCamposOrigem({
      origem_tipo: "vendedor",
      origem_subtipo: "externo",
      vendedor_responsavel_id: "user-9",
    });
    expect(p).toEqual({
      origem_tipo: "vendedor",
      origem_subtipo: "externo",
      vendedor_responsavel_id: "user-9",
      origem_indicacao_nome: null,
      origem_lead: "vendedor",
    });
  });

  it("sem origem → campos null (permite apagar)", () => {
    const p = montarCamposOrigem({});
    expect(p.origem_tipo).toBeNull();
    expect(p.vendedor_responsavel_id).toBeNull();
    expect(p.origem_lead).toBeNull();
  });
});
