/**
 * Fase 6 / C4 de docs/plano-acao-modulos.md — dados do documento de proposta.
 *
 * Antes desta fase não existia "proposta" como entidade: só a oportunidade
 * (valores/etapa) e o cadastro do cliente. Este módulo é puro (sem I/O) e
 * monta o dado do PDF a partir das três fontes que existem hoje, em ordem de
 * prioridade:
 *
 *   1. payload da fila AXS (`fila_propostas_axs.payload` — o form de proposta)
 *   2. cadastro do cliente (`clientes`)
 *   3. oportunidade (única fonte de VALORES)
 *
 * Os testes estão em `lib/propostas/documento.test.ts`.
 */

/** Dias que a proposta fica válida a partir da emissão (decisão da Fase 6). */
export const VALIDADE_DIAS = 30;

/**
 * Etapa do funil que dispara a geração automática (o botão manual continua
 * valendo para qualquer etapa). Ver decisão D8 do plano.
 */
export const ETAPA_GERA_PROPOSTA_AUTOMATICA = "contrato_enviado";

export interface FontesMontagem {
  cliente?: Record<string, any> | null;
  oportunidade?: Record<string, any> | null;
  payload?: Record<string, any> | null;
  agora?: Date;
}

export interface DadosDocumentoProposta {
  cliente_id: string;
  oportunidade_id: string;
  numero: string;
  titulo: string;
  data_emissao: string;
  validade: string;
  arquivo_path: string;
  arquivo_nome: string;
  contratante: {
    nome: string;
    documento: string;
    tipo_pessoa: "pf" | "pj" | "";
    telefone: string;
    email: string;
  };
  endereco: {
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    cep: string;
    cidade: string;
    estado: string;
  };
  uc: {
    instalacao: string;
    concessionaria: string;
    classe: string;
    subgrupo: string;
    vencimento_dia: number | null;
    consumo_medio_kwh: number | null;
    geracao_propria: boolean;
  };
  comercial: {
    valor_proposta: number | null;
    valor_venda: number | null;
  };
  observacoes: string;
}

const texto = (v: any): string =>
  v == null ? "" : typeof v === "string" ? v.trim() : String(v).trim();

const digitos = (v: any): string => texto(v).replace(/\D/g, "");

/** Primeiro valor preenchido (strings aparadas ou números finitos ≠ 0). */
function priorizar(...valores: any[]): any {
  for (const v of valores) {
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
    } else if (typeof v === "number" && Number.isFinite(v) && v !== 0) {
      return v;
    } else if (v != null && typeof v === "boolean") {
      return v;
    }
  }
  return null;
}

function numero(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n !== 0 ? n : null;
}

const MESES_CLIENTE = [
  "consumo_jan", "consumo_fev", "consumo_mar", "consumo_abr", "consumo_mai",
  "consumo_jun", "consumo_jul", "consumo_ago", "consumo_set", "consumo_out",
  "consumo_nov", "consumo_dez",
];

const MESES_GERACAO = [
  "geracao_jan", "geracao_fev", "geracao_mar", "geracao_abr", "geracao_mai",
  "geracao_jun", "geracao_jul", "geracao_ago", "geracao_set", "geracao_out",
  "geracao_nov", "geracao_dez",
];

function media(valores: number[]): number | null {
  const validos = valores.filter((v) => Number.isFinite(v) && v > 0);
  if (!validos.length) return null;
  const soma = validos.reduce((a, b) => a + b, 0);
  return Math.round((soma / validos.length) * 100) / 100;
}

/**
 * Consumo médio mensal em kWh: média dos meses preenchidos (zeros = mês sem
 * fatura, entram como ausência) em ordem de prioridade das fontes.
 */
export function consumoMedioKwh(fontes: {
  payload?: Record<string, any> | null;
  cliente?: Record<string, any> | null;
  oportunidade?: Record<string, any> | null;
}): number | null {
  const payload = fontes.payload ?? null;
  const cliente = fontes.cliente ?? null;
  const oportunidade = fontes.oportunidade ?? null;

  const doPayload = payload?.consumo_meses;
  if (doPayload && typeof doPayload === "object") {
    const mediaPayload = media(
      Object.values(doPayload).map((v) => Number(String(v).replace(",", ".")))
    );
    if (mediaPayload != null) return mediaPayload;
  }

  if (cliente) {
    const mediaCliente = media(MESES_CLIENTE.map((m) => Number(cliente[m] ?? 0)));
    if (mediaCliente != null) return mediaCliente;
  }

  return numero(oportunidade?.consumo_kwh);
}

/**
 * Número da proposta: PREFIXO-AAAAMMDD-XXXX. Determinístico — a mesma
 * oportunidade gerada no mesmo dia devolve o mesmo número (regenerar não
 * duplica documento); muda de dia ou de oportunidade, muda o código.
 */
export function numeroProposta(oportunidadeId: string, agora: Date): string {
  const data = isoData(agora).replace(/-/g, "");
  const chave = `${oportunidadeId}|${data}`;
  // djb2 → base36 em caixa alta, cortado em 4 caracteres
  let hash = 5381;
  for (let i = 0; i < chave.length; i++) {
    hash = ((hash << 5) + hash + chave.charCodeAt(i)) >>> 0;
  }
  const codigo = hash.toString(36).toUpperCase().padStart(4, "0").slice(-4);
  return `PROP-${data}-${codigo}`;
}

