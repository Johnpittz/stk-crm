/**
 * Texto do email que vai para a concessionária, junto do relatório.
 *
 * Regra comercial (João): o relatório sempre entrega o email PRONTO para a
 * distribuidora — o cliente não precisa saber escrever. O texto é gerado a
 * partir dos ACHADOS do motor (nunca de suposição) e cobra PROVA, não
 * sentença: quem recalcula somos nós.
 */
import type { Achado, FaturaReciee } from "./tipos";

export interface ClienteReciee {
  nome: string;
  uc: string;
  cpf_cnpj?: string | null;
  cidade?: string | null;
  estado?: string | null;
  distribuidora?: string | null;
}

const SECOES: { titulo: string; codigos: string[]; texto: string }[] = [
  {
    titulo: "1. CONTRIBUIÇÃO DE ILUMINAÇÃO PÚBLICA",
    codigos: ["RECIEE-073"],
    texto:
      "Solicito o fundamento legal e a tabela municipal vigente que autoriza a " +
      "cobrança da contribuição de iluminação pública, e, não havendo tabela " +
      "publicada, o ressarcimento da diferença apurada.",
  },
  {
    titulo: "2. MULTAS, JUROS E ENCARGOS COBRADOS",
    codigos: ["RECIEE-014"],
    texto:
      "Solicito a base de cálculo de cada multa e juro, com a comprovação de " +
      "que a multa incide apenas sobre os valores efetivamente em atraso, " +
      "excluídos encargos, serviços e multas anteriores (art. 343 da " +
      "Resolução ANEEL nº 1.000/2021), e cópia do termo de negociação quando " +
      "houver.",
  },
  {
    titulo: "3. EMISSÃO DE SEGUNDA VIA",
    codigos: ["RECIEE-037"],
    texto:
      "Não havendo comprovação de requerimento pelo consumidor, solicito a " +
      "devolução em dobro do valor cobrado por emissão de segunda via, " +
      "conforme art. 42 do Código de Defesa do Consumidor e arts. 623 e 626 " +
      "da Resolução ANEEL nº 1.000/2021.",
  },
  {
    titulo: "4. TARIFA APLICADA x TARIFA HOMOLOGADA",
    codigos: ["RECIEE-058", "RECIEE-040"],
    texto:
      "Solicito a demonstração do cálculo da tarifa aplicada, com a " +
      "comprovação da resolução homologatória vigente na data de cada ciclo.",
  },
  {
    titulo: "5. TRIBUTOS (ICMS, PIS E COFINS)",
    codigos: ["RECIEE-050", "RECIEE-016", "RECIEE-T69-001", "RECIEE-160"],
    texto:
      "Solicito a demonstração da base de cálculo de cada tributo, com a " +
      "exclusão do ICMS da base de PIS/COFINS (Tema 69 do STF) e a " +
      "alíquota de ICMS vigente na data de cada fatura.",
  },
  {
    titulo: "6. MEDIÇÃO, LEITURAS E FATURAS NÃO LOCALIZADAS",
    codigos: [
      "RECIEE-051",
      "RECIEE-077",
      "RECIEE-134",
      "RECIEE-162",
      "MOTOR-FURO",
    ],
    texto:
      "Solicito cópia das faturas e das atas de leitura dos ciclos em falta, " +
      "bem como dos termos de troca de medidor, para conferência da cadeia de " +
      "consumo.",
  },
  {
    titulo: "7. BANDEIRA TARIFÁRIA",
    codigos: ["RECIEE-011"],
    texto:
      "Solicito o rateio da bandeira tarifária aplicada, com a indicação da " +
      "tabela oficial da ANEEL utilizada e dos dias de cada competência " +
      "considerados.",
  },
];

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function linhaAchado(a: Achado): string {
  const valor = a.valorEstimado > 0 ? ` — R$ ${brl(a.valorEstimado)} em disputa` : "";
  return `- ${a.descricao}${valor}`;
}

/** Agrupa os achados por tema do email; seções sem achado ficam de fora. */
function secoes(achados: Achado[]): { titulo: string; texto: string; linhas: string[] }[] {
  return SECOES.map((s) => ({
    titulo: s.titulo,
    texto: s.texto,
    linhas: achados.filter((a) => s.codigos.includes(a.codigo)).map(linhaAchado),
  })).filter((s) => s.linhas.length > 0);
}

