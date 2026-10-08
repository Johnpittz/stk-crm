/**
 * Fase 2 do plano de dashboard — dimensões VENDEDOR e TIME.
 *
 * Agrupa as primeiras respostas (já calculadas em tempo-resposta) por
 * vendedor (quem respondeu) e por time (número STK da conversa — mapa de
 * teste em lib/dashboard/equipes: STK-1=Lobo, STK-3=Águia).
 * Ordenação: do que DEMORA MAIS ao que responde mais rápido.
 */
import { describe, it, expect } from "vitest";
import {
  rankingVendedores,
  resumoPorTime,
  type RespostaMedida,
} from "./rankings";

const R = (
  minutos: number,
  responsavel: string | null,
  instancia: string | null,
): RespostaMedida => ({
  inicio: "2026-10-06T13:00:00Z",
  fim: "2026-10-06T13:30:00Z",
  minutos,
  responsavel,
  instancia,
});

describe("rankingVendedores (do mais lento ao mais rápido)", () => {
  it("agrupa por quem respondeu: média, nº de respostas e pior caso", () => {
    const linhas = rankingVendedores(
      [
        R(30, "v1", "STK-1"),
        R(50, "v1", "STK-1"),
        R(10, "v2", "STK-3"),
        R(100, "v2", "STK-3"),
      ],
      { v1: "Ana", v2: "Bruno" },
    );
    expect(linhas).toHaveLength(2);
    // média Ana 40, Bruno 55 → Bruno primeiro (demora mais)
    expect(linhas[0]).toMatchObject({ nome: "Bruno", media: 55, n: 2, pior: 100 });
    expect(linhas[1]).toMatchObject({ nome: "Ana", media: 40, n: 2, pior: 50 });
  });

  it("sem nome conhecido mostra 'Conta sem cadastro'; vendedor sem resposta não aparece", () => {
    const linhas = rankingVendedores([R(20, "semNome", "STK-1")], {});
    expect(linhas[0].nome).toBe("Conta sem cadastro");
    expect(linhas[0].id).toBe("semNome");
    expect(linhas).toHaveLength(1);
  });

  it("resposta sem responsável não vira ranking", () => {
    expect(rankingVendedores([R(20, null, "STK-1")], {})).toHaveLength(0);
  });
});

describe("resumoPorTime (número STK → time de teste)", () => {
  it("agrupa STK-1=Time Lobo e STK-3=Time Águia", () => {
    const linhas = resumoPorTime([
      R(100, "v1", "STK-1"),
      R(300, "v2", "STK-1"),
      R(40, "v1", "STK-3"),
    ]);
    expect(linhas).toHaveLength(2);
    // Lobo média 200, Águia 40 → Lobo primeiro (demora mais)
    expect(linhas[0]).toMatchObject({ nome: "Time Lobo", media: 200, n: 2, pior: 300 });
    expect(linhas[1]).toMatchObject({ nome: "Time Águia", media: 40, n: 1, pior: 40 });
  });

  it("número fora do mapa vira 'Sem time (NÚMERO)'", () => {
    const linhas = resumoPorTime([R(50, "v1", "STK-9")]);
    expect(linhas[0]).toMatchObject({ nome: "Sem time (STK-9)", n: 1 });
    // sem número nenhum → só 'Sem time'
    expect(resumoPorTime([R(50, "v1", null)])[0].nome).toBe("Sem time");
  });
});
