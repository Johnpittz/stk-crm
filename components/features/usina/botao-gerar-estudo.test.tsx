// @vitest-environment jsdom
/**
 * 25/11/2026 — Fase2-B: gatilho da IA da fatura → aba Estudo Usina.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BotaoGerarEstudo } from "./botao-gerar-estudo";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

afterEach(() => {
  cleanup();
  push.mockReset();
});

describe("BotaoGerarEstudo", () => {
  it("fecha o modal e navega para a aba Estudo Usina do cliente", () => {
    const onClose = vi.fn();
    render(<BotaoGerarEstudo clienteId="cli-123" onClose={onClose} />);
    const btn = screen.getByRole("button", { name: /Gerar estudo de usina/i });
    fireEvent.click(btn);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith("/clientes/cli-123?aba=estudo_usina");
  });
});
