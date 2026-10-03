/**
 * 03/10 — Bug: ficha do cliente vazia ("Sem nome / Sem CPF/CNPJ").
 *
 * A view `v_unified_clientes` (migration 083) expõe `nome` e `cpf_cnpj`;
 * a tabela `clientes` tem `nome_razao_social` e `cnpj_cpf`. A ficha lia
 * os nomes da TABELA na linha da VIEW — e como a view SEMPRE acha a linha
 * (é o primeiro SELECT), o fallback para `clientes` nunca rodava: todo
 * campo aparecia vazio, mesmo com o dado na mão (ex.: CROPS
 * AGROBUSINESS LTDA, CNPJ 40173720000173, visível na lista).
 *
 * `normalizarCliente` faz as duas nomenclaturas conviverem — a ficha,
 * a edição e o formulário AXS novo passam a ler qualquer uma das origens.
 */
import { describe, it, expect } from "vitest"
import { normalizarCliente } from "./normalizar"

describe("normalizarCliente (view x tabela)", () => {
  it("linha da view ganha nome_razao_social/cnpj_cpf", () => {
    const linha = normalizarCliente({
      id: "v-1",
      nome: "CROPS AGROBUSINESS LTDA",
      cpf_cnpj: "40173720000173",
      telefone: null,
      origem: "reciee",
    })
    expect(linha.nome_razao_social).toBe("CROPS AGROBUSINESS LTDA")
    expect(linha.cnpj_cpf).toBe("40173720000173")
    // e os nomes originais continuam intactos (consumidores antigos)
    expect(linha.nome).toBe("CROPS AGROBUSINESS LTDA")
    expect(linha.cpf_cnpj).toBe("40173720000173")
    expect(linha.origem).toBe("reciee")
  })

  it("linha da tabela ganha nome/cpf_cnpj (leitores da view)", () => {
    const linha = normalizarCliente({
      id: "c-1",
      nome_razao_social: "João Pedro",
      cnpj_cpf: "473.486.120-08",
      cidade: "Aparecida de Goiânia",
    })
    expect(linha.nome).toBe("João Pedro")
    expect(linha.cpf_cnpj).toBe("473.486.120-08")
    expect(linha.nome_razao_social).toBe("João Pedro")
    expect(linha.cnpj_cpf).toBe("473.486.120-08")
    expect(linha.cidade).toBe("Aparecida de Goiânia")
  })

  it("não inventa dado onde não há", () => {
    const linha = normalizarCliente({ id: "x", nome: "Lead 4321" })
    expect(linha.nome_razao_social).toBe("Lead 4321")
    expect(linha.cnpj_cpf).toBeNull()
  })

  it("linha vazia/devolvida nula não derruba nada", () => {
    expect(normalizarCliente(null)).toBeNull()
    expect(normalizarCliente(undefined)).toBeUndefined()
    expect(normalizarCliente({}).nome_razao_social).toBeNull()
  })
})
