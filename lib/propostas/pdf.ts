/**
 * Fase 6 / C4 — PDF de proposta com pdf-lib (mesma base da proposta RECIEE,
 * em `app/api/reciee/clientes/[clienteId]/proposta/route.ts`).
 *
 * Diferente do RECIEE (que carrega `public/templates/proposta_template.pdf`,
 * arte pronta daquela proposta), aqui o layout é desenhado em código: o
 * documento de GD é uma ficha de dados (contratante + unidade + condições),
 * sem arte gráfica. Se um dia houver template da marca, ele entra aqui sem
 * mexer nos dados — `lib/propostas/documento.ts` é quem decide o conteúdo.
 *
 * Testes: `lib/propostas/pdf.test.ts` (lê o PDF de volta e conferem o texto).
 */
import { PDFDocument, PDFPage, StandardFonts, rgb, PDFFont } from "pdf-lib";
import type { DadosDocumentoProposta } from "./documento";
import { mascaraDocumento } from "./documento";

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 48;
const MARGEM_BAIXO = 56;
const LARGURA_UTIL = A4.largura - MARGEM * 2;

const COR_TITULO = rgb(0.09, 0.16, 0.33);
const COR_TEXTO = rgb(0.13, 0.15, 0.19);
const COR_ROTULO = rgb(0.42, 0.45, 0.52);
const COR_SECAO = rgb(0.93, 0.94, 0.97);
const COR_LINHA = rgb(0.85, 0.87, 0.91);

/**
 * O que não cabe no WinAnsiEncoding (emoji, estrelas, setas) faria o pdf-lib
 * lançar erro no meio da geração. Trocamos por equivalente ASCII e, se não
 * houver, removemos — o dado continua no registro `propostas.dados`.
 */
export function sanitizarTextoPdf(valor: string | null | undefined): string {
  const t = valor == null ? "" : String(valor);
  return t
    .replace(/[—–‐‒―]/g, "-")
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/…/g, "...")
    .replace(/[•·]/g, "-")
    .replace(/→/g, "->")
    .replace(/[←↔]/g, "<->")
    .replace(/°/g, " graus")
    .split("")
    .map((c) => {
      const code = c.charCodeAt(0);
      if (code >= 0x20 && code <= 0x7e) return c;
      if (code >= 0xa0 && code <= 0xff) return c;
      if (code < 0x20 || code === 0x7f) return " ";
      return "";
    })
    .join("");
}

