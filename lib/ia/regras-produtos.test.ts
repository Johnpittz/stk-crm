/**
 * FASE A (PPTX + "lógica dos produtos para o CRM", 17/10) — motor de
 * regras comerciais da Análise da Fatura. Puro e testado: recebe os
 * dados lidos da conta e devolve quais produtos acionam, com status
 * (Identificada / Preliminar / Não acionada / Inconclusiva), motivo,
 * evidência e pendência. Casos = as 3 simulações do documento.
 */
import { describe, it, expect } from "vitest";
import {
  aplicarRegras,
  type DadosConta,
  type OportunidadeProduto,
} from "./regras-produtos";

const porProduto = (lista: OportunidadeProduto[], produto: string) =>
  lista.find((o) => o.produto === produto);

describe("regras-produtos — Simulação 1: industrial Grupo A, R$ 5.495,48, Demanda Livre, ponta 1.025 kWh", () => {
  const sim1: DadosConta = {
    grupo: "A",
    contratacao_livre: true, // conta mostra "Demanda Livre"
    valor_medio_mensal: null, // média ainda não apurada
    consumo_ponta: 1025,
    consumo_total: 12800,
    cnae_principal: null,
    energia_injetada: null,
    uc_geradora: null,
    uc_consumidora: null,
  };
  const out = aplicarRegras(sim1);

  it("Mercado Livre NÃO recomenda (já está no livre)", () => {
    expect(porProduto(out, "mercado_livre")?.status).toBe("nao_acionada");
    expect(porProduto(out, "mercado_livre")?.motivo).toMatch(/livre/i);
  });

  it("BESS não aciona: ponta 1.025 ≤ 4.000 (e nunca usa o total)", () => {
    expect(porProduto(out, "bess")?.status).toBe("nao_acionada");
    expect(porProduto(out, "bess")?.motivo).toMatch(/ponta/i);
  });

  it("RECIEE preliminar: uma fatura não é a média", () => {
    expect(porProduto(out, "reciee")?.status).toBe("preliminar");
    expect(porProduto(out, "reciee")?.pendencia).toMatch(/média/i);
  });

  it("Eletroposto preliminar: falta CNAE (precisa consultar o CNPJ)", () => {
    expect(porProduto(out, "eletroposto")?.status).toBe("preliminar");
    expect(porProduto(out, "eletroposto")?.pendencia).toMatch(/CNAE/i);
  });

  it("GD por assinatura não é alvo do Grupo A", () => {
    expect(porProduto(out, "gd_assinatura")?.status).toBe("nao_acionada");
  });

  it("todas as decisões são independentes (múltiplos produtos saem)", () => {
    expect(out.length).toBeGreaterThanOrEqual(5);
  });
});

describe("regras-produtos — Simulação 2: hotel Grupo B, R$ 5.571,00", () => {
  const sim2: DadosConta = {
    grupo: "B",
    contratacao_livre: false,
    valor_medio_mensal: null,
    consumo_ponta: null, // sem dado de ponta
    consumo_total: 9800,
    cnae_principal: "5513-0/01 — Hotéis", // CNAE hotel
    energia_injetada: null,
    uc_geradora: null,
    uc_consumidora: null,
  };
  const out = aplicarRegras(sim2);

  it("GD por assinatura identificada (Grupo B)", () => {
    expect(porProduto(out, "gd_assinatura")?.status).toBe("identificada");
    expect(porProduto(out, "gd_assinatura")?.pendencia).toMatch(/economia/i);
  });

  it("Eletroposto identificado: CNAE = hotel", () => {
    expect(porProduto(out, "eletroposto")?.status).toBe("identificada");
    expect(porProduto(out, "eletroposto")?.evidencia).toMatch(/5513/);
  });

  it("BESS não aciona sem dado de ponta (nunca pelo total)", () => {
    expect(porProduto(out, "bess")?.status).toBe("nao_acionada");
  });

  it("RECIEE preliminar (estimativa de 1 fatura < média apurada)", () => {
    expect(porProduto(out, "reciee")?.status).toBe("preliminar");
  });

  it("Usina própria sempre a avaliar", () => {
    expect(porProduto(out, "usina_proprietaria")?.status).toBe("preliminar");
  });
});

