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
// (PEDIDO 2) os mocks logo acima já controlam estes dois
import { identificarOportunidadeDaConta } from "../ia/identificar-oportunidade";
import { verificarIAAtivada, responderComBase } from "../ai-assistant";

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

  it("mensagem de IMAGEM dispara a análise mesmo sem palavra de conta", async () => {
    await executarAutomacao({
      ...params("[image]"),
      midia: { url: "https://x/m.png", tipo: "image" },
    })
    expect(identificarOportunidadeDaConta).toHaveBeenCalledTimes(1)
    const arg = (identificarOportunidadeDaConta as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(arg.midia?.tipo).toBe("image")
  })

  it("mídia de áudio/vídeo não dispara (não é conta)", async () => {
    await executarAutomacao({
      ...params("[audio]"),
      midia: { url: "https://x/a.ogg", tipo: "audio" },
    })
    expect(identificarOportunidadeDaConta).not.toHaveBeenCalled()
  })

  it("falha na análise nunca derruba a automação", async () => {
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

describe("PEDIDO 2 — a IA recebe a base do vendedor dono do atendimento", () => {
  it("passa vendedorId (lido do atendimento) para responderComBase", async () => {
    vi.mocked(verificarIAAtivada).mockResolvedValueOnce(true);
    const supabaseStub = {
      from: (t: string) =>
        t === "atendimentos"
          ? {
              select: () => ({
                eq: () => ({
                  single: async () => ({ data: { vendedor_id: "ven-9" }, error: null }),
                }),
              }),
            }
          : { insert: async () => ({ error: null }) },
    };
    await executarAutomacao({ ...params("olá, bom dia"), supabase: supabaseStub as never });

    expect(responderComBase).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(responderComBase).mock.calls[0][0] as { vendedorId?: string | null };
    expect(arg.vendedorId).toBe("ven-9");
    vi.mocked(verificarIAAtivada).mockClear();
    vi.mocked(responderComBase).mockClear();
  });
});
