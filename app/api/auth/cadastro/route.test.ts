/**
 * FIX 15/10 — /api/auth/cadastro: o gatilho que criava a linha em
 * `profiles` não existe no banco do STK (constatado ao criar o
 * RUBENS: conta de auth nascia, mas a tela de Vendedores — que lê
 * `profiles` — não mostrava ninguém). A rota agora GARANTE a linha
 * (upsert com cargo "vendedor") em vez de um update cego que some
 * em silêncio quando a linha não existe.
 */
import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { cenario } from "@/lib/testes/supabase-fake";

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

vi.mock("@supabase/supabase-js", async () => {
  const { cenario } = await import("@/lib/testes/supabase-fake");
  return {
    createClient: () => ({
      auth: {
        admin: {
          createUser: async () => ({
            data: { user: { id: "novo-1" } },
            error: null,
          }),
        },
      },
      from: (tabela: string) => cenario.builder(tabela),
    }),
  };
});

import { POST } from "./route";

let ip = 0;
function req(body: Record<string, unknown>) {
  ip += 1;
  return new NextRequest("http://localhost/api/auth/cadastro", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `10.0.0.${ip}`,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/cadastro — garante o cadastro em profiles (FIX 15/10)", () => {
  beforeEach(() => {
    cenario.limpar();
    cenario.tabelas.profiles = [{ id: "a1", cargo: "admin" }];
    cenario.estado.usuario = { id: "a1", email: "a@stk.com", cargo: "admin" };
  });

  it("SEM gatilho no banco: cria a linha em profiles com cargo vendedor", async () => {
    // cenário: profiles SÓ tem o admin — o gatilho não existe
    const res = await POST(
      req({ nome_completo: "Rubens", email: "rubens@stk.com", senha: "senha-forte-1" })
    );
    expect(res.status).toBe(200);
    const linha = cenario.tabelas.profiles.find((p: any) => p.id === "novo-1") as any;
    expect(linha).toBeTruthy();
    expect(linha.cargo).toBe("vendedor");
    expect(linha.nome_completo).toBe("Rubens");
    expect(linha.email).toBe("rubens@stk.com");
  });

  it("validações continuam: 401 sem sessão e 400 sem senha", async () => {
    cenario.estado.usuario = null;
    expect((await POST(req({ nome_completo: "X", email: "x@x.com", senha: "1234567" }))).status).toBe(401);

    cenario.estado.usuario = { id: "a1", email: "a@stk.com", cargo: "admin" };
    expect((await POST(req({ nome_completo: "X", email: "x@x.com" }))).status).toBe(400);
  });
});
