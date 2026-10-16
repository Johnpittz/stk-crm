/**
 * ITEM 4 (16/10) — ATENDIMENTO: sem nome identificado, mostrar
 * "CLIENTE - 62982735286" (número na frente) em vez de só "CLIENTE".
 */

import { describe, expect, it } from "vitest";
import { nomeExibicaoCliente } from "./nome-exibicao";

describe("nomeExibicaoCliente (item 4)", () => {
  it("sem nome → CLIENTE - <número>", () => {
    expect(nomeExibicaoCliente(null, "62982735286")).toBe("CLIENTE - 62982735286");
    expect(nomeExibicaoCliente("   ", "62 98273-5286")).toBe("CLIENTE - 62 98273-5286");
  });

  it("sem nome e sem número → só CLIENTE", () => {
    expect(nomeExibicaoCliente("", "")).toBe("CLIENTE");
    expect(nomeExibicaoCliente(undefined, undefined)).toBe("CLIENTE");
  });

  it("placeholder antigo no banco (Cliente / Cliente não identificado) conta como sem nome", () => {
    expect(nomeExibicaoCliente("Cliente", "62982735286")).toBe("CLIENTE - 62982735286");
    expect(nomeExibicaoCliente("Cliente não identificado", "62982735286")).toBe("CLIENTE - 62982735286");
  });

  it("com nome → mantém o nome (não vira CLIENTE)", () => {
    expect(nomeExibicaoCliente("Maria Souza", "62982735286")).toBe("Maria Souza");
    expect(nomeExibicaoCliente("  Loja B  ", "")).toBe("Loja B");
  });
});
