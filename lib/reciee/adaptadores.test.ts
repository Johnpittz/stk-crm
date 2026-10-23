/**
 * Adaptador: linha de `faturas_reciee` → fatura do motor.
 * Regra: o que a tabela não tem fica null e o motor NÃO avalia o item.
 */
import { describe, expect, it } from "vitest";
import { competenciaParaData, mapearFaturaDb, type FaturaDb } from "./adaptadores";
import { validarFatura } from "./validar";

function linha(overrides: Partial<FaturaDb> = {}): FaturaDb {
  return {
    competencia: "ABR/2026",
    consumo_kwh: 4670,
    tarifa_aplicada: 1.125925,
    valor_consumo: 5258.07,
    icms_valor: 999.03,
    icms_aliquota: 19,
    pis_valor: 16.69,
    cofins_valor: 77.6,
    bandeira: "Verde",
    cip: 80,
    valor_total: 6812.13,
    ...overrides,
  };
}

describe("adaptador faturas_reciee → motor", () => {
  it("converte competência em data para achar a vigência tarifária", () => {
    expect(competenciaParaData("ABR/2026")).toBe("2026-04-01");
    expect(competenciaParaData("DEZ/2024")).toBe("2024-12-01");
    expect(competenciaParaData("xx")).toBeNull();
  });

  it("monta linha de consumo com a tarifa COM tributos e itens da CIP", () => {
    const f = mapearFaturaDb(linha());
    expect(f.referencia).toBe("ABR/2026");
    expect(f.linhas[0]).toMatchObject({
      descricao: "CONSUMO / FATURÁVEL",
      quantidade: 4670,
      tarifaCct: 1.125925,
    });
    // sem tarifa sem-tributos extraída, o motor não compara com a ANEEL
    expect(f.linhas[0].tarifaSemTributos).toBe(0);
    expect(f.itens).toEqual([
      { descricao: "CONTRIB. ILUM. PÚBLICA - MUNICIPAL", valor: 80 },
    ]);
    expect(f.leituraAnterior).toBeNull();
  });

  it("monta a base de PIS/COFINS como base de ICMS menos o ICMS", () => {
    const f = mapearFaturaDb(linha());
    expect(f.impostos?.basePisCofins).toBeCloseTo(5258.07 - 999.03, 2);
    expect(f.impostos?.aliquotaIcms).toBe(19);
  });

  it("aceita valores do banco como string numérica (Postgres NUMERIC)", () => {
    const f = mapearFaturaDb(linha({ valor_total: "6812.13", cip: "80.00" }));
    expect(f.valorTotal).toBeCloseTo(6812.13, 2);
    expect(f.itens[0].valor).toBe(80);
  });

  it("sem imposto na tabela, o motor não avalia tributos (nunca adivinha)", () => {
    const f = mapearFaturaDb(
      linha({ icms_valor: 0, icms_aliquota: 0, pis_valor: 0, cofins_valor: 0 })
    );
    expect(f.impostos).toBeNull();
    expect(validarFatura(f).some((a) => a.codigo === "RECIEE-050")).toBe(false);
  });

  it("rodando o motor num caso coerente: alíquota de ICMS de 2026 = 19%", () => {
    const f = mapearFaturaDb(linha());
    const achados = validarFatura(f);
    expect(achados.some((a) => a.codigo === "RECIEE-050")).toBe(false);
  });
});
