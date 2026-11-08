"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { acharBotaoSalvar, ehBusca, ehExcecaoGuard, ehEnterSalvavel, ehFechadorDeModal, podeFecharModal, type ElemLike } from "@/lib/form-guard";

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
 * 2. Aviso "Suas alterações não foram salvas" — modal ESTILIZADO do
 *    próprio sistema (não é o confirm feio do navegador) — antes de sair
 *    com dados digitados: link/menu, fechar modal (clique fora, × ou Esc).
 *    Fechar aba/F5 usa o aviso nativo do navegador (único caso possível).
 *
 * 3. Salvar limpa a marcação: quem já salvou não é incomodado.
 */

const AVISO_SAIDA = "Você tem alterações não salvas. Deseja sair sem salvar?";

type Pendencia = { refazer: () => void };

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
  const [pendencia, setPendencia] = useState<Pendencia | null>(null);
  /** espelho síncrono — os handlers de evento leem a ref, não o estado */
  const pendenciaRef = useRef<Pendencia | null>(null);
  /** re-executa a ação original sem reperguntar */
  const ignorarRef = useRef(false);

  const agendar = (refazer: () => void) => {
    const p = { refazer };
    pendenciaRef.current = p;
    setPendencia(p);
  };

  /** Fecha o aviso. Limpa a ref (senão os handlers ficam em silêncio para
   *  sempre) e, se for "Sair sem salvar", espera um tick antes de re-executar:
   *  disparado junto, o aviso ainda está na pilha de camadas do Radix e o
   *  fechamento (Esc) atinge o próprio aviso em vez do modal original. */
  const responder = (executarRefazer: boolean) => {
    const p = pendenciaRef.current;
    pendenciaRef.current = null;
    setPendencia(null);
    if (executarRefazer && p) window.setTimeout(() => p.refazer(), 80);
  };

  useEffect(() => {
    // ── rastreia alterações digitadas ──────────────────────────────────
    const noInput = (e: Event) => {
      const alvo = e.target as ElemLike | null;
      if (alvo && ehBusca(alvo)) return; // digitar na busca não "suja" a página
      if (alvo && ehExcecaoGuard(alvo)) return; // data-sem-guard: filtro/rename não sujam
      marcarSujo();
      // marca a sujeira também DENTRO do modal aberto (22/10 — pedido do João:
      // fechar modal com dados digitados tem que perguntar)
      const dlg = (alvo as unknown as HTMLElement | null)?.closest?.(
        '[role="dialog"]',
      ) as HTMLElement | null;
      if (dlg) dlg.dataset.sujo = "1";
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

    // ── helpers do aviso estilizado ────────────────────────────────────
    /** silêncio enquanto o aviso está na tela (evita perguntar em loop) */
    const silencioso = () =>
      ignorarRef.current || pendenciaRef.current !== null;

    const dialogoSujo = (): HTMLElement | null => {
      const d = document.querySelector('[role="dialog"]') as HTMLElement | null;
      return d && d.dataset.sujo === "1" ? d : null;
    };

    /** fecha o modal original SEM voltar a perguntar — usado quando o
     *  usuário escolhe "Sair sem salvar". Clica no × do próprio modal
     *  (mecanismo nativo do Radix); se não houver, dispara Esc com o alvo
     *  DENTRO do dialog — Esc com alvo em document é ignorado pelo Radix. */
    const refazerFechamento = () => {
      ignorarRef.current = true;
      const dlg = dialogoSujo();
      const x = dlg
        ? Array.from(dlg.querySelectorAll("button")).find((b) =>
            ehFechadorDeModal(b as unknown as ElemLike),
          )
        : null;
      if (x) {
        x.click();
      } else {
        (dlg || document).dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
        );
      }
      window.setTimeout(() => {
        ignorarRef.current = false;
      }, 500);
    };

    /** para o evento e abre o modal de aviso; ao confirmar, re-executa */
    const perguntar = (e: { preventDefault(): void; stopPropagation(): void }, refazer: () => void) => {
      const pode = podeFecharModal(true, () => {
        agendar(refazer);
        return false; // "ainda não pode sair" — o evento é interrompido
      }, AVISO_SAIDA);
      if (!pode) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // ── aviso ao sair sem salvar (link) ────────────────────────────────
    const noClique = (e: MouseEvent) => {
      if (silencioso() || !estaSujo()) return;
      const alvo = e.target as HTMLElement | null;
      const link = alvo?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      if (link.target === "_blank") return;
      const href = link.getAttribute("href") || "";
      if (href.startsWith("http") && !href.includes(window.location.host)) return;
      perguntar(e, () => {
        // re-executa o clique no link com a guarda desligada
        ignorarRef.current = true;
        window.setTimeout(() => {
          ignorarRef.current = false;
        }, 500);
        link.click();
      });
    };
    document.addEventListener("click", noClique, true);

    // o Radix fecha com clique no overlay (pointerdown fora do dialog)
    const noPointerFora = (e: PointerEvent) => {
      if (silencioso()) return;
      const dlg = dialogoSujo();
      if (!dlg) return;
      if (dlg.contains(e.target as Node)) return;
      // clique dentro de QUALQUER diálogo (inclusive o do aviso) não interfere
      if ((e.target as HTMLElement).closest?.('[role="dialog"]')) return;
      perguntar(e, refazerFechamento);
    };
    document.addEventListener("pointerdown", noPointerFora, true);

    // botão × do modal
    const noCliqueX = (e: MouseEvent) => {
      if (silencioso()) return;
      const dlg = dialogoSujo();
      if (!dlg || !dlg.contains(e.target as Node)) return;
      if (!ehFechadorDeModal(e.target as unknown as ElemLike)) return;
      perguntar(e, refazerFechamento);
    };
    document.addEventListener("click", noCliqueX, true);

    // Esc fecha o modal
    const noEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || silencioso()) return;
      if (!dialogoSujo()) return;
      perguntar(e, refazerFechamento);
    };
    document.addEventListener("keydown", noEsc, true);

    // ── aviso ao sair sem salvar (F5 / fechar aba) ─────────────────────
    const antesSair = (e: BeforeUnloadEvent) => {
      if (!estaSujo()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", antesSair);

    // limpa o marcador quando um botão de salvar é clicado com o mouse —
    // assim, depois de criar/salvar, o modal fecha sem perguntar
    const noBotao = (e: MouseEvent) => {
      const alvo = e.target as ElemLike | null;
      if (!alvo || !ehBotao(alvo)) return;
      limparSujo();
      const dlg = (e.target as HTMLElement).closest?.(
        '[role="dialog"]',
      ) as HTMLElement | null;
      if (dlg) delete dlg.dataset.sujo;
    };
    document.addEventListener("click", noBotao, true);

    return () => {
      document.removeEventListener("input", noInput, true);
      document.removeEventListener("change", noInput, true);
      document.removeEventListener("submit", noSubmit, true);
      document.removeEventListener("keydown", noKey);
      document.removeEventListener("click", noClique, true);
      document.removeEventListener("click", noBotao, true);
      document.removeEventListener("pointerdown", noPointerFora, true);
      document.removeEventListener("click", noCliqueX, true);
      document.removeEventListener("keydown", noEsc, true);
      window.removeEventListener("beforeunload", antesSair);
      limparSujo();
    };
  }, []);

  return (
    <Dialog
      open={!!pendencia}
      onOpenChange={(aberto) => {
        if (!aberto) responder(false);
      }}
    >
      <DialogContent className="bg-gray-800 border-gray-600 text-white sm:max-w-md rounded-xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-white text-lg">
            Suas alterações não foram salvas
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Você digitou informações que ainda não foram gravadas no sistema.
            O que deseja fazer?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => responder(false)}
            className="rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-700"
          >
            Continuar editando
          </button>
          <button
            type="button"
            onClick={() => responder(true)}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500"
          >
            Sair sem salvar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ehBotao(alvo: ElemLike): boolean {
  const tag = (alvo.tagName || "").toUpperCase();
  if (tag !== "BUTTON") return false;
  const texto = (alvo.textContent || "").replace(/\s+/g, " ").trim();
  return /^(salvar|criar|enviar|gravar|cadastrar|registrar|confirmar|publicar|gerar|atualizar|concluir|finalizar|aplicar)/i.test(
    texto,
  );
}
