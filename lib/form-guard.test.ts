import { describe, it, expect, vi } from "vitest";
import {
  ehBusca,
  ehEnterSalvavel,
  ehBotaoSalvar,
  acharBotaoSalvar,
  ehFechadorDeModal,
  podeFecharModal,
} from "./form-guard";

const AVISO = "Você tem alterações não salvas. Deseja sair sem salvar?";

/** 22/10 — regras da guarda: ENTER salva no sistema inteiro (inclusive
 * Marketing), mas busca não salva e textarea continua quebrando linha. */

describe("ehBusca", () => {
  it("campo de busca por placeholder", () => {
    expect(ehBusca({ tagName: "INPUT", placeholder: "Buscar cliente…" })).toBe(true);
    expect(ehBusca({ tagName: "INPUT", placeholder: "Pesquisar leads" })).toBe(true);
    expect(ehBusca({ tagName: "INPUT", ariaLabel: "Filtrar por status" })).toBe(true);
  });

  it("type=search conta como busca", () => {
    expect(ehBusca({ tagName: "INPUT", type: "search" })).toBe(true);
  });

  it("campo comum não é busca", () => {
    expect(ehBusca({ tagName: "INPUT", placeholder: "Nome do cliente" })).toBe(false);
    expect(ehBusca({ tagName: "INPUT", placeholder: "" })).toBe(false);
  });
});

describe("ehEnterSalvavel", () => {
  it("input comum salva", () => {
    expect(ehEnterSalvavel({ tagName: "INPUT", placeholder: "Nome" })).toBe(true);
  });

  it("select salva", () => {
    expect(ehEnterSalvavel({ tagName: "SELECT" })).toBe(true);
  });

  it("textarea NÃO salva — quebra linha (listas do lote)", () => {
    expect(ehEnterSalvavel({ tagName: "TEXTAREA" })).toBe(false);
  });

  it("botão/link não são alvo de Enter", () => {
    expect(ehEnterSalvavel({ tagName: "BUTTON" })).toBe(false);
    expect(ehEnterSalvavel({ tagName: "A" })).toBe(false);
  });

  it("busca não salva", () => {
    expect(ehEnterSalvavel({ tagName: "INPUT", placeholder: "Pesquisar" })).toBe(false);
    expect(ehEnterSalvavel({ tagName: "INPUT", type: "search" })).toBe(false);
  });

  it("checkbox/arquivo não disparam salvar", () => {
    expect(ehEnterSalvavel({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(ehEnterSalvavel({ tagName: "INPUT", type: "file" })).toBe(false);
  });

  it("texto editável não salva", () => {
    expect(ehEnterSalvavel({ tagName: "DIV", isContentEditable: true })).toBe(false);
  });
});

describe("fechamento de modal com dados digitados (22/10)", () => {
  it("reconhece o X do modal", () => {
    expect(ehFechadorDeModal({ tagName: "BUTTON", ariaLabel: "Close" })).toBe(true);
    expect(ehFechadorDeModal({ tagName: "BUTTON", ariaLabel: "Fechar" })).toBe(true);
    expect(ehFechadorDeModal({ tagName: "BUTTON", textContent: "\u00d7" })).toBe(true);
    expect(ehFechadorDeModal({ tagName: "BUTTON", textContent: "Criar Campanha" })).toBe(false);
    expect(ehFechadorDeModal({ tagName: "DIV", textContent: "\u00d7" })).toBe(false);
  });

  it("modal limpo fecha sem perguntar", () => {
    const confirmar = vi.fn(() => true);
    expect(podeFecharModal(false, confirmar, AVISO)).toBe(true);
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("modal com dados digitados pergunta e respeita a resposta", () => {
    const recusou = vi.fn(() => false);
    expect(podeFecharModal(true, recusou, AVISO)).toBe(false);
    expect(recusou).toHaveBeenCalledWith(AVISO);

    const aceitou = vi.fn(() => true);
    expect(podeFecharModal(true, aceitou, AVISO)).toBe(true);
  });
});

describe("ehBotaoSalvar / acharBotaoSalvar", () => {
  it("reconhece os botões de salvar do sistema", () => {
    expect(ehBotaoSalvar({ tagName: "BUTTON", textContent: "Salvar Cliente" })).toBe(true);
    expect(ehBotaoSalvar({ tagName: "BUTTON", textContent: "Criar Campanha" })).toBe(true);
    expect(ehBotaoSalvar({ tagName: "BUTTON", textContent: "Criar Disparo" })).toBe(true);
    expect(ehBotaoSalvar({ tagName: "BUTTON", textContent: "Enviar" })).toBe(true);
    expect(ehBotaoSalvar({ tagName: "BUTTON", textContent: "Nova Promoção" })).toBe(false);
    expect(ehBotaoSalvar({ tagName: "BUTTON", textContent: "Excluir" })).toBe(false);
    expect(ehBotaoSalvar({ tagName: "DIV", textContent: "Salvar" })).toBe(false);
  });

  it("acha o botão de salvar dentro do contêiner", () => {
    const botoes = [
      { tagName: "BUTTON", textContent: "Cancelar" },
      { tagName: "BUTTON", textContent: "Salvar" },
    ];
    const container = {
      querySelectorAll: () => botoes,
    };
    expect(acharBotaoSalvar(container)?.textContent).toBe("Salvar");
  });

  it("devolve null quando não há botão de salvar", () => {
    const container = {
      querySelectorAll: () => [
        { tagName: "BUTTON", textContent: "Excluir" } as const,
      ],
    };
    expect(acharBotaoSalvar(container as never)).toBeNull();
  });
});
