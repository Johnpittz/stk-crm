/**
 * MOTOR RECIEE — validação determinística de faturas.
 *
 * O que ele faz (e a IA não faz): prova a conta. Compara o que foi cobrado
 * com o que deveria ser cobrado, usando a referência VIGENTE no período e a
 * cadeia de leituras entre faturas. É essa prova que a distribuidora não
 * consegue rebater dizendo "nossa conta está certa".
 *
 * Auditoria que calibrou os números: 29 faturas da UC 000266515901272
 * (Equatorial Goiás, B3), NOV/2023 → MAI/2026, R$ 152.470,68 — a aritmética
 * fechou 100% e os achados emitidos aqui são exatamente os reais.
 *
 * Tolerâncias (calibradas na auditoria real — menores geram falso positivo,
 * maiores deixam erro de verdade passar):
 *  - valor/linha/soma ......... R$ 0,01
 *  - tarifa sem tributos ...... R$ 0,001 por kWh (0,1 centavo)
 *  - bandeira rateada ......... R$ 2,00 (distribuidora arredonda o rateio)
 *  - PIS/COFINS ............... 0,05% da base (alíquota efetiva varia)
 */
import {
  aliquotaIcmsEsperada,
  nomeBandeira,
  TARIFAS_OFICIAIS,
  valorBandeira,
  COFINS_EFETIVO,
  PIS_EFETIVO,
  type VigenciaTarifa,
} from "./referencias";
import { FRASE_GUARD_SECAO_8, INDICES_SECAO_8, temaDe } from "./indices";
import type { Achado, FaturaReciee } from "./tipos";

export const TOLERANCIA_VALOR = 0.01;
export const TOLERANCIA_TARIFA = 0.001;
export const TOLERANCIA_BANDEIRA = 2;

const MS_DIA = 86_400_000;

