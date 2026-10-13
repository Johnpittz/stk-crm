/**
 * PASTA DO CLIENTE — catálogo e regras das 4 novas linhas de negócio
 * (12/10): ELETROPOSTO, SIGMA SOLAR (monitoramento de usinas), BESS e
 * GESTÃO DE FATURA. GD e RECIEE já existem como abas próprias.
 *
 * Tudo aqui é puro (testável sem DOM/banco): a UI monta os campos a
 * partir de LINHAS_PASTA e usa normalizar → validar antes de salvar.
 * Os dados moram em `cliente_pasta_linhas.dados` (JSONB).
 */

export type LinhaId = "eletroposto" | "sigma" | "bess" | "gestao_fatura";

export type TipoCampo = "texto" | "numero" | "moeda" | "select" | "mes" | "data";

export interface CampoLinha {
  nome: string;
  label: string;
  tipo: TipoCampo;
  opcoes?: string[];
}

export interface LinhaPasta {
  id: LinhaId;
  label: string;
  descricao: string;
  campos: CampoLinha[];
}

export interface LinhaRegistro {
  id: string;
  linha: LinhaId;
  dados: Record<string, unknown>;
  created_at?: string;
}

export const LINHAS_PASTA: LinhaPasta[] = [
  {
    id: "eletroposto",
    label: "Eletroposto",
    descricao: "Posto de recarga de veículos elétricos.",
    campos: [
      {
        nome: "carregador",
        label: "Tipo de carregador",
        tipo: "select",
        opcoes: ["Coluna", "Tombo", "Wallbox", "Portátil", "Desconhecido"],
      },
      { nome: "potencia_kw", label: "Potência (kW)", tipo: "numero" },
      {
        nome: "status",
        label: "Status",
        tipo: "select",
        opcoes: ["Em instalação", "Em operação", "Parado", "Desconhecido"],
      },
      { nome: "observacoes", label: "Observações", tipo: "texto" },
    ],
  },
  {
    id: "sigma",
    label: "Sigma Solar",
    descricao: "Monitoramento de usinas fotovoltaicas.",
    campos: [
      { nome: "usina", label: "Usina", tipo: "texto" },
      { nome: "potencia_kwp", label: "Potência (kWp)", tipo: "numero" },
      { nome: "ultima_leitura_kwh", label: "Última leitura (kWh)", tipo: "numero" },
      { nome: "ultima_leitura_data", label: "Data da leitura", tipo: "data" },
      {
        nome: "status",
        label: "Status",
        tipo: "select",
        opcoes: ["Monitorando", "Em instalação", "Com falha", "Parado", "Desconhecido"],
      },
      { nome: "observacoes", label: "Observações", tipo: "texto" },
    ],
  },
  {
    id: "bess",
    label: "BESS",
    descricao: "Bateria / armazenamento de energia.",
    campos: [
      { nome: "capacidade_kwh", label: "Capacidade (kWh)", tipo: "numero" },
      { nome: "soc", label: "Estado de carga (%)", tipo: "numero" },
      {
        nome: "status",
        label: "Status",
        tipo: "select",
        opcoes: ["Em operação", "Carregando", "Descarregando", "Manutenção", "Parado"],
      },
      { nome: "observacoes", label: "Observações", tipo: "texto" },
    ],
  },
  {
    id: "gestao_fatura",
    label: "Gestão de Fatura",
    descricao: "Faturas mensais: valor, consumo e conferência.",
    campos: [
      { nome: "competencia", label: "Competência", tipo: "mes" },
      { nome: "valor", label: "Valor", tipo: "moeda" },
      { nome: "consumo_kwh", label: "Consumo (kWh)", tipo: "numero" },
      {
        nome: "situacao",
        label: "Situação",
        tipo: "select",
        opcoes: ["Pendente", "Conferida", "Contestada", "Paga"],
      },
      { nome: "observacoes", label: "Observações", tipo: "texto" },
    ],
  },
];

