/**
 * FASE C — ponte entre a Análise (IA) e as abas do cliente:
 * produto identificado pela IA vira linha na aba correspondente,
 * com origem "IA", SEM duplicar o que já existe (manual ou IA).
 * Puro e testado.
 */
import { describe, it, expect } from "vitest";
import {
  linhaDaOportunidade,
  montarDadosLinhaIA,
  deveCriarLinhaIA,
} from "./ponte-ia";
import type { OportunidadeProduto } from "../ia/regras-produtos";

const opp = (sobrescrever: Partial<OportunidadeProduto>): OportunidadeProduto => ({
  produto: "bess",
  status: "identificada",
  motivo: "m",
  ...sobrescrever,
});

describe("ponte-ia — mapeamento produto → aba", () => {
  it("produtos com aba viram a linha certa", () => {
    expect(linhaDaOportunidade(opp({ produto: "eletroposto" }))).toBe("eletroposto");
    expect(linhaDaOportunidade(opp({ produto: "sigma_solar" }))).toBe("sigma");
    expect(linhaDaOportunidade(opp({ produto: "bess" }))).toBe("bess");
    expect(linhaDaOportunidade(opp({ produto: "mercado_livre" }))).toBe("mercado_livre");
    expect(linhaDaOportunidade(opp({ produto: "usina_proprietaria" }))).toBe("usina");
  });

  it("RECIEE e GD não têm linha própria (fica de fora)", () => {
    expect(linhaDaOportunidade(opp({ produto: "reciee" }))).toBeNull();
    expect(linhaDaOportunidade(opp({ produto: "gd_assinatura" }))).toBeNull();
    expect(linhaDaOportunidade(opp({ produto: "gd_grupo_a" }))).toBeNull();
  });
});

describe("ponte-ia — montagem da linha", () => {
  it("dados levam origem IA + evidência + pendência", () => {
    const d = montarDadosLinhaIA(
      opp({ produto: "bess", motivo: "ponta alta", evidencia: "ponta 5.000", pendencia: "conferir" })
    );
    expect(d.origem).toBe("IA");
    expect(String(d.observacoes)).toContain("ponta alta");
    expect(String(d.observacoes)).toContain("ponta 5.000");
    expect(String(d.observacoes)).toContain("conferir");
  });
});

describe("ponte-ia — nunca duplica", () => {
  it("só cria identificada/preliminar e só se não existe linha do produto", () => {
    expect(deveCriarLinhaIA(opp({}), [])).toBe(true);
    expect(deveCriarLinhaIA(opp({}), [{ linha: "bess", dados: {} }])).toBe(false);
    expect(deveCriarLinhaIA(opp({ status: "nao_acionada" }), [])).toBe(false);
    expect(deveCriarLinhaIA(opp({ status: "inconclusiva" }), [])).toBe(false);
    expect(deveCriarLinhaIA(opp({ produto: "reciee" }), [])).toBe(false);
  });
});
