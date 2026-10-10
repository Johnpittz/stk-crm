/**
 * Gatilho da IA de conta (06/10): toda mensagem de cliente passa por
 * executarAutomacao — lá dentro, e SÓ quando a mensagem falar de conta,
 * dispara a identificação de oportunidades (MIMO + regras).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../ia/identificar-oportunidade", () => ({
  identificarOportunidadeDaConta: vi.fn(async () => ({ status: "ignorado" })),
}));
vi.mock("../ai-assistant", () => ({
  verificarIAAtivada: vi.fn(async () => false),
  responderComBase: vi.fn(async () => ({ texto: null, encaminhar: true })),
}));

import { executarAutomacao, type ParamsAutomacao } from "./resposta-automatica";
import { identificarOportunidadeDaConta } from "../ia/identificar-oportunidade";

const identificar = vi.mocked(identificarOportunidadeDaConta);

function params(mensagem: string): ParamsAutomacao {
  return {
    supabase: {} as never,
    telefone: "5562999990000",
    mensagem,
    instancia: "STK-3",
    nomeCliente: "Padaria Central",
    atendimentoId: "at1",
    tentarChatbot: async () => null,
    enviar: async () => ({ success: true, message_id: null }),
  };
}

beforeEach(() => {
  identificar.mockClear();
  identificar.mockResolvedValue({ status: "ignorado" });
});

describe("gatilho de identificação de conta na automação", () => {
  it("mensagem que fala de conta dispara a análise", async () => {
    await executarAutomacao(params("cliente mandou a fatura de luz"));
    expect(identificar).toHaveBeenCalledTimes(1);
    const arg = identificar.mock.calls[0][0];
    expect(arg.atendimentoId).toBe("at1");
    expect(arg.mensagem).toContain("fatura");
  });

  it("mensagem comum NÃO dispara (sem custo de IA)", async () => {
    await executarAutomacao(params("bom dia, pode ser amanhã?"));
    expect(identificar).not.toHaveBeenCalled();
  });

  it("falha na análise NUNCA derruba a automação da conversa", async () => {
    identificar.mockRejectedValueOnce(new Error("IA explodiu"));
    const r = await executarAutomacao(params("a conta veio 6 mil reais"));
    expect(r.responsavel).toBeTruthy(); // segue o fluxo normal (humano, IA off no teste)
  });

  it("mesmo quando o chatbot assume, a análise roda antes", async () => {
    const p = params("qual o valor da conta?");
    p.tentarChatbot = async () => "resposta_do_chatbot";
    const r = await executarAutomacao(p);
    expect(identificar).toHaveBeenCalledTimes(1);
    expect(r.action).toBe("resposta_do_chatbot");
  });
});
