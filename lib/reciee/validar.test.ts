/**
 * MOTOR RECIEE — validação determinística de faturas (TDD).
 *
 * Por que existe: a camada de IA (`lib/ia/analisar-fatura.ts`) extrai dados;
 * ela NÃO prova que a conta está certa. Este módulo faz a segunda camada —
 * a que a ANEEL/jurisprudência aceita como prova: conferir a conta contra a
 * referência DO PERÍODO (tarifa homologada, bandeira, alíquota de ICMS,
 * PIS/COFINS) e contra a cadeia de leituras.
 *
 * Base real: 29 faturas do cliente SANDOVAL (UC 000266515901272, Equatorial
 * Goiás, B3 convencional), NOV/2023 → MAI/2026, auditadas manualmente em
 * 06/10/2026 — 100% da aritmética fechou e os achados abaixo foram os
 * reais encontrados. Os números dos testes são os dessas faturas.
 */
import { describe, expect, it } from "vitest";
import { validarFatura, validarSequencia } from "./validar";
import type { FaturaReciee } from "./tipos";
import { INDICES_SECAO_8 } from "./indices";

/** ABR/2026 — fatura que passou em tudo (real). */
function abril2026(): FaturaReciee {
  return {
    referencia: "ABR/2026",
    estado: "GO",
    inicio: "2026-03-25",
    fim: "2026-04-24",
    dias: 30,
    consumo: 4670,
    leituraAnterior: 74051,
    leituraAtual: 78721,
    fatorK: 1,
    linhas: [
      {
        descricao: "CONSUMO / FATURÁVEL",
        quantidade: 4670,
        tarifaCct: 1.125925,
        tarifaSemTributos: 0.89181,
        valor: 5258.07,
      },
    ],
    impostos: {
      baseIcms: 5258.07,
      aliquotaIcms: 19,
      icms: 999.03,
      basePisCofins: 4259.04,
      aliquotaPis: 0.3918,
      pis: 16.69,
      aliquotaCofins: 1.8287,
      cofins: 77.6,
    },
    bandeiraCobradaSemTributos: 0,
    itens: [
      { descricao: "CONTRIB. ILUM. PÚBLICA", valor: 80.0 },
      { descricao: "EMIS. SEGUNDA VIA", valor: 4.24 },
      { descricao: "JURO DE FINANCIAMENTO", valor: 82.42 },
      { descricao: "JUROS ATRASO", valor: 8.18 },
      { descricao: "MULTA", valor: 25.85 },
      { descricao: "PARC. DEBITO-PRC", valor: 1353.37 },
    ],
    valorTotal: 6812.13,
  };
}

describe("motor RECIEE — fatura limpa não gera achado", () => {
  it("ABR/2026 (real): nenhum achado crítico nem alerta", () => {
    const achados = validarFatura(abril2026());
    const graves = achados.filter(
      (a) => a.severidade === "critico" || a.severidade === "alerta"
    );
    expect(graves).toEqual([]);
  });

  it("soma de linhas + itens = total impresso (checagem de soma)", () => {
    const f = abril2026();
    f.valorTotal = 6800.0; // forçando erro de R$ 12,13
    const achados = validarFatura(f);
    const soma = achados.find((a) => a.codigo === "MOTOR-SOMA");
    expect(soma).toBeTruthy();
    expect(soma?.severidade).toBe("critico");
    expect(soma?.valorEstimado).toBeCloseTo(12.13, 2);
  });

  it("linha: quantidade x tarifa = valor cobrado", () => {
    const f = abril2026();
    f.linhas[0].valor = 5300.0; // 4670 x 1,125925 = 5258,07
    const achados = validarFatura(f);
    expect(achados.some((a) => a.codigo === "MOTOR-LINHA")).toBe(true);
  });
});

