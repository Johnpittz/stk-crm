// @vitest-environment jsdom
/**
 * ITEM 2 (16/10) — UM único menu "Disparo" no Marketing (decisão do João:
 * "um único menu Disparo (sem Campanhas)"). A tela /disparo passa a ser
 * TUDO junto numa tela só, sem abas: criar disparo (BulkSender + artes),
 * campanhas (com Novo Disparo / remarketing) e relatórios.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/features/disparo/bulk-sender", () => ({
  BulkSender: () => <div data-testid="sec-criar" />,
}));
vi.mock("../marketing/campanhas/page", () => ({
  default: () => <div data-testid="sec-campanhas" />,
}));
vi.mock("../marketing/relatorios/page", () => ({
  default: () => <div data-testid="sec-relatorios" />,
}));

import DisparoPage from "./page";

afterEach(() => cleanup());

describe(" tela única /disparo (item 2)", () => {
  it("mostra as 3 seções empilhadas: criar, campanhas e relatórios", () => {
    render(<DisparoPage />);
    expect(screen.getByRole("heading", { name: /criar disparo/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /campanhas/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /relatórios/i })).toBeTruthy();
    expect(screen.getByTestId("sec-criar")).toBeTruthy();
    expect(screen.getByTestId("sec-campanhas")).toBeTruthy();
    expect(screen.getByTestId("sec-relatorios")).toBeTruthy();
  });

  it("explica no topo que tudo ficou junto (sem abas)", () => {
    render(<DisparoPage />);
    expect(screen.getByText(/tudo em um lugar/i)).toBeTruthy();
  });
});
