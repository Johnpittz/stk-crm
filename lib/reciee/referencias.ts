/**
 * REFERÊNCIAS OFICIAIS POR PERÍODO — motor RECIEE.
 *
 * Regra de ouro do RECIEE: a conta só pode ser julgada contra o que estava
 * VIGENTE na data da fatura, nunca contra a tabela de hoje.
 *
 * Fontes (dados abertos da ANEEL, baixados em 06/10/2026):
 *  - bandeira_acionamento.csv  (competência → bandeira acionada + R$/MWh)
 *  - bandeira_adicional.csv    (REH que fixou cada valor)
 *  - tarifas homologadas da Equatorial Goiás (subgrupo B3, sem tributos)
 *
 * Para acrescentar outra distribuidora/subgrupo: acrescentar uma vigência em
 * TARIFAS_OFICIAIS. Sem referência o motor NÃO acusa: emite achado `info`.
 */

/** Competência ("YYYY-MM") → [bandeira, adicional em R$/MWh]. */
export const BANDEIRAS_ANEEL: Record<string, [string, number]> = {
  "2015-01": ["Vermelha P1", 30.0],
  "2015-02": ["Vermelha P1", 30.0],
  "2015-03": ["Vermelha P1", 55.0],
  "2015-04": ["Vermelha P1", 55.0],
  "2015-05": ["Vermelha P1", 55.0],
  "2015-06": ["Vermelha P1", 55.0],
  "2015-07": ["Vermelha P1", 55.0],
  "2015-08": ["Vermelha P1", 55.0],
  "2015-09": ["Vermelha P1", 45.0],
  "2015-10": ["Vermelha P1", 45.0],
  "2015-11": ["Vermelha P1", 45.0],
  "2015-12": ["Vermelha P1", 45.0],
  "2016-01": ["Vermelha P1", 45.0],
  "2016-02": ["Vermelha P2", 45.0],
  "2016-03": ["Amarela", 15.0],
  "2016-04": ["Verde", 0.0],
  "2016-05": ["Verde", 0.0],
  "2016-06": ["Verde", 0.0],
  "2016-07": ["Verde", 0.0],
  "2016-08": ["Verde", 0.0],
  "2016-09": ["Verde", 0.0],
  "2016-10": ["Verde", 0.0],
  "2016-11": ["Amarela", 15.0],
  "2016-12": ["Verde", 0.0],
  "2017-01": ["Verde", 0.0],
  "2017-02": ["Verde", 0.0],
  "2017-03": ["Amarela", 20.0],
  "2017-04": ["Vermelha P1", 30.0],
  "2017-05": ["Vermelha P1", 30.0],
  "2017-06": ["Verde", 0.0],
  "2017-07": ["Amarela", 20.0],
  "2017-08": ["Vermelha P1", 30.0],
  "2017-09": ["Amarela", 20.0],
  "2017-10": ["Vermelha P2", 35.0],
  "2017-11": ["Vermelha P2", 50.0],
  "2017-12": ["Vermelha P1", 30.0],
  "2018-01": ["Verde", 0.0],
  "2018-02": ["Verde", 0.0],
  "2018-03": ["Verde", 0.0],
  "2018-04": ["Verde", 0.0],
  "2018-05": ["Amarela", 10.0],
  "2018-06": ["Vermelha P2", 50.0],
  "2018-07": ["Vermelha P2", 50.0],
  "2018-08": ["Vermelha P2", 50.0],
  "2018-09": ["Vermelha P2", 50.0],
  "2018-10": ["Vermelha P2", 50.0],
  "2018-11": ["Amarela", 10.0],
  "2018-12": ["Verde", 0.0],
  "2019-01": ["Verde", 0.0],
  "2019-02": ["Verde", 0.0],
  "2019-03": ["Verde", 0.0],
  "2019-04": ["Verde", 0.0],
  "2019-05": ["Amarela", 10.0],
  "2019-06": ["Verde", 0.0],
  "2019-07": ["Amarela", 15.0],
  "2019-08": ["Vermelha P1", 40.0],
  "2019-09": ["Vermelha P1", 40.0],
  "2019-10": ["Amarela", 15.0],
  "2019-11": ["Vermelha P1", 41.69],
  "2019-12": ["Amarela", 13.43],
  "2020-01": ["Amarela", 13.43],
  "2020-02": ["Verde", 0.0],
  "2020-03": ["Verde", 0.0],
  "2020-04": ["Verde", 0.0],
  "2020-05": ["Verde", 0.0],
  "2020-06": ["Verde", 0.0],
  "2020-07": ["Verde", 0.0],
  "2020-08": ["Verde", 0.0],
  "2020-09": ["Verde", 0.0],
  "2020-10": ["Verde", 0.0],
  "2020-11": ["Verde", 0.0],
  "2020-12": ["Vermelha P2", 62.43],
  "2021-01": ["Amarela", 13.43],
  "2021-02": ["Amarela", 13.43],
  "2021-03": ["Amarela", 13.43],
  "2021-04": ["Amarela", 13.43],
  "2021-05": ["Vermelha P1", 41.69],
  "2021-06": ["Vermelha P2", 62.43],
  "2021-07": ["Vermelha P2", 94.92],
  "2021-08": ["Vermelha P2", 94.92],
  "2021-09": ["Escassez Hídrica", 142.0],
  "2021-10": ["Escassez Hídrica", 142.0],
  "2021-11": ["Escassez Hídrica", 142.0],
  "2021-12": ["Escassez Hídrica", 142.0],
  "2022-01": ["Escassez Hídrica", 142.0],
  "2022-02": ["Escassez Hídrica", 142.0],
  "2022-03": ["Escassez Hídrica", 142.0],
  "2022-04": ["Escassez Hídrica", 71.0],
  "2022-05": ["Verde", 0.0],
  "2022-06": ["Verde", 0.0],
  "2022-07": ["Verde", 0.0],
  "2022-08": ["Verde", 0.0],
  "2022-09": ["Verde", 0.0],
  "2022-10": ["Verde", 0.0],
  "2022-11": ["Verde", 0.0],
  "2022-12": ["Verde", 0.0],
  "2023-01": ["Verde", 0.0],
  "2023-02": ["Verde", 0.0],
  "2023-03": ["Verde", 0.0],
  "2023-04": ["Verde", 0.0],
  "2023-05": ["Verde", 0.0],
  "2023-06": ["Verde", 0.0],
  "2023-07": ["Verde", 0.0],
  "2023-08": ["Verde", 0.0],
  "2023-09": ["Verde", 0.0],
  "2023-10": ["Verde", 0.0],
  "2023-11": ["Verde", 0.0],
  "2023-12": ["Verde", 0.0],
  "2024-01": ["Verde", 0.0],
  "2024-02": ["Verde", 0.0],
  "2024-03": ["Verde", 0.0],
  "2024-04": ["Verde", 0.0],
  "2024-05": ["Verde", 0.0],
  "2024-06": ["Verde", 0.0],
  "2024-07": ["Amarela", 18.85],
  "2024-08": ["Verde", 0.0],
  "2024-09": ["Vermelha P1", 44.63],
  "2024-10": ["Vermelha P2", 78.77],
  "2024-11": ["Amarela", 18.85],
  "2024-12": ["Verde", 0.0],
  "2025-01": ["Verde", 0.0],
  "2025-02": ["Verde", 0.0],
  "2025-03": ["Verde", 0.0],
  "2025-04": ["Verde", 0.0],
  "2025-05": ["Amarela", 18.85],
  "2025-06": ["Vermelha P1", 44.63],
  "2025-07": ["Vermelha P1", 44.63],
  "2025-08": ["Vermelha P2", 78.77],
  "2025-09": ["Vermelha P2", 78.77],
  "2025-10": ["Vermelha P1", 44.63],
  "2025-11": ["Vermelha P1", 44.63],
  "2025-12": ["Amarela", 18.85],
  "2026-01": ["Verde", 0.0],
  "2026-02": ["Verde", 0.0],
  "2026-03": ["Verde", 0.0],
  "2026-04": ["Verde", 0.0],
  "2026-05": ["Amarela", 18.85],
  "2026-06": ["Amarela", 18.85],
  "2026-07": ["Amarela", 18.85],
  "2026-08": ["Amarela", 18.85],
  "2026-09": ["Amarela", 18.85],
};

