/**
 * Fase 1 — GET /api/dashboard/tempo-resposta: card "Tempo de Resposta" do
 * Dashboard (primeira resposta do vendedor, só em horário comercial).
 * Supabase fakeado em memória — sem rede.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", async () => {
  const { cenario } = await import("@/lib/testes/supabase-fake");
  return {
    createAdminClient: () => ({ from: (t: string) => cenario.builder(t) }),
  };
});

import { cenario } from "@/lib/testes/supabase-fake";
import { GET } from "./route";

function req() {
  return new NextRequest("http://localhost/api/dashboard/tempo-resposta");
}

describe("GET /api/dashboard/tempo-resposta", () => {
  beforeEach(() => {
    cenario.limpar();
    cenario.tabelas.atendimentos = [{ id: "a1", created_at: "2026-10-02T20:00:00Z" }];
    cenario.tabelas.atendimento_mensagens = [
      // sexta 17:00 SP → segunda 09:00 SP = 120 min úteis (1ª do atendimento)
      { atendimento_id: "a1", remetente: "cliente", created_at: "2026-10-02T20:00:00Z", enviada_por: null },
      { atendimento_id: "a1", remetente: "vendedor", created_at: "2026-10-05T12:00:00Z", enviada_por: "v1" },
      // troca seguinte (não conta na 1ª resposta)
      { atendimento_id: "a1", remetente: "cliente", created_at: "2026-10-06T13:00:00Z", enviada_por: null },
      { atendimento_id: "a1", remetente: "vendedor", created_at: "2026-10-06T13:30:00Z", enviada_por: "v1" },
    ];
  });

  it("devolve a média da 1ª resposta em minutos e a janela", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const corpo = await res.json();
    // 1ª troca = sex 02/10 17:00 → seg 05/10 09:00 = 120 min úteis
    expect(corpo.geral).toEqual({ media: 120, n: 1 });
    expect(typeof corpo.hoje.n).toBe("number");
    expect(corpo.janela).toContain("08:00");
  });

  it("sem dados devolve zerado (200)", async () => {
    cenario.limpar();
    const res = await GET(req());
    const corpo = await res.json();
    expect(res.status).toBe(200);
    expect(corpo.geral).toEqual({ media: 0, n: 0 });
  });
});
