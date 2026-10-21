// @vitest-environment jsdom
/**
 * ITEM 2 (16/10) — UM único menu "Disparo" no Marketing (decisão do João).
 * A tela /disparo empilha: criar disparo (BulkSender, com as abas
 * Avulso/Em Massa/Remarketing NA TELA desde 19/10), campanhas e
 * relatórios.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/features/disparo/bulk-sender", () => ({
  BulkSender: () => <div data-testid="sec-criar" />,
}));
// 19/10 — o conteúdo mora em components/features/campanhas (a page da
// rota virou casca fina que só re-exporta este componente)
vi.mock("@/components/features/campanhas/campanhas-conteudo", () => ({
  CampanhasConteudo: () => <div data-testid="sec-campanhas" />,
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

  it("explica no topo o que a tela oferece (sem trocar de tela)", () => {
    render(<DisparoPage />);
    expect(screen.getByText(/sem trocar de tela/i)).toBeTruthy();
  });
});
