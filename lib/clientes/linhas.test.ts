/**
 * PASTA DO CLIENTE — 4 novas linhas de negócio (12/10, pedido do João):
 * ELETROPOSTO, SIGMA SOLAR (monitoramento de usinas), BESS e
 * GESTÃO DE FATURA (GD e RECIEE já existem como aba).
 * Esta lib é o catálogo + validação/normalização puras por linha;
 * a UI das abas monta os campos a partir do catálogo.
 */
import { describe, it, expect } from "vitest";
import {
  LINHAS_PASTA,
  validarLinha,
  normalizarLinha,
  ordenarFaturas,
  formatarValor,
  formatarCompetencia,
  type LinhaId,
} from "./linhas";

describe("catálogo LINHAS_PASTA", () => {
  it("tem exatamente as 4 linhas pedidas, com ids únicos", () => {
    expect(LINHAS_PASTA.map((l) => l.id)).toEqual([
      "eletroposto",
      "sigma",
      "bess",
      "gestao_fatura",
    ]);
    const ids = new Set(LINHAS_PASTA.map((l) => l.id));
    expect(ids.size).toBe(4);
  });

  it("rótulos são os combinados com o João", () => {
    const porId = Object.fromEntries(LINHAS_PASTA.map((l) => [l.id, l.label]));
    expect(porId.eletroposto).toBe("Eletroposto");
    expect(porId.sigma).toBe("Sigma Solar");
    expect(porId.bess).toBe("BESS");
    expect(porId.gestao_fatura).toBe("Gestão de Fatura");
  });

  it("cada linha tem ao menos um campo definido com rótulo", () => {
    for (const linha of LINHAS_PASTA) {
      expect(linha.campos.length).toBeGreaterThan(0);
      for (const campo of linha.campos) {
        expect(campo.label.length).toBeGreaterThan(0);
        expect(["texto", "numero", "moeda", "select", "mes", "data"].includes(campo.tipo)).toBe(true);
      }
    }
  });
});

describe("validarLinha", () => {
  it("Eletroposto: potência obrigatória e maior que zero", () => {
    expect(validarLinha("eletroposto", {})).toContain("Potência (kW) é obrigatória.");
    expect(validarLinha("eletroposto", { potencia_kw: -5 })).toContain(
      "Potência (kW) deve ser maior que zero."
    );
    expect(validarLinha("eletroposto", { potencia_kw: 7.4 })).toEqual([]);
  });

  it("Sigma Solar: usina e potência obrigatórias", () => {
    const errs = validarLinha("sigma", { potencia_kwp: 75 });
    expect(errs).toContain("Usina é obrigatória.");
    expect(validarLinha("sigma", { usina: "Usina Centro", potencia_kwp: 75 })).toEqual([]);
    expect(validarLinha("sigma", { usina: "Usina Centro", potencia_kwp: 0 })).toContain(
      "Potência (kWp) deve ser maior que zero."
    );
  });

  it("BESS: capacidade obrigatória e estado de carga entre 0 e 100", () => {
    expect(validarLinha("bess", {})).toContain("Capacidade (kWh) é obrigatória.");
    expect(validarLinha("bess", { capacidade_kwh: 120, soc: 150 })).toContain(
      "Estado de carga deve estar entre 0 e 100%."
    );
    expect(validarLinha("bess", { capacidade_kwh: 120, soc: 45 })).toEqual([]);
  });

  it("Gestão de Fatura: competência e valor obrigatórios; valor não-negativo", () => {
    expect(validarLinha("gestao_fatura", { valor: 100 })).toContain(
      "Competência é obrigatória."
    );
    expect(validarLinha("gestao_fatura", { competencia: "2026-10" })).toContain(
      "Valor é obrigatório."
    );
    expect(validarLinha("gestao_fatura", { competencia: "2026-10", valor: -1 })).toContain(
      "Valor não pode ser negativo."
    );
    expect(
      validarLinha("gestao_fatura", { competencia: "2026-10", valor: 1234.56 })
    ).toEqual([]);
  });
});

describe("normalizarLinha", () => {
  it("entende moeda no formato brasileiro e em texto puro", () => {
    expect(normalizarLinha("gestao_fatura", { valor: "R$ 1.234,56" }).valor).toBe(1234.56);
    expect(normalizarLinha("gestao_fatura", { valor: "980.40" }).valor).toBe(980.4);
    expect(normalizarLinha("gestao_fatura", { valor: "" }).valor).toBeNull();
  });

  it("converte números, apaga espaços e zera vazio", () => {
    expect(normalizarLinha("eletroposto", { potencia_kw: " 7.4 " }).potencia_kw).toBe(7.4);
    expect(normalizarLinha("eletroposto", { potencia_kw: "" }).potencia_kw).toBeNull();
    expect(normalizarLinha("bess", { soc: "45" }).soc).toBe(45);
  });

  it("preserva textos com trim e remove campos vazios", () => {
    const dados = normalizarLinha("sigma", { usina: "  Usina Centro  ", status: "" });
    expect(dados.usina).toBe("Usina Centro");
    expect("status" in dados).toBe(false);
  });
});

describe("formatar / ordenar", () => {
  it("formatarValor devolve moeda brasileira", () => {
    expect(formatarValor(1234.56)).toBe("R$ 1.234,56");
    expect(formatarValor(null)).toBe("—");
    expect(formatarValor(0)).toBe("R$ 0,00");
  });

  it("formatarCompetencia entende AAAA-MM", () => {
    expect(formatarCompetencia("2026-10")).toBe("Out/2026");
    expect(formatarCompetencia(null)).toBe("—");
  });

  it("ordenarFaturas deixa a competência mais nova primeiro", () => {
    const linhas = [
      { dados: { competencia: "2026-08" } },
      { dados: { competencia: "2026-10" } },
      { dados: { competencia: "2026-09" } },
    ];
    const ordenado = ordenarFaturas(linhas as { dados: { competencia?: string } }[]);
    expect(ordenado.map((l) => l.dados.competencia)).toEqual(["2026-10", "2026-09", "2026-08"]);
  });
});

describe("tipos", () => {
  it("LinhaId cobre as 4 linhas", () => {
    const todas: LinhaId[] = ["eletroposto", "sigma", "bess", "gestao_fatura"];
    expect(todas).toHaveLength(4);
  });
});
