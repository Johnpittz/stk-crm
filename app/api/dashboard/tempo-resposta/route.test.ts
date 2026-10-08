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
    cenario.tabelas.atendimentos = [{ id: "a1", created_at: "2026-10-02T20:00:00Z", instancia: "STK-1" }];
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

  it("Fase 2: devolve ranking por vendedor e por time (STK-1=Lobo)", async () => {
    const res = await GET(req());
    const corpo = await res.json();
    expect(Array.isArray(corpo.porVendedor)).toBe(true);
    expect(Array.isArray(corpo.porTime)).toBe(true);
    // a resposta veio do v1 via STK-1 → Time Lobo
    expect(corpo.porVendedor[0]).toMatchObject({ nome: "Conta sem cadastro", media: 120, n: 1 });
    expect(corpo.porTime[0]).toMatchObject({ nome: "Time Lobo", media: 120, n: 1 });
  });

  it("Fase 2: filtro ?dias=7 exclui resposta de 26 dias atrás", async () => {
    // atendimento antigo (10/09) fora dos 7 dias, mas dentro dos 30
    cenario.tabelas.atendimentos.push({
      id: "old",
      created_at: "2026-09-10T12:00:00Z",
      instancia: "STK-3",
    });
    cenario.tabelas.atendimento_mensagens.push(
      { atendimento_id: "old", remetente: "cliente", created_at: "2026-09-11T13:00:00Z", enviada_por: null },
      { atendimento_id: "old", remetente: "vendedor", created_at: "2026-09-14T13:00:00Z", enviada_por: "v9" },
    );

    const sete = await GET(new NextRequest("http://localhost/api/dashboard/tempo-resposta?dias=7"));
    const c7 = await sete.json();
    // antigo (26 dias) fora dos 7: sem Time Águia e sem o v9
    expect(c7.porTime.map((t: any) => t.nome)).not.toContain("Time Águia");
    expect(c7.porVendedor.map((v: any) => v.id)).not.toContain("v9");

    // padrão 30 dias inclui o antigo
    const trinta = await GET(req());
    const c30 = await trinta.json();
    expect(c30.porTime.map((t: any) => t.nome)).toContain("Time Águia");
    expect(c30.porVendedor.map((v: any) => v.id)).toContain("v9");
  });

  it("Fase 3: devolve a dimensão POR PRODUTO (tempo + comercial)", async () => {
    cenario.tabelas.produtos = [{ id: "p1", nome: "GD" }];
    cenario.tabelas.oportunidades = [
      {
        id: "o1",
        atendimento_id: "a1",
        produto_id: "p1",
        resultado: "ganho",
        valor_venda: 1000,
      },
    ];

    const res = await GET(req());
    const corpo = await res.json();
    expect(Array.isArray(corpo.porProduto)).toBe(true);
    const gd = corpo.porProduto.find((l: any) => l.nome === "GD");
    // 1ª resposta do atendimento a1 = 120 min, vinculada à oportunidade de GD
    expect(gd).toMatchObject({
      media: 120,
      n: 1,
      oportunidades: 1,
      vendas: 1,
      valor_venda: 1000,
    });
    // produto sem nenhum dado não aparece
    expect(corpo.porProduto.find((l: any) => l.nome === "RECIEE")).toBeUndefined();
  });

  it("sem dados devolve zerado (200)", async () => {
    cenario.limpar();
    const res = await GET(req());
    const corpo = await res.json();
    expect(res.status).toBe(200);
    expect(corpo.geral).toEqual({ media: 0, n: 0 });
  });
});
