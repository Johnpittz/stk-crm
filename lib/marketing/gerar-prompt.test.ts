import { describe, it, expect } from "vitest";
import { montarPromptArte, montarPartesImagem, FORMATOS_ARTE } from "./gerar-prompt";

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

  it("MELHORIA 12/10: marker {{logo}} vira parte inlineData na posição certa", () => {
    const p = montarPromptArte({
      ...base,
      observacoes: "usar o logo {{logo_stk}} no canto",
    });
    const partes = montarPartesImagem(p, [
      { marker: "logo_stk", data: "TUxD", mimeType: "image/png" },
    ]);
    // [texto antes] [imagem] [texto depois]
    expect(partes).toHaveLength(3);
    expect(partes[0]).toMatchObject({ text: expect.any(String) });
    // API do Gemini NÃO aceita campo extra nas partes
    expect(JSON.stringify(partes)).not.toContain('"type"');
    expect((partes[1] as any).inlineData.data).toBe("TUxD");
    expect(String((partes[2] as any).text)).toContain("no canto");
    // o texto não pode mais conter o marcador literal
    expect(JSON.stringify(partes)).not.toContain("{{logo_stk}}");
  });

  it("MELHORIA 12/10: referência não citada vai na frente mesmo assim", () => {
    const partes = montarPartesImagem(montarPromptArte(base), [
      { marker: "logo_stk", data: "AAA", mimeType: "image/png" },
      { marker: "produto", data: "BBB", mimeType: "image/jpeg" },
    ]);
    expect((partes[0] as any).inlineData.data).toBe("AAA");
    expect((partes[1] as any).inlineData.data).toBe("BBB");
    expect((partes[2] as any).text).toContain("Feed do Instagram");
  });

  it("MELHORIA 12/10: sem referências → só o texto; marker desconhecido fica no texto", () => {
    const soTexto = montarPartesImagem("prompt aqui", []);
    expect(soTexto).toEqual([{ text: "prompt aqui" }]);
    const comDesconhecido = montarPartesImagem("olhe {{outra}} coisa", [
      { marker: "logo_stk", data: "CCC", mimeType: "image/png" },
    ]);
    expect(JSON.stringify(comDesconhecido)).toContain("{{outra}}");
    expect(JSON.stringify(comDesconhecido)).not.toContain("{{logo_stk}}");
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
