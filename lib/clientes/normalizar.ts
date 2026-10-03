/**
 * 03/10 — Ficha do cliente vazia ("Sem nome / Sem CPF/CNPJ").
 *
 * Duas fontes, duas nomenclaturas:
 *   - tabela `clientes`      -> `nome_razao_social` + `cnpj_cpf`
 *   - view  `v_unified_clientes` (migração 083) -> `nome` + `cpf_cnpj`
 * A ficha lia os nomes da TABELA na linha da VIEW e, como a view é o
 * primeiro SELECT (e sempre acha), o fallback nunca rodava — o CROPS
 * AGROBUSINESS LTDA aparecia como "Sem nome / Sem CPF/CNPJ" mesmo com
 * os dados na view.
 *
 * `normalizarCliente` devolve a linha com AMBAS as grafias preenchidas,
 * preservando o que já existia — qualquer consumidor continua lendo o
 * campo que já conhece.
 */

type Linha = Record<string, any>;

export function normalizarCliente<T>(row: T): T & Record<string, any> {
  if (row == null || typeof row !== "object") {
    return row as T & Record<string, any>;
  }
  const linha = row as Linha;

  const nome =
    linha.nome_razao_social ?? linha.nome ?? linha.nome_completo ?? null;
  const documento = linha.cnpj_cpf ?? linha.cpf_cnpj ?? null;

  return {
    ...linha,
    nome_razao_social: nome,
    nome: linha.nome ?? nome,
    nome_completo: linha.nome_completo ?? nome,
    cnpj_cpf: documento,
    cpf_cnpj: linha.cpf_cnpj ?? documento,
  } as unknown as T & Record<string, any>;
}
