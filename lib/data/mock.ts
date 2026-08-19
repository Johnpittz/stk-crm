// ============================================================
// DADOS MOCK - STK CRM
// ============================================================

export const vendedorAtual = {
  id: "v1",
  nome: "Ana Silva",
  email: "ana.silva@roma.com.br",
  cargo: "vendedor" as const,
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Ana",
  canal: "Loja Norte",
  whatsapp: "5511987654321",
  online: true,
};

// ============================================================
// METAS
// ============================================================

export const metas = {
  diaria: {
    valorMeta: 2000,
    valorAtual: 1500,
    percentual: 75,
  },
  semanal: {
    valorMeta: 10000,
    valorAtual: 7200,
    percentual: 72,
  },
  mensal: {
    valorMeta: 50000,
    valorAtual: 35000,
    percentual: 70,
  },
};

// Projeção calculada
export const projecaoMensal = {
  valorAtual: 35000,
  valorProjecao: 56000,
  percentualProjecao: 112,
  percentualAtual: 70,
  gap: -6000, // negativo = acima da meta
  mediaDiariaAtual: 1400,
  velocidadeNecessaria: 1250,
  tendencia: "acima" as const,
  diasUteisRestantes: 12,
};

// ============================================================
// TAREFAS - KANBAN
// ============================================================

export type Tarefa = {
  id: string;
  titulo: string;
  tipo: "visita" | "ligacao" | "whatsapp" | "email" | "reuniao";
  cliente: string;
  prioridade: "baixa" | "media" | "alta" | "urgente";
  data: string;
  hora: string;
  coluna: "a_fazer" | "em_andamento" | "concluida";
};

export const tarefas: Tarefa[] = [
  {
    id: "t1",
    titulo: "Visita - Apresentação nova linha",
    tipo: "visita",
    cliente: "Rede ABC Ltda",
    prioridade: "alta",
    data: "2026-03-03",
    hora: "09:00",
    coluna: "em_andamento",
  },
  {
    id: "t2",
    titulo: "Ligação - Follow up proposta",
    tipo: "ligacao",
    cliente: "Carlos Veículos",
    prioridade: "media",
    data: "2026-03-03",
    hora: "11:00",
    coluna: "a_fazer",
  },
  {
    id: "t3",
    titulo: "WhatsApp - Enviar catálogo",
    tipo: "whatsapp",
    cliente: "Atacado XYZ",
    prioridade: "baixa",
    data: "2026-03-03",
    hora: "14:00",
    coluna: "a_fazer",
  },
  {
    id: "t4",
    titulo: "Reunião - Negociação contrato",
    tipo: "reuniao",
    cliente: "Supermercados Silva",
    prioridade: "urgente",
    data: "2026-03-03",
    hora: "16:00",
    coluna: "a_fazer",
  },
  {
    id: "t5",
    titulo: "Email - Orçamento solicitado",
    tipo: "email",
    cliente: "Posto Ipiranga",
    prioridade: "media",
    data: "2026-03-03",
    hora: "10:30",
    coluna: "concluida",
  },
  {
    id: "t6",
    titulo: "Ligação - Cobrança agendada",
    tipo: "ligacao",
    cliente: "Lojas Centro Oeste",
    prioridade: "alta",
    data: "2026-03-03",
    hora: "15:30",
    coluna: "em_andamento",
  },
];

// ============================================================
// AGENDA DO DIA
// ============================================================

export const agendaDia = [
  {
    id: "a1",
    hora: "09:00",
    titulo: "Visita Rede ABC Ltda",
    cliente: "Rede ABC Ltda",
    endereco: "Av. Paulista, 1000 - São Paulo/SP",
    tipo: "visita",
    status: "em_andamento",
    concluido: false,
  },
  {
    id: "a2",
    hora: "10:30",
    titulo: "Email enviado",
    cliente: "Posto Ipiranga",
    tipo: "email",
    status: "concluido",
    concluido: true,
  },
  {
    id: "a3",
    hora: "11:00",
    titulo: "Ligação: Carlos Veículos",
    cliente: "Carlos Veículos",
    tipo: "ligacao",
    status: "pendente",
    concluido: false,
  },
  {
    id: "a4",
    hora: "14:00",
    titulo: "WhatsApp: Enviar catálogo",
    cliente: "Atacado XYZ",
    tipo: "whatsapp",
    status: "pendente",
    concluido: false,
  },
  {
    id: "a5",
    hora: "16:00",
    titulo: "Reunião: Negociação contrato",
    cliente: "Supermercados Silva",
    tipo: "reuniao",
    status: "pendente",
    concluido: false,
  },
];

// ============================================================
// ALERTAS E OPORTUNIDADES
// ============================================================

export const alertasChurn = [
  {
    id: "c1",
    tipo: "churn",
    cliente: "Atacado XYZ",
    diasSemCompra: 48,
    ultimaCompra: "2026-01-15",
    ticketMedio: 4500,
    prioridade: "alta",
  },
  {
    id: "c2",
    tipo: "churn",
    cliente: "Mercado do Bairro",
    diasSemCompra: 35,
    ultimaCompra: "2026-01-28",
    ticketMedio: 1200,
    prioridade: "media",
  },
];

export const oportunidades = [
  {
    id: "o1",
    tipo: "promocao",
    titulo: "Promoção vigente: 15% OFF",
    cliente: "Rede ABC Ltda",
    descricao: "Cliente tem desconto de 15% em produtos da linha Premium - válido até 10/03",
    valorEstimado: 8500,
    prioridade: "alta",
  },
  {
    id: "o2",
    tipo: "afinidade",
    titulo: "Produto complementar",
    cliente: "Carlos Veículos",
    descricao: "Comprou Óleo 20W50 → Sugerir Filtro de Óleo (venda cruzada)",
    valorEstimado: 350,
    prioridade: "media",
  },
  {
    id: "o3",
    tipo: "ciclo",
    titulo: "Ciclo de reposição",
    cliente: "Posto Ipiranga",
    descricao: "Baseado no histórico, cliente deve precisar repor Aditivo nesta semana",
    valorEstimado: 2800,
    prioridade: "media",
  },
];

