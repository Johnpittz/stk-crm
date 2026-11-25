/**
 * 25/11/2026 — Fase1: geração da PROPOSTA em PDF (jspdf já é dependência).
 *
 * Montagem simples e legível (o vendedor imprime e manda pro cliente):
 * cabeçalho → cliente → o que foi estudado → componentes → condições.
 * Testado em lib/usina/proposta-pdf.test.ts.
 */
import { jsPDF } from "jspdf";
import type { EstudoUsina } from "./estudo";

export interface PropostaPdfInput {
  clienteNome: string;
  clienteCidade?: string | null;
  estudo: EstudoUsina;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: number, casas = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function gerarPropostaPdf(input: PropostaPdfInput): jsPDF {
  const { clienteNome, clienteCidade, estudo } = input;
  const r = estudo.resultado;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const L = 18; // margem esquerda
  const W = 210 - L * 2;
  let y = 20;

  const titulo = (texto: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(59, 100, 207); // #3B64CF
    doc.text(texto.toUpperCase(), L, y);
    y += 6;
  };
  const linha = (rotulo: string, valor: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(rotulo, L, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(valor, L + 75, y);
    y += 5.5;
  };

  // ─── Cabeçalho ───
  doc.setFillColor(59, 100, 207);
  doc.rect(0, 0, 210, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("PROPOSTA DE SISTEMA FOTOVOLTAICO", L, 10.5);
  y = 24;

  // ─── Cliente ───
  titulo("Cliente");
  linha("Nome", clienteNome || "—");
  if (clienteCidade) linha("Cidade", clienteCidade);
  linha(
    "Data",
    new Date(estudo.geradoEm).toLocaleDateString("pt-BR")
  );
  y += 2;

  // ─── O que foi estudado ───
  titulo("Estudo de dimensionamento");
  linha("Consumo médio", `${num(estudo.consumoMensalKwh, 0)} kWh/mês`);
  linha("Tarifa utilizada", `${num(estudo.tarifaRpkwh, 3)} R$/kWh`);
  linha("Meta de cobertura", `${num(estudo.metaPct, 0)}% do consumo`);
  linha("Módulo escolhido", `${estudo.modulo.marca} ${estudo.modulo.modelo} (${estudo.modulo.wp} Wp)`);
  if (estudo.inversor) {
    linha("Inversor sugerido", `${estudo.inversor.marca} ${estudo.inversor.modelo} (${num(estudo.inversor.kw, 1)} kW)`);
  }
  y += 2;

  // ─── Resultado ───
  titulo("Resultado do sistema");
  linha("Potência instalada", `${num(r.kwpInstalado)} kWp`);
  linha("Quantidade de painéis", `${r.numPaineis} unidades`);
  linha("Área estimada no telhado", `${num(r.areaM2, 1)} m²`);
  linha("Geração estimada", `${num(r.geracaoMensalKwh, 0)} kWh/mês`);
  linha("Cobertura do consumo", `${num(r.cobrePct, 1)}%`);
  linha("Economia estimada", `${brl(r.economiaMensalR)}/mês  (${brl(r.economiaAnualR)}/ano)`);
  if (r.paybackAnos != null) linha("Retorno do investimento", `${num(r.paybackAnos, 1)} anos`);
  linha("CO₂ evitado", `${num(r.co2EvitadoTons, 1)} toneladas/ano`);
  y += 2;

  // ─── Componentes / valor ───
  titulo("Investimento");
  if (estudo.precoKitR && estudo.precoKitR > 0) {
    linha("Valor do pacote", brl(estudo.precoKitR));
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text("Valores de equipamento e instalação a confirmar em reunião.", L, y);
    y += 6;
  }

  // ─── Condições ───
  titulo("Condições");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const notas = [
    `1. Proposta válida por60 dias a partir de ${new Date(estudo.geradoEm).toLocaleDateString("pt-BR")}.`,
    `2. Geração estimada com fator de produção de1.500 kWh/kWp/ano — pode variar conforme o local e a orientação do telhado.`,
    `3. ${estudo.precoKitR && estudo.precoKitR > 0 ? "Valor de equipamento, instalação e homologação incluso." : "Preço final confirmado após visita técnica e levantamento do telhado."}`,
    `4. Economia calculada sobre a tarifa informada (${num(estudo.tarifaRpkwh, 3)} R$/kWh); alterações de tarifa alteram a economia.`,
  ];
  for (const n of notas) {
    const linhas = doc.splitTextToSize(n, W) as string[];
    for (const l of linhas) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(l, L, y);
      y += 4.5;
    }
  }

  return doc;
}
