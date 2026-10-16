/**
 * ITEM 5 (16/10) — KANBAN com EDIÇÃO para QUALQUER oportunidade
 * (antes só dava pra editar as concluídas). Aqui: montagem do PATCH
 * (etapa/prioridade/valor) e o parse de valor monetário BR.
 */
import { describe, it, expect } from "vitest";
import { parseValorMoeda, montarCorpoEdicao } from "./corpo-edicao";

describe("parseValorMoeda", () => {
  it("entende formato brasileiro 1.234,56", () => {
    expect(parseValorMoeda("1.234,56")).toBe(1234.56);
  });
  it("entende número simples", () => {
    expect(parseValorMoeda("1500")).toBe(1500);
  });
  it("vazio ou inválido vira null", () => {
    expect(parseValorMoeda("")).toBeNull();
    expect(parseValorMoeda("   ")).toBeNull();
    expect(parseValorMoeda("abc")).toBeNull();
  });
});

describe("montarCorpoEdicao", () => {
  const base = {
    titulo: "Instalação painel",
    descricao: "anotação",
    prioridade: "alta",
    valorVenda: "1.234,56",
    etapa: "proposta_feita",
  };

  it("monta o corpo com id, campos e etapa", () => {
    const corpo = montarCorpoEdicao("abc-123", base);
    expect(corpo).toEqual({
      id: "abc-123",
      titulo: "Instalação painel",
      descricao: "anotação",
      prioridade: "alta",
      etapa: "proposta_feita",
      valor_venda: 1234.56,
    });
  });

  it("omite valor_venda quando vazio e mantém o resto", () => {
    const corpo = montarCorpoEdicao("abc-123", { ...base, valorVenda: "" });
    expect(corpo.valor_venda).toBeUndefined();
    expect(corpo.etapa).toBe("proposta_feita");
  });

  it("omite etapa quando vazia (não mexe no funil)", () => {
    const corpo = montarCorpoEdicao("abc-123", { ...base, etapa: "" });
    expect(corpo.etapa).toBeUndefined();
    expect(corpo.titulo).toBe("Instalação painel");
  });
});
