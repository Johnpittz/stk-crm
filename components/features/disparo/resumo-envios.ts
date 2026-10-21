/**
 * 19/10 (pedido do João) — o card "Campanhas" da tela de Disparo vira um
 * PAINEL DE ENVIOS: agregado com os números certos (enviados, falhas,
 * taxa, em andamento) no formato de dashboard. Puro e testável.
 */

export interface CampanhaEnvio {
  id?: string;
  name?: string;
  status?: string | null;
  sent?: number | null;
  failed?: number | null;
  numbers?: string[] | null;
  createdAt?: string | null;
}

export interface ResumoEnvios {
  /** mensagens entregues com sucesso (soma de todos os envios) */
  enviadas: number;
  falhas: number;
  /** enviadas + falhas = tentativas feitas */
  tentativas: number;
  /** % de sucesso arredondada (0 quando ainda não tentou nada) */
  taxa: number;
  emAndamento: number;
  concluidas: number;
  falharamCampanha: number;
  pendentes: number;
  totalCampanhas: number;
  contatos: number;
}

export function resumoEnvios(campanhas: CampanhaEnvio[]): ResumoEnvios {
  const num = (v: unknown): number => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  let enviadas = 0;
  let falhas = 0;
  let emAndamento = 0;
  let concluidas = 0;
  let falharamCampanha = 0;
  let pendentes = 0;
  let contatos = 0;

  for (const c of campanhas) {
    enviadas += num(c.sent);
    falhas += num(c.failed);
    contatos += Array.isArray(c.numbers) ? c.numbers.length : 0;
    if (c.status === "running") emAndamento++;
    else if (c.status === "completed") concluidas++;
    else if (c.status === "failed") falharamCampanha++;
    else if (c.status === "pending") pendentes++;
  }

  const tentativas = enviadas + falhas;
  const taxa = tentativas > 0 ? Math.round((enviadas / tentativas) * 100) : 0;

  return {
    enviadas,
    falhas,
    tentativas,
    taxa,
    emAndamento,
    concluidas,
    falharamCampanha,
    pendentes,
    totalCampanhas: campanhas.length,
    contatos,
  };
}
