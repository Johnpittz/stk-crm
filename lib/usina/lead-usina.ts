/**
 * 25/11/2026 — Fase2-A: regra do LEAD da landing "quanto posso economizar".
 *
 * Puro de propósito: a rota pública só faz rate-limit e grava; validação,
 * estimativa e payload moram aqui (testável sem rede/banco).
 *
 * A landing pede GASTO EM REAIS (como a Reonic), não kWh — quem não souber
 * o consumo em kWh entra por estimativa: consumo = gasto / tarifa padrão.
 * A tarifa padrão fica declarada aqui para o vendedor saber o que a conta
 * usa (a landing mostra a premissa na tela).
 */
import { CATALOGO_MODULOS, dimensionar } from "./dimensionamento";
import { calcularScoreLead } from "./score-lead";

/** Premissa da estimativa da landing (R$/kWh residencial, média). */
export const TARIFA_PADRAO_RKWH = 0.95;

export interface EntradaLeadUsina {
  nome?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  gastoMensalR?: number | null;
  consumoKwh?: number | null;
}

export interface LeadUsina {
  /** vazios = válido (padrão do projeto). */
  erros: string[];
  consumoMensalKwh: number;
  /** payload pronto para insert em `leads_marketing`. */
  payload: Record<string, any>;
}

export function montarLeadUsina(entrada: EntradaLeadUsina): LeadUsina {
  const erros: string[] = [];
  const nome = String(entrada.nome ?? "").trim();
  const telefoneDigitos = String(entrada.telefone ?? "").replace(/\D/g, "");
  const gasto = Number(entrada.gastoMensalR ?? 0);
  const kwh = Number(entrada.consumoKwh ?? 0);

  if (nome.length < 2) erros.push("nome");
  if (telefoneDigitos.length < 10) erros.push("telefone");
  if (!(gasto > 0) && !(kwh > 0)) erros.push("gasto");

  const consumoMensalKwh = kwh > 0 ? kwh : gasto > 0 ? gasto / TARIFA_PADRAO_RKWH : 0;

  if (erros.length > 0) return { erros, consumoMensalKwh, payload: {} };

  const r = dimensionar({
    consumoMensalKwh,
    tarifaRpkwh: TARIFA_PADRAO_RKWH,
    metaPct: 100,
    moduloWp: CATALOGO_MODULOS[0].wp, // padrão do catálogo (Astronergy525)
  });

  const payload = {
    nome,
    telefone: telefoneDigitos,
    origem: "site",
    status: "novo",
    score: calcularScoreLead({ gastoMensalR: gasto, telefone: entrada.telefone }),
    notas: JSON.stringify({
      fonte: "landing_usina",
      cidade: String(entrada.cidade ?? "").trim() || null,
      gastoMensalR: gasto > 0 ? gasto : null,
      consumoMensalKwh,
      tarifaPadraoRkwh: TARIFA_PADRAO_RKWH,
      kwp: r.kwpInstalado,
      numPaineis: r.numPaineis,
      geracaoMensalKwh: r.geracaoMensalKwh,
      cobrePct: r.cobrePct,
    }),
  };

  return { erros: [], consumoMensalKwh, payload };
}
