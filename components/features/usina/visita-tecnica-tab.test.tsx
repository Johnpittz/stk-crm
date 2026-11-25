// @vitest-environment jsdom
/**
 * 25/11/2026 — Fase2-C: aba "Visita Técnica" da pasta do cliente
 * (checklist de visita técnica, no espírito do checklist de homologação
 * da Reonic).
 *
 * Cobre: os 6 itens típicos + progresso "X/Y completo", checkbox marcando,
 * nota opcional por item, PERSISTÊNCIA em `cliente_pasta_linhas`
 * (linha="visita_tecnica" — tabela já existe, sem migration: insert na
 * primeira visita e update nas seguintes) e o botão de upload ainda
 * desabilitado (bucket da análise de conta é privado/só service role).
 *
 * Sem jest-dom: o projeto não tem os matchers — asserções nativas.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";

/**
 * Estado do supabase falso: `linhas` é o que o SELECT devolve (o
 * componente relê na abertura), `inserts`/`updates` guardam o payload do
 * Salvar para o teste de persistência.
 */
const supabaseMock: {
  linhas: { id: string; cliente_id: string; linha: string; dados: any }[];
  inserts: any[];
  updates: any[];
  /** simula erro do banco (ex.: check constraint da coluna `linha`) */
  falhar: boolean;
} = { linhas: [], inserts: [], updates: [], falhar: false };

function responder(b: any) {
  if (supabaseMock.falhar) {
    return { data: null, error: { message: "violates check constraint" } };
  }
  if (b.payload?.tipo === "insert") {
    supabaseMock.inserts.push(b.payload.dados);
    const linha = {
      id: `reg-${supabaseMock.inserts.length}`,
      cliente_id: b.payload.dados.cliente_id,
      linha: b.payload.dados.linha,
      dados: b.payload.dados.dados,
    };
    supabaseMock.linhas.push(linha);
    return { data: linha, error: null };
  }
  if (b.payload?.tipo === "update") {
    supabaseMock.updates.push(b.payload.dados);
    return { data: null, error: null };
  }
  return { data: [...supabaseMock.linhas], error: null };
}

/** builder encadeável do supabase: resolve quando o componente dá `await`. */
function builder() {
  const b: any = { ops: [] as any[], payload: null as any };
  const encadear = (nome: string) =>
    (...args: any[]) => {
      b.ops.push([nome, args]);
      return b;
    };
  b.select = encadear("select");
  b.eq = encadear("eq");
  b.order = encadear("order");
  b.single = encadear("single");
  b.insert = (dados: any) => {
    b.ops.push(["insert", [dados]]);
    b.payload = { tipo: "insert", dados };
    return b;
  };
  b.update = (dados: any) => {
    b.ops.push(["update", [dados]]);
    b.payload = { tipo: "update", dados };
    return b;
  };
  b.then = (ok: any, err: any) => Promise.resolve(responder(b)).then(ok, err);
  return b;
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ from: () => builder() }),
}));

import { VisitaTecnicaTab, ITENS_VISITA } from "./visita-tecnica-tab";

beforeEach(() => {
  supabaseMock.linhas = [];
  supabaseMock.inserts = [];
  supabaseMock.updates = [];
  supabaseMock.falhar = false;
});

afterEach(() => cleanup());

/** campo de nota opcional de um item (aria-label "<item> — nota"). */
const notaDe = (rotulo: string) =>
  screen.getByLabelText(new RegExp(`${rotulo} — nota`, "i")) as HTMLInputElement;

const botaoSalvar = () =>
  screen.getByRole("button", { name: /salvar checklist/i }) as HTMLButtonElement;

/** espera o load inicial terminar (o Salvar só libera depois dele). */
async function aguardarPronto() {
  await waitFor(() =>
    expect(screen.queryByText(/abrindo o checklist salvo/i)).toBeNull()
  );
}

