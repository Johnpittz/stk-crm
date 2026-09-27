/**
 * Fase 6 / C4 — geração do PDF de proposta com pdf-lib (mesma base do
 * RECIEE, conteúdo próprio de GD).
 *
 * O teste lê de volta o que foi desenhado: título/metadados do documento e o
 * conteúdo dos content streams (descomprimidos com zlib) — prova de que os
 * dados do contratante, a UC e os valores realmente entram na página.
 */
import { describe, it, expect } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFDocument, PDFName } from "pdf-lib";
import { gerarPdfProposta } from "./pdf";
import { montarDadosDocumento, mascaraDocumento } from "./documento";

const AGORA = new Date("2026-09-27T12:00:00.000Z");

const FONTE_COMPLETA = {
  cliente: {
    id: "cli-1",
    nome_razao_social: "João da Silva",
    cnpj_cpf: "12345678900",
    telefone: "(62) 3333-4444",
    email: "joao@email.com",
    endereco: "Rua das Flores",
    numero: "10",
    complemento: "Casa",
    bairro: "Setor Central",
    cep: "74000000",
    cidade: "Goiânia",
    estado: "go",
    concessionaria: "CEMIG",
    instalacao: "99887766",
    classe_tarifaria: "Residencial",
    subgrupo_tarifario: "B1",
    vencimento_fatura: 10,
    consumo_jan: 300,
    consumo_fev: 330,
  },
  oportunidade: {
    id: "opp-1",
    cliente_id: "cli-1",
    titulo: "GD — João da Silva",
    uc: "11223344",
    consumo_kwh: 400,
    valor_proposta: 1500,
    valor_venda: 1700,
  },
  payload: null,
  agora: AGORA,
};

/**
 * Descomprime os content streams do PDF e decodifica o texto desenhado — o
 * pdf-lib grava cada linha em string hexadecimal (`<50524F...>`), então só
 * inflar não basta para achar os dados na página.
 */
function textoDoPdf(bytes: Uint8Array): string {
  const bruto = Buffer.from(bytes).toString("latin1");
  const linhasDesenhadas: string[] = [];
  const re = /(?<!end)stream\r?\n?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bruto))) {
    const inicio = m.index + m[0].length;
    const fim = bruto.indexOf("endstream", inicio);
    if (fim < 0) break;
    const chunk = Buffer.from(bruto.slice(inicio, fim), "latin1");
    const conteudo = (safeInflate(chunk) ?? chunk).toString("latin1");
    re.lastIndex = fim;
    // só o stream de desenho da página tem operadores de texto
    if (!/\bBT\b|\bTj\b|\bTJ\b/.test(conteudo)) continue;
    linhasDesenhadas.push(...textoDoStream(conteudo));
  }
  return linhasDesenhadas.join("\n");
}

/** Strings hex (padrão do pdf-lib) e literais de um content stream. */
function textoDoStream(conteudo: string): string[] {
  const pedacos: string[] = [];
  const hex = /<([0-9A-Fa-f\s]+)>/g;
  let h: RegExpExecArray | null;
  while ((h = hex.exec(conteudo))) {
    const limpo = h[1].replace(/\s+/g, "");
    if (limpo.length % 2) continue;
    const decodificado = Buffer.from(limpo, "hex").toString("latin1");
    // ignora ruído binário que eventualmente casa com <...>
    if (!/[\x20-\x7e\xa0-\xff]/.test(decodificado)) continue;
    pedacos.push(decodificado);
  }
  const literal = /\(((?:[^()\\]|\\.)*)\)/g;
  let l: RegExpExecArray | null;
  while ((l = literal.exec(conteudo))) {
    pedacos.push(l[1].replace(/\\([()\\])/g, "$1"));
  }
  return pedacos;
}

function safeInflate(conteudo: Buffer): Buffer | null {
  try {
    return inflateSync(conteudo);
  } catch {
    return null;
  }
}

