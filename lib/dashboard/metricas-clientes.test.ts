/**
 * ITEM 7 (16/10) — DASHBOARD: aparecer STATUS, CLASSIFICAÇÃO e ORIGEM
 * dos clientes (valores que já são preenchidos no cadastro, ex.: Prospect).
 * Aqui o agrupamento puro: {valor → total} ordenado do maior para o menor,
 * com bucket explícito para vazio/nulo.
 */
import { describe, it, expect } from "vitest";
import { agruparPorCampo } from "./metricas-clientes";

describe("agruparPorCampo (dashboard)", () => {
  it("conta por valor e ordena do maior para o menor", () => {
    const clientes = [
      { status: "prospect" },
      { status: "ativo" },
      { status: "prospect" },
      { status: "ativo" },
      { status: "ativo" },
    ];
    expect(agruparPorCampo(clientes, "status", "Não informado")).toEqual([
      { valor: "ativo", total: 3 },
      { valor: "prospect", total: 2 },
    ]);
  });

  it("reúne nulo/vazio no rótulo de 'sem informação'", () => {
    const clientes = [
      { origem: "chatbot" },
      { origem: null },
      { origem: "" },
      { origem: "   " },
      { origem: "chatbot" },
    ];
    expect(agruparPorCampo(clientes, "origem", "Não informado")).toEqual([
      { valor: "Não informado", total: 3 },
      { valor: "chatbot", total: 2 },
    ]);
  });

  it("devolve lista vazia sem registros", () => {
    expect(agruparPorCampo([], "status", "Não informado")).toEqual([]);
  });

  it("não mistura campos: só usa o campo pedido", () => {
    const clientes = [
      { status: "ativo", origem: "disparo" },
      { status: "churn", origem: "disparo" },
    ];
    expect(agruparPorCampo(clientes, "status", "x")).toEqual([
      { valor: "ativo", total: 1 },
      { valor: "churn", total: 1 },
    ]);
  });
});
