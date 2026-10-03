// @vitest-environment jsdom
/**
 * 03/10 — Modal de oportunidade (pedido do João):
 *  1. o quadro tinha que ficar MAIOR (max-w-md = 448px);
 *  2. precisava de ESPAÇO PARA ANOTAÇÃO: a descrição só virava textarea no
 *     modo edição, que só existe em oportunidade CONCLUÍDA — num card em
 *     andamento era só texto "Sem descrição", sem como anotar.
 *     Agora a textarea é sempre visível e tem botão próprio "Salvar
 *     anotação" que faz PATCH de {id, descricao} sem entrar no fluxo de
 *     edição/conclusão.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react"

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "tok-teste" } } }),
    },
  }),
}))
vi.mock("@/components/features/propostas/botao-proposta", () => ({
  BotaoProposta: () => null,
}))

import { ModalDetalhesOportunidade } from "./modal-detalhes-oportunidade"

const OPORTUNIDADE = {
  id: "opp-1",
  titulo: "Conta de energia - João Pedro",
  descricao: null,
  tipo: "visita",
  prioridade: "media",
  status: "pendente",
  etapa: "recebeu_conta", // em aberto: NÃO pode usar o fluxo de edição
  data_inicio: null,
  hora_inicio: null,
  data_fim: null,
  hora_fim: null,
  resultado: null,
  observacao_resultado: null,
  valor_venda: null,
  cliente_nome: "João Pedro",
  origem_lead: null,
  clientes: null,
}

const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }))

describe("ModalDetalhesOportunidade — quadro maior + anotação", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockClear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  function abrir() {
    return render(
      <ModalDetalhesOportunidade
        oportunidade={OPORTUNIDADE}
        aberto
        onClose={() => {}}
        onAtualizar={() => {}}
      />
    )
  }

  it("o quadro é maior que o antigo max-w-md (448px)", async () => {
    abrir()
    const dialogo = await screen.findByRole("dialog")
    expect(dialogo.className).toContain("max-w-2xl")
  })

  it("oportunidade em aberto já abre com espaço para anotação (textarea)", async () => {
    abrir()
    await screen.findByRole("dialog")
    const textarea = screen.getByPlaceholderText(/anotação/i)
    expect(textarea).toBeTruthy()
    // não é mais o <p> "Sem descrição" travado
    expect(screen.queryByText("Sem descrição")).toBeNull()
  })

  it("Salvar anotação faz PATCH de {id, descricao} sem fluxo de edição", async () => {
    abrir()
    await screen.findByRole("dialog")
    const textarea = screen.getByPlaceholderText(/anotação/i)
    fireEvent.change(textarea, { target: { value: "Cliente pediu retorno amanhã 9h" } })

    fireEvent.click(screen.getByText("Salvar anotação"))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("/api/oportunidades")
    expect(init.method).toBe("PATCH")
    expect(JSON.parse(String(init.body))).toEqual({
      id: "opp-1",
      descricao: "Cliente pediu retorno amanhã 9h",
    })
  })

  it("após salvar mostra confirmação visível", async () => {
    abrir()
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByText("Salvar anotação"))
    await waitFor(() => {
      expect(screen.getByText(/Anotação salva/)).toBeTruthy()
    })
  })
})
