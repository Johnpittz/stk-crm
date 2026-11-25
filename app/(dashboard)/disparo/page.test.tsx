// @vitest-environment jsdom
/**
 * Reorganização do Disparo (25/11) — a tela /disparo deixou de ser 3 seções
 * empilhadas numa página comprida e passou a navegar por abas, na ordem do
 * documento de proposta: Visão Geral, Disparos, Relatórios, Configurações.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("@/components/features/disparo/bulk-sender", () => ({
  BulkSender: (props: { apenasPainel?: boolean }) => (
    <div data-testid="painel-envios" data-apenas-painel={String(!!props.apenasPainel)} />
  ),
}));
// O conteúdo mora em components/features/campanhas (a page da rota virou casca
// fina que só re-exporta este componente)
vi.mock("@/components/features/campanhas/campanhas-conteudo", () => ({
  CampanhasConteudo: () => <div data-testid="sec-campanhas" />,
}));
vi.mock("../marketing/relatorios/page", () => ({
  default: () => <div data-testid="sec-relatorios" />,
}));
vi.mock("@/components/features/disparo/configuracoes-disparo", () => ({
  ConfiguracoesDisparo: () => <div data-testid="sec-config" />,
}));

import DisparoPage from "./page";

afterEach(() => cleanup());

// O Radix Tabs seleciona no `mousedown` (não no `click`) — no navegador os
// dois eventos saem juntos; aqui disparo os dois para simular o clique real.
const abrirAba = (nome: RegExp) => {
  const aba = screen.getByRole("tab", { name: nome });
  fireEvent.mouseDown(aba);
  fireEvent.click(aba);
};

describe(" /disparo reorganizado em abas (25/11)", () => {
  it("expõe as 4 seções do documento como navegação", () => {
    render(<DisparoPage />);
    expect(screen.getByRole("tab", { name: /visão geral/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /^disparos$/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /relatórios/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /configurações/i })).toBeTruthy();
  });

  it("abre na Visão Geral com o Painel de Envios em modo apenasPainel", () => {
    render(<DisparoPage />);
    const painel = screen.getByTestId("painel-envios");
    expect(painel.getAttribute("data-apenas-painel")).toBe("true");
    // as outras seções ficam fechadas (não renderizadas)
    expect(screen.queryByTestId("sec-campanhas")).toBeNull();
    expect(screen.queryByTestId("sec-relatorios")).toBeNull();
    expect(screen.queryByTestId("sec-config")).toBeNull();
  });

  it("NÃO tem o form 'Criar disparo' em Visão Geral (só painel)", () => {
    render(<DisparoPage />);
    expect(screen.queryByRole("heading", { name: /criar disparo/i })).toBeNull();
  });

  it("trocar de aba abre Disparos, Relatórios e Configurações", () => {
    render(<DisparoPage />);

    abrirAba(/^disparos$/i);
    expect(screen.getByTestId("sec-campanhas")).toBeTruthy();
    expect(screen.queryByTestId("painel-envios")).toBeNull();

    abrirAba(/relatórios/i);
    expect(screen.getByTestId("sec-relatorios")).toBeTruthy();
    expect(screen.queryByTestId("sec-campanhas")).toBeNull();

    abrirAba(/configurações/i);
    expect(screen.getByTestId("sec-config")).toBeTruthy();
    expect(screen.queryByTestId("sec-relatorios")).toBeNull();
  });

  it("mantém a explicação do topo do que a tela oferece", () => {
    render(<DisparoPage />);
    expect(screen.getByText(/sem rolar a página/i)).toBeTruthy();
  });
});
