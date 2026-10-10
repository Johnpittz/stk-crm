/**
 * IA identifica oportunidades da CONTA (pedido do João, 06/10).
 *
 * Regras aprovadas:
 *  - "acima de 5K" = VALOR DA CONTA > R$ 5.000;
 *  - prioridade: se > 5K e Grupo B ao mesmo tempo → RECIEE;
 *  - conta do Grupo B (e até R$ 5.000) → GD;
 *  - caso contrário → não é oportunidade.
 *
 * A MIMO só EXTRAI os dados da conversa (valor, grupo); quem aplica a
 * regra é o código (determinístico e testável).
 */
import { describe, it, expect } from "vitest";
import {
  mensagemFalaDeConta,
  aplicarRegras,
  extrairAnalise,
  montarPromptClassificacao,
  LIMIAR_RECIEE,
} from "./classificar-conta";

describe("mensagemFalaDeConta — pré-filtro barato (sem chamar a IA)", () => {
  it("detecta conversa sobre conta/fatura/energia", () => {
    expect(mensagemFalaDeConta("cliente mandou a fatura de luz")).toBe(true);
    expect(mensagemFalaDeConta("minha conta veio R$ 6.200")).toBe(true);
    expect(mensagemFalaDeConta("consumo de 900 kWh no mês")).toBe(true);
    expect(mensagemFalaDeConta("a conta de energia subiu muito")).toBe(true);
    expect(mensagemFalaDeConta("tarifa da CEMIG está salgada")).toBe(true);
  });

  it("ignora conversa comum", () => {
    expect(mensagemFalaDeConta("bom dia, tudo bem?")).toBe(false);
    expect(mensagemFalaDeConta("pode ser amanhã às 14h")).toBe(false);
    expect(mensagemFalaDeConta("")).toBe(false);
  });
});

describe("aplicarRegras — a regra do João no código", () => {
  it("conta acima de R$ 5.000 → RECIEE", () => {
    const r = aplicarRegras({ achouConta: true, valorConta: 5000.01, grupo: "B" });
    expect(r.tipo).toBe("reciee");
    expect(r.motivo).toMatch(/5\.000/);
  });

  it("valor exatamente 5.000 NÃO é 'acima de 5K'", () => {
    const r = aplicarRegras({ achouConta: true, valorConta: 5000, grupo: "A" });
    expect(r.tipo).toBeNull();
  });

  it("Grupo B até 5.000 → GD", () => {
    const r = aplicarRegras({ achouConta: true, valorConta: 3200, grupo: "B" });
    expect(r.tipo).toBe("gd");
  });

  it("Grupo A até 5.000 → não é oportunidade", () => {
    const r = aplicarRegras({ achouConta: true, valorConta: 3200, grupo: "A" });
    expect(r.tipo).toBeNull();
  });

  it("sem valor mas Grupo B → GD (regra do grupo vale sozinha)", () => {
    const r = aplicarRegras({ achouConta: true, valorConta: null, grupo: "B" });
    expect(r.tipo).toBe("gd");
  });

  it("sem conta encontrada → nada", () => {
    const r = aplicarRegras({ achouConta: false, valorConta: null, grupo: null });
    expect(r.tipo).toBeNull();
  });

  it("limiar ficou em 5.000 (constante única)", () => {
    expect(LIMIAR_RECIEE).toBe(5000);
  });
});

describe("extrairAnalise — resposta da MIMO em vários formatos", () => {
  it("JSON puro", () => {
    expect(
      extrairAnalise('{"achouConta":true,"valorConta":6100,"grupo":"B"}'),
    ).toEqual({ achouConta: true, valorConta: 6100, grupo: "B" });
  });

  it("JSON dentro de bloco de código", () => {
    const texto = "Aqui está:\n```json\n{\"achouConta\":true,\"valorConta\":2900,\"grupo\":\"B\"}\n```";
    expect(extrairAnalise(texto)).toEqual({
      achouConta: true,
      valorConta: 2900,
      grupo: "B",
    });
  });

  it("resposta sem JSON / inválida → não achou conta (nunca lança)", () => {
    expect(extrairAnalise("não identifiquei nada")).toEqual({
      achouConta: false,
      valorConta: null,
      grupo: null,
    });
    expect(extrairAnalise("{quebrado")).toEqual({
      achouConta: false,
      valorConta: null,
      grupo: null,
    });
  });

  it("normaliza grupo texto ('grupo b') e valor com R$/ponto", () => {
    expect(
      extrairAnalise('{"achouConta":true,"valorConta":"5.400,90","grupo":"Grupo B"}'),
    ).toEqual({ achouConta: true, valorConta: 5400.9, grupo: "B" });
  });
});

describe("montarPromptClassificacao — o que a MIMO recebe", () => {
  it("traz a conversa, o cliente e pede JSON no formato certo", () => {
    const p = montarPromptClassificacao({
      nomeCliente: "Padaria Central",
      mensagem: "nossa conta veio 6.300 reais",
      historico: [{ remetente: "cliente", conteudo: "bom dia" }],
    });
    expect(p).toContain("Padaria Central");
    expect(p).toContain("nossa conta veio 6.300 reais");
    expect(p).toContain("JSON");
    expect(p).toContain("valorConta");
    expect(p).toContain("grupo");
  });
});