/**
 * Alíquota de ICMS em Goiás por período: 17% até 31/03/2024 e 19% a partir
 * de 01/04/2024 (Lei estadual 22.460/2023; ADIs 7122/7123 derrubaram as
 * alíquotas específicas de 25%/27%).
 */
export const ICMS_GO: { ate: string; aliquota: number }[] = [
  { ate: "2024-03-31", aliquota: 17 },
  { ate: "2099-12-31", aliquota: 19 },
];

/**
 * PIS/COFINS com o ICMS fora da base (Tema 69 do STF). A alíquota NOMINAL é
 * 1,65% e 7,6%, mas a ANEEL sanciona a alíquota efetiva resultante — por isso
 * a conta traz 0,3918% e ~1,82%. Tratar isso como erro é falso positivo.
 */
export const PIS_EFETIVO = 0.3918;
export const COFINS_EFETIVO = 1.822;
export const TOLERANCIA_ALIQUOTA = 0.05;

/**
 * Tarifa sem tributos (R$/kWh) por vigência — Equatorial Goiás, subgrupo B3
 * convencional (classe B). Tolerância do motor: 0,001 R$/kWh.
 */
export interface VigenciaTarifa {
  distribuidora: string;
  subgrupo: string;
  inicio: string;
  fim: string | null; // null = vigente
  semTributos: number;
  resolucao: string;
}

export const TARIFAS_OFICIAIS: VigenciaTarifa[] = [
  {
    distribuidora: "EQUATORIAL GOIAS",
    subgrupo: "B3",
    inicio: "2023-10-22",
    fim: "2024-10-21",
    semTributos: 0.71063,
    resolucao: "REH 3.307/2023",
  },
  {
    distribuidora: "EQUATORIAL GOIAS",
    subgrupo: "B3",
    inicio: "2024-10-22",
    fim: "2025-10-21",
    semTributos: 0.74593,
    resolucao: "REH 3.433/2024",
  },
  {
    distribuidora: "EQUATORIAL GOIAS",
    subgrupo: "B3",
    inicio: "2025-10-22",
    fim: null,
    semTributos: 0.89181,
    resolucao: "REH 3.544/2025",
  },
];

export function valorBandeira(competencia: string): number {
  return BANDEIRAS_ANEEL[competencia]?.[1] ?? 0;
}

export function nomeBandeira(competencia: string): string {
  return BANDEIRAS_ANEEL[competencia]?.[0] ?? "s/dados";
}

/** Alíquota de ICMS esperada em Goiás para a data de fim do ciclo. */
export function aliquotaIcmsEsperada(estado: string, data: string): number | null {
  if ((estado || "").toUpperCase() !== "GO") return null;
  const faixa = ICMS_GO.find((f) => data <= f.ate);
  return faixa ? faixa.aliquota : null;
}
