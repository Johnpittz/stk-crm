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

  it("MELHORIA 13/10: cada formato tem o aspectRatio pra API do Gemini", () => {
    expect(FORMATOS_ARTE.feed_insta.aspectRatio).toBe("1:1");
    expect(FORMATOS_ARTE.story.aspectRatio).toBe("9:16");
    expect(FORMATOS_ARTE.facebook.aspectRatio).toBe("1:1");
    expect(FORMATOS_ARTE.banner.aspectRatio).toBe("16:9");
  });

  it("todos os formatos da tela existem no catálogo e no Gemini", () => {
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

describe("montarPromptArte — REFORMULACAO 24/11 (campos novos + prompt base)", () => {
  const base = {
    formato: "feed_insta",
    assunto: "Promocao de fim de ano",
    texto: "30% OFF",
  };

  it("inclui o OBJETIVO quando preenchido e omite quando vazio", () => {
    const com = montarPromptArte({ ...base, objetivo: "Criar anúncio (pago)" });
    expect(com).toContain("Objetivo: Criar anúncio (pago)");
    expect(montarPromptArte(base)).not.toContain("Objetivo:");
  });

  it("inclui o que mais adicionar (extra) e a cor de preferencia", () => {
    const p = montarPromptArte({ ...base, extra: "QR code no canto", cor: "Azul" });
    expect(p).toContain("Adicionar na arte: QR code no canto");
    expect(p).toContain("Cor predominante: Azul");
  });

  it("digital/impresao entra; resolucao SO quando for impressao", () => {
    const digital = montarPromptArte({ ...base, meio: "Digital" });
    expect(digital).toContain("Uso: Digital");
    expect(digital).not.toContain("Resolução:");

    const imp = montarPromptArte({
      ...base,
      meio: "Impressão",
      resolucao: "300 DPI — impressão profissional",
    });
    expect(imp).toContain("Resolução: 300 DPI — impressão profissional");
  });

  it("inclui humano ou equipamento quando escolhido", () => {
    const p = montarPromptArte({ ...base, sujeito: "Humano (pessoa)" });
    expect(p).toContain("Aparece na arte: Humano (pessoa)");
    expect(montarPromptArte(base)).not.toContain("Aparece na arte");
  });

  it("prompt base tem as regras de qualidade do mercado", () => {
    const p = montarPromptArte(base).toLowerCase();
    expect(p).toContain("não invente textos");
    expect(p).toContain("margem de segurança");
    expect(p).toContain("sem letras cortadas");
  });
});
