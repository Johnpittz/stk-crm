/**
 * 06/10 — POST /api/clientes: criação com os campos novos (contato/
 * proprietário) + TRILHA de auditoria `cliente_auditoria` (log de criação,
 * só admin vê a leitura — ver /api/clientes/log).
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
import { POST } from "./route";

function req(body: any) {
  return new NextRequest("http://test/api/clientes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => cenario.limpar());

describe("POST /api/clientes — criação + log", () => {
  it("cria com os campos novos e grava a trilha de CRIAÇÃO", async () => {
    cenario.estado.usuario = { id: "u1", email: "joao@stk.com" };

    const res = await POST(
      req({
        nome_razao_social: "Rede ABC",
        nome_contato: "Ana Souza",
        cargo_contato: "Diretora",
        cpf_proprietario: "12345678900",
        data_nascimento_proprietario: "1980-05-20",
        email: "ana@abc.com",
      })
    );

    expect(res.status).toBe(201);
    const { cliente } = await res.json();
    const linha = cenario.tabelas.clientes[0];
    expect(linha.nome_contato).toBe("Ana Souza");
    expect(linha.data_nascimento_proprietario).toBe("1980-05-20");

    const logs = cenario.tabelas.cliente_auditoria ?? [];
    expect(logs).toHaveLength(1);
    expect(logs[0].acao).toBe("criado");
    expect(logs[0].cliente_id).toBe(cliente.id);
    expect(logs[0].cliente_nome).toBe("Rede ABC");
    expect(logs[0].usuario_email).toBe("joao@stk.com");
    expect(logs[0].campos).toContain("nome_contato");
  });

  it("sem sessão o log é gravado assim mesmo (usuario nulo)", async () => {
    cenario.estado.usuario = null;
    const res = await POST(req({ nome_razao_social: "Sem Sessão Ltda" }));
    expect(res.status).toBe(201);
    const logs = cenario.tabelas.cliente_auditoria ?? [];
    expect(logs).toHaveLength(1);
    expect(logs[0].usuario_email).toBeNull();
    expect(logs[0].usuario_id).toBeNull();
  });

  it("sem nome continua 400 e NÃO grava trilha", async () => {
    const res = await POST(req({ email: "x@y.com" }));
    expect(res.status).toBe(400);
    expect(cenario.tabelas.cliente_auditoria ?? []).toHaveLength(0);
  });
});
