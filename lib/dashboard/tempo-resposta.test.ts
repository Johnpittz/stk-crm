/**
 * Fase 1 do plano de dashboard (docs/plano-dashboard-fases.md) — TEMPO DE
 * RESPOSTA.
 *
 * Regra aprovada pelo João (06/10): conta a PRIMEIRA resposta do vendedor
 * ao cliente e só em HORÁRIO COMERCIAL (seg–sex, 08:00–18:00 — Brasília).
 * Ex.: cliente escreve sexta 17:00 e o vendedor responde segunda 09:00
 * → espera real útil = 60 (sex) + 60 (seg) = 120 min, não 64h.
 */
import { describe, it, expect } from "vitest";
import {
  minutosEmHorarioComercial,
  primeiraResposta,
  resumoTempoResposta,
} from "./tempo-resposta";

describe("minutosEmHorarioComercial (seg–sex 08:00–18:00, UTC-3)", () => {
  it("dentro da janela conta minuto a minuto", () => {
    // terça 06/10/2026 10:00 → 11:30 (SP)
    expect(
      minutosEmHorarioComercial(
        "2026-10-06T13:00:00Z",
        "2026-10-06T14:30:00Z",
      ),
    ).toBe(90);
  });

  it("atravessa fim de semana e conta só o útil", () => {
    // sexta 02/10 17:00 SP → segunda 05/10 09:00 SP = 60 + 60
    expect(
      minutosEmHorarioComercial(
        "2026-10-02T20:00:00Z",
        "2026-10-05T12:00:00Z",
      ),
    ).toBe(120);
  });

  it("fora de horário (sábado / madrugada) conta zero", () => {
    // sábado 03/10 10:00 → domingo 04/10 22:00 (SP)
    expect(
      minutosEmHorarioComercial(
        "2026-10-03T13:00:00Z",
        "2026-10-05T01:00:00Z",
      ),
    ).toBe(0);
    // mesma noite útil: 19:00 → 23:00 (fora da janela) = 0
    expect(
      minutosEmHorarioComercial(
        "2026-10-06T22:00:00Z",
        "2026-10-07T02:00:00Z",
      ),
    ).toBe(0);
  });

  it("corta o começo na abertura (cliente 07:00 → vendedor 09:00)", () => {
    expect(
      minutosEmHorarioComercial(
        "2026-10-06T10:00:00Z",
        "2026-10-06T12:00:00Z",
      ),
    ).toBe(60);
  });
});

describe("primeiraResposta (cliente → vendedor humano)", () => {
  const base = [
    { remetente: "cliente", created_at: "2026-10-06T13:00:00Z", enviada_por: null },
    { remetente: "vendedor", created_at: "2026-10-06T13:30:00Z", enviada_por: "v1" },
  ];

  it("calcula a 1ª troca e ignora trocas seguintes", () => {
    const mensagens = [
      ...base,
      { remetente: "cliente", created_at: "2026-10-06T15:00:00Z", enviada_por: null },
      { remetente: "vendedor", created_at: "2026-10-06T16:00:00Z", enviada_por: "v1" },
    ];
    const r = primeiraResposta(mensagens);
    expect(r).not.toBeNull();
    expect(r!.minutos).toBe(30);
    expect(r!.fim).toBe("2026-10-06T13:30:00Z");
  });

  it("resposta AUTOMÁTICA (enviada_por nulo) não vale como resposta", () => {
    const mensagens = [
      { remetente: "cliente", created_at: "2026-10-06T13:00:00Z", enviada_por: null },
      { remetente: "vendedor", created_at: "2026-10-06T13:05:00Z", enviada_por: null }, // chatbot/IA
      { remetente: "vendedor", created_at: "2026-10-06T13:40:00Z", enviada_por: "v1" },
    ];
    const r = primeiraResposta(mensagens);
    expect(r!.minutos).toBe(40);
  });

  it("sem resposta do vendedor → null (não conta na média)", () => {
    expect(
      primeiraResposta([
        { remetente: "cliente", created_at: "2026-10-06T13:00:00Z", enviada_por: null },
      ]),
    ).toBeNull();
    expect(primeiraResposta([])).toBeNull();
  });
});

describe("resumoTempoResposta (geral + hoje)", () => {
  it("média geral e média de hoje (dia de Brasília do fim)", () => {
    const respostas = [
      { fim: "2026-10-05T12:00:00Z", minutos: 120 }, // segunda
      { fim: "2026-10-06T13:30:00Z", minutos: 30 }, // terça
    ];
    const r = resumoTempoResposta(respostas, "2026-10-06T15:00:00Z"); // terça 12:00 SP
    expect(r.geral).toEqual({ media: 75, n: 2 });
    expect(r.hoje).toEqual({ media: 30, n: 1 });
  });

  it("sem respostas → zeros, sem quebrar", () => {
    const r = resumoTempoResposta([], "2026-10-06T15:00:00Z");
    expect(r.geral).toEqual({ media: 0, n: 0 });
    expect(r.hoje).toEqual({ media: 0, n: 0 });
  });
});
