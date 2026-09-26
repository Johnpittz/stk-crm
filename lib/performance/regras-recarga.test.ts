import { describe, it, expect } from "vitest";
import {
  deveBuscarContatos,
  silenciosoNaRecarga,
  deveRefazerOportunidades,
} from "./regras-recarga";

/**
 * Regras de recarga da tela — medida em produção em 26/09 (HANDOFF §8):
 *
 * - Entrada no Atendimento: `page-data` saía 2× (1.655 ms + 1.092 ms) porque DOIS
 *   efeitos o disparavam; a página só ficava "pronta" em 1,77–2,02 s.
 * - Entrada no Kanban: `/api/oportunidades` saía 3× (759/632/328 ms).
 * - `whatsapp/contacts` (100 contatos, 786 ms) era buscado na montagem com o
 *   modal FECHADO, sem exibir nada, competindo com o carregamento principal.
 */

describe("deveBuscarContatos — modal de contatos do WhatsApp", () => {
  it("modal fechado: NÃO busca (era a chamada de 786 ms na entrada da tela)", () => {
    expect(deveBuscarContatos(false)).toBe(false);
  });

  it("modal aberto: busca, que é quando a lista aparece", () => {
    expect(deveBuscarContatos(true)).toBe(true);
  });
});

describe("silenciosoNaRecarga — loading na tela", () => {
  it("primeira carga mostra o loading", () => {
    expect(silenciosoNaRecarga(false)).toBe(false);
  });

  it("recargas seguintes são em silêncio (a tela não pisca)", () => {
    expect(silenciosoNaRecarga(true)).toBe(true);
    expect(silenciosoNaRecarga(true)).toBe(true);
  });
});

describe("deveRefazerOportunidades — Kanban não repete a chamada na montagem", () => {
  const onRefresh = () => {};

  it("montagem (deps mudaram sem dado novo) não refaz — já buscou no efeito da montagem", () => {
    const mesmo = [] as unknown[];
    expect(deveRefazerOportunidades(mesmo, mesmo, onRefresh)).toBe(false);
  });

  it("primeira chegada de atendimentos (vazio → dados) não refaz — oportunidades acabaram de ser buscadas", () => {
    expect(deveRefazerOportunidades([], [{ id: "a" }], onRefresh)).toBe(false);
  });

  it("mudança posterior de atendimentos refaz (as conversas mudaram)", () => {
    expect(deveRefazerOportunidades([{ id: "a" }], [{ id: "a" }, { id: "b" }], onRefresh)).toBe(true);
    expect(deveRefazerOportunidades([{ id: "a" }, { id: "b" }], [{ id: "a" }], onRefresh)).toBe(true);
  });

  it("sem onRefresh na tela, nada a refazer", () => {
    expect(deveRefazerOportunidades([{ id: "a" }], [{ id: "a" }, { id: "b" }], undefined)).toBe(false);
  });
});
