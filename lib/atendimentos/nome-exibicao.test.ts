/**
 * ITEM 4 (16/10) — ATENDIMENTO: sem nome identificado, mostrar
 * "CLIENTE - 62982735286" (número na frente) em vez de só "CLIENTE".
 */

import { describe, expect, it } from "vitest";
import { nomeExibicaoCliente, nomeExibicaoAtendimento } from "./nome-exibicao";

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

/**
 * 14/11 — pedido do João (apresentação amanhã): a tela mostrava
 * "Michele Swistalski" em20 números diferentes porque o nome vinha do
 * CLIENTE VINCULADO sem conferir o telefone. Regra nova: o nome do
 * cliente vinculado só aparece se o telefone da conversa bater com o
 * do cliente (igual ou8 últimos dígitos — a mesma régua do
 * check-duplicate). Não batendo → nome salvo no atendimento → e sem
 * nome → "CLIENTE - <número>".
 */
describe("nomeExibicaoAtendimento — nome só quando o telefone bate", () => {
  it("mostra o nome do cliente quando o telefone da conversa bate", () => {
    expect(
      nomeExibicaoAtendimento({
        nomeClienteVinculado: "Michele Swistalski",
        telClienteVinculado: "556281598253",
        nomeAtendimento: "",
        telefone: "556281598253",
      })
    ).toBe("Michele Swistalski");
  });

  it("bate também com os8 últimos dígitos (sem55)", () => {
    expect(
      nomeExibicaoAtendimento({
        nomeClienteVinculado: "Michele Swistalski",
        telClienteVinculado: "556281598253",
        nomeAtendimento: "",
        telefone: "6281598253",
      })
    ).toBe("Michele Swistalski");
  });

  it("telefone NAO bate → ignora o nome do cliente e usa o do atendimento", () => {
    expect(
      nomeExibicaoAtendimento({
        nomeClienteVinculado: "Michele Swistalski",
        telClienteVinculado: "556281598253",
        nomeAtendimento: "João da Silva",
        telefone: "556281114073",
      })
    ).toBe("João da Silva");
  });

  it("telefone NAO bate e sem nome → CLIENTE - numero", () => {
    expect(
      nomeExibicaoAtendimento({
        nomeClienteVinculado: "Michele Swistalski",
        telClienteVinculado: "556281598253",
        nomeAtendimento: "",
        telefone: "556281114073",
      })
    ).toBe("CLIENTE - 556281114073");
  });

  it("cliente sem telefone cadastrado → mantem o nome (vinculo manual)", () => {
    expect(
      nomeExibicaoAtendimento({
        nomeClienteVinculado: "Empresa XYZ",
        telClienteVinculado: null,
        nomeAtendimento: "",
        telefone: "5562999990000",
      })
    ).toBe("Empresa XYZ");
  });

  it("sem cliente vinculado → comportamento antigo (nome do atendimento / CLIENTE - numero)", () => {
    expect(
      nomeExibicaoAtendimento({
        nomeClienteVinculado: null,
        telClienteVinculado: null,
        nomeAtendimento: "",
        telefone: "556291927783",
      })
    ).toBe("CLIENTE - 556291927783");
    expect(
      nomeExibicaoAtendimento({
        nomeClienteVinculado: null,
        telClienteVinculado: null,
        nomeAtendimento: "Maria",
        telefone: "556291927783",
      })
    ).toBe("Maria");
  });

  it("nome do atendimento placeholder também cai no padrao CLIENTE - numero", () => {
    expect(
      nomeExibicaoAtendimento({
        nomeClienteVinculado: "Outro Nome",
        telClienteVinculado: "556281000001",
        nomeAtendimento: "Cliente não identificado",
        telefone: "556281000009",
      })
    ).toBe("CLIENTE - 556281000009");
  });
});