/** R$ 1.500,00 — sem depender de ICU/locale do ambiente. */
export function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return "";
  const negativo = valor < 0;
  const [inteiro, decimais] = Math.abs(valor)
    .toFixed(2)
    .split(".") as [string, string];
  const comSeparador = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativo ? "-" : ""}R$ ${comSeparador},${decimais}`;
}

/** "2026-10-27" → "27/10/2026" */
export function formatarDataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

interface Estado {
  doc: PDFDocument;
  pagina: PDFPage;
  y: number;
  paginaNum: number;
  fonte: PDFFont;
  fonteNegrito: PDFFont;
}

function novaPagina(estado: Estado): void {
  estado.pagina = estado.doc.addPage([A4.largura, A4.altura]);
  estado.paginaNum += 1;
  estado.y = A4.altura - MARGEM;
}

function garantirEspaco(estado: Estado, espaco: number): void {
  if (estado.y - espaco < MARGEM_BAIXO) novaPagina(estado);
}

function quebrarEmLinhas(
  fonte: PDFFont,
  conteudo: string,
  tamanho: number,
  larguraMax: number
): string[] {
  // medir a largura SEM sanitizar derrubaria o pdf-lib no primeiro caractere
  // fora do WinAnsi (emoji, estrela, seta)
  const texto = sanitizarTextoPdf(conteudo);
  const linhas: string[] = [];
  for (const paragrafo of texto.split("\n")) {
    const palavras = paragrafo.split(/\s+/).filter(Boolean);
    if (!palavras.length) {
      linhas.push("");
      continue;
    }
    let atual = "";
    for (const palavra of palavras) {
      const candidato = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(candidato, tamanho) <= larguraMax) {
        atual = candidato;
      } else {
        if (atual) linhas.push(atual);
        atual = palavra;
      }
    }
    if (atual) linhas.push(atual);
  }
  return linhas;
}

function texto(estado: Estado, conteudo: string, x: number, y: number, tamanho: number, cor = COR_TEXTO) {
  estado.pagina.drawText(sanitizarTextoPdf(conteudo), {
    x,
    y,
    size: tamanho,
    font: estado.fonte,
    color: cor,
  });
}

/** Barra de seção (fundo cinza + título). */
function secao(estado: Estado, titulo: string): void {
  garantirEspaco(estado, 64);
  const altura = 20;
  estado.y -= altura;
  estado.pagina.drawRectangle({
    x: MARGEM,
    y: estado.y - 4,
    width: LARGURA_UTIL,
    height: altura,
    color: COR_SECAO,
  });
  estado.pagina.drawText(sanitizarTextoPdf(titulo), {
    x: MARGEM + 10,
    y: estado.y + 2,
    size: 10,
    font: estado.fonteNegrito,
    color: COR_TITULO,
  });
  estado.y -= 20;
}

/** Linha "rótulo ...... valor" (rótulo à esquerda, valor a partir da coluna). */
function campo(estado: Estado, rotulo: string, valor: string): void {
  const valorLimpo = sanitizarTextoPdf(valor);
  if (!valorLimpo.trim()) return;
  const colunaValor = 176;
  const linhas = quebrarEmLinhas(
    estado.fonte,
    valorLimpo,
    10,
    LARGURA_UTIL - colunaValor
  );
  const altura = Math.max(1, linhas.length) * 13;
  garantirEspaco(estado, altura + 4);
  estado.pagina.drawText(sanitizarTextoPdf(rotulo), {
    x: MARGEM + 4,
    y: estado.y,
    size: 9,
    font: estado.fonteNegrito,
    color: COR_ROTULO,
  });
  linhas.forEach((linha, i) => {
    texto(estado, linha, MARGEM + colunaValor, estado.y - i * 13, 10);
  });
  estado.y -= altura;
}

function paragrafo(estado: Estado, conteudo: string): void {
  const linhas = quebrarEmLinhas(
    estado.fonte,
    sanitizarTextoPdf(conteudo),
    10,
    LARGURA_UTIL - 8
  );
  for (const linha of linhas) {
    garantirEspaco(estado, 14);
    texto(estado, linha, MARGEM + 4, estado.y, 10);
    estado.y -= 13;
  }
}

function regua(estado: Estado): void {
  estado.y -= 8;
  estado.pagina.drawRectangle({
    x: MARGEM,
    y: estado.y,
    width: LARGURA_UTIL,
    height: 0.6,
    color: COR_LINHA,
  });
  estado.y -= 14;
}

function cabecalho(estado: Estado, dados: DadosDocumentoProposta): void {
  estado.pagina.drawText("PROPOSTA COMERCIAL", {
    x: MARGEM,
    y: estado.y - 4,
    size: 20,
    font: estado.fonteNegrito,
    color: COR_TITULO,
  });
  estado.y -= 26;
  texto(estado, "Geração Distribuída de Energia", MARGEM, estado.y - 4, 11, COR_ROTULO);
  estado.y -= 20;

  // bloco de identificação (alinhado à direita)
  const linhas = [
    `Nº ${dados.numero}`,
    `Emissão ${formatarDataBR(dados.data_emissao)}`,
    `Válida até ${formatarDataBR(dados.validade)}`,
  ];
  linhas.forEach((linha, i) => {
    const segura = sanitizarTextoPdf(linha);
    const largura = estado.fonte.widthOfTextAtSize(segura, 9);
    estado.pagina.drawText(segura, {
      x: A4.largura - MARGEM - largura,
      y: estado.y - i * 13 + 13,
      size: 9,
      font: estado.fonteNegrito,
      color: COR_TEXTO,
    });
  });
  estado.y -= 6;
  regua(estado);

  if (dados.titulo) {
    campo(estado, "Assunto", dados.titulo);
    regua(estado);
  }
}

function rodape(estado: Estado, dados: DadosDocumentoProposta): void {
  const paginas = estado.doc.getPageCount();
  estado.doc.getPages().forEach((pagina, i) => {
    const conteudo = sanitizarTextoPdf(
      `Proposta ${dados.numero} · ${dados.data_emissao ? formatarDataBR(dados.data_emissao) : ""} · página ${i + 1}/${paginas}`
    );
    const largura = estado.fonte.widthOfTextAtSize(conteudo, 7.5);
    pagina.drawText(conteudo, {
      x: (A4.largura - largura) / 2,
      y: MARGEM_BAIXO - 24,
      size: 7.5,
      font: estado.fonte,
      color: COR_ROTULO,
    });
  });
}

/** Gera o PDF da proposta. Só recebe dados JÁ validados pela rota. */
export async function gerarPdfProposta(
  dados: DadosDocumentoProposta
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(dados.numero || "Proposta");
  doc.setSubject(`Proposta comercial — ${dados.contratante?.nome || "cliente"}`);
  doc.setKeywords(["proposta", "geracao distribuida", "stk-crm"]);
  doc.setCreator("STK-CRM");

  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const fonteNegrito = await doc.embedFont(StandardFonts.HelveticaBold);

  const estado: Estado = {
    doc,
    pagina: doc.addPage([A4.largura, A4.altura]),
    y: A4.altura - MARGEM,
    paginaNum: 1,
    fonte,
    fonteNegrito,
  };

  cabecalho(estado, dados);

  const c = dados.contratante;
  secao(estado, "CONTRATANTE");
  campo(estado, "Nome / razão social", c.nome);
  campo(
    estado,
    c.tipo_pessoa === "pj" ? "CNPJ" : "CPF",
    mascaraDocumento(c.documento)
  );
  campo(estado, "Telefone", c.telefone);
  campo(estado, "E-mail", c.email);
  regua(estado);

  const e = dados.endereco;
  secao(estado, "ENDEREÇO DA UNIDADE CONSUMIDORA");
  const numeroEndereco = e.numero ? `${e.logradouro}, ${e.numero}` : e.logradouro;
  campo(estado, "Endereço", numeroEndereco);
  campo(estado, "Complemento", e.complemento);
  campo(estado, "Bairro", e.bairro);
  campo(estado, "CEP", e.cep);
  campo(estado, "Cidade / UF", e.cidade ? `${e.cidade}/${e.estado}` : "");
  regua(estado);

  const u = dados.uc;
  secao(estado, "UNIDADE CONSUMIDORA");
  campo(estado, "UC de instalação", u.instalacao);
  campo(estado, "Concessionária", u.concessionaria);
  campo(estado, "Classe de consumo", u.classe);
  campo(estado, "Subgrupo", u.subgrupo);
  campo(
    estado,
    "Vencimento da fatura",
    u.vencimento_dia != null ? `dia ${u.vencimento_dia}` : ""
  );
  campo(
    estado,
    "Consumo médio",
    u.consumo_medio_kwh != null ? `${u.consumo_medio_kwh} kWh/mês` : ""
  );
  campo(estado, "Geração própria", u.geracao_propria ? "Sim" : "Não");
  regua(estado);

  const v = dados.comercial;
  secao(estado, "CONDIÇÕES COMERCIAIS");
  campo(estado, "Valor da proposta", formatarMoeda(v.valor_proposta));
  campo(estado, "Valor de venda", formatarMoeda(v.valor_venda));
  campo(estado, "Validade da proposta", formatarDataBR(dados.validade));
  regua(estado);

  if (dados.observacoes) {
    secao(estado, "OBSERVAÇÕES");
    paragrafo(estado, dados.observacoes);
    regua(estado);
  }

  rodape(estado, dados);

  return doc.save();
}
