// @vitest-environment jsdom
/**
 * 03/10 — Bug da aba "Propostas" no Atendimento.
 *
 * O botão "Salvar Proposta GD" só salvava cadastro no cliente e o nome
 * prometia proposta; o input "Consumo mensal (kWh)" era pedido e jogado
 * fora (nem ia no corpo do PUT); e não havia caminho para o formulário
 * AXS novo (o único que enfileira proposta de verdade).
 *
 * O que este teste garante (RED -> GREEN):
 *  1. GD se chama cadastro e o botão não promete proposta;
 *  2. nenhum campo que é descartado (consumo mensal);
 *  3. link "Criar proposta na AXS" para /clientes/{id}/axs-novo;
 *  4. regressões: RECIEE continua "Salvar Proposta RECIEE" e o
 *     placeholder "Selecione GD ou RECIEE acima" continua.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

import AbaPropostas from "./aba-propostas"

afterEach(() => cleanup())

const base = {
  setTipoProposta: () => {},
  setGdForm: () => {},
  setRecieeForm: () => {},
  criarPropostaGD: () => {},
  criarPropostaRECIEE: () => {},
  salvandoCliente: false,
  verificandoDuplicata: false,
  clienteId: "CLI-123",
  gdForm: {
    concessionaria: "",
    instalacao: "",
    classe_tarifaria: "",
    subgrupo_tarifario: "",
    bandeira: "",
  },
  recieeForm: {
    uc: "",
    estado: "GO",
    distribuidora: "CEMIG",
    subgrupo: "B3",
    modalidade: "Convencional",
    classe: "Comercial",
    tensao: "Baixa",
    regime_tributario: "Simples Nacional",
    grupo: "B",
  },
}

describe("aba Propostas (Atendimento)", () => {
  it("GD se apresenta como CADASTRO — não promete 'Proposta'", () => {
    render(<AbaPropostas {...base} tipoProposta="gd" />)
    expect(screen.queryByText("Salvar Proposta GD")).toBeNull()
    expect(screen.getByText(/Dados GD do cliente/)).toBeTruthy()
    expect(screen.getByText("Salvar cadastro GD")).toBeTruthy()
  })

  it("não mostra campo que é descartado (consumo mensal)", () => {
    render(<AbaPropostas {...base} tipoProposta="gd" />)
    expect(screen.queryByPlaceholderText("Consumo mensal (kWh)")).toBeNull()
  })

  it("tem o caminho para o formulário AXS novo da pasta do cliente", () => {
    render(<AbaPropostas {...base} tipoProposta="gd" />)
    const link = screen.getByText(/Criar proposta na AXS/i).closest("a")
    expect(link).toBeTruthy()
    expect(link!.getAttribute("href")).toBe("/clientes/CLI-123/axs-novo")
  })

  it("sem cliente vinculado não mostra o link AXS (não adianta ir pro form)", () => {
    render(<AbaPropostas {...base} clienteId={null} tipoProposta="gd" />)
    expect(screen.queryByText(/Criar proposta na AXS/i)).toBeNull()
  })

  it("regressão: RECIEE continua propondo 'Salvar Proposta RECIEE'", () => {
    render(<AbaPropostas {...base} tipoProposta="reciee" />)
    expect(screen.getByText("Salvar Proposta RECIEE")).toBeTruthy()
  })

  it("regressão: sem tipo selecionado continua pedindo a escolha", () => {
    render(<AbaPropostas {...base} tipoProposta={null} />)
    expect(screen.getByText(/Selecione GD ou RECIEE acima/)).toBeTruthy()
  })
})
