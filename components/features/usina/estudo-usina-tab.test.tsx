// @vitest-environment jsdom
/**
 * 25/11/2026 — Fase1: aba "Estudo Usina" da pasta do cliente.
 * Cobre: pré-preenchimento (média do consumo do cliente + estudo salvo),
 * cálculo ao vivo, salvar (PUT com merge em clientes.usina) e botão do funil.
 * Sem jest-dom: o projeto não tem os matchers — asserções nativas.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { EstudoUsinaTab } from "./estudo-usina-tab";

afterEach(() => cleanup());

const valorDo = (nome: RegExp) =>
  (screen.getByLabelText(nome) as HTMLInputElement).value;

const CLIENTE = {
  nome_razao_social: "Maria Silva",
  usina: null as string | null,
  consumo_jan: 900,
  consumo_fev: 1100,
  consumo_mar: null,
};

function montar(cliente: Record<string, any> = CLIENTE) {
  return render(<EstudoUsinaTab cliente={cliente} clienteId="cli-1" />);
}

describe("EstudoUsinaTab — entradas", () => {
  it("pré-preenche o consumo com a média dos meses informados", () => {
    montar();
    expect(valorDo(/consumo mensal/i)).toBe("1000");
  });

  it("sem nenhum consumo informado, deixa o campo vazio (vendedor digita)", () => {
    montar({ nome_razao_social: "Zé", usina: null });
    expect(valorDo(/consumo mensal/i)).toBe("");
  });

  it("carrega um estudo já salvo (consumo/tarifa/meta restaurados)", () => {
    const usina = JSON.stringify({
      CRI: "",
      usina: "",
      potencia: "",
      estudo: {
        geradoEm: "2026-11-25T10:00:00.000Z",
        consumoMensalKwh: 1500,
        tarifaRpkwh: 0.78,
        metaPct: 120,
        modulo: { marca: "Honor Solar", modelo: "HB-M16R/132H-550", wp: 550 },
        resultado: {},
      },
    });
    montar({ ...CLIENTE, usina, consumo_jan: 900, consumo_fev: 900 });
    expect(valorDo(/consumo mensal/i)).toBe("1500");
    expect(valorDo(/tarifa/i)).toBe("0,78");
    expect(screen.getByText(/120%/i)).toBeTruthy();
  });
});

describe("EstudoUsinaTab — cálculo ao vivo", () => {
  it("com consumo e tarifa preenchidos mostra o dimensionamento na tela", () => {
    montar();
    fireEvent.change(screen.getByLabelText(/módulo/i), { target: { value: "1" } }); // Honor550 Wp
    fireEvent.change(screen.getByLabelText(/tarifa/i), { target: { value: "0,95" } });
    //1.000 kWh/mês, meta100%, módulo550 Wp →15 painéis /8,25 kWp /103,1% cobre
    expect(screen.getByText("8,25 kWp")).toBeTruthy();
    expect(screen.getByText("15")).toBeTruthy();
    expect(screen.getByText(/103,1/)).toBeTruthy();
  });

  it("sem tarifa não mostra os números (só o aviso do que falta)", () => {
    montar();
    expect(screen.getByText(/informe a tarifa/i)).toBeTruthy();
    expect(screen.queryByText(/8,25 kWp/)).toBeNull();
  });
});

describe("EstudoUsinaTab — ações", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Salvar faz PUT com o JSON da coluna usina já com a chave estudo", async () => {
    montar();
    fireEvent.change(screen.getByLabelText(/módulo/i), { target: { value: "1" } }); // Honor550 Wp
    fireEvent.change(screen.getByLabelText(/tarifa/i), { target: { value: "0,95" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar estudo/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, opts] = (fetch as any).mock.calls[0];
    expect(url).toBe("/api/clientes/cli-1");
    expect(opts.method).toBe("PUT");
    const body = JSON.parse(opts.body);
    const salvo = JSON.parse(body.usina);
    expect(salvo.estudo.consumoMensalKwh).toBe(1000);
    expect(salvo.estudo.resultado.numPaineis).toBe(15);
    expect(await screen.findByText(/estudo salvo/i)).toBeTruthy();
  });

  it("preserva CRI/usina existentes ao salvar", async () => {
    montar({ ...CLIENTE, usina: JSON.stringify({ CRI: "777", usina: "Usina X", potencia: "40" }) });
    fireEvent.change(screen.getByLabelText(/tarifa/i), { target: { value: "0,9" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar estudo/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    const salvo = JSON.parse(body.usina);
    expect(salvo.CRI).toBe("777");
    expect(salvo.usina).toBe("Usina X");
    expect(salvo.estudo).toBeTruthy();
  });

  it("Enviar para o funil cria a oportunidade com o resumo do estudo", async () => {
    //1º GET (checagem de duplicata) devolve lista vazia; POST cria.
    (fetch as any).mockImplementation((url: string, opts: any) => {
      if (opts?.method === "POST") {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ oportunidades: [] }) });
    });
    montar();
    fireEvent.change(screen.getByLabelText(/tarifa/i), { target: { value: "0,95" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar para o funil/i }));

    await waitFor(() =>
      expect(
        (fetch as any).mock.calls.some(
          ([u, o]: [string, any]) => u === "/api/oportunidades" && o?.method === "POST"
        )
      ).toBe(true)
    );
    const post = (fetch as any).mock.calls.find(
      ([u, o]: [string, any]) => u === "/api/oportunidades" && o?.method === "POST"
    );
    const payload = JSON.parse(post[1].body);
    expect(payload.cliente_id).toBe("cli-1");
    expect(payload.titulo).toMatch(/estudo de usina/i);
    expect(payload.consumo_kwh).toBe(1000);
    expect(await screen.findByText(/enviado ao funil/i)).toBeTruthy();
  });
});
