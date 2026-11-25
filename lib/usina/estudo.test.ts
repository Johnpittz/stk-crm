/**
 * 25/11/2026 — Fase1: persistência do ESTUDO de usina.
 *
 * O estudo mora DENTRO da coluna `clientes.usina` (JSON que já existe e é
 * consumido pela AXS: { CRI, usina, potencia }). Adicionamos a chave `estudo`
 * sem migration. Duas garantias testadas:
 *   1. gravar estudo NUNCA apaga CRI/usina/potencia (nem outras chaves);
 *   2. editar os dados da usina no form NÃO apaga o estudo (serializarUsina
 *      preserva chaves extras do JSON atual).
 */
import { describe, it, expect } from "vitest";
import { parseEstudo, gravarEstudo, EstudoUsina } from "./estudo";
import { serializarUsina } from "@/components/features/clientes/form-usina-solar";

const ESTUDO: EstudoUsina = {
  geradoEm: "2026-11-25T10:00:00.000Z",
  consumoMensalKwh: 1000,
  tarifaRpkwh: 0.95,
  metaPct: 100,
  modulo: { marca: "Honor Solar", modelo: "HB-M16R/132H-550", wp: 550 },
  precoKitR: 40000,
  resultado: {
    kwpNecessario: 8,
    kwpInstalado: 8.25,
    numPaineis: 15,
    geracaoMensalKwh: 1031.25,
    cobrePct: 103.125,
    economiaMensalR: 979.6875,
    economiaAnualR: 11756.25,
    paybackAnos: 3.4024,
    co2EvitadoTons: 2.475,
    areaM2: 31.5,
  },
};

describe("gravarEstudo — merge no JSON da coluna usina", () => {
  it("preserva CRI/usina/potencia e acrescenta estudo", () => {
    const atual = JSON.stringify({ CRI: "123", usina: "Usina CD", potencia: "75" });
    const novo = JSON.parse(gravarEstudo(atual, ESTUDO));
    expect(novo.CRI).toBe("123");
    expect(novo.usina).toBe("Usina CD");
    expect(novo.potencia).toBe("75");
    expect(novo.estudo.consumoMensalKwh).toBe(1000);
    expect(novo.estudo.modulo.wp).toBe(550);
  });

  it("funciona quando a coluna está vazia ou corrompida", () => {
    expect(JSON.parse(gravarEstudo(null, ESTUDO)).estudo.metaPct).toBe(100);
    expect(JSON.parse(gravarEstudo("", ESTUDO)).estudo.metaPct).toBe(100);
    expect(JSON.parse(gravarEstudo("{nao é json", ESTUDO)).estudo.metaPct).toBe(100);
  });

  it("regravar substitui o estudo anterior (não acumula histórico)", () => {
    const primeira = gravarEstudo(null, ESTUDO);
    const segunda = gravarEstudo(primeira, { ...ESTUDO, metaPct: 120 });
    const obj = JSON.parse(segunda);
    expect(obj.estudo.metaPct).toBe(120);
    expect(Object.keys(obj).filter((k) => k === "estudo")).toHaveLength(1);
  });
});

describe("parseEstudo — leitura tolerante", () => {
  it("lê o estudo gravado", () => {
    const json = gravarEstudo(null, ESTUDO);
    expect((parseEstudo(json) as any)?.numPaineisResult).toBeUndefined(); // campo não existe
    expect(parseEstudo(json)?.resultado.numPaineis).toBe(15);
  });

  it("devolve null para coluna vazia, corrompida ou sem estudo", () => {
    expect(parseEstudo(null)).toBeNull();
    expect(parseEstudo("{quebrado")).toBeNull();
    expect(parseEstudo(JSON.stringify({ CRI: "1" }))).toBeNull();
  });
});

describe("serializarUsina (form de usina) — não pode apagar o estudo", () => {
  it("ao editar CRI/nome/potência, mantém a chave estudo já gravada", () => {
    const atual = gravarEstudo(JSON.stringify({ CRI: "", usina: "Antiga", potencia: "10" }), ESTUDO);
    const depois = JSON.parse(
      serializarUsina({ cri: "999", nome: "Usina Nova", potencia: "80" }, atual)
    );
    expect(depois.CRI).toBe("999");
    expect(depois.usina).toBe("Usina Nova");
    expect(depois.potencia).toBe("80");
    expect(depois.estudo.metaPct).toBe(100);
  });

  it("sem JSON atual, comporta-se como antes (só os3 campos)", () => {
    expect(serializarUsina({ cri: "1", nome: "X", potencia: "5" })).toBe(
      JSON.stringify({ CRI: "1", usina: "X", potencia: "5" })
    );
  });
});
