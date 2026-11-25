// @vitest-environment jsdom
/**
 * 25/11/2026 — Fase2-A: landing pública /usina.
 * Cobre: estimativa ao vivo, validação sem chamada de rede, envio com sucesso.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import LandingUsinaPage from "./page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Landing /usina", () => {
  it("mostra a proposta e a estimativa ao vivo a partir do gasto mensal", () => {
    render(<LandingUsinaPage />);
    expect(screen.getByText(/Descubra quanto sua casa pode economizar/i)).toBeTruthy();
    // gasto950 → consumo1000 kWh (tarifa0,95) →8,40 kWp /16 painéis
    fireEvent.change(screen.getByLabelText(/paga de luz/i), { target: { value: "950" } });
    expect(screen.getByText(/8,40 kWp/)).toBeTruthy();
    expect(screen.getByText(/16 unidades/)).toBeTruthy();
    expect(screen.getByText(/R\$ 997,50/)).toBeTruthy();
  });

  it("sem nome/telefone NÃO chama a rede e destaca os campos", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<LandingUsinaPage />);
    fireEvent.change(screen.getByLabelText(/paga de luz/i), { target: { value: "950" } });
    fireEvent.click(screen.getByRole("button", { name: /Quero meu estudo grátis/i }));
    await waitFor(() =>
      expect(screen.getByText("Confira os campos destacados.")).toBeTruthy()
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia o lead e mostra a confirmação com a prioridade (score)", async () => {
    const fetchMock = vi.fn(async (_url: string, opts?: { body?: string }) => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, score: 80 }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<LandingUsinaPage />);
    fireEvent.change(screen.getByLabelText(/Seu nome/i), { target: { value: "Maria Silva" } });
    fireEvent.change(screen.getByLabelText(/WhatsApp/i), { target: { value: "11987654321" } });
    fireEvent.change(screen.getByLabelText(/paga de luz/i), { target: { value: "950" } });
    fireEvent.click(screen.getByRole("button", { name: /Quero meu estudo grátis/i }));
    expect(await screen.findByText("Pedido recebido!")).toBeTruthy();
    expect(screen.getByText(/prioridade 80\/100/)).toBeTruthy();
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.gastoMensalR).toBe(950);
    expect(body.telefone).toBe("11987654321");
  });

  it("erro do servidor vira mensagem amigável (sem stack)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: "Não foi possível registrar agora. Tente novamente." }),
      }))
    );
    render(<LandingUsinaPage />);
    fireEvent.change(screen.getByLabelText(/Seu nome/i), { target: { value: "Maria" } });
    fireEvent.change(screen.getByLabelText(/WhatsApp/i), { target: { value: "11987654321" } });
    fireEvent.change(screen.getByLabelText(/paga de luz/i), { target: { value: "950" } });
    fireEvent.click(screen.getByRole("button", { name: /Quero meu estudo grátis/i }));
    expect(
      await screen.findByText(/Não foi possível registrar agora/i)
    ).toBeTruthy();
  });
});
