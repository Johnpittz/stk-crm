/**
 * "Cadastrar com fatura" — o cadastro vem da conta, não do formulário.
 */
import { describe, expect, it } from "vitest";
import { camposEmBranco, montarClienteDeFatura } from "./cadastro";
import type { ResumoFatura } from "@/lib/ia/analisar-fatura";

function resumo(overrides: Partial<ResumoFatura> = {}): ResumoFatura {
  return {
    concessionaria: "Equatorial Goiás Distribuidora de Energia",
    uc: "000266515901272",
    titular: "SANDOVAL GARCIA DA SILVEIRA JR",
    cnpj_cpf: "902.564.501-70",
    vencimento: "14/05/2026",
    consumo: "4670",
    valor: "6812,13",
    grupo: "B",
    contratacao_livre: false,
    cnae_principal: "4712-5/00",
    consumo_ponta: null,
    energia_injetada: null,
    uc_geradora: null,
    uc_consumidora: null,
    ...overrides,
  };
}

describe("cadastro com fatura", () => {
  it("preenche nome, UC, CPF/CNPJ e concessionária direto da conta", () => {
    const { payload, avisos } = montarClienteDeFatura({ resumo: resumo() });
    expect(payload.nome).toBe("SANDOVAL GARCIA DA SILVEIRA JR");
    expect(payload.uc).toBe("000266515901272");
    expect(payload.cpf_cnpj).toBe("902.564.501-70");
    expect(payload.distribuidora).toContain("Equatorial");
    expect(payload.grupo).toBe("B");
    expect(avisos).toHaveLength(0);
  });

  it("sem titular na fatura, usa o nome digitado pelo operador", () => {
    const { payload, avisos } = montarClienteDeFatura({
      resumo: resumo({ titular: null }),
      nomeInformado: "Fogo e Brasa Ltda",
    });
    expect(payload.nome).toBe("Fogo e Brasa Ltda");
    expect(avisos.join(" ")).not.toContain("titular");
  });

  it("sem nada, não inventa: nome fica marcado e o aviso explica o que falta", () => {
    const { payload, avisos } = montarClienteDeFatura({
      resumo: resumo({ titular: null, uc: null, cnpj_cpf: null, concessionaria: null }),
    });
    expect(payload.nome).toBe("(sem nome)");
    expect(avisos.length).toBeGreaterThanOrEqual(4);
    expect(avisos.join(" ")).toContain("titular");
    expect(avisos.join(" ")).toContain("UC");
    expect(avisos.join(" ")).toContain("Concessionária");
    expect(avisos.join(" ")).toContain("CPF/CNPJ");
  });

  it("grupo não identificado vira B com aviso (mesma regra do upload)", () => {
    const { payload, avisos } = montarClienteDeFatura({
      resumo: resumo({ grupo: null }),
    });
    expect(payload.grupo).toBe("B");
    expect(avisos.join(" ")).toContain("grupo B");
  });

  it("fatura com energia injetada = cliente com geração distribuída", () => {
    const { payload } = montarClienteDeFatura({
      resumo: resumo({ energia_injetada: 1200 }),
    });
    expect(payload.gd).toBe(true);
    const semGd = montarClienteDeFatura({ resumo: resumo() });
    expect(semGd.payload.gd).toBe(false);
  });

  it("camposEmBranco aponta exatamente o que falta completar na ficha", () => {
    const { payload } = montarClienteDeFatura({ resumo: resumo() });
    expect(camposEmBranco(payload)).toContain("estado");
    expect(camposEmBranco(payload)).toContain("subgrupo");
    expect(camposEmBranco(payload)).not.toContain("uc");
    expect(camposEmBranco(payload)).not.toContain("nome");
  });
});
