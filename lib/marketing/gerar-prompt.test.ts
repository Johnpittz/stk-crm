import { describe, it, expect } from "vitest";
import { montarPromptArte, FORMATOS_ARTE } from "./gerar-prompt";

/**
 * PEDIDO 3 (11/10) — "grande prompt" guiado da tela de artes.
 *
 * O vendedor escolhe o TIPO de post, preenche assunto/texto/estilo e a
 * tela monta UM prompt pronto para o Gemini (Nano Banana) — aqui testa
 * o montador puro: formato com a proporção certa, texto exato exigido
 * da imagem, padrões quando ele não preenche estilo/observações.
 */
describe("montarPromptArte — o grande prompt guiado", () => {
  const base = {
    formato: "feed_insta",
    assunto: "Instalação de painéis solares",
    texto: "Economize até 40% na conta de luz",
  };

  it("cita o formato com a orientação/dimensões certas", () => {
    const p = montarPromptArte(base);
    expect(p).toContain("Feed do Instagram");
    expect(p).toContain("1080x1080");
  });

  it("exige o texto EXATO na imagem (o que o vendedor digitou)", () => {
    const p = montarPromptArte({ ...base, texto: "Promoção GD até sexta" });
    expect(p).toContain("Promoção GD até sexta");
    expect(p.toLowerCase()).toContain("exatamente");
  });

  it("usa estilo padrão quando ele não escolhe e inclui o assunto", () => {
    const p = montarPromptArte(base);
    expect(p.toLowerCase()).toContain("moderno");
    expect(p).toContain("Instalação de painéis solares");
  });

  it("só inclui observações quando foram preenchidas", () => {
    const sem = montarPromptArte(base);
    const com = montarPromptArte({ ...base, observacoes: "fundo azul escuro" });
    expect(sem).not.toContain("fundo azul escuro");
    expect(com).toContain("fundo azul escuro");
  });

  it("todos os formatos da tela existem no catálogo", () => {
    expect(Object.keys(FORMATOS_ARTE).sort()).toEqual([
      "banner",
      "facebook",
      "feed_insta",
      "story",
    ]);
    // story é o único vertical
    expect(FORMATOS_ARTE.story.orientacao).toContain("1080x1920");
  });
});
