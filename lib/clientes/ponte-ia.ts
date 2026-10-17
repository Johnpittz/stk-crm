/**
 * FASE C — ponte entre a Análise (IA) e as abas do cliente.
 * A IA identifica o produto → vira linha na aba correspondente com
 * origem "IA". Regra de ouro: NUNCA duplica (se já existe linha do
 * produto — manual ou IA — não cria outra) e só passa o que o
 * protocolo aprova (Identificada/Preliminar).
 * Puro e testado; a rota só consulta e insere.
 */
import type { LinhaId } from "./linhas";
import type { OportunidadeProduto } from "../ia/regras-produtos";

/** Produtos que TÊM aba própria no cliente. RECIEE/GD ficam de fora. */
const MAPA_ABA: Record<string, LinhaId> = {
  eletroposto: "eletroposto",
  sigma_solar: "sigma",
  bess: "bess",
  mercado_livre: "mercado_livre",
  usina_proprietaria: "usina",
};

export function linhaDaOportunidade(
  o: OportunidadeProduto
): LinhaId | null {
  return MAPA_ABA[o.produto] ?? null;
}

/** Texto da sugestão: motivo + evidência + pendência. */
export function montarDadosLinhaIA(o: OportunidadeProduto): Record<string, unknown> {
  const partes = [`[IA] ${o.motivo}.`];
  if (o.evidencia) partes.push(`Evidência: ${o.evidencia}.`);
  if (o.pendencia) partes.push(`Pendência: ${o.pendencia}.`);
  return {
    origem: "IA",
    observacoes: partes.join(" "),
  };
}

export interface LinhaExistente {
  linha: string;
  dados: Record<string, unknown>;
}

/**
 * Cria a linha da IA só quando:
 * - produto tem aba própria;
 * - status é identificada ou preliminar (o protocolo nunca cria card
 *   nem linha automática pros outros);
 * - ainda NÃO existe nenhuma linha daquele produto (manual ou IA).
 */
export function deveCriarLinhaIA(
  o: OportunidadeProduto,
  linhasExistentes: LinhaExistente[]
): boolean {
  if (o.status !== "identificada" && o.status !== "preliminar") return false;
  const linha = linhaDaOportunidade(o);
  if (!linha) return false;
  return !linhasExistentes.some((l) => l.linha === linha);
}