/** Itens financeiros questionados (multa, juro, 2ª via, iluminação, IPCA). */
function itensQuestionados(faturas: FaturaReciee[]): string[] {
  const totais = new Map<string, { valor: number; qtd: number }>();
  for (const f of faturas) {
    for (const i of f.itens) {
      const chave = i.descricao
        .replace(/-\s*\d{4,6}\/\d{4}.*$/i, "")
        .replace(/\.\s*$/, "")
        .trim();
      const atual = totais.get(chave) ?? { valor: 0, qtd: 0 };
      atual.valor += i.valor;
      atual.qtd += 1;
      totais.set(chave, atual);
    }
  }
  return Array.from(totais.entries())
    .sort((a, b) => b[1].valor - a[1].valor)
    .map(([nome, t]) => `- ${nome}: R$ ${brl(t.valor)} em ${t.qtd} fatura(s)`);
}

export interface EmailConcessionaria {
  assunto: string;
  corpo: string;
}

/**
 * Monta o email do caso (assinatura, UC e período entram na identificação;
 * o corpo só traz o que o motor achou).
 */
export function montarEmailConcessionaria(p: {
  cliente: ClienteReciee;
  faturas: FaturaReciee[];
  achados: Achado[];
  prazoDias?: number;
}): EmailConcessionaria {
  const prazo = p.prazoDias ?? 15;
  const nome = p.cliente.nome || "(consumidor)";
  const uc = p.cliente.uc || "(UC)";
  const cidade = p.cliente.cidade ? ` — ${p.cliente.cidade}` : "";
  const estado = p.cliente.estado ? `/${p.cliente.estado}` : "";
  const dist =
    (p.cliente.distribuidora || "Distribuidora de Energia Elétrica").toUpperCase();
  const competencias = p.faturas.map((f) => f.referencia).filter(Boolean);
  const periodo =
    competencias.length > 0
      ? `${competencias[0]} a ${competencias[competencias.length - 1]}`
      : "(período)";
  const total = p.faturas.reduce((s, f) => s + (f.valorTotal || 0), 0);

  const secoesTxt = secoes(p.achados);
  const itens = itensQuestionados(p.faturas);

  const corpo = [
    `À: ${dist} — Atendimento ao Consumidor / Ouvidoria`,
    "",
    `Assunto: Requerimento de revisão de faturas — UC ${uc} — ${nome}${cidade}${estado}`,
    "",
    "Prezados,",
    "",
    "Venho requerer a revisão das faturas emitidas para a UC acima, relativas ao " +
      `período de ${periodo} (${p.faturas.length} fatura(s), total de R$ ${brl(total)}), ` +
      "pelas razões a seguir:",
    "",
    ...secoesTxt.flatMap((s) => [
      s.titulo,
      ...s.linhas,
      s.texto,
      "",
    ]),
    ...(itens.length > 0
      ? [
          "ITENS FINANCEIROS QUESTIONADOS",
          ...itens,
          "",
        ]
      : []),
    "DOCUMENTOS QUE SOLICITO",
    "- cópia de todas as faturas e atas de leitura do período;",
    "- tabelas tarifárias e municipais vigentes em cada ciclo;",
    "- termos de negociação, troca de medidor e comprovação de solicitação de serviços cobrados;",
    "",
    `Solicito resposta em até ${prazo} dias, na forma do art. 22 do Código de ` +
      "Defesa do Consumidor. Havendo recusa ou silêncio, encaminharei o pleito ao " +
      "Procon e à Ouvidoria da ANEEL, com a transcrição integral desta petição.",
    "",
    "Atenciosamente,",
    "",
    nome,
    p.cliente.cpf_cnpj ? `CPF/CNPJ ${p.cliente.cpf_cnpj}` : "",
    `UC ${uc}${cidade}${estado}`,
    "",
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return {
    assunto: `Requerimento de revisão de faturas — UC ${uc} — ${nome}`,
    corpo,
  };
}
