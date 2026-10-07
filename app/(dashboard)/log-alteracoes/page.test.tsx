// @vitest-environment jsdom
/**
 * 06/10 — tela do LOG DE CRIAÇÃO/EDIÇÃO de clientes (só admin).
 * RED: lista vinda de /api/clientes/log e aviso claro quando a rota
 * devolve 403 (não-admin).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import LogAlteracoesPage from "./page";

afterEach(() => cleanup());

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function responder(status: number, corpo: any) {
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    json: async () => corpo,
  });
}

describe("/log-alteracoes", () => {
  it("lista cliente, ação, campos e quem fez", async () => {
    responder(200, {
      logs: [
        {
          id: "l1",
          cliente_nome: "Rede ABC",
          acao: "editado",
          campos: ["email", "nome_contato"],
          usuario_email: "maria@stk.com",
          created_at: "2026-10-06T12:00:00+00:00",
        },
      ],
    });

    render(<LogAlteracoesPage />);
    await screen.findByText("Rede ABC");
    expect(screen.getByText(/Editado/)).toBeTruthy();
    expect(screen.getByText(/email, nome_contato/)).toBeTruthy();
    expect(screen.getByText(/maria@stk\.com/)).toBeTruthy();
  });

  it("403 → avisa que é restrito a admin", async () => {
    responder(403, { error: "Acesso restrito a admin" });

    render(<LogAlteracoesPage />);
    await screen.findByText(/Acesso restrito/);
  });
});