describe("VisitaTecnicaTab — checklist", () => {
  it("renderiza os 6 itens típicos com progresso 0/6 completo", () => {
    render(<VisitaTecnicaTab clienteId="cli-1" />);
    expect(ITENS_VISITA.length).toBe(6);
    expect(screen.getByText("0/6 completo")).toBeTruthy();
    for (const item of ITENS_VISITA) {
      expect(screen.getByLabelText(item.label)).toBeTruthy();
      expect(notaDe(item.label)).toBeTruthy();
    }
  });

  it("marcar um item sobe o progresso para 1/6 completo", () => {
    render(<VisitaTecnicaTab clienteId="cli-1" />);
    const chk = screen.getByLabelText("Fotos do telhado") as HTMLInputElement;
    expect(chk.checked).toBeFalsy();
    fireEvent.click(chk);
    expect(chk.checked).toBe(true);
    expect(screen.getByText("1/6 completo")).toBeTruthy();
    // desmarcar volta
    fireEvent.click(chk);
    expect(screen.getByText("0/6 completo")).toBeTruthy();
  });

  it("a nota opcional fica no campo e sozinha não conta como item completo", () => {
    render(<VisitaTecnicaTab clienteId="cli-1" />);
    const campo = notaDe("Última conta de luz");
    fireEvent.change(campo, { target: { value: "vence dia 10" } });
    expect(campo.value).toBe("vence dia 10");
    expect(screen.getByText("0/6 completo")).toBeTruthy();
    // marcando o item junto, o texto continua no campo e o progresso sobe
    fireEvent.click(screen.getByLabelText("Última conta de luz"));
    expect(campo.value).toBe("vence dia 10");
    expect(screen.getByText("1/6 completo")).toBeTruthy();
  });

  it("botão Adicionar foto vem desabilitado com o aviso de upload em construção", () => {
    render(<VisitaTecnicaTab clienteId="cli-1" />);
    const btn = screen.getByRole("button", {
      name: /adicionar foto/i,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBeTruthy();
    expect(screen.getByText(/upload em construção/i)).toBeTruthy();
  });
});

describe("VisitaTecnicaTab — persistência (cliente_pasta_linhas)", () => {
  it("Salvar grava a1ª visita como linha nova (linha=visita_tecnica)", async () => {
    render(<VisitaTecnicaTab clienteId="cli-1" />);
    await aguardarPronto();
    fireEvent.click(screen.getByLabelText("Fotos do telhado"));
    fireEvent.click(screen.getByLabelText("Foto da fachada"));
    fireEvent.change(notaDe("Fotos do telhado"), {
      target: { value: "telhado cerâmico,2 telhados" },
    });
    fireEvent.click(botaoSalvar());

    await waitFor(() => expect(supabaseMock.inserts.length).toBe(1));
    const payload = supabaseMock.inserts[0];
    expect(payload.cliente_id).toBe("cli-1");
    expect(payload.linha).toBe("visita_tecnica");
    expect(payload.dados.itens.fotos_telhado).toBe(true);
    expect(payload.dados.itens.foto_fachada).toBe(true);
    expect(payload.dados.itens.fotos_quadro).toBeFalsy();
    expect(payload.dados.notas.fotos_telhado).toBe("telhado cerâmico,2 telhados");
    expect(supabaseMock.updates.length).toBe(0);
    expect(await screen.findByText(/checklist salvo/i)).toBeTruthy();
  });

  it("com visita já salva, reabre marcada e o Salvar faz UPDATE da mesma linha", async () => {
    supabaseMock.linhas = [
      {
        id: "reg-7",
        cliente_id: "cli-1",
        linha: "visita_tecnica",
        dados: {
          itens: { fotos_telhado: true },
          notas: { fotos_telhado: "ok" },
        },
      },
    ];
    render(<VisitaTecnicaTab clienteId="cli-1" />);
    await waitFor(() =>
      expect(
        (screen.getByLabelText("Fotos do telhado") as HTMLInputElement).checked
      ).toBe(true)
    );
    expect(screen.getByText("1/6 completo")).toBeTruthy();
    expect(notaDe("Fotos do telhado").value).toBe("ok");

    fireEvent.click(botaoSalvar());
    await waitFor(() => expect(supabaseMock.updates.length).toBe(1));
    // mesma linha, não uma segunda
    expect(supabaseMock.inserts.length).toBe(0);
    expect(supabaseMock.updates[0].dados.itens.fotos_telhado).toBe(true);
    expect(await screen.findByText(/checklist salvo/i)).toBeTruthy();
  });

  it("erro do banco (ex.: check constraint) avisa e mantém o checklist na tela", async () => {
    supabaseMock.falhar = true;
    render(<VisitaTecnicaTab clienteId="cli-1" />);
    await aguardarPronto();
    fireEvent.click(screen.getByLabelText("Fotos do telhado"));
    fireEvent.click(botaoSalvar());
    expect(await screen.findByText(/não foi possível salvar/i)).toBeTruthy();
    // o que o vendedor marcou não some por causa do erro
    expect(screen.getByText("1/6 completo")).toBeTruthy();
  });
});