export function buscarLinha(id: LinhaId): LinhaPasta {
  const linha = LINHAS_PASTA.find((l) => l.id === id);
  if (!linha) throw new Error(`Linha desconhecida: ${id}`);
  return linha;
}

// ─── Números e moeda ───

function paraNumero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const bruto = String(valor ?? "").trim();
  if (!bruto) return null;
  let limpo = bruto.replace(/[R$\s]/g, "");
  if (limpo.includes(",")) {
    // formato brasileiro: 1.234,56 → 1234.56
    limpo = limpo.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

export function normalizarLinha(
  linha: LinhaId,
  form: Record<string, unknown>
): Record<string, unknown> {
  const cfg = buscarLinha(linha);
  const dados: Record<string, unknown> = {};
  for (const [nome, valor] of Object.entries(form)) {
    const campo = cfg.campos.find((c) => c.nome === nome);
    if (campo && (campo.tipo === "numero" || campo.tipo === "moeda")) {
      // numérico vazio gravamos null (diferente de texto, que sai do payload)
      dados[nome] = paraNumero(valor);
      continue;
    }
    const texto = String(valor ?? "").trim();
    if (texto) dados[nome] = texto;
  }
  return dados;
}

export function validarLinha(linha: LinhaId, dados: Record<string, unknown>): string[] {
  const erros: string[] = [];
  const num = (nome: string) => paraNumero(dados[nome]);

  if (linha === "eletroposto") {
    const pot = num("potencia_kw");
    if (pot === null) erros.push("Potência (kW) é obrigatória.");
    else if (pot <= 0) erros.push("Potência (kW) deve ser maior que zero.");
  }

  if (linha === "sigma") {
    if (!String(dados.usina ?? "").trim()) erros.push("Usina é obrigatória.");
    const kwp = num("potencia_kwp");
    if (kwp === null) erros.push("Potência (kWp) é obrigatória.");
    else if (kwp <= 0) erros.push("Potência (kWp) deve ser maior que zero.");
  }

  if (linha === "bess") {
    const cap = num("capacidade_kwh");
    if (cap === null) erros.push("Capacidade (kWh) é obrigatória.");
    else if (cap <= 0) erros.push("Capacidade (kWh) deve ser maior que zero.");
    const soc = num("soc");
    if (soc !== null && (soc < 0 || soc > 100)) {
      erros.push("Estado de carga deve estar entre 0 e 100%.");
    }
  }

  if (linha === "gestao_fatura") {
    if (!String(dados.competencia ?? "").trim()) erros.push("Competência é obrigatória.");
    const valor = num("valor");
    if (valor === null) erros.push("Valor é obrigatório.");
    else if (valor < 0) erros.push("Valor não pode ser negativo.");
  }

  return erros;
}

// ─── Formatação / ordenação ───

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function formatarValor(valor: unknown): string {
  const n = paraNumero(valor);
  if (n === null) return "—";
  const [inteiro, centavos] = Math.abs(n).toFixed(2).split(".");
  const agrupado = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sinal = n < 0 ? "-" : "";
  return `${sinal}R$ ${agrupado},${centavos}`;
}

export function formatarCompetencia(competencia: unknown): string {
  const bruto = String(competencia ?? "").trim();
  const m = /^(\d{4})-(\d{2})$/.exec(bruto);
  if (!m) return "—";
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return "—";
  return `${MESES[mes - 1]}/${m[1]}`;
}

export function ordenarFaturas<T extends { dados: Record<string, unknown>; created_at?: string }>(
  registros: T[]
): T[] {
  return [...registros].sort((a, b) => {
    const ca = String(a.dados.competencia ?? "");
    const cb = String(b.dados.competencia ?? "");
    if (ca !== cb) return cb.localeCompare(ca);
    const ta = a.created_at ?? "";
    const tb = b.created_at ?? "";
    return tb.localeCompare(ta);
  });
}