describe("regras-produtos — Simulação 3: sítio rural Grupo B, R$ 293,00, já compensa GD II", () => {
  const sim3: DadosConta = {
    grupo: "B",
    contratacao_livre: false,
    valor_medio_mensal: 293,
    consumo_ponta: null,
    consumo_total: 1760,
    cnae_principal: "0111-3/01 — Cultivo de arroz", // CNAE rural
    energia_injetada: 1760, // GD II compensada
    uc_geradora: null, // não sabemos de quem é
    uc_consumidora: "270977101881",
  };
  const out = aplicarRegras(sim3);

  it("Sigma Solar INCONCLUSIVO: injeta energia mas não se sabe de quem é a usina", () => {
    expect(porProduto(out, "sigma_solar")?.status).toBe("inconclusiva");
    expect(porProduto(out, "sigma_solar")?.pendencia).toMatch(/usina/i);
  });

  it("RECIEE não aciona: média R$ 293 < R$ 5.000", () => {
    expect(porProduto(out, "reciee")?.status).toBe("nao_acionada");
  });

  it("Eletroposto não aciona: CNAE rural fora da lista", () => {
    expect(porProduto(out, "eletroposto")?.status).toBe("nao_acionada");
  });
});

describe("comparação de UC com/sem pontuação (caso real da conta)", () => {
  it("UC geradora 2.709.771.018-81 = consumidora 270977101881", () => {
    const out = aplicarRegras({
      grupo: "B",
      contratacao_livre: false,
      valor_medio_mensal: 600,
      consumo_ponta: null,
      consumo_total: 3000,
      cnae_principal: null,
      energia_injetada: 900,
      uc_geradora: "2.709.771.018-81",
      uc_consumidora: "270977101881",
    });
    expect(out.find((o) => o.produto === "sigma_solar")?.status).toBe("identificada");
    expect(out.find((o) => o.produto === "usina_proprietaria")?.status).toBe("identificada");
  });
});

describe("calcularMediaFinanceira (alimenta o gatilho do RECIEE)", () => {
  it("menos de 3 faturas não gera média (fica preliminar)", async () => {
    const { calcularMediaFinanceira } = await import("./regras-produtos");
    expect(calcularMediaFinanceira([])).toBeNull();
    expect(calcularMediaFinanceira([5200])).toBeNull();
    expect(calcularMediaFinanceira([5200, 5400])).toBeNull();
  });

  it("com 3+ faturas devolve a média aritmética", async () => {
    const { calcularMediaFinanceira } = await import("./regras-produtos");
    expect(calcularMediaFinanceira([4000, 5000, 6000])).toBe(5000);
    expect(calcularMediaFinanceira([5200, 5300, 5400, 6000])).toBe(5475);
  });

  it("ignora valores nulos/vazios", async () => {
    const { calcularMediaFinanceira } = await import("./regras-produtos");
    expect(calcularMediaFinanceira([5000, null, 5000, 5000])).toBe(5000);
  });
});

describe("regras-produtos — casos-limite do protocolo", () => {
  it("BESS identificada quando a ponta passa de 4.000 kWh", () => {
    const out = aplicarRegras({
      grupo: "A",
      contratacao_livre: true,
      valor_medio_mensal: null,
      consumo_ponta: 4001,
      consumo_total: 20000,
      cnae_principal: null,
      energia_injetada: null,
      uc_geradora: null,
      uc_consumidora: null,
    });
    expect(porProduto(out, "bess")?.status).toBe("identificada");
  });

  it("RECIEE identificada quando a média passa de R$ 5.000", () => {
    const out = aplicarRegras({
      grupo: "B",
      contratacao_livre: false,
      valor_medio_mensal: 5000.01,
      consumo_ponta: null,
      consumo_total: 8000,
      cnae_principal: null,
      energia_injetada: null,
      uc_geradora: null,
      uc_consumidora: null,
    });
    expect(porProduto(out, "reciee")?.status).toBe("identificada");
  });

  it("Sigma identificada quando a UC geradora é a própria consumidora", () => {
    const out = aplicarRegras({
      grupo: "B",
      contratacao_livre: false,
      valor_medio_mensal: 600,
      consumo_ponta: null,
      consumo_total: 3000,
      cnae_principal: null,
      energia_injetada: 900,
      uc_geradora: "123",
      uc_consumidora: "123",
    });
    expect(porProduto(out, "sigma_solar")?.status).toBe("identificada");
  });

  it("Sigma não aciona quando a energia vem de usina de terceiro (UCs diferentes)", () => {
    const out = aplicarRegras({
      grupo: "B",
      contratacao_livre: false,
      valor_medio_mensal: 600,
      consumo_ponta: null,
      consumo_total: 3000,
      cnae_principal: null,
      energia_injetada: 900,
      uc_geradora: "999",
      uc_consumidora: "123",
    });
    expect(porProduto(out, "sigma_solar")?.status).toBe("nao_acionada");
  });

  it("CNPJ sem CNAE = pendência, nunca descarte", () => {
    const out = aplicarRegras({
      grupo: "B",
      contratacao_livre: false,
      valor_medio_mensal: null,
      consumo_ponta: null,
      consumo_total: 4000,
      cnae_principal: null,
      energia_injetada: null,
      uc_geradora: null,
      uc_consumidora: null,
    });
    expect(porProduto(out, "eletroposto")?.status).toBe("preliminar");
  });
});
