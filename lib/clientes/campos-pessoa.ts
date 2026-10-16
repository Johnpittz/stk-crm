/**
 * ITEM 1 (16/10) — o que mostrar no cadastro/editar CLIENTE conforme
 * o tipo de pessoa (PF = CPF, PJ = CNPJ). Puro e testado.
 */

export function mostrarCamposEmpresa(tipo: "pf" | "pj"): boolean {
  // PF: "Nome do Contato" e "CPF do Proprietário" não fazem sentido
  // (o CPF do cadastro já é o da pessoa; o contato é ela mesma).
  return tipo !== "pf";
}

export function tituloEndereco(tipo: "pf" | "pj"): string {
  // PF mora lá — não é "Endereço da Empresa".
  return tipo === "pf" ? "Endereço" : "Endereço da Empresa";
}
