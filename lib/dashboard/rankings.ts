/**
 * Fase 2 — dimensões VENDEDOR e TIME do tempo de resposta.
 * Puro: recebe as 1ª respostas medidas e devolve os rankings.
 */
import type { Resposta } from "./tempo-resposta";
import { nomeDaEquipe } from "./equipes";

export interface RespostaMedida extends Resposta {
  /** id de quem respondeu (enviada_por) */
  responsavel?: string | null;
  /** número/instância STK do atendimento */
  instancia?: string | null;
}

export interface LinhaRanking {
  id: string;
  nome: string;
  media: number;
  n: number;
  pior: number;
}

function media(v: number[]): number {
  return v.length === 0 ? 0 : Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
}

/** Agrupa por quem respondeu; do MAIS LENTO ao mais rápido. */
export function rankingVendedores(
  respostas: RespostaMedida[],
  nomes: Record<string, string>,
): LinhaRanking[] {
  const grupos = new Map<string, number[]>();
  for (const r of respostas) {
    if (!r.responsavel) continue;
    const lista = grupos.get(r.responsavel);
    if (lista) lista.push(r.minutos);
    else grupos.set(r.responsavel, [r.minutos]);
  }

  const linhas: LinhaRanking[] = [];
  grupos.forEach((minutos, id) => {
    linhas.push({
      id,
      nome: nomes[id] || "Conta sem cadastro",
      media: media(minutos),
      n: minutos.length,
      pior: Math.max(...minutos),
    });
  });
  return linhas.sort((a, b) => b.media - a.media);
}

/** Agrupa por time (número STK → Time Lobo/Águia); do MAIS LENTO ao mais rápido. */
export function resumoPorTime(respostas: RespostaMedida[]): LinhaRanking[] {
  const grupos = new Map<string, number[]>();
  for (const r of respostas) {
    const time =
      nomeDaEquipe(r.instancia) ??
      (r.instancia ? `Sem time (${r.instancia})` : "Sem time");
    const lista = grupos.get(time);
    if (lista) lista.push(r.minutos);
    else grupos.set(time, [r.minutos]);
  }

  const linhas: LinhaRanking[] = [];
  grupos.forEach((minutos, nome) => {
    linhas.push({
      id: nome,
      nome,
      media: media(minutos),
      n: minutos.length,
      pior: Math.max(...minutos),
    });
  });
  return linhas.sort((a, b) => b.media - a.media);
}
