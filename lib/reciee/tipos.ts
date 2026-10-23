/**
 * Tipos do motor RECIEE (validação determinística de faturas).
 *
 * O motor recebe o que a IA extraiu da fatura (`lib/ia/analisar-fatura.ts`)
 * e devolve ACHADOS — cada um com código do catálogo RECIEE, severidade e o
 * valor em disputa quando dá para quantificar.
 */

export interface LinhaFatura {
  descricao: string;
  /** kWh da linha (a fatura pode ter mais de uma: consumo + bandeira). */
  quantidade: number;
  /** Tarifa com tributos (R$/kWh) — a que a conta usa para achar o valor. */
  tarifaCct: number;
  /** Tarifa sem tributos (R$/kWh) — a que se compara com a ANEEL. */
  tarifaSemTributos: number;
  valor: number;
}

export interface ImpostosFatura {
  baseIcms: number;
  aliquotaIcms: number;
  icms: number;
  basePisCofins: number;
  aliquotaPis: number;
  pis: number;
  aliquotaCofins: number;
  cofins: number;
}

export interface ItemFinanceiro {
  descricao: string;
  valor: number;
}

export interface FaturaReciee {
  referencia: string; // "ABR/2026"
  estado: string; // "GO"
  distribuidora?: string;
  subgrupo?: string;
  inicio: string;
  fim: string; // "2026-04-24"
  dias: number; // "Nº Dias" impresso na fatura
  consumo: number; // kWh
  leituraAnterior: number | null;
  leituraAtual: number | null;
  fatorK: number;
  linhas: LinhaFatura[];
  impostos: ImpostosFatura | null;
  /** Valor da bandeira cobrado, já sem tributos (linha ADC BANDEIRA). */
  bandeiraCobradaSemTributos: number;
  itens: ItemFinanceiro[];
  valorTotal: number;
}

export type Severidade = "critico" | "alerta" | "ok" | "info";

export interface Achado {
  /** Código do catálogo RECIEE (RECIEE-058) ou interno (MOTOR-SOMA). */
  codigo: string;
  tema: string;
  descricao: string;
  severidade: Severidade;
  /** R$ em disputa quando dá para quantificar; 0 quando é sinal/documento. */
  valorEstimado: number;
  /** Competência da fatura em que o achado foi detectado. */
  referencia?: string;
}
