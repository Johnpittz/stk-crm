/**
 * ITEM 4 (16/10) — nome de exibição no ATENDIMENTO.
 * Sem nome identificado: "CLIENTE - 62982735286" (número na frente),
 * em vez de só "CLIENTE"/"Cliente não identificado".
 * Puro e testado — as telas só chamam aqui.
 */
export function nomeExibicaoCliente(
  nome: string | null | undefined,
  telefone: string | null | undefined,
): string {
  const nomeLimpo = String(nome ?? "").trim();
  // placeholders gravados por versões antigas também contam como "sem nome"
  const PLACEHOLDERS = new Set([
    "cliente",
    "cliente nao identificado",
    "cliente não identificado",
    "contato",
    "sem nome",
    "desconhecido",
  ]);
  const semNome =
    !nomeLimpo ||
    PLACEHOLDERS.has(
      nomeLimpo
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
    ) ||
    // sem acento o set tem "cliente nao identificado"; com acento cai acima
    PLACEHOLDERS.has(nomeLimpo.toLowerCase());
  if (!semNome) return nomeLimpo;

  const tel = String(telefone ?? "").trim();
  if (!tel) return "CLIENTE";
  return `CLIENTE - ${tel}`;
}
