/**
 * ITEM 3 (16/10) — GERAR ARTES: texto extra (número, opções do cadastro
 * tipo "orçamento grátis") + ONDE colocar na imagem (canto superior,
 * rodapé...). Aqui: a montagem da linha do prompt.
 */

import { describe, expect, it } from "vitest";
import { montarTextoImagem, POSICOES_ARTE } from "./textos-imagem";

describe("montarTextoImagem (item 3)", () => {
  it("sem número e sem opções não acrescenta nada", () => {
    expect(montarTextoImagem("", [], "rodape")).toBe("");
    expect(montarTextoImagem("   ", ["  "], "inf_dir")).toBe("");
  });

  it("só com o número cadastrado", () => {
    const r = montarTextoImagem("WhatsApp (62) 99999-8888", [], "automatica");
    expect(r).toContain('"WhatsApp (62) 99999-8888"');
    expect(r).toContain("exatamente");
  });

  it("número + opções, com a posição pedida", () => {
    const r = montarTextoImagem("62 99999-8888", ["Orçamento grátis", "Atendimento 24h"], "rodape");
    expect(r).toContain('"62 99999-8888"');
    expect(r).toContain('"Orçamento grátis"');
    expect(r).toContain('"Atendimento 24h"');
    expect(r).toContain("rodapé");
  });

  it("posição inválida cai no automático", () => {
    const r = montarTextoImagem("62 99999-8888", [], "qualquer_coisa");
    expect(r).toContain(POSICOES_ARTE.automatica);
  });
});
