/**
 * Fase 3 — dimensão PRODUTO no Dashboard.
 * Puro: cruza as 1ª respostas medidas com as oportunidades/produtos e
 * devolve uma linha por produto: tempo de resposta + números comerciais.
 */
import { describe, it, expect } from "vitest";
import { dimensaoProdutos } from "./produtos-dim";

describe("dimensaoProdutos", () => {
  const oportunidades = [
    { id: "o1", atendimento_id: "a1", produto_id: "p1", resultado: "ganho", valor_venda: 1000 },
    { id: "o2", atendimento_id: "a2", produto_id: "p1", resultado: null, valor_venda: null },
    { id: "o3", atendimento_id: null, produto_id: "p2", resultado: "ganho", valor_venda: 500 },
    { id: "o4", atendimento_id: "a3", produto_id: null, resultado: null, valor_venda: null },
  ];
  const produtos = [
    { id: "p1", nome: "GD" },
    { id: "p2", nome: "RECIEE" },
  ];
  const respostas = [
    { atendimento_id: "a1", minutos: 60, fim: "x", responsavel: "v1" },
    { atendimento_id: "a2", minutos: 120, fim: "x", responsavel: "v1" },
    { atendimento_id: "a4", minutos: 30, fim: "x", responsavel: "v1" }, // sem oportunidade
  ];

  it("agrega tempo de resposta, oportunidades e vendas por produto", () => {
    const linhas = dimensaoProdutos({ respostas, oportunidades, produtos });
    const gd = linhas.find((l) => l.nome === "GD");
    expect(gd).toMatchObject({
      media: 90, // (60+120)/2
      n: 2,
      oportunidades: 2,
      vendas: 1,
      valor_venda: 1000,
    });
    const reciee = linhas.find((l) => l.nome === "RECIEE");
    expect(reciee).toMatchObject({ oportunidades: 1, vendas: 1, valor_venda: 500, n: 0 });
  });

  it("resposta sem oportunidade cai em 'Sem produto'; produto desconhecido não quebra", () => {
    const linhas = dimensaoProdutos({ respostas, oportunidades, produtos });
    expect(linhas.find((l) => l.nome === "Sem produto")).toMatchObject({ n: 1, oportunidades: 1 });
    const estranho = dimensaoProdutos({
      respostas: [],
      oportunidades: [{ id: "o9", atendimento_id: null, produto_id: "p404", resultado: null, valor_venda: null }],
      produtos,
    });
    expect(estranho[0].nome).toBe("Sem produto");
  });

  it("ordenado do que responde mais devagar (sem respostas vão no fim)", () => {
    const linhas = dimensaoProdutos({ respostas, oportunidades, produtos });
    expect(linhas[0].nome).toBe("GD"); // 90 min
    expect(linhas[linhas.length - 1].n).toBe(0);
  });
});
