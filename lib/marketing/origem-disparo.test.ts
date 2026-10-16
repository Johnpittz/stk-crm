/**
 * PARTE 9 (16/10) — mostrar QUAL NÚMERO foi usado em cada disparo.
 * bulk_campaigns guarda a `instancia` (nome da sessão WAHA, ex. STK-1);
 * o número vem de /api/instances. Aqui: mapa nome->número + formatação
 * pt-BR + fallback (sem número → o próprio nome; sem instancia → null).
 */
import { describe, it, expect } from "vitest";
import { mapearNumerosInstancias, formatarNumeroBR, numeroDeOrigem } from "./origem-disparo";

describe("mapearNumerosInstancias", () => {
  it("transforma a lista de /api/instances em mapa nome → número", () => {
    const mapa = mapearNumerosInstancias([
      { name: "STK-1", number: "5562999998888" },
      { name: "STK-3", number: "" },
    ]);
    expect(mapa).toEqual({ "STK-1": "5562999998888", "STK-3": "" });
  });

  it("lista vazia/inválida vira mapa vazio", () => {
    expect(mapearNumerosInstancias(null)).toEqual({});
    expect(mapearNumerosInstancias(undefined)).toEqual({});
    expect(mapearNumerosInstancias([{}] as any)).toEqual({});
  });
});

describe("formatarNumeroBR", () => {
  it("celular com DDI vira +55 62 99999-8888", () => {
    expect(formatarNumeroBR("5562999998888")).toBe("+55 62 99999-8888");
  });

  it("10 dígitos (fixo antigo) vira 64 3631-1824", () => {
    expect(formatarNumeroBR("6436311824")).toBe("64 3631-1824");
  });

  it("não mexe em número curto ou já formatado", () => {
    expect(formatarNumeroBR("123")).toBe("123");
    expect(formatarNumeroBR("+55 62 99999-8888")).toBe("+55 62 99999-8888");
    expect(formatarNumeroBR("")).toBe("");
  });
});

describe("numeroDeOrigem (o que a tela exibe por disparo)", () => {
  const mapa = { "STK-1": "5562999998888" };

  it("instância conhecida → número formatado", () => {
    expect(numeroDeOrigem(mapa, "STK-1")).toBe("+55 62 99999-8888");
  });

  it("instância sem número → mostra o próprio nome da sessão", () => {
    expect(numeroDeOrigem({ "STK-3": "" }, "STK-3")).toBe("STK-3");
    expect(numeroDeOrigem({}, "STK-9")).toBe("STK-9");
  });

  it("sem instancia → null (nada na tela)", () => {
    expect(numeroDeOrigem(mapa, null)).toBeNull();
    expect(numeroDeOrigem(mapa, "")).toBeNull();
    expect(numeroDeOrigem(mapa, undefined)).toBeNull();
  });
});
