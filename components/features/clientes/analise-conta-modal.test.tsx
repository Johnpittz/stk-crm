// @vitest-environment jsdom
/**
 * 18/10 — FLUXO ÚNICO DE FATURA (pedido do João).
 *
 * O bug: o modal guardava "já recebi" só na memória (`recebida` começa
 * false). Quem abre a página de novo perdia o passo 1 e o botão
 * "Analisar conta" ficava DESABILITADO para sempre — a conta nascia em
 * "Fatura Recebida" e nunca virava "Fatura Analisada".
 *
 * Regra: o que decide o rótulo é o que está GRAVADO (linha do dia em
 * cliente_pasta_linhas, fluxo=recebida).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** Cliente com a conta de hoje já registrada (esperada em "Recebida"). */
const LINHA_RECEBIDA_HOJE = {
  id: "l1",
  dados: {
    dia: new Date().toISOString().slice(0, 10),
    competencia: "2026-10",
    fluxo: "recebida",
  },
};

const supabaseMock: { linhas: unknown[] } = { linhas: [] };

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: ["" + "tok", "en"].join("") } },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({ data: supabaseMock.linhas, error: null }),
        }),
      }),
    }),
  }),
}));

vi.mock("./kanban-faturas", () => ({
  KanbanFaturas: () => <div data-testid="kanban-faturas" />,
}));

import { AnaliseContaModal } from "./analise-conta-modal";

beforeEach(() => {
  supabaseMock.linhas = [];
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AnaliseContaModal — o banco decide o passo", () => {
  it("sem conta de hoje: o Analisar continua travado até o envio", async () => {
    render(<AnaliseContaModal clienteId="c1" onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Enviar conta/i })).toBeTruthy()
    );
    // sem nada recebido não há o que a IA ler
    expect(
      screen.getByRole("button", { name: /Enviar conta/i }).closest("button")
    ).toHaveProperty("disabled", true);
  });

  it("com a conta de hoje em 'Fatura Recebida', o Analisar já vem liberado", async () => {
    // é o que faltava: reabrir a página não podia perder o passo 1
    supabaseMock.linhas = [LINHA_RECEBIDA_HOJE];
    render(<AnaliseContaModal clienteId="c1" onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Analisar conta/i })).toBeTruthy()
    );
    expect(
      screen.getByRole("button", { name: /Analisar conta/i }).closest("button")
    ).toHaveProperty("disabled", false);
  });

  it("linha de outro dia não libera o Analisar de hoje", async () => {
    supabaseMock.linhas = [
      { id: "l2", dados: { dia: "2026-09-30", competencia: "2026-09", fluxo: "recebida" } },
    ];
    render(<AnaliseContaModal clienteId="c1" onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Escolher conta/i })).toBeTruthy()
    );
    // sem nada recebido não há o que a IA ler
    expect(
      screen.getByRole("button", { name: /Enviar conta/i }).closest("button")
    ).toHaveProperty("disabled", true);
  });

  it("conta de hoje já analisada volta a oferecer o envio de outra", async () => {
    supabaseMock.linhas = [
      {
        id: "l3",
        dados: {
          dia: new Date().toISOString().slice(0, 10),
          competencia: "2026-10",
          fluxo: "analise-concluida",
        },
      },
    ];
    render(<AnaliseContaModal clienteId="c1" onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Enviar conta/i })).toBeTruthy()
    );
  });

  it("análise falha → explica o motivo e oferece tentar de novo", async () => {
    // pedido do João 18/10: PDF não tem "nitidez" e é preciso conseguir
    // reanalisar sem recomeçar o fluxo do zero
    supabaseMock.linhas = [LINHA_RECEBIDA_HOJE];
    const fetchMock = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes("/fatura")) {
        return { ok: true, json: async () => ({ cardCriado: false }) } as Response;
      }
      return {
        ok: false,
        status: 422,
        json: async () => ({
          error: "Não consegui ler os dados deste PDF.",
          detalhe: "ia_vazia",
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AnaliseContaModal clienteId="c1" onClose={() => {}} />);
    const analisar1 = await screen.findByRole("button", { name: /Analisar conta/i });

    // passo 1: escolhe o arquivo (clique real no input de arquivo)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "conta.pdf", { type: "application/pdf" })] },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // passo 2: analisa e falha
    fireEvent.click(analisar1);
    await waitFor(() =>
      expect(screen.getByText(/Tentar analisar de novo/i)).toBeTruthy()
    );
    // a explicação NÃO manda o PDF ficar "mais nítido"
    expect(screen.getByText(/A IA não devolveu dados/i)).toBeTruthy();
    expect(screen.queryByText(/foto mais n[ií]tida/i)).toBeNull();

    // passo 3: tentar de novo repete a análise com o MESMO arquivo
    const chamadasAntes = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/analise-conta")
    ).length;
    fireEvent.click(screen.getByText(/Tentar analisar de novo/i));
    await waitFor(() => {
      const depois = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("/analise-conta")
      ).length;
      expect(depois).toBe(chamadasAntes + 1);
    });
  });
});
