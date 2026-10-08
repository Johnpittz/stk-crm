/**
 * Fase 3 — cadastro de produtos (POST/PATCH em /api/produtos).
 * Até aqui a rota só tinha GET (catálogo leitura). Agora o admin cadastra
 * e edita os produtos que alimentam a dimensão "produto" do Dashboard.
 * Regra: só admin/diretor escreve; nome é obrigatório.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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
import { POST, PATCH } from "./route";

function req(body: any, method: string) {
  return new NextRequest("http://localhost/api/produtos", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST/PATCH /api/produtos — cadastro (Fase 3)", () => {
  beforeEach(() => {
    cenario.limpar();
    cenario.tabelas.produtos = [{ id: "p1", nome: "GD", ativo: true }];
    cenario.tabelas.profiles = [
      { id: "a1", cargo: "admin" },
      { id: "v1", cargo: "vendedor" },
    ];
  });

  it("401 sem sessão; 403 para vendedor; admin cria", async () => {
    expect((await POST(req({ nome: "X" }, "POST"))).status).toBe(401);

    cenario.estado.usuario = { id: "v1", email: "v@x.com", cargo: "vendedor" };
    expect((await POST(req({ nome: "X" }, "POST"))).status).toBe(403);

    cenario.estado.usuario = { id: "a1", email: "a@x.com", cargo: "admin" };
    const res = await POST(req({ nome: "BIOMETRIA", ativo: true }, "POST"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.produto.nome).toBe("BIOMETRIA");
    expect(cenario.tabelas.produtos).toHaveLength(2);
  });

  it("nome é obrigatório (400)", async () => {
    cenario.estado.usuario = { id: "a1", email: "a@x.com", cargo: "admin" };
    expect((await POST(req({ nome: "  " }, "POST"))).status).toBe(400);
  });

  it("admin edita nome/ativo via PATCH", async () => {
    cenario.estado.usuario = { id: "a1", email: "a@x.com", cargo: "admin" };
    const res = await PATCH(req({ id: "p1", nome: "GD EDITADO", ativo: false }, "PATCH"));
    expect(res.status).toBe(200);
    expect(cenario.tabelas.produtos[0].nome).toBe("GD EDITADO");
    expect(cenario.tabelas.produtos[0].ativo).toBe(false);
  });

  it("vendedor não edita (403)", async () => {
    cenario.estado.usuario = { id: "v1", email: "v@x.com", cargo: "vendedor" };
    expect((await PATCH(req({ id: "p1", nome: "X" }, "PATCH"))).status).toBe(403);
  });
});
