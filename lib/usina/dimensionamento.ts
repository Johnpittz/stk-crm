/**
 * 25/11/2026 — Fase 1 do estudo de usina (ideia da demo Reonic).
 *
 * Cálculo puro do dimensionamento de um sistema fotovoltaico a partir do
 * consumo do cliente. Nada de UI, nada de banco: função pura e testada
 * (lib/usina/dimensionamento.test.ts).
 *
 * Fórmulas (transparência para o vendedor/cliente ver de onde vem o número):
 *   consumo anual      = consumo mensal ×12
 *   kWp necessário     = (consumo anual × meta%) / fator de produção
 *   nº de painéis      = ceil(kWp ×1000 / Wp do módulo)
 *   geração mensal     = kWp instalado × fator de produção /12
 *   cobre %            = geração mensal / consumo mensal ×100
 *   economia           = (energia usada × tarifa) + (excedente × tarifa × crédito%)
 *   payback            = preço do kit / economia anual (só se preço digitado)
 *   CO₂ evitado        = geração anual (MWh) ×0,2 t/MWh (média da rede)
 *
 * "Fator de produção" = kWh gerados por kWp instalado por ano. Usamos1.500
 * (média Brasil, com folga). Constante visível no topo p/ ajuste depois.
 */

/** kWh gerados por kWp por ano (média nacional — ajustar se quiser região). */
export const FATOR_PRODUCAO_KWH_KWP_ANO = 1500;
/** t de CO₂ evitadas por MWh gerado (rede brasileira). */
export const CO2_TONS_POR_MWH = 0.2;
/** área ocupada por painel, m² (módulo comercial típico ~2,1 m²). */
export const AREA_M2_POR_PAINEL = 2.1;
/** % do excedente injetado que volta como crédito (1 = crédito cheio). */
export const CREDITO_PADRAO_PCT = 1;

export interface EntradaDimensionamento {
  consumoMensalKwh: number;
  tarifaRpkwh: number;
  /**50–200: meta de cobertura (zerar conta ≈100, acumular crédito ≈120). */
  metaPct: number;
  /** potência de pico do módulo escolhido, em Wp. */
  moduloWp: number;
  /** preço total digitado à mão (placeholder) — opcional. */
  precoKitR?: number;
  /** crédito dado ao excedente injetado (padrão1 =100%). */
  creditoPct?: number;
}

export interface ResultadoDimensionamento {
  kwpNecessario: number;
  kwpInstalado: number;
  numPaineis: number;
  geracaoMensalKwh: number;
  geracaoAnualKwh: number;
  cobrePct: number;
  economiaMensalR: number;
  economiaAnualR: number;
  paybackAnos: number | null;
  co2EvitadoTons: number;
  areaM2: number;
  erros: string[];
}

