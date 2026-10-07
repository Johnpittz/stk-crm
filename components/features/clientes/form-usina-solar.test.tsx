// @vitest-environment jsdom
/**
 * 06/10 — formulário de marcação de USINA SOLAR (abre automático ao marcar
 * "Tem Usina Solar" = SIM). Cobre validação, serialização no formato da
 * AXS ({ CRI, usina }) e leitura de dado já gravado.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  FormUsinaSolar,
  parseUsina,
  serializarUsina,
} from "./form-usina-solar";

afterEach(() => cleanup());

const VAZIO = { cri: "", nome: "", potencia: "" };

describe("parseUsina / serializarUsina", () => {
  it("vazio ou JSON inválido vira formulário em branco", () => {
    expect(parseUsina("")).toEqual(VAZIO);
    expect(parseUsina(null)).toEqual(VAZIO);
    expect(parseUsina("não é json")).toEqual(VAZIO);
  });

  it("entende o formato da AXS ({ CRI, usina }) e preserva potência", () => {
    expect(parseUsina('{"CRI":"123","usina":"Usina CD","potencia":"75.5"}')).toEqual({
      cri: "123",
      nome: "Usina CD",
      potencia: "75.5",
    });
  });

  it("roundtrip serializa no formato da AXS", () => {
    const json = serializarUsina({ cri: "9", nome: "Usina Z", potencia: "10" });
    expect(JSON.parse(json)).toEqual({ CRI: "9", usina: "Usina Z", potencia: "10" });
  });
});

function montar(onSalvar = vi.fn()) {
  const utils = render(
    <FormUsinaSolar
      open
      onOpenChange={() => {}}
      valor={VAZIO}
      onSalvar={onSalvar}
    />
  );
  return { onSalvar, ...utils };
}

describe("FormUsinaSolar", () => {
  it("mostra os campos da usina", () => {
    montar();
    expect(screen.getByText(/Nome da usina/)).toBeTruthy();
    expect(screen.getByText(/Potência \(kWp\)/)).toBeTruthy();
    expect(screen.getByText(/CRI/)).toBeTruthy();
  });

  it("bloqueia salvar sem nome e sem potência", () => {
    const { onSalvar } = montar();
    fireEvent.click(screen.getByText("Salvar usina"));
    expect(screen.getByText("Informe o nome da usina")).toBeTruthy();
    expect(screen.getByText("Informe a potência em kWp")).toBeTruthy();
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it("salva válidos com potência normalizada (vírgula → ponto)", () => {
    const { onSalvar } = montar();
    fireEvent.change(screen.getByPlaceholderText("Ex: Usina Solar CD Rede ABC"), {
      target: { value: "Usina Centro" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ex: 75,5"), {
      target: { value: "75,5" },
    });
    fireEvent.change(screen.getByPlaceholderText("Código de registro"), {
      target: { value: "CRI-1" },
    });
    fireEvent.click(screen.getByText("Salvar usina"));
    expect(onSalvar).toHaveBeenCalledWith({
      cri: "CRI-1",
      nome: "Usina Centro",
      potencia: "75.5",
    });
  });
});
