import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/atendimentos/detectar-conta
 * 
 * Analisa uma mensagem (PDF ou imagem) para detectar se é uma conta de energia.
 * Retorna: detectou, confiança, dados extraídos (UC, consumo, etc.)
 * 
 * Body: { conteudo_base64, tipo_arquivo, nome_arquivo }
 */

// Padrões para identificar conta de energia
const padroesArquivo = {
  nomes: [/conta/i, /fatura/i, /energia/i, /eletrica/i, /bill/i, /luz/i],
  exclusoes: [/comprovante/i, /recibo/i, /nota\s*fiscal/i, /nf/i],
};

const padroesConteudo = {
  uc: /UC\s*[\d.\-\/]+/i,
  consumo: /consumo.*?(\d+[\.\d]*)\s*kWh/i,
  vencimento: /vencimento.*?(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{2})/i,
  valorTotal: /valor.*?total.*?R\$\s*([\d.,]+)/i,
  bandeira: /bandeira.*(vermelha|amarela|verde|azul)/i,
  energiaEletrica: /energia\s*elétrica/i,
  numeroConta: /n[°º]\s*(\d+)/i,
  cpfCnpj: /(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/,
};

interface ResultadoDetecao {
  detectou: boolean;
  confianca: number;
  tipo: "arquivo" | "texto" | "nenhum";
  dados_extraidos: {
    uc?: string;
    consumo_kwh?: number;
    vencimento?: string;
    valor_total?: number;
    bandeira?: string;
    numero_conta?: string;
  };
  sugestao: string;
  motivos: string[];
}

function analisarNomeArquivo(nomeArquivo: string): { score: number; motivos: string[] } {
  let score = 0;
  const motivos: string[] = [];

  // Verificar exclusões
  for (const padrao of padroesArquivo.exclusoes) {
    if (padrao.test(nomeArquivo)) {
      return { score: -1, motivos: ["Arquivo excluído: " + nomeArquivo] };
    }
  }

  // Verificar padrões positivos
  for (const padrao of padroesArquivo.nomes) {
    if (padrao.test(nomeArquivo)) {
      score += 0.4;
      motivos.push(`Nome contém: ${padrao.source}`);
    }
  }

  // Extensão de imagem ou PDF
  if (/\.(jpg|jpeg|png|webp|pdf)$/i.test(nomeArquivo)) {
    score += 0.1;
    motivos.push("Formato aceito (imagem/PDF)");
  }

  return { score: Math.min(score, 1), motivos };
}

function analisarConteudo(textoOCR: string): { score: number; dados: ResultadoDetecao["dados_extraidos"]; motivos: string[] } {
  let score = 0;
  const dados: ResultadoDetecao["dados_extraidos"] = {};
  const motivos: string[] = [];

  // UC (Unidade Consumidora) — indicador forte
  const ucMatch = textoOCR.match(padroesConteudo.uc);
  if (ucMatch) {
    score += 0.35;
    dados.uc = ucMatch[0].replace(/UC\s*/i, "").trim();
    motivos.push(`UC encontrada: ${dados.uc}`);
  }

  // Consumo kWh
  const consumoMatch = textoOCR.match(padroesConteudo.consumo);
  if (consumoMatch) {
    score += 0.2;
    dados.consumo_kwh = parseInt(consumoMatch[1].replace(".", ""));
    motivos.push(`Consumo: ${dados.consumo_kwh} kWh`);
  }

  // Valor total
  const valorMatch = textoOCR.match(padroesConteudo.valorTotal);
  if (valorMatch) {
    score += 0.15;
    dados.valor_total = parseFloat(valorMatch[1].replace(".", "").replace(",", "."));
    motivos.push(`Valor: R$ ${dados.valor_total}`);
  }

  // Vencimento
  const vencimentoMatch = textoOCR.match(padroesConteudo.vencimento);
  if (vencimentoMatch) {
    score += 0.1;
    dados.vencimento = vencimentoMatch[1];
    motivos.push(`Vencimento: ${dados.vencimento}`);
  }

  // Bandeira tarifária
  const bandeiraMatch = textoOCR.match(padroesConteudo.bandeira);
  if (bandeiraMatch) {
    score += 0.1;
    dados.bandeira = bandeiraMatch[1];
    motivos.push(`Bandeira: ${dados.bandeira}`);
  }

  // Energia Elétrica
  if (padroesConteudo.energiaEletrica.test(textoOCR)) {
    score += 0.1;
    motivos.push("Texto 'Energia Elétrica' encontrado");
  }

  return { score: Math.min(score, 1), dados, motivos };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conteudo_base64, tipo_arquivo, nome_arquivo, texto_mensagem } = body;

    const resultado: ResultadoDetecao = {
      detectou: false,
      confianca: 0,
      tipo: "nenhum",
      dados_extraidos: {},
      sugestao: "",
      motivos: [],
    };

    // 1. Analisar nome do arquivo (se houver)
    if (nome_arquivo) {
      const nomeResult = analisarNomeArquivo(nome_arquivo);
      resultado.motivos.push(...nomeResult.motivos);
      
      if (nomeResult.score < 0) {
        resultado.sugestao = "Arquivo não parece ser conta de energia";
        return NextResponse.json(resultado);
      }
      
      resultado.confianca += nomeResult.score;
    }

    // 2. Analisar texto da mensagem (se houver)
    if (texto_mensagem) {
      const textoResult = analisarConteudo(texto_mensagem);
      resultado.motivos.push(...textoResult.motivos);
      resultado.confianca += textoResult.score * 0.5; // Texto tem menos peso que OCR
      Object.assign(resultado.dados_extraidos, textoResult.dados);
    }

    // 3. Se tem arquivo, tentar OCR (só para imagens por enquanto)
    if (conteudo_base64 && tipo_arquivo?.startsWith("image/")) {
      try {
        // Usar Tesseract.js via dynamic import
        const Tesseract = await import("tesseract.js");
        
        // Converter base64 para buffer
        const base64Data = conteudo_base64.includes(",") 
          ? conteudo_base64.split(",")[1] 
          : conteudo_base64;
        const buffer = Buffer.from(base64Data, "base64");
        
        const { data } = await Tesseract.recognize(buffer, "por", {
          logger: () => {}, // Silenciar logs
        });
        
        if (data.text) {
          const ocrResult = analisarConteudo(data.text);
          resultado.motivos.push(...ocrResult.motivos.map(m => `[OCR] ${m}`));
          resultado.confianca += ocrResult.score;
          Object.assign(resultado.dados_extraidos, ocrResult.dados);
          resultado.tipo = "arquivo";
        }
      } catch (ocrError) {
        console.error("[detectar-conta] Erro no OCR:", ocrError);
        resultado.motivos.push("[OCR] Erro ao processar imagem");
      }
    }

    // 4. Determinar se detectou
    resultado.confianca = Math.min(resultado.confianca, 1);
    
    if (resultado.confianca >= 0.6) {
      resultado.detectou = true;
      resultado.sugestao = "Possível conta de energia detectada";
    } else if (resultado.confianca >= 0.3) {
      resultado.detectou = false;
      resultado.sugestao = "Possível conta de energia (confiança média)";
    } else {
      resultado.detectou = false;
      resultado.sugestao = "Não foi possível identificar conta de energia";
    }

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error("[detectar-conta] Erro:", error);
    return NextResponse.json(
      { error: error.message || "Erro ao analisar mensagem" },
      { status: 500 }
    );
  }
}