// ============================================================
// CAMPANHAS E INCENTIVOS
// ============================================================

export const campanhas = [
  {
    id: "camp1",
    titulo: "Meta do Mês - Viagem para Cancun",
    descricao: "Venda R$ 100.000 em março e ganhe uma viagem com acompanhante!",
    imagem: "🏝️",
    progresso: 82,
    valorAtual: 82000,
    valorMeta: 100000,
    ranking: 3,
    dataFim: "2026-03-31",
  },
  {
    id: "camp2",
    titulo: "Desafio Semanal - Novos Clientes",
    descricao: "Cadastre 5 novos clientes esta semana e ganhe bônus de R$ 500",
    imagem: "🎯",
    progresso: 60,
    atual: 3,
    meta: 5,
    dataFim: "2026-03-08",
  },
];

// ============================================================
// DADOS DO DASHBOARD (Visão Gestão)
// ============================================================

export const rankingVendedores = [
  { posicao: 1, nome: "Ana Silva", canal: "Loja Norte", vendas: 45000, ticket: 320, meta: 112 },
  { posicao: 2, nome: "Pedro Santos", canal: "Loja Sul", vendas: 42000, ticket: 280, meta: 105 },
  { posicao: 3, nome: "Maria Oliveira", canal: "Online", vendas: 38000, ticket: 410, meta: 98 },
  { posicao: 4, nome: "João Costa", canal: "Televendas", vendas: 35000, ticket: 195, meta: 92 },
  { posicao: 5, nome: "Carla Mendes", canal: "Loja Centro", vendas: 32000, ticket: 265, meta: 85 },
];

export const evolucaoMensal = [
  { mes: "Abr", vendedor: 35000, media: 32000 },
  { mes: "Mai", vendedor: 42000, media: 35000 },
  { mes: "Jun", vendedor: 38000, media: 36000 },
  { mes: "Jul", vendedor: 45000, media: 38000 },
  { mes: "Ago", vendedor: 43000, media: 40000 },
  { mes: "Set", vendedor: 41000, media: 39000 },
  { mes: "Out", vendedor: 48000, media: 42000 },
  { mes: "Nov", vendedor: 46000, media: 43000 },
  { mes: "Dez", vendedor: 52000, media: 48000 },
  { mes: "Jan", vendedor: 49000, media: 45000 },
  { mes: "Fev", vendedor: 47000, media: 44000 },
  { mes: "Mar", vendedor: 35000, media: 34000 },
];

export const cacPorCanal = [
  { canal: "Loja Física", cac: 45, vendas: 120, cor: "#3B82F6" },
  { canal: "WhatsApp", cac: 32, vendas: 85, cor: "#25D366" },
  { canal: "Online", cac: 28, vendas: 64, cor: "#EC4899" },
  { canal: "Telefone", cac: 38, vendas: 42, cor: "#8B5CF6" },
];

export const churnData = [
  { cliente: "Rede ABC Ltda", ultimaCompra: "15/01/2026", dias: 47, motivo: "preço_alto", valor: 5454154154545 },
  { cliente: "Carlos Veículos", ultimaCompra: "20/01/2026", dias: 42, motivo: "concorrente", valor: 3800 },
  { cliente: "Atacado XYZ", ultimaCompra: "05/02/2026", dias: 26, motivo: "nao_informado", valor: 4500 },
  { cliente: "Posto Shell", ultimaCompra: "10/02/2026", dias: 21, motivo: "problema_logistica", valor: 8200 },
];

export const ticketMedioPorCanal = [
  { canal: "Loja Norte", ticket: 320, minhaVenda: true },
  { canal: "Loja Sul", ticket: 280, minhaVenda: false },
  { canal: "Online", ticket: 410, minhaVenda: false },
  { canal: "Televendas", ticket: 195, minhaVenda: false },
  { canal: "Média Geral", ticket: 301, minhaVenda: false },
];

// ============================================================
// HELPERS
// ============================================================

export const motivosChurn = [
  { valor: "preco_alto", label: "Preço alto", cor: "#EF4444" },
  { valor: "concorrente", label: "Concorrente", cor: "#F97316" },
  { valor: "atendimento_insatisfatorio", label: "Atendimento insatisfatório", cor: "#EAB308" },
  { valor: "problema_qualidade", label: "Problema de qualidade", cor: "#8B5CF6" },
  { valor: "problema_logistica", label: "Problema logística", cor: "#06B6D4" },
  { valor: "falta_estoque", label: "Falta de estoque", cor: "#84CC16" },
  { valor: "mudanca_negocio", label: "Mudança de negócio", cor: "#64748B" },
  { valor: "fechamento_empresa", label: "Fechamento da empresa", cor: "#475569" },
  { valor: "nao_informado", label: "Não informado", cor: "#94A3B8" },
  { valor: "outro", label: "Outro", cor: "#71717A" },
];

export const iconesTarefa = {
  visita: "🏢",
  ligacao: "📞",
  whatsapp: "💬",
  email: "📧",
  reuniao: "🤝",
};

export const coresPrioridade = {
  baixa: "bg-slate-100 text-slate-700",
  media: "bg-blue-100 text-blue-700",
  alta: "bg-orange-100 text-orange-700",
  urgente: "bg-red-100 text-red-700",
};
