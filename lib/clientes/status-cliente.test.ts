/**
 * 06/10 — dropdown de STATUS do cliente passa a ser
 * LEAD / PROSPECT / CLIENTE / CAPTADOR (pedido do João).
 *
 * O banco continua com valores antigos (ativo, churn, inativo) de antes da
 * troca; `opcoesStatus` acrescenta o valor ANTIGO atual como opção extra
 * quando ele não é um dos novos — assim ninguém perde dado nem vê o select
 * em branco.
 */
import { describe, it, expect } from "vitest";
import { opcoesStatus, STATUS_NOVOS } from "./status-cliente";

describe("opcoesStatus", () => {
  it("sem status salvo: só as 4 opções novas, na ordem pedida", () => {
    expect(opcoesStatus("")).toEqual([
      { valor: "lead", rotulo: "Lead" },
      { valor: "prospect", rotulo: "Prospect" },
      { valor: "cliente", rotulo: "Cliente" },
      { valor: "captador", rotulo: "Captador" },
    ]);
  });

  it("status antigo salvo vira opção extra (nada se perde)", () => {
    const opcoes = opcoesStatus("churn");
    expect(opcoes).toHaveLength(STATUS_NOVOS.length + 1);
    expect(opcoes[4]).toEqual({ valor: "churn", rotulo: "Churn (antigo)" });
  });

  it("status que já é novo não duplica", () => {
    expect(opcoesStatus("prospect")).toEqual(STATUS_NOVOS);
  });

  it("extra capitaliza o valor antigo (inativo → Inativo (antigo))", () => {
    const opcoes = opcoesStatus("inativo");
    expect(opcoes[4]).toEqual({ valor: "inativo", rotulo: "Inativo (antigo)" });
  });
});
