// @vitest-environment jsdom
/**
 * Configurações do Disparo — consome GET /api/instances (dado real do WAHA).
 * Nada aqui é mockado no status: se a sessão não está "open", ela aparece
 * fechada.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { ConfiguracoesDisparo } from "./configuracoes-disparo";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const sessoes = {
  instancias: [
    { id: "1", name: "STK-1", number: "5511999990001", status: "open" },
    { id: "2", name: "ROMA_2", number: null, status: "STOPPED" },
  ],
};

describe("ConfiguracoesDisparo", () => {
  it("lista as sessões com número e status aberta/fechada", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => sessoes });

    render(<ConfiguracoesDisparo />);

    expect(await screen.findByText("STK-1")).toBeTruthy();
    expect(screen.getByText("5511999990001")).toBeTruthy();
    expect(screen.getByText("✅ Aberta")).toBeTruthy();

    expect(screen.getByText("ROMA_2")).toBeTruthy();
    expect(screen.getByText("❌ Fechada")).toBeTruthy();

    // resumo: 1 de 2
    expect(screen.getByText(/1 de 2 sessão\(ões\) aberta\(s\)/i)).toBeTruthy();
  });

  it("mostra o resumo do WAHA para parear número novo", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => sessoes });

    render(<ConfiguracoesDisparo />);

    expect(await screen.findByText(/parear um número novo/i)).toBeTruthy();
    expect(screen.getByText(/172\.16\.1\.1:3000/)).toBeTruthy();
  });

  it("erro na API vira aviso com botão de tentar de novo (sem quebrar a tela)", async () => {
    fetchMock.mockRejectedValue(new Error("rede fora"));

    render(<ConfiguracoesDisparo />);

    expect(await screen.findByText(/não consegui listar as sessões/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /tentar de novo/i })).toBeTruthy();
    expect(screen.queryByText("STK-1")).toBeNull();
  });

  it("resposta sem instancias não quebra", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    render(<ConfiguracoesDisparo />);

    expect(await screen.findByText(/nenhuma sessão encontrada/i)).toBeTruthy();
  });

  it("chama /api/instances uma vez ao montar", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => sessoes });

    render(<ConfiguracoesDisparo />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/instances");
  });
});
