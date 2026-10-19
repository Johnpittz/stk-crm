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
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";

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
          eq: () => ({
            order: async () => ({ data: supabaseMock.linhas, error: null }),
          }),
        }),
      }),
    }),
  }),
}));

type CardAnalisar = { id: string; arquivo: string | null };
const kanban = vi.hoisted(() => ({
  onAnalisar: null as ((c: CardAnalisar) => void) | null,
}));

vi.mock("./kanban-faturas", () => ({
  KanbanFaturas: (props: { onAnalisar?: (c: CardAnalisar) => void }) => {
    kanban.onAnalisar = props.onAnalisar ?? null;
    return <div data-testid="kanban-faturas" />;
  },
}));

import { AnaliseContaModal } from "./analise-conta-modal";

beforeEach(() => {
  supabaseMock.linhas = [];
  kanban.onAnalisar = null;
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

  it("reanálise: Analisar sem arquivo pede o arquivo e analisa ao chegar", async () => {
    // é o caso do F4: página reaberta, card em Recebida, arquivo não
    // guardado — clicar em Analisar tem que pedir o arquivo e seguir
    supabaseMock.linhas = [LINHA_RECEBIDA_HOJE];
    const fetchMock = vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.includes("/fatura")) {
        return { ok: true, json: async () => ({ cardCriado: false }) } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          resumo: { concessionaria: "EQUATORIAL", uc: "1" },
          salvo: false,
          oportunidades: [],
          abasCriadas: [],
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AnaliseContaModal clienteId="c1" onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Analisar conta/i }));

    // sem arquivo: NÃO chama a análise nem reclama com o vendedor
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(
      fetchMock.mock.calls.filter((c) => String(c[0]).includes("/analise-conta"))
        .length
    ).toBe(0);
    expect(screen.queryByText(/Escolha a foto/i)).toBeNull();

    // escolheu: registra e analisa em sequência, sem segundo clique
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "conta.pdf", { type: "application/pdf" })] },
    });
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.filter((c) => String(c[0]).includes("/analise-conta"))
          .length
      ).toBe(1);
    });
  });

  it("conta do dia com ARQUIVO GUARDADO: Analisar relê sem pedir arquivo", async () => {
    // pedido 19/10: reanalisar usa a fatura JÁ INSERIDA — sem escolher outra
    supabaseMock.linhas = [
      {
        id: "l1",
        dados: {
          dia: new Date().toISOString().slice(0, 10),
          competencia: "2026-10",
          fluxo: "recebida",
          arquivo: "c1/1-conta.pdf",
        },
      },
    ];
    const fetchMock = vi.fn(
      async (_url: unknown, _options?: RequestInit) =>
        ({
          ok: true,
          json: async () => ({
            resumo: { concessionaria: "EQUATORIAL", uc: "9" },
            salvo: false,
            oportunidades: [],
            abasCriadas: [],
          }),
        }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AnaliseContaModal clienteId="c1" onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Analisar conta/i }));

    // analisa DIRETO com a linha gravada — sem seletor de arquivo
    await waitFor(() => {
      const chamadas = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("/analise-conta")
      );
      expect(chamadas.length).toBe(1);
      const fd = chamadas[0][1]?.body as FormData;
      expect(fd.get("linha_id")).toBe("l1");
      expect(fd.get("arquivo")).toBeNull();
    });
    expect(screen.queryByText(/Sessão expirada/i)).toBeNull();
  });

  it("reanalisar pelo card: com arquivo guardado relê; sem arquivo, explica", async () => {
    supabaseMock.linhas = [LINHA_RECEBIDA_HOJE]; // linha sem arquivo guardado
    const fetchMock = vi.fn(
      async (_url: unknown, _options?: RequestInit) =>
        ({
          ok: true,
          json: async () => ({
            resumo: { uc: "7" },
            salvo: false,
            oportunidades: [],
            abasCriadas: [],
          }),
        }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AnaliseContaModal clienteId="c1" onClose={() => {}} />);
    await waitFor(() => expect(kanban.onAnalisar).toBeTruthy());

    // card COM arquivo guardado → relê sem escolher nada
    act(() => {
      kanban.onAnalisar!({ id: "l9", arquivo: "c1/9-conta.pdf" });
    });
    await waitFor(() => {
      const chamadas = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("/analise-conta")
      );
      expect(chamadas.length).toBe(1);
      expect((chamadas[0][1]?.body as FormData).get("linha_id")).toBe("l9");
    });

  });

  it("reanalisar card SEM arquivo guardado: explica e abre o seletor", async () => {
    // linha antiga (antes de guardarmos o arquivo): o card manda escolher
    // de novo — mas SEMPRE explicando o porquê, nunca calado
    supabaseMock.linhas = [LINHA_RECEBIDA_HOJE];
    const fetchMock = vi.fn(
      async (_url: unknown, _options?: RequestInit) =>
        ({ ok: true, json: async () => ({}) }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<AnaliseContaModal clienteId="c1" onClose={() => {}} />);
    await waitFor(() => expect(kanban.onAnalisar).toBeTruthy());

    act(() => {
      kanban.onAnalisar!({ id: "l8", arquivo: null });
    });
    await waitFor(() => expect(screen.getByText(/escolha o PDF/i)).toBeTruthy());
    // sem arquivo não analisa: nenhum POST a mais
    expect(
      fetchMock.mock.calls.filter((c) => String(c[0]).includes("/analise-conta"))
        .length
    ).toBe(0);
  });
});