describe("gerarPdfProposta", () => {
  it("devolve um PDF válido de pelo menos uma página A4", async () => {
    const dados = montarDadosDocumento(FONTE_COMPLETA);
    const bytes = await gerarPdfProposta(dados);

    expect(Buffer.from(bytes).subarray(0, 5).toString("latin1")).toBe("%PDF-");

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it("carrega os metadados com o número da proposta", async () => {
    const dados = montarDadosDocumento(FONTE_COMPLETA);
    const doc = await PDFDocument.load(await gerarPdfProposta(dados));
    expect(doc.getTitle()).toBe(dados.numero);
    expect(doc.getSubject()).toContain("João da Silva");
    expect(doc.getKeywords()).toContain("proposta");
    expect(doc.getProducer()).toContain("pdf-lib");
  });

  it("desenha contratante, endereço, UC, concessionária e valores na página", async () => {
    const dados = montarDadosDocumento(FONTE_COMPLETA);
    const texto = textoDoPdf(await gerarPdfProposta(dados));

    // número da proposta (inteiro, nunca quebra em pedaços)
    expect(texto).toContain(dados.numero);
    // identificação do contratante (máscara de CPF e sobrenome)
    expect(texto).toContain("123.456.789-00");
    expect(texto).toContain("Silva");
    // unidade consumidora
    expect(texto).toContain("99887766");
    expect(texto).toContain("CEMIG");
    // endereço
    expect(texto).toContain("74000000");
    // condições comerciais
    expect(texto).toContain("R$ 1.500,00");
    expect(texto).toContain("R$ 1.700,00");
    // validade da proposta
    expect(texto).toContain("27/10/2026");
  });

  it("preenche consumo médio e geração própria quando existem", async () => {
    const dados = montarDadosDocumento({
      ...FONTE_COMPLETA,
      cliente: { ...FONTE_COMPLETA.cliente, geracao_jan: 200, geracao_fev: 100 },
    });
    const texto = textoDoPdf(await gerarPdfProposta(dados));
    expect(texto).toContain("315"); // média de 300 e 330
    expect(texto).toMatch(/Sim/); // geração própria = sim
  });

  it("não quebra com texto acentuado, em dash ou emoji no título", async () => {
    const dados = montarDadosDocumento({
      ...FONTE_COMPLETA,
      oportunidade: { ...FONTE_COMPLETA.oportunidade, titulo: "GD — Cliente ★ João (nº 2) 🚀" },
    });
    const bytes = await gerarPdfProposta(dados);
    expect(bytes.byteLength).toBeGreaterThan(1000);

    const texto = textoDoPdf(bytes);
    // o que é imprimível sobrevive; o que não cabe em WinAnsi é substituído
    expect(texto).toContain("(n");
    expect(texto).not.toContain("🚀");
  });

  it("omite linhas de campo vazio em vez de imprimir rótulo solto", async () => {
    const dados = montarDadosDocumento({
      ...FONTE_COMPLETA,
      cliente: { ...FONTE_COMPLETA.cliente, email: null, complemento: null },
    });
    const texto = textoDoPdf(await gerarPdfProposta(dados));
    expect(texto).not.toContain("E-mail");
    expect(texto).not.toContain("Complemento");
  });

  it("usa o valor de venda quando a oportunidade não tem valor de proposta", async () => {
    const dados = montarDadosDocumento({
      ...FONTE_COMPLETA,
      oportunidade: { ...FONTE_COMPLETA.oportunidade, valor_proposta: null, valor_venda: 1700 },
    });
    const texto = textoDoPdf(await gerarPdfProposta(dados));
    expect(texto).toContain("R$ 1.700,00");
    expect(texto).not.toContain("R$ 1.500,00");
  });
});

describe("mascaraDocumento no documento", () => {
  it("formata CNPJ quando o contratante é pessoa jurídica", () => {
    expect(mascaraDocumento("11222333000181")).toBe("11.222.333/0001-81");
  });
});
