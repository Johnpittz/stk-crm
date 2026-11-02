"use client";

import { useEffect } from "react";
import { acharBotaoSalvar, ehBusca, ehEnterSalvavel, type ElemLike } from "@/lib/form-guard";

/**
 * FormGuard — 22/10 (pedido do João: "no sistema inteiro, inclusive
 * Marketing").
 *
 * Montado no layout do dashboard, vale para TODA a aplicação:
 *
 * 1. ENTER salva: em qualquer campo digitável (input/select) o Enter
 *    dispara o botão de salvar/criar do mesmo bloco — clientes, módulo
 *    de Marketing (Disparo, Campanhas, Promoções), configurações, etc.
 *    - textarea continua quebrando linha;
 *    - campo de busca continua filtrando (Enter nativo de busca);
 *    - se o form já tem botão submit, o navegador resolve sozinho.
 *
 * 2. "Você tem alterações não salvas. Deseja sair sem salvar?" antes de
 *    sair da página (link, F5 ou fechar aba) com dados digitados.
 */

const AVISO_SAIDA = "Você tem alterações não salvas. Deseja sair sem salvar?";

function marcarSujo() {
  document.body.dataset.formSujo = "1";
}

function limparSujo() {
  delete document.body.dataset.formSujo;
}

function estaSujo() {
  return document.body.dataset.formSujo === "1";
}

export function FormGuard() {
  useEffect(() => {
    // ── rastreia alterações digitadas ──────────────────────────────────
    const noInput = (e: Event) => {
      const alvo = e.target as ElemLike | null;
      if (alvo && ehBusca(alvo)) return; // digitar na busca não "suja" a página
      marcarSujo();
    };
    const noSubmit = () => limparSujo();

    document.addEventListener("input", noInput, true);
    document.addEventListener("change", noInput, true);
    document.addEventListener("submit", noSubmit, true);

    // ── ENTER salva ────────────────────────────────────────────────────
    const noKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.defaultPrevented) return;
      const alvo = e.target as (ElemLike & { closest?: (s: string) => HTMLElement | null }) | null;
      if (!alvo || !ehEnterSalvavel(alvo)) return;

      const form = alvo.closest?.("form") || null;
      if (form) {
        // form com botão submit: o próprio navegador já submete no Enter
        const temSubmit = !!form.querySelector(
          'button[type="submit"], input[type="submit"], button:not([type])',
        );
        if (temSubmit) return;
        const botao = acharBotaoSalvar(form as unknown as { querySelectorAll: (s: string) => ArrayLike<ElemLike> });
        if (botao) {
          e.preventDefault();
          (botao as unknown as HTMLElement).click();
        }
        return;
      }
      // sem <form> (telas em div): sobe nos pais até achar o bloco com
      // botão de salvar — modal, card ou o bloco do formulário
      let no = (alvo as unknown as HTMLElement).parentElement;
      for (let i = 0; no && i < 6; i++, no = no.parentElement) {
        const botao = acharBotaoSalvar(no as unknown as { querySelectorAll: (s: string) => ArrayLike<ElemLike> });
        if (botao) {
          e.preventDefault();
          (botao as unknown as HTMLElement).click();
          return;
        }
      }
    };
    document.addEventListener("keydown", noKey);

    // ── aviso ao sair sem salvar (link) ────────────────────────────────
    const noClique = (e: MouseEvent) => {
      if (!estaSujo()) return;
      const alvo = e.target as HTMLElement | null;
      const link = alvo?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      if (link.target === "_blank") return;
      const href = link.getAttribute("href") || "";
      if (href.startsWith("http") && !href.includes(window.location.host)) return;
      if (!window.confirm(AVISO_SAIDA)) {
        e.preventDefault();
        e.stopPropagation();
      } else {
        limparSujo();
      }
    };
    document.addEventListener("click", noClique, true);

    // ── aviso ao sair sem salvar (F5 / fechar aba) ─────────────────────
    const antesSair = (e: BeforeUnloadEvent) => {
      if (!estaSujo()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", antesSair);

    // limpa o marcador quando um botão de salvar é clicado com o mouse
    const noBotao = (e: MouseEvent) => {
      const alvo = e.target as ElemLike | null;
      if (alvo && ehBotao(alvo)) limparSujo();
    };
    document.addEventListener("click", noBotao, true);

    return () => {
      document.removeEventListener("input", noInput, true);
      document.removeEventListener("change", noInput, true);
      document.removeEventListener("submit", noSubmit, true);
      document.removeEventListener("keydown", noKey);
      document.removeEventListener("click", noClique, true);
      document.removeEventListener("click", noBotao, true);
      window.removeEventListener("beforeunload", antesSair);
      limparSujo();
    };
  }, []);

  return null;
}

function ehBotao(alvo: ElemLike): boolean {
  const tag = (alvo.tagName || "").toUpperCase();
  if (tag !== "BUTTON") return false;
  const texto = (alvo.textContent || "").replace(/\s+/g, " ").trim();
  return /^(salvar|criar|enviar|gravar|cadastrar|registrar|confirmar|publicar|gerar|atualizar|concluir|finalizar|aplicar)/i.test(
    texto,
  );
}
