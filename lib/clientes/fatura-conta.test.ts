/**
 * PARTE 11 (PPTX 17/10) — fatura anexada no cadastro/edição já cai em
 * GESTÃO DE FATURA. Puro: do texto do PDF acha valor/consumo e monta a
 * competência; a rota só grava a linha.
 */
import { describe, expect, it } from "vitest";
import {
  competenciaAtual,
  deveCriarCardFatura,
  extrairDadosConta,
  montarLinhaGestaoFatura,
} from "./fatura-conta";

describe("competenciaAtual", () => {
  it("fica no formato AAAA-MM", () => {
    expect(competenciaAtual(new Date("2026-10-17T12:00:00"))).toBe("2026-10");
    expect(competenciaAtual(new Date("2026-02-01T12:00:00"))).toBe("2026-02");
  });
});

describe("extrairDadosConta", () => {
  it("acha valor total e consumo no texto da fatura", () => {
    const texto = [
      "CELNOR DISTRIBUICAO",
      "CONSUMO 342 kWh",
      "TARIFA APLICADA R$ 0,98",
      "TOTAL A PAGAR R$ 1.234,56",
    ].join("\n");
    const r = extrairDadosConta(texto);
    expect(r.valor).toBe(1234.56);
    expect(r.consumo).toBe(342);
  });

  it("aceita 'VALOR TOTAL' e valor com ponto (padrão API)", () => {
    const r = extrairDadosConta("CONSUMO: 100 kWh\nVALOR TOTAL: R$ 89.90");
    expect(r.valor).toBe(89.9);
    expect(r.consumo).toBe(100);
  });

  it("acha valor mascarado com asteriscos (CROPS: R$*******4.687,56)", () => {
    // achado no teste de usabilidade 18/10: a capa da fatura Equatorial
    // traz o valor protegido por asteriscos e o Upload não extraía nada
    const t = "01/10/2023 31 Tipo de Fornecimento: TRIFÁSICO\n" +
      "TOTAL A PAGAR R$*******4.687,56\nConsumo: 5334,96 kWh";
    const d = extrairDadosConta(t);
    expect(d.valor).toBe(4687.56);
    expect(d.consumo).toBe(5334.96);
  });

  it("acha valor mascarado SEM rótulo (fatura Equatorial só traz R$*******4.687,56)", () => {
    // achado no teste de usabilidade 18/10: a capa não tem "TOTAL A PAGAR";
    // o único cifrão com asteriscos é o valor protegido
    const t = "POLO EMPRESARIAL GOIAS CEP: 74000000 0 % R$*******4.687,56 04/10/2023";
    expect(extrairDadosConta(t).valor).toBe(4687.56);
  });

  it("sem dados devolve null (nunca lança)", () => {
    const r = extrairDadosConta("página em branco");
    expect(r.valor).toBeNull();
    expect(r.consumo).toBeNull();
  });
});

describe("deveCriarCardFatura (pedido 18/10)", () => {
  it("cria card quando o cliente ainda não tem card em RECEBEU A CONTA", () => {
    expect(deveCriarCardFatura([])).toBe(true);
  });

  it("não duplica quando já existe card na etapa", () => {
    expect(deveCriarCardFatura([{ id: "x", etapa: "recebeu_conta" }])).toBe(false);
  });

  it("cards em outras etapas não bloqueiam", () => {
    expect(deveCriarCardFatura([{ id: "x", etapa: "proposta_feita" }])).toBe(true);
  });
});

describe("montarLinhaGestaoFatura", () => {
  it("monta a linha da pasta com competência e situação Pendente", () => {
    const l = montarLinhaGestaoFatura({ competencia: "2026-10", valor: 10, consumo: 5 });
    expect(l.linha).toBe("gestao_fatura");
    expect(l.dados.competencia).toBe("2026-10");
    expect(l.dados.valor).toBe(10);
    expect(l.dados.consumo_kwh).toBe(5);
    expect(l.dados.situacao).toBe("Pendente");
  });

  it("valor/consumo nulos ainda montam a linha (falta análise)", () => {
    const l = montarLinhaGestaoFatura({ competencia: "2026-10", valor: null, consumo: null });
    expect(l.dados.competencia).toBe("2026-10");
    expect(l.dados.valor).toBeNull();
  });
});
