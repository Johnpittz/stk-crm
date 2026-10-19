import { describe, expect, it } from "vitest";
import { caminhoArquivoFatura } from "./arquivo-fatura";

describe("caminhoArquivoFatura — onde o PDF da conta é guardado", () => {
  it("guarda por cliente, com timestamp e nome legível", () => {
    expect(caminhoArquivoFatura("CLI1", "conta outubro.pdf", 176)).toBe(
      "CLI1/176-conta_outubro.pdf"
    );
  });

  it("nome sujo não quebra o caminho (só [A-Za-z0-9._-] sobrevive)", () => {
    const p = caminhoArquivoFatura("CLI1", "conta (1).pdf", 5);
    expect(p).toBe("CLI1/5-conta__1_.pdf");
    expect(/[()]/.test(p)).toBe(false);
  });

  it("nome sem letras/dígitos vira conta.pdf e nunca lança erro", () => {
    expect(caminhoArquivoFatura("CLI1", "", 2)).toBe("CLI1/2-conta.pdf");
    expect(caminhoArquivoFatura("CLI1", "///", 3)).toBe("CLI1/3-conta.pdf");
  });

  it("nome gigante não estoura o limite do Storage", () => {
    const p = caminhoArquivoFatura("CLI1", `${"a".repeat(400)}.pdf`, 7);
    expect(p.length).toBeLessThanOrEqual("CLI1/".length + 20 + 1 + 90);
    expect(p.endsWith(".pdf")).toBe(true);
  });
});