describe("motor RECIEE — referências do período", () => {
  it("tarifa sem tributos fora da vigência homologada vira RECIEE-058", () => {
    const f = abril2026();
    f.linhas[0].tarifaSemTributos = 0.74593; // vigência de 2024, não a de 2025/26
    const achados = validarFatura(f);
    const t = achados.find((a) => a.codigo === "RECIEE-058");
    expect(t).toBeTruthy();
    expect(t?.severidade).toBe("critico");
  });

  it("tarifa que muda NO MEIO do ciclo é ponderada pelos dias (OUT/2024 real)", () => {
    // 23/09→23/10/2024: 28 dias a 0,71063 + 2 dias a 0,74593 = 0,712983 (a conta cobra 0,712983)
    const f: FaturaReciee = {
      ...abril2026(),
      referencia: "OUT/2024",
      inicio: "2024-09-23",
      fim: "2024-10-23",
      dias: 30,
      consumo: 5816,
      linhas: [
        {
          descricao: "CONSUMO / FATURÁVEL",
          quantidade: 5816,
          tarifaCct: 0.925303,
          tarifaSemTributos: 0.712983,
          valor: 5381.56,
        },
      ],
      impostos: {
        baseIcms: 5381.56,
        aliquotaIcms: 19,
        icms: 1022.49,
        basePisCofins: 4359.07,
        aliquotaPis: 0.3918,
        pis: 17.08,
        aliquotaCofins: 1.8287,
        cofins: 79.71,
      },
      itens: [],
      valorTotal: 5381.56,
    };
    expect(validarFatura(f).some((a) => a.codigo === "RECIEE-058")).toBe(false);
  });

  it("alíquota de ICMS de 19% antes de 01/04/2024 é RECIEE-050", () => {
    const f: FaturaReciee = {
      ...abril2026(),
      referencia: "MAR/2024",
      inicio: "2024-02-23",
      fim: "2024-03-25",
      dias: 31,
      linhas: [
        {
          descricao: "CONSUMO / FATURÁVEL",
          quantidade: 5963,
          tarifaCct: 1.0,
          tarifaSemTributos: 0.683194,
          valor: 5963.0,
        },
      ],
      impostos: {
        baseIcms: 5963.0,
        aliquotaIcms: 19, // errado: era 17% até 31/03/2024
        icms: 1132.97,
        basePisCofins: 4830.03,
        aliquotaPis: 0.3918,
        pis: 18.93,
        aliquotaCofins: 1.8287,
        cofins: 88.33,
      },
      itens: [],
      valorTotal: 5963.0,
    };
    const achados = validarFatura(f);
    const icms = achados.find((a) => a.codigo === "RECIEE-050");
    expect(icms).toBeTruthy();
    expect(icms?.severidade).toBe("critico");
    expect(icms?.descricao).toContain("17");
  });

  it("base de PIS/COFINS com ICMS dentro é RECIEE-T69-001", () => {
    const f = abril2026();
    f.impostos!.basePisCofins = 5258.07; // igual à base de ICMS = errou a exclusão
    const achados = validarFatura(f);
    expect(achados.some((a) => a.codigo === "RECIEE-T69-001")).toBe(true);
  });
});

describe("motor RECIEE — bandeira rateada por dia", () => {
  it("AGO/2024 (real): 7 dias de julho amarelo em ciclo de 30 = R$ 18,88", () => {
    const f: FaturaReciee = {
      ...abril2026(),
      referencia: "AGO/2024",
      inicio: "2024-07-24",
      fim: "2024-08-23",
      dias: 30,
      consumo: 4294,
      linhas: [
        {
          descricao: "CONSUMO / FATURÁVEL",
          quantidade: 4294,
          tarifaCct: 0.944605,
          tarifaSemTributos: 0.74593,
          valor: 4056.14,
        },
      ],
      impostos: {
        baseIcms: 4056.14,
        aliquotaIcms: 19,
        icms: 770.67,
        basePisCofins: 3285.47,
        aliquotaPis: 0.3918,
        pis: 12.87,
        aliquotaCofins: 1.8287,
        cofins: 60.07,
      },
      // a conta cobra 18,89 — diferença de 1 centavo do rateio oficial
      bandeiraCobradaSemTributos: 18.89,
      itens: [],
      valorTotal: 4075.03, // energia 4.056,14 + bandeira 18,89
    };
    const achados = validarFatura(f);
    expect(achados.some((a) => a.codigo === "RECIEE-011")).toBe(false);
  });

  it("bandeira cobrada acima do oficial vira RECIEE-011 com o valor da diferença", () => {
    const f: FaturaReciee = {
      ...abril2026(),
      referencia: "AGO/2024",
      inicio: "2024-07-24",
      fim: "2024-08-23",
      dias: 30,
      consumo: 4294,
      linhas: [
        {
          descricao: "CONSUMO / FATURÁVEL",
          quantidade: 4294,
          tarifaCct: 0.944605,
          tarifaSemTributos: 0.74593,
          valor: 4056.14,
        },
      ],
      impostos: {
        baseIcms: 4056.14,
        aliquotaIcms: 19,
        icms: 770.67,
        basePisCofins: 3285.47,
        aliquotaPis: 0.3918,
        pis: 12.87,
        aliquotaCofins: 1.8287,
        cofins: 60.07,
      },
      bandeiraCobradaSemTributos: 60.0, // deveria ser ~18,88
      itens: [],
      valorTotal: 4116.14, // energia 4.056,14 + bandeira 60,00
    };
    const b = validarFatura(f).find((a) => a.codigo === "RECIEE-011");
    expect(b).toBeTruthy();
    expect(b?.severidade).toBe("alerta");
    expect(b?.valorEstimado).toBeGreaterThan(30);
  });
});