export function dimensionar(entrada: EntradaDimensionamento): ResultadoDimensionamento {
  const erros: string[] = [];
  const consumo = Number(entrada.consumoMensalKwh);
  const tarifa = Number(entrada.tarifaRpkwh);
  const meta = Number(entrada.metaPct);
  const moduloWp = Number(entrada.moduloWp);

  if (!(consumo > 0)) erros.push("Informe o consumo mensal em kWh (maior que zero).");
  if (!(tarifa > 0)) erros.push("Informe a tarifa em R$/kWh (maior que zero).");
  if (!(meta >= 50 && meta <= 200)) erros.push("A meta de cobertura deve ficar entre50% e200%.");
  if (!(moduloWp > 0)) erros.push("Escolha um módulo (painel) com potência maior que zero.");

  if (erros.length > 0) {
    return {
      kwpNecessario: 0,
      kwpInstalado: 0,
      numPaineis: 0,
      geracaoMensalKwh: 0,
      geracaoAnualKwh: 0,
      cobrePct: 0,
      economiaMensalR: 0,
      economiaAnualR: 0,
      paybackAnos: null,
      co2EvitadoTons: 0,
      areaM2: 0,
      erros,
    };
  }

  const creditoPct = entrada.creditoPct ?? CREDITO_PADRAO_PCT;
  const consumoAnual = consumo * 12;
  const geracaoAlvoAnual = (consumoAnual * meta) / 100;

  const kwpNecessario = geracaoAlvoAnual / FATOR_PRODUCAO_KWH_KWP_ANO;
  const numPaineis = Math.ceil((kwpNecessario * 1000) / moduloWp);
  const kwpInstalado = (numPaineis * moduloWp) / 1000;

  const geracaoAnualKwh = kwpInstalado * FATOR_PRODUCAO_KWH_KWP_ANO;
  const geracaoMensalKwh = geracaoAnualKwh / 12;
  const cobrePct = (geracaoMensalKwh / consumo) * 100;

  const usadaMes = Math.min(geracaoMensalKwh, consumo);
  const excedenteMes = Math.max(0, geracaoMensalKwh - consumo);
  const economiaMensalBruta = (usadaMes + excedenteMes * creditoPct) * tarifa;
  const economiaMensalR = economiaMensalBruta;
  const economiaAnualR = economiaMensalBruta * 12;

  const preco = Number(entrada.precoKitR ?? 0);
  const paybackAnos = preco > 0 && economiaAnualR > 0 ? preco / economiaAnualR : null;

  return {
    kwpNecessario,
    kwpInstalado,
    numPaineis,
    geracaoMensalKwh,
    geracaoAnualKwh,
    cobrePct,
    economiaMensalR,
    economiaAnualR,
    paybackAnos,
    co2EvitadoTons: (geracaoAnualKwh / 1000) * CO2_TONS_POR_MWH,
    areaM2: numPaineis * AREA_M2_POR_PAINEL,
    erros,
  };
}

/* ─── Catálogo placeholder ────────────────────────────────────────────────
 * Preços ficam A DEFINIR (decisão do João em25/11) — a tela deixa o vendedor
 * digitar o valor do kit, como faz a própria Reonic ("valor do kit"). Quando
 * houver planilha de fornecedor, estes itens migram para a tabela `produtos`
 * ou para uma tabela de catálogo usina. */

export interface ItemCatalogo {
  marca: string;
  modelo: string;
}

export interface Modulo extends ItemCatalogo {
  wp: number;
  /** dimensão típica do módulo, p/ estimativa de área do telhado. */
  alturaM: number;
  larguraM: number;
}

export interface Inversor extends ItemCatalogo {
  kw: number;
  tipo: string;
}

export const CATALOGO_MODULOS: Modulo[] = [
  { marca: "Astronergy", modelo: "CHSM72M-HC-525", wp: 525, alturaM: 2.278, larguraM: 1.134 },
  { marca: "Honor Solar", modelo: "HB-M16R/132H-550", wp: 550, alturaM: 2.382, larguraM: 1.134 },
  { marca: "Honor Solar", modelo: "HB-M16R/132H-610", wp: 610, alturaM: 2.382, larguraM: 1.134 },
  { marca: "Canadian Solar", modelo: "HiKu6 CS6R-585", wp: 585, alturaM: 2.278, larguraM: 1.134 },
  { marca: "Jinko Solar", modelo: "Tiger Neo N-type72HL4-V25", wp: 615, alturaM: 2.278, larguraM: 1.134 },
];

export const CATALOGO_INVERSORES: Inversor[] = [
  { marca: "Solplanet", modelo: "ASW9100-S", kw: 9.1, tipo: "String monofásico" },
  { marca: "Solplanet", modelo: "ASW6000-S", kw: 6.0, tipo: "String monofásico" },
  { marca: "Growatt", modelo: "MIN3000TL-XH", kw: 3.0, tipo: "String monofásico" },
  { marca: "Growatt", modelo: "MIC2500TL-X", kw: 2.5, tipo: "Microinversor" },
];

/** menor inversor que aguenta a potência instalada (com10% de folga). */
export function escolherInversor(kwpInstalado: number): Inversor | null {
  const alvo = kwpInstalado * 1.1;
  const ordenados = [...CATALOGO_INVERSORES].sort((a, b) => a.kw - b.kw);
  return ordenados.find((i) => i.kw >= alvo) ?? ordenados[ordenados.length - 1];
}
