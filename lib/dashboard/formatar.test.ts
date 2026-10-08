/**
 * Formatação amigável dos tempos do Dashboard (Fase 2/UX).
 * João: "não ficou intuitivo" — ninguém lê 1143 min. Horas e dias.
 */
import { describe, it, expect } from "vitest";
import { formatarDuracao } from "./formatar";

describe("formatarDuracao (minutos → texto)", () => {
  it("resposta imediata e minutos curtos", () => {
    expect(formatarDuracao(0)).toBe("na hora");
    expect(formatarDuracao(45)).toBe("45 min");
  });

  it("vira horas quando passa de 60 min", () => {
    expect(formatarDuracao(60)).toBe("1h");
    expect(formatarDuracao(1143)).toBe("19h 3min");
    expect(formatarDuracao(67)).toBe("1h 7min");
  });

  it("vira dias quando passa de 24h", () => {
    expect(formatarDuracao(7800)).toBe("5 dias 10h");
    expect(formatarDuracao(2880)).toBe("2 dias");
    expect(formatarDuracao(1440)).toBe("1 dia");
  });

  it("sobrevive a valor quebrado/inválido", () => {
    expect(formatarDuracao(1333.5)).toBe("22h 14min");
    expect(formatarDuracao(-5)).toBe("na hora");
    expect(formatarDuracao(NaN)).toBe("—");
  });
});
