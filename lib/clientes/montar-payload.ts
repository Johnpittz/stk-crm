/**
 * 06/10 — mapeamento FORMULÁRIO → COLUNAS reais da tabela `clientes`.
 *
 * Duas telas usam: Novo Cliente (POST /api/clientes) e Editar Cliente
 * (PUT /api/clientes/[id]). O edit mandava `nome_completo` (coluna
 * inexistente → PGRST204, save nunca passava) e o create jogava fora
 * endereço/energia/consumo. Regras:
 *   - todo texto vira `null` quando vazio (para conseguir APAGAR campo);
 *   - consumo/geração (NUMERIC) viram número; vazio → null;
 *   - `geracao_propria` é booleano e SEMPRE vai (desligar é estado válido);
 *   - só colunas que existem — nada de `bandeira` (saiu do form) etc.
 */

export interface FormularioCliente {
  nome_razao_social?: string;
  tipo?: "pf" | "pj";
  cpf_cnpj?: string;
  rg_ie?: string;
  data_nascimento?: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  celular?: string;
  nome_contato?: string;
  cargo_contato?: string;
  cpf_proprietario?: string;
  data_nascimento_proprietario?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  concessionaria?: string;
  classe_tarifaria?: string;
  subgrupo?: string;
  uc_instalacao?: string;
  vencimento_fatura?: string;
  consumo_meses?: Record<string, string>;
  geracao_propria?: boolean;
  geracao_meses?: Record<string, string>;
  usina?: string;
  observacoes?: string;
  status?: string;
  classificacao?: string;
  origem?: string;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function texto(valor: unknown): string | null {
  if (valor == null) return null;
  const t = String(valor).trim();
  return t === "" ? null : t;
}

function numero(valor: unknown): number | null {
  if (valor == null || String(valor).trim() === "") return null;
  const n = parseFloat(String(valor).replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

export function montarPayloadCliente(form: FormularioCliente): Record<string, any> {
  const p: Record<string, any> = {
    nome_razao_social: texto(form.nome_razao_social),
    tipo_cliente: texto(form.tipo),
    cnpj_cpf: texto(form.cpf_cnpj),
    rg_ie: texto(form.rg_ie),
    data_nascimento: texto(form.data_nascimento),
    email: texto(form.email),
    telefone: texto(form.telefone),
    whatsapp: texto(form.whatsapp),
    celular: texto(form.celular),
    nome_contato: texto(form.nome_contato),
    cargo_contato: texto(form.cargo_contato),
    cpf_proprietario: texto(form.cpf_proprietario),
    data_nascimento_proprietario: texto(form.data_nascimento_proprietario),
    cep: texto(form.cep),
    endereco: texto(form.logradouro),
    numero: texto(form.numero),
    complemento: texto(form.complemento),
    bairro: texto(form.bairro),
    cidade: texto(form.cidade),
    estado: texto(form.estado),
    concessionaria: texto(form.concessionaria),
    classe_tarifaria: texto(form.classe_tarifaria),
    subgrupo_tarifario: texto(form.subgrupo),
    instalacao: texto(form.uc_instalacao),
    vencimento_fatura: texto(form.vencimento_fatura),
    usina: texto(form.usina),
    observacoes: texto(form.observacoes),
    status: texto(form.status),
    classificacao: texto(form.classificacao),
    origem_lead: texto(form.origem),
    geracao_propria: form.geracao_propria === true,
  };

  for (const mes of MESES) {
    p[`consumo_${mes}`] = numero(form.consumo_meses?.[mes]);
    p[`geracao_${mes}`] = numero(form.geracao_meses?.[mes]);
  }

  return p;
}
