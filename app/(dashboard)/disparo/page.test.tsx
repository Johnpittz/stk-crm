// @vitest-environment jsdom
/**
 * ITEM 2 (16/10) — UM único menu "Disparo" no Marketing (decisão do João).
 * A tela /disparo empilha: painel de envios, campanhas e relatórios.
 * 02/11 (pedido do João): o form "Criar disparo" SAIU da tela — a criação
 * acontece só pelo botão "Novo Disparo" (seção Campanhas). O BulkSender
 * aparece em modo `apenasPainel`.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/features/disparo/bulk-sender", () => ({
  BulkSender: (props: { apenasPainel?: boolean }) => (
    <div data-testid="painel-envios" data-apenas-painel={String(!!props.apenasPainel)} />
  ),
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

describe(" tela única /disparo (item 2 + 02/11)", () => {
  it("NÃO tem mais o form 'Criar disparo' na tela; só painel, disparos e relatórios", () => {
    render(<DisparoPage />);
    expect(screen.queryByRole("heading", { name: /criar disparo/i })).toBeNull();
    expect(screen.getByRole("heading", { name: /disparos/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /relatórios/i })).toBeTruthy();
    expect(screen.getByTestId("sec-campanhas")).toBeTruthy();
    expect(screen.getByTestId("sec-relatorios")).toBeTruthy();
  });

  it("mostra o Painel de Envios em modo apenasPainel (sem form)", () => {
    render(<DisparoPage />);
    const painel = screen.getByTestId("painel-envios");
    expect(painel).toBeTruthy();
    expect(painel.getAttribute("data-apenas-painel")).toBe("true");
  });

  it("explica no topo o que a tela oferece (sem trocar de tela)", () => {
    render(<DisparoPage />);
    expect(screen.getByText(/sem trocar de tela/i)).toBeTruthy();
  });
});
