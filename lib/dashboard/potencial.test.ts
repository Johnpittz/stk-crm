/**
 * PEDIDO 1 (11/10) — Potencial de Vendas do vendedor.
 *
 * Puro: agrupa as vendas confirmadas (`oportunidades.resultado = sucesso`)
 * por VENDEDOR e, dentro dele, monta o MIX por PRODUTO — o que ele vendeu
 * mais — para a gestão direcionar mais demanda daquele produto.
 *
 * Sem rede: entrada = linhas já filtradas pela rota (resultado = sucesso,
 * janela de período) + mapas de nomes (profiles) e de produtos.
 */
import { describe, it, expect } from "vitest";
import { montarPotencial, type VendaConfirmada } from "./potencial";

const vendas: VendaConfirmada[] = [
  { vendedor_id: "v1", produto_id: "p-gd", valor_venda: 6000 },
  { vendedor_id: "v1", produto_id: "p-gd", valor_venda: 3000 },
  { vendedor_id: "v1", produto_id: "p-rec", valor_venda: 5000 },
  { vendedor_id: "v2", produto_id: "p-rec", valor_venda: 1000 },
  // venda sem vendedor não conta para ninguém
  { vendedor_id: null, produto_id: null, valor_venda: 99999 },
];

const nomes = { v1: "João Silva" };
const produtos = { "p-gd": "GD" };

describe("montarPotencial — vendas por vendedor × produto", () => {
  it("agrupa por vendedor com total de vendas e valor (ignora sem vendedor)", () => {
    const r = montarPotencial(vendas, nomes, produtos);
    expect(r).toHaveLength(2);
    const v1 = r[0];
    expect(v1.vendedor_id).toBe("v1");
    expect(v1.total_vendas).toBe(3);
    expect(v1.valor_total).toBe(14000);
  });

  it("ordena os vendedores do que mais vendeu (em R$) para o menos", () => {
    const r = montarPotencial(vendas, nomes, produtos);
    expect(r.map((v) => v.vendedor_id)).toEqual(["v1", "v2"]);
  });

  it("monta o mix por produto do MAIS vendido ao MENOS e marca o líder", () => {
    const r = montarPotencial(vendas, nomes, produtos);
    const v1 = r[0];
    // GD vendeu 2 (o que ele vendeu mais) → líder
    expect(v1.mix[0]).toEqual({ produto_id: "p-gd", produto_nome: "GD", qtd: 2, valor_total: 9000 });
    expect(v1.mix[1]).toEqual({ produto_id: "p-rec", produto_nome: "Sem produto", qtd: 1, valor_total: 5000 });
    expect(v1.produto_lider).toEqual(v1.mix[0]);
  });

  it("participação % no total geral (14k de 15k = 93.3)", () => {
    const r = montarPotencial(vendas, nomes, produtos);
    expect(r[0].participacao).toBe(93.3);
    expect(r[1].participacao).toBe(6.7);
  });

  it("fallbacks: nome de vendedor/produto desconhecidos", () => {
    const r = montarPotencial(vendas, nomes, produtos);
    expect(r[1].nome).toBe("Conta sem cadastro");
    expect(r[1].mix[0].produto_nome).toBe("Sem produto");
  });

  it("valor_venda nulo conta como R$ 0 (venda sem valor fechado)", () => {
    const r = montarPotencial(
      [{ vendedor_id: "v9", produto_id: null, valor_venda: null }],
      {},
      {},
    );
    expect(r[0].total_vendas).toBe(1);
    expect(r[0].valor_total).toBe(0);
    expect(r[0].participacao).toBe(0);
  });

  it("empate de quantidade no mix decide pelo valor", () => {
    const r = montarPotencial(
      [
        { vendedor_id: "v1", produto_id: "a", valor_venda: 100 },
        { vendedor_id: "v1", produto_id: "b", valor_venda: 900 },
      ],
      nomes,
      { a: "A", b: "B" },
    );
    expect(r[0].mix[0].produto_id).toBe("b");
    expect(r[0].produto_lider?.produto_id).toBe("b");
  });
});
