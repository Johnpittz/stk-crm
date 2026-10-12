/**
 * PEDIDO 1 (11/10) — GET /api/dashboard/potencial-vendas.
 *
 * Vendas confirmadas (resultado = sucesso) por vendedor × produto, com o
 * mesmo harness da Fase 1: Supabase fakeado em memória, sem rede, relógio
 * fixo para o filtro de período.
 *
 * Perfil (padrão Fase 4): admin/diretor/gerente_comercial veem todos;
 * vendedor vê só as próprias vendas (filtro AQUI no servidor).
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

afterEach(() => vi.useRealTimers());

function logar(id: string, cargo: string) {
  cenario.estado.usuario = { id, email: `${id}@x.com`, cargo };
}

function req(url = "http://localhost/api/dashboard/potencial-vendas") {
  return new NextRequest(url);
}

describe("GET /api/dashboard/potencial-vendas", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date("2026-10-06T15:00:00.000Z") });
    cenario.limpar();
    logar("adm-1", "admin");
    cenario.tabelas.profiles = [
      { id: "adm-1", cargo: "admin", nome_completo: "Admin" },
      { id: "v1", cargo: "vendedor", nome_completo: "João Silva" },
    ];
    cenario.tabelas.produtos = [{ id: "p-gd", nome: "GD", ativo: true }];
    cenario.tabelas.oportunidades = [
      // venda recente do v1
      { id: "o1", resultado: "sucesso", vendedor_id: "v1", produto_id: "p-gd", valor_venda: 5000, updated_at: "2026-10-01T12:00:00Z" },
      // NÃO conta: perdida
      { id: "o2", resultado: "perdido", vendedor_id: "v1", produto_id: "p-gd", valor_venda: 99999, updated_at: "2026-10-05T12:00:00Z" },
      // venda recente de outro vendedor
      { id: "o3", resultado: "sucesso", vendedor_id: "v2", produto_id: null, valor_venda: null, updated_at: "2026-10-06T12:00:00Z" },
      // NÃO conta: fora da janela de 30 dias (01/08)
      { id: "o4", resultado: "sucesso", vendedor_id: "v1", produto_id: "p-gd", valor_venda: 7000, updated_at: "2026-08-01T12:00:00Z" },
    ];
  });

  it("exige sessão (401 sem login)", async () => {
    cenario.estado.usuario = null;
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("admin vê todos: só vendas com sucesso, na janela, com mix por produto", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.perfil).toBe("admin");
    expect(corpo.periodo_dias).toBe(30);

    // v1: só o1 (o2=perdido, o4=fora da janela) → 1 venda, 5k, líder GD
    const v1 = corpo.vendedores.find((v: any) => v.vendedor_id === "v1");
    expect(v1.total_vendas).toBe(1);
    expect(v1.valor_total).toBe(5000);
    expect(v1.produto_lider.produto_nome).toBe("GD");
    // v2: vendeu sem valor fechado → conta 0
    const v2 = corpo.vendedores.find((v: any) => v.vendedor_id === "v2");
    expect(v2.total_vendas).toBe(1);
    expect(v2.valor_total).toBe(0);
    // total geral = 2 vendas / 5k (99999 e 7000 fora)
    expect(corpo.total_geral).toEqual({ total_vendas: 2, valor_total: 5000 });
  });

  it("vendedor (perfil) vê só as próprias vendas", async () => {
    logar("v1", "vendedor");
    const res = await GET(req());
    const corpo = await res.json();
    expect(corpo.perfil).toBe("vendedor");
    expect(corpo.vendedores).toHaveLength(1);
    expect(corpo.vendedores[0].vendedor_id).toBe("v1");
    expect(corpo.vendedores[0].valor_total).toBe(5000);
  });

  it("?dias=90 amplia a janela (pega a venda de 01/08)", async () => {
    const res = await GET(req("http://localhost/api/dashboard/potencial-vendas?dias=90"));
    const corpo = await res.json();
    expect(corpo.periodo_dias).toBe(90);
    expect(corpo.vendedores.find((v: any) => v.vendedor_id === "v1").total_vendas).toBe(2);
  });
});
