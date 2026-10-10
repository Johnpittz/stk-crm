/**
 * Fase 1 — GET /api/dashboard/tempo-resposta: card "Tempo de Resposta" do
 * Dashboard (primeira resposta do vendedor, só em horário comercial).
 * Supabase fakeado em memória — sem rede.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", async () => {
  const { cenario } = await import("@/lib/testes/supabase-fake");
  return {
    createAdminClient: () => ({ from: (t: string) => cenario.builder(t) }),
  };
});

vi.mock("@/lib/supabase/server", async () => {
  const { cenario } = await import("@/lib/testes/supabase-fake");
  return {
    createClient: async () => ({
      auth: {
        getUser: async () => ({
          data: { user: cenario.estado.usuario },
          error: cenario.estado.usuario ? null : { message: "no session" },
        }),
      },
      from: (tabela: string) => cenario.builder(tabela),
    }),
  };
});

import { cenario } from "@/lib/testes/supabase-fake";
import { GET } from "./route";

// Relógio fixo em 06/10/2026 12:00 SP: as datas fixas dos seeds
// (sex 02/10, atendimento de 26 dias atrás) continuam válidas para sempre.
afterEach(() => {
  vi.useRealTimers();
});

function logar(id: string, cargo: string) {
  cenario.estado.usuario = { id, email: `${id}@x.com`, cargo };
  cenario.tabelas.profiles = [{ id, cargo, nome_completo: id }];
}

function req() {
  return new NextRequest("http://localhost/api/dashboard/tempo-resposta");
}

describe("GET /api/dashboard/tempo-resposta", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-10-06T15:00:00.000Z") });
    cenario.limpar();
    logar("adm-1", "admin"); // Fase 4: rota passou a exigir sessão
    cenario.tabelas.atendimentos = [{ id: "a1", created_at: "2026-10-02T20:00:00Z", instancia: "STK-1", vendedor_id: "ven-1" }];
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

  it("Fase 4: 401 sem sessão", async () => {
    cenario.estado.usuario = null;
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("Fase 4: vendedor vê SÓ os seus atendimentos e oportunidades", async () => {
    // a2 pertence a outro vendedor e também teve resposta
    cenario.tabelas.atendimentos.push({
      id: "a2",
      created_at: "2026-10-05T12:00:00Z",
      instancia: "STK-3",
      vendedor_id: "ven-2",
    });
    cenario.tabelas.atendimento_mensagens.push(
      { atendimento_id: "a2", remetente: "cliente", created_at: "2026-10-05T12:00:00Z", enviada_por: null },
      { atendimento_id: "a2", remetente: "vendedor", created_at: "2026-10-05T12:40:00Z", enviada_por: "ven-2" },
    );
    cenario.tabelas.oportunidades.push(
      { id: "o-ven1", atendimento_id: "a1", vendedor_id: "ven-1", produto_id: null, resultado: null, valor_venda: null },
      { id: "o-ven2", atendimento_id: "a2", vendedor_id: "ven-2", produto_id: null, resultado: null, valor_venda: null },
    );
    logar("ven-1", "vendedor");
    cenario.tabelas.profiles.push({ id: "ven-2", cargo: "vendedor", nome_completo: "Outro" });

    const res = await GET(req());
    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.perfil).toBe("vendedor");
    expect(corpo.geral.n).toBe(1); // só a1
    expect(corpo.porTime.map((t: any) => t.nome)).toEqual(["Time Lobo"]); // a2 (Águia) fora
    expect(corpo.porProduto[0].oportunidades).toBe(1); // só a do ven-1
  });

  it("Fase 4: gerente vê tudo (times e vendedores); admin idem", async () => {
    cenario.tabelas.atendimentos.push({
      id: "a2",
      created_at: "2026-10-05T12:00:00Z",
      instancia: "STK-3",
      vendedor_id: "ven-2",
    });
    cenario.tabelas.atendimento_mensagens.push(
      { atendimento_id: "a2", remetente: "cliente", created_at: "2026-10-05T12:00:00Z", enviada_por: null },
      { atendimento_id: "a2", remetente: "vendedor", created_at: "2026-10-05T12:40:00Z", enviada_por: "ven-2" },
    );

    logar("ger-1", "gerente_comercial");
    const resGerente = await GET(req());
    const gerente = await resGerente.json();
    expect(resGerente.status).toBe(200);
    expect(gerente.perfil).toBe("gerente_comercial");
    expect(gerente.geral.n).toBe(2);

    logar("adm-1", "admin");
    const resAdmin = await GET(req());
    const admin = await resAdmin.json();
    expect(admin.perfil).toBe("admin");
    expect(admin.geral.n).toBe(2);
  });

  it("sem dados devolve zerado (200)", async () => {
    cenario.limpar();
    logar("adm-1", "admin"); // limpar() zera a sessão
    const res = await GET(req());
    const corpo = await res.json();
    expect(res.status).toBe(200);
    expect(corpo.geral).toEqual({ media: 0, n: 0 });
  });
});