describe("motor RECIEE — leitura, ciclo e cadeia", () => {
  it("leitura atual - anterior != consumo é RECIEE-162", () => {
    const f = abril2026();
    f.consumo = 5000; // 78721 - 74051 = 4670
    const a = validarFatura(f).find((x) => x.codigo === "RECIEE-162");
    expect(a).toBeTruthy();
    expect(a?.severidade).toBe("critico");
  });

  it("período impresso não bate com os dias (JAN/2025 real) é RECIEE-051", () => {
    const f: FaturaReciee = {
      ...abril2026(),
      referencia: "JAN/2025",
      inicio: "2024-11-25",
      fim: "2025-01-23",
      dias: 30, // a conta imprime 30, mas 25/11→23/01 são 59 dias
      consumo: 4234.06,
      leituraAnterior: null, // a fatura não traz a leitura anterior completa
      leituraAtual: 63849,
      linhas: [
        {
          descricao: "CONSUMO / FATURÁVEL",
          quantidade: 4234.06,
          tarifaCct: 0.922236,
          tarifaSemTributos: 0.74593,
          valor: 3904.87,
        },
      ],
      impostos: {
        baseIcms: 3904.87,
        aliquotaIcms: 19,
        icms: 741.93,
        basePisCofins: 3162.94,
        aliquotaPis: 0.3918,
        pis: 12.39,
        aliquotaCofins: 1.8287,
        cofins: 57.84,
      },
      itens: [],
      valorTotal: 4247.26,
    };
    const a = validarFatura(f).find((x) => x.codigo === "RECIEE-051");
    expect(a).toBeTruthy();
    expect(a?.severidade).toBe("alerta");
  });

  it("leitura anterior da fatura seguinte não bate com a atual = cadeia quebrada", () => {
    const junho = {
      ...abril2026(),
      referencia: "JUN/2024",
      inicio: "2024-05-23",
      fim: "2024-06-24",
      dias: 32,
      leituraAnterior: 24829,
      leituraAtual: 29978,
      consumo: 5149,
    };
    const agosto = {
      ...abril2026(),
      referencia: "AGO/2024",
      inicio: "2024-07-24",
      fim: "2024-08-23",
      dias: 30,
      leituraAnterior: 34377, // não bate com 29978 (JUL/2024 sumiu da pasta)
      leituraAtual: 38671,
      consumo: 4294,
    };
    const achados = validarSequencia([junho, agosto]);
    // o pulo de leitura é EXPLICADO pelo furo: o achado é o mês que falta,
    // não uma acusação de medidor trocado nem de leitura quebrada.
    expect(achados.some((a) => a.codigo === "RECIEE-134")).toBe(false);
    expect(achados.some((a) => a.codigo === "RECIEE-077")).toBe(false);
    expect(achados.some((a) => a.codigo === "MOTOR-FURO")).toBe(true);
    const furo = achados.find((a) => a.codigo === "MOTOR-FURO");
    expect(furo?.descricao).toContain("JUL");
  });

  it("sem furo de ciclo, leitura que não encosta na anterior = RECIEE-077", () => {
    const uma = {
      ...abril2026(),
      referencia: "MAI/2026",
      inicio: "2026-04-24",
      fim: "2026-05-25",
      dias: 31,
      leituraAnterior: 78721,
      leituraAtual: 84249,
      consumo: 5528,
    };
    const outra = {
      ...abril2026(),
      referencia: "JUN/2026",
      inicio: "2026-05-25",
      fim: "2026-06-24",
      dias: 30,
      leituraAnterior: 85000, // não encosta em 84.249
      leituraAtual: 89000,
      consumo: 4000,
    };
    const achados = validarSequencia([uma, outra]);
    const cadeia = achados.find((a) => a.codigo === "RECIEE-077");
    expect(cadeia).toBeTruthy();
    expect(cadeia?.severidade).toBe("alerta");
  });

  it("leitura que zera = troca de medidor (FEV/2025 real)", () => {
    const jan = {
      ...abril2026(),
      referencia: "JAN/2025",
      inicio: "2024-12-24",
      fim: "2025-01-23",
      dias: 30,
      leituraAnterior: 59614.94,
      leituraAtual: 63849,
      consumo: 4234.06,
    };
    const fev = {
      ...abril2026(),
      referencia: "FEV/2025",
      inicio: "2025-01-23",
      fim: "2025-02-21",
      dias: 29,
      leituraAnterior: 0, // medidor novo, zerado
      leituraAtual: 3398,
      consumo: 3398,
    };
    const achados = validarSequencia([jan, fev]);
    const troca = achados.find((a) => a.codigo === "RECIEE-134");
    expect(troca).toBeTruthy();
    expect(troca?.descricao).toMatch(/medidor/i);
  });
});

describe("motor RECIEE — guarda da seção 8 (continuidade)", () => {
  it("índice da seção 8 nunca sai como cobrança: só a frase obrigatória", () => {
    const f = abril2026();
    const achados = validarFatura(f, {
      codigosSugeridos: ["RECIEE-007"],
    });
    const guard = achados.find((a) => a.codigo === "RECIEE-007");
    expect(guard).toBeTruthy();
    expect(guard?.severidade).toBe("info");
    expect(guard?.descricao).toContain(
      "não identificável conclusivamente apenas pela fatura"
    );
  });

  it("todo índice da seção 8 está na lista de guarda", () => {
    expect(INDICES_SECAO_8).toContain("RECIEE-007");
    expect(INDICES_SECAO_8).toContain("RECIEE-164");
    expect(INDICES_SECAO_8.length).toBe(20);
  });
});
