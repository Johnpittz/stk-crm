/**
 * 06/10 — PUT /api/clientes/[clienteId]: gravação com os campos novos +
 * TRILHA de EDIÇÃO com os campos que mudaram (log de edição, só admin lê).
 * A tela Editar passou a chamar esta rota (antes mandava `nome_completo`,
 * coluna inexistente, e o save falhava sempre).
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
import { PUT } from "./route";

function req(body: any) {
  return new NextRequest("http://test/api/clientes/c1", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  cenario.limpar();
  cenario.estado.usuario = { id: "u1", email: "maria@stk.com" };
  cenario.tabelas.clientes.push({
    id: "c1",
    nome_razao_social: "Rede ABC",
    email: "antigo@abc.com",
    nome_contato: null,
    cargo_contato: null,
  });
  cenario.tabelas.profiles.push({ id: "u1", cargo: "vendedor", email: "maria@stk.com" });
});

const params = { params: { clienteId: "c1" } };

describe("PUT /api/clientes/[clienteId] — edição + log", () => {
  it("grava os campos novos e a trilha com o QUE mudou", async () => {
    const res = await PUT(
      req({ nome_contato: "Ana Souza", cargo_contato: "Gerente", email: "novo@abc.com" }),
      params
    );

    expect(res.status).toBe(200);
    const linha = cenario.tabelas.clientes[0];
    expect(linha.nome_contato).toBe("Ana Souza");
    expect(linha.email).toBe("novo@abc.com");

    const logs = cenario.tabelas.cliente_auditoria ?? [];
    expect(logs).toHaveLength(1);
    expect(logs[0].acao).toBe("editado");
    expect(logs[0].cliente_id).toBe("c1");
    expect(logs[0].cliente_nome).toBe("Rede ABC");
    expect(logs[0].usuario_email).toBe("maria@stk.com");
    expect([...logs[0].campos].sort()).toEqual(["cargo_contato", "email", "nome_contato"]);
  });

  it("404 para cliente inexistente e SEM trilha", async () => {
    const res = await PUT(req({ nome_contato: "Ana" }), {
      params: { clienteId: "99999999-9999-9999-9999-999999999999" },
    });
    expect(res.status).toBe(404);
    expect(cenario.tabelas.cliente_auditoria ?? []).toHaveLength(0);
  });

  it("400 quando não há campo permitido no corpo", async () => {
    const res = await PUT(req({ campo_proibido: "x" }), params);
    expect(res.status).toBe(400);
    expect(cenario.tabelas.cliente_auditoria ?? []).toHaveLength(0);
  });

  it("sucesso mesmo com a tabela de log quebrada (best-effort)", async () => {
    cenario.estado.tabelaQuebrada = "cliente_auditoria";
    const res = await PUT(req({ nome_contato: "Ana" }), params);
    expect(res.status).toBe(200);
    expect(cenario.tabelas.clientes[0].nome_contato).toBe("Ana");
    cenario.estado.tabelaQuebrada = null;
  });
});
