/**
 * 06/10 — GET /api/clientes/log: leitura do LOG DE CRIAÇÃO/EDIÇÃO de
 * clientes. Recurso novo, EXCLUSIVO de admin (pedido do João): vendedor/
 * gerente recebem 403 e sem sessão 401.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/admin", async () => {
  const { cenario } = await import("@/lib/testes/supabase-fake");
  return { createAdminClient: () => ({ from: (t: string) => cenario.builder(t) }) };
});
vi.mock("@/lib/supabase/server", async () => {
  const { cenario } = await import("@/lib/testes/supabase-fake");
  return {
    createClient: () => ({
      auth: {
        getUser: async () => ({
          data: { user: cenario.estado.usuario },
          error: cenario.estado.usuario ? null : new Error("no session"),
        }),
      },
      from: (t: string) => cenario.builder(t),
    }),
  };
});

import { cenario } from "@/lib/testes/supabase-fake";
import { GET } from "./route";

const req = () => new NextRequest("http://test/api/clientes/log");

beforeEach(() => {
  cenario.limpar();
  cenario.tabelas.profiles.push({ id: "u1", cargo: "admin", email: "admin@stk.com" });
  cenario.tabelas.profiles.push({ id: "u2", cargo: "vendedor", email: "vend@stk.com" });
  cenario.tabelas.cliente_auditoria = [
    {
      id: "l1",
      cliente_id: "c1",
      cliente_nome: "Rede ABC",
      acao: "editado",
      campos: ["email"],
      usuario_id: "u2",
      usuario_email: "vend@stk.com",
      created_at: "2026-10-06T12:00:00+00:00",
    },
    {
      id: "l2",
      cliente_id: "c2",
      cliente_nome: "Sol Ltda",
      acao: "criado",
      campos: ["nome_contato"],
      usuario_id: "u2",
      usuario_email: "vend@stk.com",
      created_at: "2026-10-06T14:00:00+00:00",
    },
  ];
});

function logado(id: string, email: string) {
  cenario.estado.usuario = { id, email };
}

describe("GET /api/clientes/log — só admin", () => {
  it("admin vê a lista (mais recente primeiro)", async () => {
    logado("u1", "admin@stk.com");
    const res = await GET(req());
    expect(res.status).toBe(200);
    const { logs } = await res.json();
    expect(logs).toHaveLength(2);
    expect(logs[0].id).toBe("l2"); // 14h antes de 12h
    expect(logs[1].cliente_nome).toBe("Rede ABC");
  });

  it("vendedor NÃO vê (403)", async () => {
    logado("u2", "vend@stk.com");
    const res = await GET(req());
    expect(res.status).toBe(403);
  });

  it("sem sessão → 401", async () => {
    cenario.estado.usuario = null;
    const res = await GET(req());
    expect(res.status).toBe(401);
  });
});
