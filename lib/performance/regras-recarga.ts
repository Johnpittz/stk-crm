/**
 * Regras de recarga das telas (medidas em produção em 26/09 — ver HANDOFF §8).
 *
 * Motivo: cada entrada de aba disparava chamadas repetidas do mesmo endpoint e
 * a página só ficava "pronta" quando TODAS terminavam (Atendimento 1,8–2,0 s;
 * Kanban 1,6 s). As regras ficam aqui, puras e testadas; os componentes só as
 * consultam.
 */

/**
 * O modal de contatos só busca quando está ABERTO.
 *
 * O efeito de debounce rodava na montagem mesmo com o modal fechado (o
 * componente retorna null, mas os hooks já executaram) — era um pedido de
 * 100 contatos no WAHA, medido em 786 ms, no meio do carregamento principal
 * e sem exibir nada.
 */
export function deveBuscarContatos(open: boolean): boolean {
  return open;
}

/**
 * A primeira recarga mostra o loading; as seguintes rodam em silêncio para a
 * tela não piscar enquanto o usuário já está lendo.
 */
export function silenciosoNaRecarga(jaCarregou: boolean): boolean {
  return jaCarregou;
}

/**
 * O Kanban busca oportunidades num efeito próprio E num efeito que reage a
 * `atendimentos`. Sem guarda, os dois rodam na montagem e o primeiro conjunto
 * de dados chegar dispara a terceira chamada (medido: 759/632/328 ms).
 *
 * Retorna true só quando vale a pena refazer: houve mudança REAL posterior à
 * primeira carga, e a tela tem `onRefresh`.
 */
export function deveRefazerOportunidades(
  atendimentosAnteriores: readonly unknown[],
  atendimentosAtuais: readonly unknown[],
  onRefresh: unknown,
): boolean {
  if (!onRefresh) return false;
  if (atendimentosAnteriores === atendimentosAtuais) return false; // montagem
  if (atendimentosAnteriores.length === 0 && atendimentosAtuais.length > 0) {
    return false; // primeira chegada de dados
  }
  return true;
}
