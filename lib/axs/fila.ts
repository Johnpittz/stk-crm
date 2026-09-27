/**
 * Fila de propostas AXS — Fase 3 / C3 de docs/plano-acao-modulos.md.
 *
 * Puro, sem I/O: usado pela rota POST/PATCH/GET /api/axs/fila, pela tela
 * /fila-axs e pelo form de proposta. O espelho do worker vive em
 * `worker/fila_axs.py` — os dois lados seguem o mesmo contrato de estados.
 */

export type StatusFila = "pendente" | "enviando" | "criada" | "erro" | "manual";

export const STATUS_FILA: StatusFila[] = [
  "pendente",
  "enviando",
  "criada",
  "erro",
  "manual",
];

export const ROTULO_STATUS: Record<StatusFila, string> = {
  pendente: "Pendente",
  enviando: "Enviando",
  criada: "Criada na AXS",
  erro: "Erro",
  manual: "Feita manualmente",
};

export const COR_STATUS: Record<StatusFila, string> = {
  pendente: "border-slate-500/40 bg-slate-500/15 text-slate-300",
  enviando: "border-blue-500/40 bg-blue-500/15 text-blue-300",
  criada: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  erro: "border-red-500/40 bg-red-500/15 text-red-300",
  manual: "border-amber-500/40 bg-amber-500/15 text-amber-300",
};

/** Etapas do funil que o retroalimentamento pode mover para `ETAPA_RETROALIMENTO`. */
export const ETAPAS_QUE_AVANCAM = ["recebeu_conta", "proposta_a_fazer"];

export const ETAPA_RETROALIMENTO = "proposta_feita";

/**
 * A criação confirmada (ou marcada como manual) só empurra a oportunidade
 * para "proposta_feita" se ela estiver numa etapa ANTERIOR — nunca regressa
 * uma oportunidade que já passou daqui.
 */
export function podeAvancarEtapa(etapa?: string | null): boolean {
  return !!etapa && ETAPAS_QUE_AVANCAM.includes(etapa);
}

/** Formulário de proposta (mesmos campos do /clientes/[id]/axs-novo). */
export interface FormProposta {
  tipo_imovel: string;
  tipo_pessoa: string;
  cpf_cnpj: string;
  nome_razao_social: string;
  data_nascimento: string;
  email: string;
  telefone: string;
  whatsapp: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  classe: string;
  subgrupo: string;
  uc_instalacao: string;
  vencimento_dia: string;
  concessionaria: string;
  consumo_meses: Record<string, string>;
  geracao_propria: boolean;
  geracao_meses: Record<string, string>;
  observacoes: string;
}

export interface DadosProposta {
  tipo_imovel: string;
  tipo_pessoa: string;
  cpf_cnpj: string;
  nome: string;
  data_nascimento: string;
  email: string;
  telefone: string;
  whatsapp: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  classe: string;
  subgrupo: string;
  uc_instalacao: string;
  vencimento_dia: string;
  concessionaria: string;
  consumo_meses: Record<string, string>;
  geracao_propria: boolean;
  geracao_meses: Record<string, string>;
  observacoes: string;
}

const limpar = (v: string | null | undefined) => (v ?? "").trim();
const digitos = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

/**
 * Monta o payload que vai para a fila (o mesmo que o form enviava direto
 * para /api/axs/send): CPF/CEP só com dígitos, textos aparados.
 */
export function montarDadosProposta(form: FormProposta): DadosProposta {
  return {
    tipo_imovel: form.tipo_imovel,
    tipo_pessoa: form.tipo_pessoa,
    cpf_cnpj: digitos(form.cpf_cnpj),
    nome: limpar(form.nome_razao_social),
    data_nascimento: form.data_nascimento,
    email: limpar(form.email),
    telefone: limpar(form.telefone),
    whatsapp: limpar(form.whatsapp),
    cep: digitos(form.cep),
    logradouro: limpar(form.logradouro),
    numero: limpar(form.numero),
    complemento: limpar(form.complemento),
    bairro: limpar(form.bairro),
    cidade: limpar(form.cidade),
    estado: limpar(form.estado).toUpperCase(),
    classe: form.classe,
    subgrupo: form.subgrupo,
    uc_instalacao: limpar(form.uc_instalacao),
    vencimento_dia: form.vencimento_dia,
    concessionaria: form.concessionaria,
    consumo_meses: form.consumo_meses,
    geracao_propria: form.geracao_propria,
    geracao_meses: form.geracao_meses,
    observacoes: limpar(form.observacoes),
  };
}

const TIPOS_IMOVEL = ["casa", "comercio", "industria", "rural"];
const CLASSES = ["Residencial", "Comercial", "Industrial", "Rural"];

/**
 * Validação do payload ANTES de entrar na fila (400 na rota, mensagem
 * amigável no form). Retorna a lista de erros — vazia = pode enfileirar.
 */
export function validarPayloadProposta(payload: any): string[] {
  const erros: string[] = [];
  const p = payload && typeof payload === "object" ? payload : {};
  const get = (campo: string) => {
    const v = p[campo];
    return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
  };

  if (get("nome").length < 3) erros.push("Nome / razão social é obrigatório");

  const cpfCnpj = digitos(get("cpf_cnpj"));
  const ehPj = (get("tipo_pessoa") || "").toLowerCase() === "pj";
  if (ehPj) {
    if (cpfCnpj.length !== 14) erros.push("CNPJ precisa ter 14 dígitos");
  } else if (cpfCnpj.length !== 11) {
    erros.push("CPF precisa ter 11 dígitos");
  }

  if (!get("telefone") && !get("whatsapp")) {
    erros.push("Informe telefone ou WhatsApp do contratante");
  }

  if (digitos(get("cep")).length !== 8) erros.push("CEP precisa ter 8 dígitos");

  if (get("cidade").length < 2) erros.push("Cidade é obrigatória");
  if (!/^[A-Za-z]{2}$/.test(get("estado"))) erros.push("Estado (UF) é obrigatório");

  if (!TIPOS_IMOVEL.includes(get("tipo_imovel"))) {
    erros.push("Tipo de imóvel inválido");
  }
  if (!CLASSES.includes(get("classe"))) {
    erros.push("Classe de consumo inválida");
  }

  if (!get("uc_instalacao")) erros.push("UC de instalação é obrigatória");

  return erros;
}