function dataMs(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

/** Dias inclusivos entre as datas (25/03 → 24/04 = 31 dias). */
export function diasInclusivos(inicio: string, fim: string): number {
  return Math.round((dataMs(fim) - dataMs(inicio)) / MS_DIA) + 1;
}

export function competencia(iso: string): string {
  return iso.slice(0, 7);
}

function mesAnterior(iso: string): string {
  const [a, m] = iso.slice(0, 7).split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MESES_PT = [
  "JAN",
  "FEV",
  "MAR",
  "ABR",
  "MAI",
  "JUN",
  "JUL",
  "AGO",
  "SET",
  "OUT",
  "NOV",
  "DEZ",
];

/** Competências inteiras que ficaram de fora entre duas faturas ("JUL/2024"). */
export function mesesFaltantes(deFim: string, ateInicio: string): string[] {
  const saida: string[] = [];
  let [a, m] = deFim.slice(0, 7).split("-").map(Number);
  const [fa, fm] = ateInicio.slice(0, 7).split("-").map(Number);
  m += 1;
  if (m > 12) {
    m = 1;
    a += 1;
  }
  while (a < fa || (a === fa && m <= fm)) {
    saida.push(`${MESES_PT[m - 1]}/${a}`);
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return saida;
}

function brl(v: number): string {
  return v.toFixed(2).replace(".", ",");
}

function achado(
  codigo: string,
  descricao: string,
  severidade: Achado["severidade"],
  valorEstimado = 0,
  referencia?: string
): Achado {
  return {
    codigo,
    tema: temaDe(codigo),
    descricao,
    severidade,
    valorEstimado: Math.round(valorEstimado * 100) / 100,
    referencia,
  };
}

/**
 * Tarifa sem tributos esperada para o PERÍODO da fatura. Quando a vigência
 * muda no meio do ciclo, é a média ponderada pelos dias inclusivos — foi o
 * que a Equatorial fez corretamente em OUT/2024 e OUT/2025.
 */
export function tarifaOficialPeriodo(
  inicio: string,
  fim: string,
  vigencias: VigenciaTarifa[] = TARIFAS_OFICIAIS
): { valor: number; trechos: number } | null {
  const total = diasInclusivos(inicio, fim);
  let soma = 0;
  let trechos = 0;
  for (const v of vigencias) {
    const ini = Math.max(dataMs(inicio), dataMs(v.inicio));
    const f = dataMs(v.fim ?? "2099-12-31");
    const fimV = Math.min(dataMs(fim), f);
    const dias = fimV < ini ? 0 : Math.round((fimV - ini) / MS_DIA) + 1;
    if (dias > 0) {
      soma += dias * v.semTributos;
      trechos += 1;
    }
  }
  return trechos === 0 ? null : { valor: soma / total, trechos };
}

/**
 * Bandeira esperada (sem tributos) pelo rateio que a própria conta usa:
 * os dias do mês FINAL do ciclo carregam a bandeira daquele mês e o resto,
 * a do mês anterior. Validado centavo a centavo em 13 de 16 faturas com
 * bandeira da auditoria.
 */
export function bandeiraEsperada(f: FaturaReciee): number {
  const diasFim = Math.min(Number(f.fim.slice(8, 10)), f.dias);
  const restante = Math.max(f.dias - diasFim, 0);
  const vFim = valorBandeira(competencia(f.fim));
  const vPrev = valorBandeira(mesAnterior(f.fim));
  return (f.consumo * (diasFim * vFim + restante * vPrev)) / 1000 / f.dias;
}

function achadosGuardaSecao8(opcoes?: { codigosSugeridos?: string[] }): Achado[] {
  const sugeridos = opcoes?.codigosSugeridos ?? [];
  return sugeridos
    .filter((c) => INDICES_SECAO_8.includes(c))
    .map((c) =>
      achado(
        c,
        `Continuidade/ressarcimento: ${FRASE_GUARD_SECAO_8}`,
        "info",
        0
      )
    );
}

/** Valida UMA fatura (leitura, linhas, tarifa, impostos, soma, bandeira). */
export function validarFatura(
  f: FaturaReciee,
  opcoes?: { codigosSugeridos?: string[] }
): Achado[] {
  const out: Achado[] = [...achadosGuardaSecao8(opcoes)];
  const rot = f.referencia;

  // 1) Leitura: (atual - anterior) x fator K = consumo
  if (f.leituraAnterior != null && f.leituraAtual != null) {
    const medido = (f.leituraAtual - f.leituraAnterior) * (f.fatorK || 1);
    if (Math.abs(medido - f.consumo) > 1) {
      out.push(
        achado(
          "RECIEE-162",
          `Leitura não fecha com o consumo: (${brl(f.leituraAtual)} - ` +
            `${brl(f.leituraAnterior)}) = ${brl(medido)} kWh, mas a conta ` +
            `fatura ${brl(f.consumo)} kWh.`,
          "critico",
          0,
          rot
        )
      );
    }
  }

  // 2) Linhas: quantidade x tarifa = valor cobrado
  for (const l of f.linhas) {
    const esperado = l.quantidade * l.tarifaCct;
    if (Math.abs(esperado - l.valor) > TOLERANCIA_VALOR) {
      out.push(
        achado(
          "MOTOR-LINHA",
          `Linha "${l.descricao}": ${brl(l.quantidade)} kWh x ` +
            `${l.tarifaCct.toFixed(6)} = R$ ${brl(esperado)}, mas a conta ` +
            `cobra R$ ${brl(l.valor)}.`,
          "critico",
          Math.abs(esperado - l.valor),
          rot
        )
      );
    }
  }

  // 3) Tarifa sem tributos x referência vigente do período
  const ref = tarifaOficialPeriodo(f.inicio, f.fim);
  const linhaConsumo = f.linhas.find(
    (l) => /CONSUMO|FATURÁVEL/i.test(l.descricao) && l.tarifaSemTributos > 0
  );
  if (ref && linhaConsumo) {
    if (Math.abs(ref.valor - linhaConsumo.tarifaSemTributos) > TOLERANCIA_TARIFA) {
      const codigo = ref.trechos > 1 ? "RECIEE-040" : "RECIEE-058";
      out.push(
        achado(
          codigo,
          `Tarifa sem tributos de R$ ${linhaConsumo.tarifaSemTributos.toFixed(
            6
          )} contra a homologada de R$ ${ref.valor.toFixed(6)} para ` +
            `${competencia(f.inicio)}/${competencia(f.fim)} ` +
            `(${ref.trechos} vigência(s) no período).`,
          "critico",
          Math.abs(ref.valor - linhaConsumo.tarifaSemTributos) * linhaConsumo.quantidade,
          rot
        )
      );
    }
  } else if (!ref) {
    out.push(
      achado(
        "MOTOR-TARIFA-REF",
        "Sem tabela tarifária homologada para esta distribuidora/subgrupo " +
          "no período — tarifa não avaliada (nunca acusar sem referência).",
        "info",
        0,
        rot
      )
    );
  }

  // 4) Impostos: alíquota de ICMS do período, base por dentro e PIS/COFINS
  if (f.impostos) {
    const imp = f.impostos;
    const esperada = aliquotaIcmsEsperada(f.estado, f.fim);
    if (esperada != null && Math.abs(imp.aliquotaIcms - esperada) > 0.01) {
      out.push(
        achado(
          "RECIEE-050",
          `Alíquota de ICMS de ${imp.aliquotaIcms}% para ${competencia(f.fim)}; ` +
            `em Goiás a alíquota vigente era de ${esperada}%.`,
          "critico",
          (imp.aliquotaIcms - esperada) / 100 * imp.baseIcms,
          rot
        )
      );
    }
    // PIS/COFINS: ICMS fora da base (Tema 69) e alíquota efetiva sancionada
    const somaBaseIcms = f.linhas.reduce((s, l) => s + l.valor, 0);
    const baseEsperada = somaBaseIcms - imp.icms;
    if (
      Math.abs(imp.basePisCofins - somaBaseIcms) < 0.02 ||
      Math.abs(imp.basePisCofins - baseEsperada) > 0.05
    ) {
      out.push(
        achado(
          "RECIEE-T69-001",
          `Base de PIS/COFINS de R$ ${brl(imp.basePisCofins)} não corresponde ` +
            `à base de ICMS menos o ICMS (R$ ${brl(baseEsperada)}) — a base ` +
            `deve EXCLUIR o ICMS (Tema 69 do STF).`,
          "critico",
          Math.abs(imp.basePisCofins - baseEsperada),
          rot
        )
      );
    } else {
      const espPis = (imp.basePisCofins * PIS_EFETIVO) / 100;
      const espCofins = (imp.basePisCofins * COFINS_EFETIVO) / 100;
      if (Math.abs(espPis - imp.pis) > Math.max(0.05, imp.basePisCofins * 0.0005)) {
        out.push(
          achado(
            "RECIEE-016",
            `PIS cobrado de R$ ${brl(imp.pis)} contra R$ ${brl(espPis)} na ` +
              `alíquota efetiva de ${PIS_EFETIVO}%.`,
            "critico",
            Math.abs(espPis - imp.pis),
            rot
          )
        );
      }
      if (
        Math.abs(espCofins - imp.cofins) >
        Math.max(0.05, imp.basePisCofins * 0.0005)
      ) {
        out.push(
          achado(
            "RECIEE-016",
            `COFINS cobrado de R$ ${brl(imp.cofins)} contra R$ ${brl(espCofins)} ` +
              `na alíquota efetiva de ${COFINS_EFETIVO}%.`,
            "critico",
            Math.abs(espCofins - imp.cofins),
            rot
          )
        );
      }
    }
  }

  // 5) Soma: linhas + itens = total impresso. A bandeira entra como linha
  //    na fatura da Equatorial; se o parser não achou a linha, contamos aqui.
  const temLinhaBandeira = f.linhas.some((l) => /BANDEIRA/i.test(l.descricao));
  const somaLinhas = f.linhas.reduce((s, l) => s + l.valor, 0);
  const bandeiraAvulsa =
    f.bandeiraCobradaSemTributos > 0 && !temLinhaBandeira
      ? f.bandeiraCobradaSemTributos
      : 0;
  const somaItens =
    f.itens.reduce((s, i) => s + i.valor, 0) + bandeiraAvulsa;
  const soma = somaLinhas + somaItens;
  if (Math.abs(soma - f.valorTotal) > TOLERANCIA_VALOR) {
    out.push(
      achado(
        "MOTOR-SOMA",
        `Soma de R$ ${brl(soma)} (energia R$ ${brl(somaLinhas)} + itens ` +
          `R$ ${brl(somaItens)}) contra total impresso de R$ ${brl(f.valorTotal)}.`,
        "critico",
        Math.abs(soma - f.valorTotal),
        rot
      )
    );
  }

  // 6) Ciclo de faturamento: os dias impressos têm que bater com o período
  const reais = diasInclusivos(f.inicio, f.fim);
  if (Math.abs(reais - f.dias) > 1) {
    out.push(
      achado(
        "RECIEE-051",
        `Período ${f.inicio} → ${f.fim} tem ${reais} dias, mas a conta ` +
          `imprime ${f.dias}.`,
        "alerta",
        0,
        rot
      )
    );
  }

  // 7) Bandeira: oficial rateada x cobrada
  const esperadaBandeira = bandeiraEsperada(f);
  const dif = f.bandeiraCobradaSemTributos - esperadaBandeira;
  if (Math.abs(dif) > TOLERANCIA_BANDEIRA) {
    out.push(
      achado(
        "RECIEE-011",
        `Bandeira cobrada de R$ ${brl(f.bandeiraCobradaSemTributos)} contra ` +
          `R$ ${brl(esperadaBandeira)} da tabela ANEEL rateada ` +
          `(${nomeBandeira(competencia(f.fim))} em ${competencia(f.fim)}, ` +
          `${f.dias} dias).`,
        "alerta",
        Math.abs(dif),
        rot
      )
    );
  }

  return out;
}

/** Valida um histórico de faturas (cadeia de leituras e buracos de ciclo). */
export function validarSequencia(faturas: FaturaReciee[]): Achado[] {
  const out: Achado[] = [];
  const ordenadas = [...faturas].sort((a, b) => a.fim.localeCompare(b.fim));
  for (let i = 1; i < ordenadas.length; i++) {
    const ant = ordenadas[i - 1];
    const atu = ordenadas[i];
    if (ant.leituraAtual == null || atu.leituraAnterior == null) continue;

    const buraco = diasInclusivos(ant.fim, atu.inicio) - 1;

    // medidor zerou = troca de medidor (RECIEE-134). Só vale quando não há
    // furo de ciclo: com mês faltando, o pulo de leitura é esperado e o
    // achado é o furo, não uma acusação de medidor trocado.
    const trocou =
      atu.leituraAnterior === 0 || atu.leituraAnterior < ant.leituraAtual;
    if (trocou) {
      out.push(
        achado(
          "RECIEE-134",
          `Leitura anterior de ${atu.referencia} é ${brl(atu.leituraAnterior)} ` +
            `contra ${brl(ant.leituraAtual)} de ${ant.referencia}: provável ` +
            `troca de medidor — pedir o termo de troca para fechar a cadeia.`,
          "alerta",
          0,
          atu.referencia
        )
      );
    } else if (atu.leituraAnterior !== ant.leituraAtual && buraco <= 1) {
      const pulo = atu.leituraAnterior - ant.leituraAtual;
      out.push(
        achado(
          "RECIEE-077",
          `Cadeia de leitura quebrada: ${ant.referencia} termina em ` +
            `${brl(ant.leituraAtual)} e ${atu.referencia} começa em ` +
            `${brl(atu.leituraAnterior)} (pulo de ${brl(pulo)} kWh sem fatura).`,
          "alerta",
          0,
          atu.referencia
        )
      );
    }

    // buraco de ciclo: o fim de uma não encosta no início da outra
    if (buraco > 1) {
      const faltantes = mesesFaltantes(ant.fim, atu.inicio);
      out.push(
        achado(
          "MOTOR-FURO",
          `${ant.referencia} termina em ${ant.fim} e ${atu.referencia} ` +
            `começa em ${atu.inicio}: ${buraco} dia(s) sem fatura na pasta ` +
            `(falta ${faltantes.join(", ") || "ciclo"} — pedir as faturas ` +
            `faltantes; se não existirem, é faturamento omitido).`,
          "alerta",
          0,
          atu.referencia
        )
      );
    }
  }
  return out;
}
