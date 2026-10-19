/**
 * 18/10 — FLUXO ÚNICO DE FATURA (pedido do João).
 *
 * Um botão só ("Análise da Fatura") com duas funções. O que decide o
 * rótulo é o que JÁ ESTÁ GRAVADO — não memória da tela. Assim a segunda
 * etapa não trava quando o vendedor abre a página de novo, e a coluna
 * "Fatura Recebida" esvazia sozinha depois da análise.
 *
 * Regra de ouro: cada linha guarda o dia em que a conta chegou. Sem o
 * dia gravado, duas contas do mesmo mês ficam indistinguíveis e o card
 * antigo voltava para a coluna errada.
 *
 * Puro de propósito: nenhuma consulta aqui, só regra.
 */

/** Um dia por conta: é assim que a equipe trabalha. */
export function diaDeHoje(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export interface LinhaGestao {
  id?: string;
  dados?: Record<string, unknown> | null;
}

/**
 * Só as contas do dia contam. Linha de ontem segue no histórico (e no
 * funil), mas não manda no botão de hoje.
 */
export function linhasDeHoje<T extends LinhaGestao>(linhas: T[], hoje = diaDeHoje()): T[] {
  return linhas.filter((l) => String(l.dados?.dia ?? "") === hoje);
}

export function fluxoDe(linha: LinhaGestao): string {
  return String(linha.dados?.fluxo ?? "");
}

export const FLUXO_RECEBIDA = "recebida";
export const FLUXO_ANALISADA = "analise-concluida";

/**
 * Separa as linhas nas duas colunas do kanban de faturas.
 *
 * Linha sem `dia` (gravada antes do dia 18/10) continua aparecendo no
 * histórico — só não decide o rótulo do botão.
 */
export function separarColunas(linhas: LinhaGestao[]): {
  recebidas: LinhaGestao[];
  analisadas: LinhaGestao[];
} {
  const recebidas: LinhaGestao[] = [];
  const analisadas: LinhaGestao[] = [];
  for (const l of linhas) {
    if (fluxoDe(l) === FLUXO_ANALISADA) analisadas.push(l);
    else recebidas.push(l);
  }
  return { recebidas, analisadas };
}

/** Existe conta de hoje esperando a IA? */
export function temRecebidaHoje(linhas: LinhaGestao[], hoje = diaDeHoje()): boolean {
  return linhasDeHoje(linhas, hoje).some((l) => fluxoDe(l) === FLUXO_RECEBIDA);
}

/**
 * Uma conta por dia, por cliente.
 *
 * Subir o mesmo PDF duas vezes não pode virar dois cards na coluna
 * "Fatura Recebida": a segunda tentativa REUSA a linha do dia.
 */
export function deveRegravarLinhaDoDia(linhas: LinhaGestao[], hoje = diaDeHoje()): boolean {
  return linhaDoDiaParaRegravar(linhas, hoje) !== null;
}

/**
 * Dá pra reanalisar a conta sem pedir o arquivo de novo?
 * O passo 1 guarda o PDF enviado; linhas antigas (antes disso) não têm
 * arquivo guardado e precisam de um novo upload.
 */
export function temArquivoGuardado(dados: unknown): boolean {
  if (!dados) return false;
  const arquivo = (dados as { arquivo?: unknown } | null)?.arquivo;
  return typeof arquivo === "string" && arquivo.trim().length > 0;
}

/** A linha do dia a ser atualizada (a mais recente), ou null se não há. */
export function linhaDoDiaParaRegravar<T extends LinhaGestao>(
  linhas: T[],
  hoje = diaDeHoje()
): T | null {
  const doDia = linhasDeHoje(linhas, hoje);
  return doDia.length ? doDia[doDia.length - 1] : null;
}

/**
 * Estado do botão, lido do que está gravado:
 *   recebidaHoje  → existe conta de hoje esperando a IA
 *   analisadaHoje → a conta de hoje já passou pela IA
 *
 * Regra: se a conta do dia já foi analisada, o rótulo volta a ser
 * "Escolher conta" (coluna Recebida vazia → cabe a próxima conta).
 */
export function rotuloBotaoAnalise(estado: {
  recebidaHoje: boolean;
  analisadaHoje: boolean;
}): string {
  // Nome próprio: não pode coincidir com o botão de arquivo ("Escolher
  // conta") — dois botões iguais na mesma tela confundem a equipe.
  if (estado.recebidaHoje) return "Analisar conta";
  return "Enviar conta para a IA";
}

/** Deriva os dois indicadores a partir das linhas gravadas. */
export function estadoAnalise(
  linhas: LinhaGestao[],
  hoje = diaDeHoje()
): { recebidaHoje: boolean; analisadaHoje: boolean; doDia: LinhaGestao[] } {
  const doDia = linhasDeHoje(linhas, hoje);
  return {
    recebidaHoje: doDia.some((l) => fluxoDe(l) === FLUXO_RECEBIDA),
    analisadaHoje: doDia.some((l) => fluxoDe(l) === FLUXO_ANALISADA),
    doDia,
  };
}

/**
 * Explica em português simples POR QUE a análise falhou.
 *
 * A rota devolve um `detalhe` técnico; sem tradução, a tela só dizia
 * "foto mais nítida" — sem sentido para PDF, que não tem nitidez.
 */
export function dicaAnalise(detalhe: string | null | undefined): string | null {
  if (!detalhe) return null;
  if (detalhe === "sem_arquivo_guardado") {
    return "Esta conta foi inserida antes de guardarmos o arquivo — escolha o PDF/foto de novo para reanalisar.";
  }
  if (detalhe === "pdf_sem_texto") {
    return "Este PDF não tem texto selecionável — envie uma foto/print da conta.";
  }
  if (detalhe === "pdf_ilegivel") {
    return "Não consegui abrir este PDF — tente exportar de novo ou envie uma foto.";
  }
  if (detalhe === "ia_vazia") {
    return "A IA não devolveu dados deste arquivo — tentar de novo costuma resolver.";
  }
  if (detalhe.startsWith("ia:")) {
    return `A IA não respondeu direito (${detalhe.slice(3).trim()}) — tentar de novo costuma resolver.`;
  }
  return null;
}
