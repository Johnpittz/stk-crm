// @vitest-environment jsdom
/**
 * 03/10 — Passo 9 do guia: "a tela vira Criada, com a mensalidade ao lado".
 *
 * A fila mostrava só `card 1452248820` sem R$ nenhum: a rota GET não
 * devolvia a mensalidade (que o worker grava em clientes.axs_mensalidade)
 * e a tela não tinha o campo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}))

import FilaAxsPage from "./page"

const ITEM_CRIADA = {
  id: "f2",
  cliente_id: "cli-2",
  oportunidade_id: null,
  vendedor_id: null,
  status: "criada",
  tentativas: 1,
  max_tentativas: 6,
  job_id: null,
  axs_card_id: "1452248820",
  erro: null,
  origem: "crm",
  payload: {},
  created_at: "2026-09-27T23:51:00.000Z",
  updated_at: "2026-09-27T23:51:00.000Z",
  mensalidade: 767.88,
}

describe("Fila AXS — mensalidade ao lado da proposta criada", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ itens: [ITEM_CRIADA], gestor: true }),
      }))
    )
    vi.spyOn(window, "confirm").mockReturnValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("mostra a mensalidade em R$ no item Criada na AXS", async () => {
    render(<FilaAxsPage />)
    await waitFor(
      () => {
        expect(screen.getByText(/card 1452248820/)).toBeTruthy()
      },
      { timeout: 3000 }
    )
    expect(screen.getByText(/R\$\s*767,88/)).toBeTruthy()
  })

  it("item sem mensalidade não quebra a tela (só não mostra o R$)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          itens: [{ ...ITEM_CRIADA, mensalidade: null }],
          gestor: true,
        }),
      }))
    )
    render(<FilaAxsPage />)
    await waitFor(
      () => {
        expect(screen.getByText(/card 1452248820/)).toBeTruthy()
      },
      { timeout: 3000 }
    )
    expect(screen.queryByText(/R\$/)).toBeNull()
  })
})