function isoData(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 12345678900 → 123.456.789-00 · 11222333000181 → 11.222.333/0001-81 */
export function mascaraDocumento(valor: string | null | undefined): string {
  const d = digitos(valor);
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return texto(valor);
}

/** Monta o conteúdo do PDF de proposta a partir das fontes disponíveis. */
export function montarDadosDocumento(fontes: FontesMontagem): DadosDocumentoProposta {
  const cliente = fontes.cliente ?? null;
  const oportunidade = fontes.oportunidade ?? null;
  const payload = fontes.payload ?? null;
  const agora = fontes.agora ?? new Date();

  const numeroDocumento = digitos(priorizar(payload?.cpf_cnpj, cliente?.cnpj_cpf));
  const tipoPessoa: "pf" | "pj" | "" =
    numeroDocumento.length === 11 ? "pf" : numeroDocumento.length === 14 ? "pj" : "";

  const nome = texto(
    priorizar(payload?.nome, cliente?.nome_razao_social, oportunidade?.cliente_nome)
  );
  const emissao = isoData(agora);
  const validade = isoData(new Date(agora.getTime() + VALIDADE_DIAS * 86_400_000));
  const numeroDocumentoProposta = numeroProposta(
    oportunidade?.id ?? texto(cliente?.id),
    agora
  );
  const clienteId = texto(cliente?.id) || texto(oportunidade?.cliente_id);
  const oportunidadeId = texto(oportunidade?.id);

  return {
    cliente_id: clienteId,
    oportunidade_id: oportunidadeId,
    numero: numeroDocumentoProposta,
    titulo: texto(priorizar(oportunidade?.titulo)) || (nome ? `Proposta — ${nome}` : "Proposta comercial"),
    data_emissao: emissao,
    validade,
    // caminho ESTÁVEL por oportunidade: reemitir sobrescreve o objeto no
    // Storage em vez de deixar PDF órfão a cada geração
    arquivo_path: `${clienteId || "sem-cliente"}/${
      oportunidadeId || numeroDocumentoProposta
    }.pdf`,
    arquivo_nome: `${numeroDocumentoProposta}.pdf`,
    contratante: {
      nome,
      documento: numeroDocumento,
      tipo_pessoa: tipoPessoa,
      telefone: texto(
        priorizar(payload?.telefone, payload?.whatsapp, cliente?.telefone, cliente?.celular, cliente?.whatsapp)
      ),
      email: texto(priorizar(payload?.email, cliente?.email)),
    },
    endereco: {
      logradouro: texto(priorizar(payload?.logradouro, cliente?.endereco, cliente?.logradouro)),
      numero: texto(priorizar(payload?.numero, cliente?.numero)),
      complemento: texto(priorizar(payload?.complemento, cliente?.complemento)),
      bairro: texto(priorizar(payload?.bairro, cliente?.bairro)),
      cep: digitos(priorizar(payload?.cep, cliente?.cep)),
      cidade: texto(priorizar(payload?.cidade, cliente?.cidade)),
      estado: texto(priorizar(payload?.estado, cliente?.estado)).toUpperCase(),
    },
    uc: {
      instalacao: texto(
        priorizar(payload?.uc_instalacao, cliente?.instalacao, oportunidade?.uc)
      ),
      concessionaria: texto(
        priorizar(payload?.concessionaria, cliente?.concessionaria, oportunidade?.concessionaria)
      ),
      classe: texto(priorizar(payload?.classe, cliente?.classe_tarifaria)),
      subgrupo: texto(priorizar(payload?.subgrupo, cliente?.subgrupo_tarifario)),
      vencimento_dia: numero(priorizar(payload?.vencimento_dia, cliente?.vencimento_fatura)),
      consumo_medio_kwh: consumoMedioKwh({ payload, cliente, oportunidade }),
      geracao_propria:
        typeof payload?.geracao_propria === "boolean"
          ? payload.geracao_propria
          : cliente
          ? media(MESES_GERACAO.map((m) => Number(cliente[m] ?? 0))) != null
          : false,
    },
    comercial: {
      valor_proposta: numero(oportunidade?.valor_proposta),
      valor_venda: numero(oportunidade?.valor_venda),
    },
    observacoes: texto(priorizar(payload?.observacoes, cliente?.observacoes)),
  };
}

/**
 * Obrigatório do PDF (decisão da Fase 6): o que identifica quem contrata,
 * onde fica a unidade e quanto custa. Sem isso o documento não nasce — a rota
 * devolve 400 com esta lista para o vendedor completar o cadastro.
 */
export function validarDadosDocumento(dados: DadosDocumentoProposta): string[] {
  const erros: string[] = [];
  const d = dados && typeof dados === "object" ? dados : ({} as DadosDocumentoProposta);

  if ((d.contratante?.nome ?? "").trim().length < 3) {
    erros.push("Nome / razão social do contratante");
  }

  const doc = digitos(d.contratante?.documento);
  if (doc.length !== 11 && doc.length !== 14) {
    erros.push("CPF/CNPJ do contratante com 11 ou 14 dígitos");
  }

  const endereco = d.endereco ?? { logradouro: "", numero: "", cidade: "", estado: "" };
  if (!endereco.logradouro) erros.push("Endereço (logradouro) da unidade consumidora");
  if (!endereco.numero) erros.push("Endereço (número) da unidade consumidora");
  if (!endereco.cidade) erros.push("Cidade do contratante");
  if (!/^[A-Za-z]{2}$/.test(endereco.estado ?? "")) erros.push("Estado (UF) do contratante");

  if (!(d.uc?.instalacao ?? "").trim()) erros.push("UC de instalação");
  if (!(d.uc?.concessionaria ?? "").trim()) erros.push("Concessionária");

  const temValor =
    (d.comercial?.valor_proposta ?? 0) > 0 || (d.comercial?.valor_venda ?? 0) > 0;
  if (!temValor) erros.push("Valor da proposta (valor_proposta ou valor_venda na oportunidade)");

  return erros;
}
