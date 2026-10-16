/**
 * ITEM 1 (16/10) — CADASTRO/EDITAR CLIENTE: para PESSOA FÍSICA (CPF):
 *   - não mostrar "Nome do Contato" nem "CPF do Proprietário"
 *   - o endereço não é "da Empresa" → título vira "Endereço"
 * Puro e testado — as telas só consultam aqui.
 */

import { describe, expect, it } from "vitest";
import { mostrarCamposEmpresa, tituloEndereco } from "./campos-pessoa";

describe("campos-pessoa (item 1)", () => {
  it("pessoa física não mostra campos de empresa", () => {
    expect(mostrarCamposEmpresa("pf")).toBe(false);
  });

  it("pessoa jurídica mantém Nome do Contato e CPF do Proprietário", () => {
    expect(mostrarCamposEmpresa("pj")).toBe(true);
  });

  it("título do endereço por tipo", () => {
    expect(tituloEndereco("pf")).toBe("Endereço");
    expect(tituloEndereco("pj")).toBe("Endereço da Empresa");
  });
});
