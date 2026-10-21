import { describe, it, expect } from "vitest";
import { resumoEnvios } from "./resumo-envios";

// 19/10 (pedido do João) — o card "Campanhas" virou PAINEL DE ENVIOS:
// agregado com os números certos dos disparos, no formato de dashboard.
describe("resumoEnvios — agregado do painel de disparos", () => {
  const base = {
    id: "c1",
    name: "30%-14",
    message: "oi",
    numbers: ["1", "2", "3"],
    status: "completed",
    sent: 0,
    failed: 0,
    instancia: null,
    delay_min: null,
    intervalo: null,
    imagem_url: null,
    createdAt: "2026-10-20T12:00:00",
  };

  it("soma enviados e falhas de todas as campanhas", () => {
    const r = resumoEnvios([
      { ...base, sent: 16, failed: 36 },
      { ...base, id: "c2", sent: 52, failed: 4 },
    ]);
    expect(r.enviadas).toBe(68);
    expect(r.falhas).toBe(40);
  });

  it("taxa de sucesso em % (108 tentativas, 68 ok = 62,96%)", () => {
    const r = resumoEnvios([
      { ...base, sent: 68, failed: 40 },
    ]);
    expect(r.tentativas).toBe(108);
    expect(r.taxa).toBe(63);
  });

  it("sem tentativas, taxa é 0 (nunca NaN)", () => {
    expect(resumoEnvios([{ ...base, sent: 0, failed: 0 }]).taxa).toBe(0);
  });

  it("conta campanhas em andamento, concluídas e pendentes", () => {
    const r = resumoEnvios([
      { ...base, id: "a", status: "running" },
      { ...base, id: "b", status: "running" },
      { ...base, id: "c", status: "completed" },
      { ...base, id: "d", status: "pending" },
      { ...base, id: "e", status: "failed" },
    ]);
    expect(r.emAndamento).toBe(2);
    expect(r.concluidas).toBe(1);
    expect(r.pendentes).toBe(1);
    expect(r.totalCampanhas).toBe(5);
  });

  it("contatos = soma da lista de números", () => {
    expect(resumoEnvios([{ ...base, numbers: ["1", "2", "3"] }]).contatos).toBe(3);
  });

  it("sem campanha nenhuma → zeros", () => {
    expect(resumoEnvios([])).toMatchObject({
      enviadas: 0,
      falhas: 0,
      taxa: 0,
      emAndamento: 0,
      contatos: 0,
    });
  });
});
