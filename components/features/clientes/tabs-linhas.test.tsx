// @vitest-environment jsdom
/**
 * 12/10 — abas NOVAS da pasta do cliente (Eletroposto, Sigma Solar,
 * BESS, Gestão de Fatura). Cobre: vazio → formulário → validação →
 * salvar normalizado; e a lista de faturas (adicionar/excluir).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TabLinhaSimples, TabGestaoFatura } from "./tabs-linhas";

afterEach(() => cleanup());

describe("TabLinhaSimples", () => {
  it("mostra estado vazio com botão de adicionar", () => {
    render(
      <TabLinhaSimples linha="eletroposto" registros={[]} onSalvar={vi.fn()} onExcluir={vi.fn()} />
    );
    expect(screen.getByText(/nenhum registro/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /adicionar/i })).toBeTruthy();
  });

  it("abre o formulário e valida potência obrigatória", () => {
    render(
      <TabLinhaSimples linha="eletroposto" registros={[]} onSalvar={vi.fn()} onExcluir={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    fireEvent.click(screen.getByRole("button", { name: /^salvar$/i }));
    expect(screen.getByText(/Potência \(kW\) é obrigatória/i)).toBeTruthy();
  });

  it("salva dados normalizados quando válidos", () => {
    const onSalvar = vi.fn();
    render(
      <TabLinhaSimples linha="bess" registros={[]} onSalvar={onSalvar} onExcluir={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: /adicionar/i }));
    const capacidade = screen.getByLabelText(/Capacidade \(kWh\)/i);
    fireEvent.change(capacidade, { target: { value: "120" } });
    const soc = screen.getByLabelText(/Estado de carga/i);
    fireEvent.change(soc, { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: /^salvar$/i }));
    expect(onSalvar).toHaveBeenCalledTimes(1);
    const [dados] = onSalvar.mock.calls[0];
    expect(dados.capacidade_kwh).toBe(120);
    expect(dados.soc).toBe(45);
  });

  it("edita registro existente pré-carregando o formulário", () => {
    const onSalvar = vi.fn();
    render(
      <TabLinhaSimples
        linha="sigma"
        registros={[{ id: "r1", linha: "sigma", dados: { usina: "Usina Centro" } }]}
        onSalvar={onSalvar}
        onExcluir={vi.fn()}
      />
    );
    expect(screen.getByText("Usina Centro")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /editar/i }));
    expect((screen.getByLabelText(/Usina/i) as HTMLInputElement).value).toBe("Usina Centro");
  });
});

describe("TabGestaoFatura", () => {
  it("lista faturas com valor formatado e permite excluir", () => {
    const onExcluir = vi.fn();
    render(
      <TabGestaoFatura
        registros={[
          { id: "f1", linha: "gestao_fatura", dados: { competencia: "2026-10", valor: 1234.56 } },
        ]}
        onSalvar={vi.fn()}
        onExcluir={onExcluir}
      />
    );
    expect(screen.getByText(/Out\/2026/)).toBeTruthy();
    expect(screen.getByText(/R\$ 1\.234,56/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /excluir/i }));
    expect(onExcluir).toHaveBeenCalledWith("f1");
  });

  it("valida competência e valor ao adicionar", () => {
    render(<TabGestaoFatura registros={[]} onSalvar={vi.fn()} onExcluir={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /adicionar fatura/i }));
    fireEvent.click(screen.getByRole("button", { name: /^salvar$/i }));
    expect(screen.getByText(/Competência é obrigatória/i)).toBeTruthy();
    expect(screen.getByText(/Valor é obrigatório/i)).toBeTruthy();
  });

  it("salva fatura normalizada (moeda brasileira)", () => {
    const onSalvar = vi.fn();
    render(<TabGestaoFatura registros={[]} onSalvar={onSalvar} onExcluir={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /adicionar fatura/i }));
    fireEvent.change(screen.getByLabelText(/Competência/i), { target: { value: "2026-10" } });
    fireEvent.change(screen.getByLabelText(/^valor/i), { target: { value: "R$ 1.234,56" } });
    fireEvent.click(screen.getByRole("button", { name: /^salvar$/i }));
    expect(onSalvar).toHaveBeenCalledTimes(1);
    expect(onSalvar.mock.calls[0][0]).toMatchObject({ competencia: "2026-10", valor: 1234.56 });
  });
});
