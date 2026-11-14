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

/**
 * 14/11 — o telefone da conversa bate com o do cliente vinculado?
 * Mesma régua do check-duplicate: igualdade completa ou8 últimos
 * dígitos. Usado pelo nomeExibicaoAtendimento e pelo painel de contato.
 */
export function telefoneBateComCliente(
  telefoneConversa: string | null | undefined,
  telCliente: string | null | undefined,
): boolean {
  const t = String(telefoneConversa ?? "").replace(/\D/g, "");
  const c = String(telCliente ?? "").replace(/\D/g, "");
  if (!t || !c) return false;
  if (t === c) return true;
  return t.length >= 8 && c.length >= 8 && t.slice(-8) === c.slice(-8);
}

/**
 * 14/11 — nome da conversa no ATENDIMENTO com conferência de TELEFONE.
 *
 * A tela mostrava "Michele Swistalski" em20 números diferentes: o nome
 * vinha do CLIENTE VINCULADO sem bater com o número da conversa. Regra:
 * o nome do cliente só aparece se o telefone da conversa bater com o do
 * cliente (igual ou8 últimos dígitos — a mesma régua do
 * check-duplicate). Não batendo → nome salvo no atendimento → e sem
 * nome → "CLIENTE - <número>" (nomeExibicaoCliente).
 *
 * Cliente vinculado SEM telefone cadastrado mantém o nome (vínculo
 * manual costuma ser consciente — não dá como desmentir).
 */
export function nomeExibicaoAtendimento(params: {
  nomeClienteVinculado?: string | null;
  telClienteVinculado?: string | null;
  nomeAtendimento?: string | null;
  telefone?: string | null;
}): string {
  const { nomeClienteVinculado, telClienteVinculado, nomeAtendimento, telefone } = params;
  const telConversa = String(telefone ?? "").replace(/\D/g, "");
  const telCliente = String(telClienteVinculado ?? "").replace(/\D/g, "");

  const nomeOk = (nome: string | null | undefined) => {
    const exibido = nomeExibicaoCliente(nome, telefone);
    return exibido.startsWith("CLIENTE") ? null : exibido;
  };

  // Sem telefone no cliente → mantém o nome do vínculo.
  if (nomeClienteVinculado && !telCliente) {
    const nome = nomeOk(nomeClienteVinculado);
    if (nome) return nome;
  }

  if (telefoneBateComCliente(telConversa, telCliente)) {
    const nome = nomeOk(nomeClienteVinculado);
    if (nome) return nome;
  }

  return nomeExibicaoCliente(nomeAtendimento, telefone);
}
