/**
 * PARTE 11 (PPTX 17/10) — fatura anexada no cadastro/edição já cai em
 * GESTÃO DE FATURA. Puro: do texto do PDF acha valor/consumo e monta a
 * competência; a rota só grava a linha.
 */
import { describe, expect, it } from "vitest";
import {
  competenciaAtual,
  deveCriarCardFatura,
  cardsFunilFaltando,
  montarCadastroUnificado,
  extrairDadosConta,
  montarLinhaGestaoFatura,
  marcarComoAnalisada,
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
  it("cria card quando o cliente não tem o rótulo 'Fatura Recebida'", () => {
    expect(deveCriarCardFatura([])).toBe(true);
    expect(deveCriarCardFatura([{ id: "x", etapa: "recebeu_conta", titulo: "Ligar" }])).toBe(true);
  });

  it("não duplica quando o rótulo já existe (mesmo em outra coluna)", () => {
    expect(
      deveCriarCardFatura([{ id: "x", etapa: "recebeu_conta", titulo: "Fatura Recebida" }])
    ).toBe(false);
    expect(
      deveCriarCardFatura([{ id: "x", etapa: "contrato_enviado", titulo: "Fatura Recebida" }])
    ).toBe(false);
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

  it("a linha guarda o dia em que a conta chegou", () => {
    // 18/10: uma conta por DIA. Sem o dia gravado, duas contas do mesmo
    // mês ficam indistinguíveis e o card antigo voltava pra coluna errada.
    const l = montarLinhaGestaoFatura({
      competencia: "2026-10",
      valor: 10,
      consumo: 5,
      dia: "2026-10-18",
    });
    expect(l.dados.dia).toBe("2026-10-18");
  });

  it("sem dia informado, grava o dia de hoje", () => {
    const l = montarLinhaGestaoFatura({ competencia: "2026-10", valor: 10, consumo: 5 });
    expect(String(l.dados.dia)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("valor/consumo nulos ainda montam a linha (falta análise)", () => {
    const l = montarLinhaGestaoFatura({ competencia: "2026-10", valor: null, consumo: null });
    expect(l.dados.competencia).toBe("2026-10");
    expect(l.dados.valor).toBeNull();
  });
});

// 18/10 — FLUXO ÚNICO (pedido do João): o botão é só "Análise da Fatura".
// A fatura entra como RECEBIDA no kanban de faturas e, quando a IA termina,
// vira ANALISADA guardando o resumo lido.
describe("kanban de faturas (recebida → analisada)", () => {
  it("montarLinhaGestaoFatura nasce marcada como recebida", () => {
    const l = montarLinhaGestaoFatura({ competencia: "2026-10", valor: 10, consumo: 5 });
    expect(l.dados.fluxo).toBe("recebida");
    expect(l.dados.resumo_analise).toBeNull();
  });

  it("marcarComoAnalisada guarda o resumo e vira analisada", () => {
    const l = montarLinhaGestaoFatura({ competencia: "2026-10", valor: null, consumo: null });
    const r = marcarComoAnalisada(l.dados, {
      concessionaria: "Equatorial",
      uc: "12345678",
      titular: "João",
      cnpj_cpf: "000.000.000-00",
      vencimento: "10",
      consumo: "342",
      valor: "R$ 1.234,56",
    });
    expect(r.fluxo).toBe("analise-concluida");
    expect(l.dados.fluxo).toBe("recebida");
    expect((r.resumo_analise as { concessionaria?: string }).concessionaria).toBe("Equatorial");
    expect((r.resumo_analise as { valor?: string }).valor).toBe("R$ 1.234,56");
  });

  it("marcarComoAnalisada preenche valor/consumo quando a linha não tinha", () => {
    const l = montarLinhaGestaoFatura({ competencia: "2026-10", valor: null, consumo: null });
    const r = marcarComoAnalisada(l.dados, {
      concessionaria: null, uc: null, titular: null, cnpj_cpf: null,
      vencimento: null, consumo: "100", valor: "R$ 89,90",
    });
    expect(r.valor).toBe(89.9);
    expect(r.consumo_kwh).toBe(100);
  });

  it("marcarComoAnalisada não apaga valor já lido do PDF", () => {
    const l = montarLinhaGestaoFatura({ competencia: "2026-10", valor: 4687.56, consumo: null });
    const r = marcarComoAnalisada(l.dados, {
      concessionaria: null, uc: null, titular: null, cnpj_cpf: null,
      vencimento: null, consumo: "512", valor: null,
    });
    expect(r.valor).toBe(4687.56);
    expect(r.consumo_kwh).toBe(512);
  });
});

// 19/10 — os DOIS cards da conta moram em RECEBEU A CONTA (pedido do João):
// a coluna conta a história da fatura (chegou / foi analisada). A checagem é
// por RÓTULO: se o vendedor arrastar um card pra outra coluna, não duplica.
describe("cardsFunilFaltando — os dois cards ficam em Recebeu a Conta", () => {
  it("sem card nenhum → faltam os dois", () => {
    expect(cardsFunilFaltando([])).toEqual(["recebida", "analisada"]);
  });

  it("só a recebida existe → falta a analisada", () => {
    expect(
      cardsFunilFaltando([{ etapa: "recebeu_conta", titulo: "Fatura Recebida" }])
    ).toEqual(["analisada"]);
  });

  it("os dois já em Recebeu a Conta → não cria nada", () => {
    expect(
      cardsFunilFaltando([
        { etapa: "recebeu_conta", titulo: "Fatura Recebida" },
        { etapa: "recebeu_conta", titulo: "Fatura Analisada" },
      ])
    ).toEqual([]);
  });

  it("vendedor arrastou o card de analisada pra outra coluna → não duplica", () => {
    expect(
      cardsFunilFaltando([
        { etapa: "recebeu_conta", titulo: "Fatura Recebida" },
        { etapa: "contrato_enviado", titulo: "Fatura Analisada" },
      ])
    ).toEqual([]);
  });

  it("tarefa qualquer na coluna não conta como conta", () => {
    expect(
      cardsFunilFaltando([{ etapa: "recebeu_conta", titulo: "Ligar pra Maria" }])
    ).toEqual(["recebida", "analisada"]);
  });
});

// 19/10 — a listagem de clientes vem da view unificada (v_unified_clientes);
// muitos clientes SÓ existem lá. Sem linha em `clientes`, o banco recusa o
// card do funil (FK) e o quadro do João ficava zerado pra sempre.
describe("montarCadastroUnificado — enriquece o cadastro (mesmo id)", () => {
  it("sem cadastro e com nome na view → payload com o MESMO id", () => {
    expect(montarCadastroUnificado("abc-123", { nome: "João Pedro" })).toEqual({
      id: "abc-123",
      nome_razao_social: "João Pedro",
    });
  });

  it("view sem nome → segue com nome neutro (nada impede o card)", () => {
    expect(montarCadastroUnificado("abc-123", { nome: "   " })).toEqual({
      id: "abc-123",
      nome_razao_social: "Cliente sem nome",
    });
  });

  it("nem na view → null (deixa o fluxo normal tratar)", () => {
    expect(montarCadastroUnificado("abc-123", null)).toBeNull();
  });
});
