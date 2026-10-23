/**
 * Adaptadores das linhas do banco (faturas_reciee) para o motor.
 *
 * A tabela gravou o que a IA conseguiu extrair; o motor aceita o que houver.
 * O que a tabela não tem fica `null` e o motor simplesmente NÃO emite o
 * achado daquele item — nunca adivinha, nunca acusa sem dado.
 */
import type { FaturaReciee, ItemFinanceiro, LinhaFatura } from "./tipos";

/** Linha crua de `faturas_reciee`. */
export interface FaturaDb {
  competencia: string; // "ABR/2026"
  consumo_kwh: number | string | null;
  tarifa_aplicada: number | string | null;
  valor_consumo: number | string | null;
  icms_valor: number | string | null;
  icms_aliquota: number | string | null;
  pis_valor: number | string | null;
  cofins_valor: number | string | null;
  bandeira: string | null;
  cip: number | string | null;
  valor_total: number | string | null;
  estado?: string | null;
}

const MESES_PT: Record<string, number> = {
  JAN: 1,
  FEV: 2,
  MAR: 3,
  ABR: 4,
  MAI: 5,
  JUN: 6,
  JUL: 7,
  AGO: 8,
  SET: 9,
  OUT: 10,
  NOV: 11,
  DEZ: 12,
};

function num(v: number | string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** "ABR/2026" → "2026-04-01" (dia arbitrário: só serve para achar vigência). */
export function competenciaParaData(competencia: string): string | null {
  const m = MESES_PT[(competencia || "").slice(0, 3).toUpperCase()];
  const ano = Number((competencia || "").slice(4, 8));
  if (!m || !ano) return null;
  return `${ano}-${String(m).padStart(2, "0")}-01`;
}

/** Linha de bandeira cobrada, quando a tabela guardou o nome. */
function linhaBandeira(f: FaturaDb): LinhaFatura | null {
  if (!f.bandeira) return null;
  const valor = num(f.valor_consumo) ?? 0;
  const qtd = num(f.consumo_kwh) ?? 0;
  // Só entra como linha se a fatura não tiver separado o consumo: aqui a
  // tabela tem UM valor de consumo, então a bandeira fica no campo próprio.
  return qtd > 0 && valor > 0
    ? { descricao: `BANDEIRA ${f.bandeira}`, quantidade: 0, tarifaCct: 0, tarifaSemTributos: 0, valor: 0 }
    : null;
}

/**
 * Converte uma linha de `faturas_reciee` em fatura do motor.
 *
 * Só o que existe na tabela vira dado: sem período impresso e sem leituras,
 * o motor não avalia ciclo nem cadeia (fica para a próxima etapa, quando a
 * extração passar a gravar as datas de leitura).
 */
export function mapearFaturaDb(f: FaturaDb): FaturaReciee {
  const consumo = num(f.consumo_kwh) ?? 0;
  const tarifa = num(f.tarifa_aplicada) ?? 0;
  const valorConsumo = num(f.valor_consumo) ?? 0;
  const baseIcms = valorConsumo;
  const icms = num(f.icms_valor) ?? 0;
  const pis = num(f.pis_valor) ?? 0;
  const cofins = num(f.cofins_valor) ?? 0;
  const cip = num(f.cip) ?? 0;

  const linhas: LinhaFatura[] = [];
  if (consumo > 0 || valorConsumo > 0) {
    linhas.push({
      descricao: "CONSUMO / FATURÁVEL",
      quantidade: consumo,
      tarifaCct: tarifa,
      // A tabela guarda a tarifa COM tributos; sem-tributos não foi extraído,
      // então o motor pula a comparação com a ANEEL em vez de inventá-la.
      tarifaSemTributos: 0,
      valor: valorConsumo,
    });
  }
  const lb = linhaBandeira(f);
  if (lb) linhas.push(lb);

  const itens: ItemFinanceiro[] = [];
  if (cip > 0) {
    itens.push({ descricao: "CONTRIB. ILUM. PÚBLICA - MUNICIPAL", valor: cip });
  }

  const temImposto = icms > 0 || pis > 0 || cofins > 0;

  return {
    referencia: f.competencia,
    estado: f.estado ?? "GO",
    inicio: competenciaParaData(f.competencia) ?? "",
    fim: competenciaParaData(f.competencia) ?? "",
    dias: 30,
    consumo,
    leituraAnterior: null, // não extraídos pela IA ainda
    leituraAtual: null,
    fatorK: 1,
    linhas,
    impostos: temImposto
      ? {
          baseIcms,
          aliquotaIcms: num(f.icms_aliquota) ?? 0,
          icms,
          basePisCofins: baseIcms - icms,
          aliquotaPis: 0,
          pis,
          aliquotaCofins: 0,
          cofins,
        }
      : null,
    bandeiraCobradaSemTributos: 0,
    itens,
    valorTotal: num(f.valor_total) ?? valorConsumo + cip,
  };
}
