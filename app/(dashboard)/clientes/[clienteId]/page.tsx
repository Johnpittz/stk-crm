"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Zap,
  Pencil,
  ChevronDown,
  ChevronUp,
  Plus,
  FileText,
  MessageSquare,
  Headphones,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileWarning,
  Upload,
  Loader2,
  Smartphone,
  Star,
  Calendar,
  DollarSign,
  Activity,
  Info,
  Receipt,
  PieChart,
  Shield,
} from "lucide-react";

// ─── Types ───

interface Cliente {
  id: string;
  nome_razao_social: string | null;
  cnpj_cpf: string | null;
  telefone: string | null;
  celular: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  bairro: string | null;
  cep: string | null;
  numero: string | null;
  complemento: string | null;
  data_nascimento: string | null;
  classe_tarifaria: string | null;
  subgrupo_tarifario: string | null;
  concessionaria: string | null;
  vencimento_fatura: string | null;
  consumo_jan: number | null;
  consumo_fev: number | null;
  consumo_mar: number | null;
  consumo_abr: number | null;
  consumo_mai: number | null;
  consumo_jun: number | null;
  consumo_jul: number | null;
  consumo_ago: number | null;
  consumo_set: number | null;
  consumo_out: number | null;
  consumo_nov: number | null;
  consumo_dez: number | null;
  geracao_jan: number | null;
  geracao_fev: number | null;
  geracao_mar: number | null;
  geracao_abr: number | null;
  geracao_mai: number | null;
  geracao_jun: number | null;
  geracao_jul: number | null;
  geracao_ago: number | null;
  geracao_set: number | null;
  geracao_out: number | null;
  geracao_nov: number | null;
  geracao_dez: number | null;
  observacoes: string | null;
  vendedor_responsavel_id: string | null;
  axs_card_id: string | null;
  axs_status: string | null;
}

interface Oportunidade {
  id: string;
  cliente_id: string;
  titulo: string;
  descricao: string | null;
  etapa: string;
  tipo: string | null;
  uc: string | null;
  consumo_kwh: number | null;
  valor_proposta: number | null;
  created_at: string;
}

interface AxsProposta {
  id: string;
  cliente_id: string;
  axs_card_id: string | null;
  axs_status: string | null;
  axs_mensalidade: number | null;
  created_at: string;
}

interface ClienteReciee {
  id: string;
  cliente_id: string;
  nome: string | null;
  cpf_cnpj: string | null;
  uc: string | null;
  estado: string | null;
  distribuidora: string | null;
  subgrupo: string | null;
  modalidade: string | null;
  classe: string | null;
  tensao: string | null;
  gd: string | null;
}

interface FaturaReciee {
  id: string;
  cliente_id: string;
  competencia: string | null;
  consumo_kwh: number | null;
  valor_total: number | null;
  bandeira: string | null;
  tarifa_aplicada: number | null;
  icms_valor: number | null;
  pis_valor: number | null;
  cofins_valor: number | null;
}

interface AnaliseReciee {
  id: string;
  fatura_id: string;
  macro_indice: string | null;
  codigo: string | null;
  descricao: string | null;
  severidade: string | null;
  valor_estimado: number | null;
}

interface Atendimento {
  id: string;
  cliente_id: string;
  telefone_cliente: string | null;
  nome_cliente: string | null;
  canal: string | null;
  status: string | null;
  created_at: string;
}

type TabId = "dados" | "gd" | "reciee" | "atendimentos" | "oportunidades";

const TABS: { id: TabId; label: string; icon: any }[] = [
  { id: "dados", label: "Dados", icon: User },
  { id: "gd", label: "GD", icon: Zap },
  { id: "reciee", label: "RECIEE", icon: Shield },
  { id: "atendimentos", label: "Atendimentos", icon: Headphones },
  { id: "oportunidades", label: "Oportunidades", icon: TrendingUp },
];

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const ETAPA_COLORS: Record<string, string> = {
  ganha: "bg-green-500/20 text-green-400 border-green-500/30",
  ganho: "bg-green-500/20 text-green-400 border-green-500/30",
  "em andamento": "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  em_processamento: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  perdida: "bg-red-500/20 text-red-400 border-red-500/30",
  perdido: "bg-red-500/20 text-red-400 border-red-500/30",
  proposta: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  levantamento: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  aprovacao: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  contratacao: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  implantacao: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  satisfacao: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
};

const SEVERIDADE_COLORS: Record<string, string> = {
  critico: "bg-red-500/20 text-red-400",
  critica: "bg-red-500/20 text-red-400",
  alta: "bg-orange-500/20 text-orange-400",
  media: "bg-yellow-500/20 text-yellow-400",
  média: "bg-yellow-500/20 text-yellow-400",
  baixa: "bg-blue-500/20 text-blue-400",
  info: "bg-slate-500/20 text-slate-400",
};

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function getEtapaColor(etapa: string): string {
  return ETAPA_COLORS[etapa?.toLowerCase()] || "bg-slate-500/20 text-slate-400 border-slate-500/30";
}

function getSeveridadeColor(sev: string): string {
  return SEVERIDADE_COLORS[sev?.toLowerCase()] || "bg-slate-500/20 text-slate-400";
}

function getCanalIcon(canal: string | null): any {
  switch (canal?.toLowerCase()) {
    case "whatsapp":
    case "wa":
      return MessageSquare;
    case "telefone":
    case "ligacao":
    case "ligação":
      return Phone;
    case "email":
      return Mail;
    case "chatbot":
      return Smartphone;
    default:
      return Headphones;
  }
}

// ─── Main Component ───

export default function ClienteDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const clienteId = params.clienteId as string;
  const supabase = createClient();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("dados");

  // Tab data
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [axsPropostas, setAxsPropostas] = useState<AxsProposta[]>([]);
  const [faturasReciee, setFaturasReciee] = useState<FaturaReciee[]>([]);
  const [analisesReciee, setAnalisesReciee] = useState<AnaliseReciee[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [expandedFatura, setExpandedFatura] = useState<string | null>(null);
  const [tabLoading, setTabLoading] = useState(false);
  const [analisesLoaded, setAnalisesLoaded] = useState(false);

  // ─── Load client ───

  useEffect(() => {
    async function load() {
      // Try view first (bypasses RLS issues), then fallback to direct table
      let result = await supabase
        .from("v_unified_clientes")
        .select("*")
        .eq("id", clienteId)
        .maybeSingle();
      
      if (result.error || !result.data) {
        // Fallback to clientes table
        result = await supabase
          .from("clientes")
          .select("*")
          .eq("id", clienteId)
          .maybeSingle();
      }
      
      if (result.error) console.error("[Cliente] Error loading:", result.error);
      if (result.data) setCliente(result.data);
      setLoading(false);
    }
    load();
  }, [supabase, clienteId]);

  // ─── Load tab data on demand ───

  const loadTabData = useCallback(async (tab: TabId) => {
    setTabLoading(true);
    try {
      switch (tab) {
        case "gd": {
          const [oppRes, axsRes] = await Promise.all([
            supabase
              .from("oportunidades")
              .select("*")
              .eq("cliente_id", clienteId)
              .eq("tipo", "gd")
              .order("created_at", { ascending: false }),
            supabase
              .from("axs_propostas")
              .select("*")
              .eq("cliente_id", clienteId)
              .order("created_at", { ascending: false }),
          ]);
          if (oppRes.data) setOportunidades(oppRes.data);
          if (axsRes.data) setAxsPropostas(axsRes.data);
          break;
        }
        case "reciee": {
          const { data: faturas } = await supabase
            .from("faturas_reciee")
            .select("*")
            .eq("cliente_id", clienteId)
            .order("competencia", { ascending: false });
          if (faturas) setFaturasReciee(faturas);
          setAnalisesLoaded(false);
          break;
        }
        case "atendimentos": {
          const { data } = await supabase
            .from("atendimentos")
            .select("*")
            .eq("cliente_id", clienteId)
            .order("created_at", { ascending: false });
          if (data) setAtendimentos(data);
          break;
        }
        case "oportunidades": {
          const { data } = await supabase
            .from("oportunidades")
            .select("*")
            .eq("cliente_id", clienteId)
            .order("created_at", { ascending: false });
          if (data) setOportunidades(data);
          break;
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados da tab:", err);
    } finally {
      setTabLoading(false);
    }
  }, [supabase, clienteId]);

  useEffect(() => {
    if (!loading && cliente) {
      loadTabData(activeTab);
    }
  }, [activeTab, loading, cliente, loadTabData]);

  // ─── Load analyses for expanded fatura ───

  const loadAnalises = useCallback(async (faturaId: string) => {
    if (analisesLoaded) return;
    const { data } = await supabase
      .from("analises_reciee")
      .select("*")
      .eq("fatura_id", faturaId);
    if (data && data.length > 0) {
      setAnalisesReciee((prev) => [...prev.filter((a) => a.fatura_id !== faturaId), ...data]);
      setAnalisesLoaded(true);
    }
  }, [supabase, analisesLoaded]);

  const toggleFatura = (faturaId: string) => {
    if (expandedFatura === faturaId) {
      setExpandedFatura(null);
    } else {
      setExpandedFatura(faturaId);
      loadAnalises(faturaId);
    }
  };

  // ─── Consumption data for chart ───

  const getConsumoData = (): number[] => {
    if (!cliente) return [];
    return [
      cliente.consumo_jan, cliente.consumo_fev, cliente.consumo_mar,
      cliente.consumo_abr, cliente.consumo_mai, cliente.consumo_jun,
      cliente.consumo_jul, cliente.consumo_ago, cliente.consumo_set,
      cliente.consumo_out, cliente.consumo_nov, cliente.consumo_dez,
    ].map((v) => v ?? 0);
  };

  const getGeracaoData = (): number[] => {
    if (!cliente) return [];
    return [
      cliente.geracao_jan, cliente.geracao_fev, cliente.geracao_mar,
      cliente.geracao_abr, cliente.geracao_mai, cliente.geracao_jun,
      cliente.geracao_jul, cliente.geracao_ago, cliente.geracao_set,
      cliente.geracao_out, cliente.geracao_nov, cliente.geracao_dez,
    ].map((v) => v ?? 0);
  };

  const hasGeracao = (): boolean => {
    return getGeracaoData().some((v) => v > 0);
  };

  const hasConsumo = (): boolean => {
    return getConsumoData().some((v) => v > 0);
  };

  const consumoData = getConsumoData();
  const geracaoData = getGeracaoData();
  const maxConsumo = Math.max(...consumoData, 1);
  const maxGeracao = Math.max(...geracaoData, 1);

  // ─── RECIEE summary ───

  const recieeTotalFaturas = faturasReciee.length;
  const recieeTotalAnalises = analisesReciee.length;
  const recieeValorEstimado = analisesReciee.reduce(
    (sum, a) => sum + (a.valor_estimado ?? 0),
    0
  );

  // ─── Oportunidades by etapa ───

  const oportunidadesPorEtapa = oportunidades.reduce((acc, o) => {
    const etapa = o.etapa || "Sem etapa";
    if (!acc[etapa]) acc[etapa] = [];
    acc[etapa].push(o);
    return acc;
  }, {} as Record<string, Oportunidade[]>);

  const allOportunidades = [...oportunidades];
  const gdPropostas = [...oportunidades];

  // ─── Loading state ───

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-9rem)]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 text-[#3B64CF] animate-spin" />
          <span className="text-sm text-white/50">Carregando cliente...</span>
        </div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-9rem)] text-white/50">
        <User className="h-10 w-10 mb-3 text-white/20" />
        <p className="text-sm mb-4">Cliente não encontrado</p>
        <button
          onClick={() => router.push("/clientes")}
          className="flex items-center gap-2 text-xs text-[#3B64CF] hover:underline"
        >
          <ArrowLeft className="h-3 w-3" />
          Voltar
        </button>
      </div>
    );
  }

  // ─── Render ───

  return (
    <div className="space-y-4 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/clientes")}
            className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <User className="h-4 w-4 text-[#3B64CF]" />
              {cliente.nome_razao_social || "Sem nome"}
            </h2>
            <p className="text-[11px] text-white/50">
              {cliente.cnpj_cpf || "Sem CPF/CNPJ"}
              {cliente.cidade && cliente.estado
                ? ` · ${cliente.cidade}/${cliente.estado}`
                : cliente.cidade
                ? ` · ${cliente.cidade}`
                : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push(`/clientes/${clienteId}/editar`)}
          className="flex items-center gap-1.5 h-7 px-3 text-[11px] rounded-lg border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Editar
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all flex-1 justify-center",
                isActive
                  ? "bg-[#3B64CF] text-white shadow-md"
                  : "text-white/50 hover:text-white/70 hover:bg-white/5"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {tabLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 text-[#3B64CF] animate-spin" />
          </div>
        )}

        {!tabLoading && activeTab === "dados" && (
          <TabDados cliente={cliente} consumoData={consumoData} geracaoData={geracaoData} hasConsumo={hasConsumo()} hasGeracao={hasGeracao()} maxConsumo={maxConsumo} maxGeracao={maxGeracao} />
        )}

        {!tabLoading && activeTab === "gd" && (
          <TabGD propostas={gdPropostas} axsPropostas={axsPropostas} clienteId={clienteId} router={router} />
        )}

        {!tabLoading && activeTab === "reciee" && (
          <TabReciee faturas={faturasReciee} analises={analisesReciee} totalFaturas={recieeTotalFaturas} totalAnalises={recieeTotalAnalises} valorEstimado={recieeValorEstimado} expandedFatura={expandedFatura} toggleFatura={toggleFatura} clienteId={clienteId} router={router} />
        )}

        {!tabLoading && activeTab === "atendimentos" && (
          <TabAtendimentos atendimentos={atendimentos} />
        )}

        {!tabLoading && activeTab === "oportunidades" && (
          <TabOportunidades oportunidades={allOportunidades} oportunidadesPorEtapa={oportunidadesPorEtapa} />
        )}
      </div>
    </div>
  );
}

// ─── Tab: DADOS ───

function TabDados({
  cliente,
  consumoData,
  geracaoData,
  hasConsumo,
  hasGeracao,
  maxConsumo,
  maxGeracao,
}: {
  cliente: Cliente;
  consumoData: number[];
  geracaoData: number[];
  hasConsumo: boolean;
  hasGeracao: boolean;
  maxConsumo: number;
  maxGeracao: number;
}) {
  return (
    <div className="space-y-4">
      {/* Dados Pessoais */}
      <Section title="Dados Pessoais" icon={User}>
        <InfoGrid>
          <InfoItem icon={User} label="Nome" value={cliente.nome_razao_social} />
          <InfoItem icon={FileText} label="CPF/CNPJ" value={cliente.cnpj_cpf} />
          <InfoItem icon={Phone} label="Telefone" value={cliente.telefone} />
          <InfoItem icon={Smartphone} label="Celular" value={cliente.celular} />
          <InfoItem icon={Mail} label="E-mail" value={cliente.email} />
          <InfoItem icon={Calendar} label="Nascimento" value={cliente.data_nascimento ? formatDate(cliente.data_nascimento) : null} />
        </InfoGrid>
      </Section>

      {/* Endereço */}
      <Section title="Endereço" icon={MapPin}>
        <InfoGrid>
          <InfoItem
            icon={MapPin}
            label="Endereço"
            value={
              cliente.bairro
                ? `${cliente.bairro}${cliente.numero ? ", " + cliente.numero : ""}${cliente.complemento ? " - " + cliente.complemento : ""}`
                : null
            }
          />
          <InfoItem icon={Building2} label="Cidade/UF" value={cliente.cidade && cliente.estado ? `${cliente.cidade} - ${cliente.estado}` : cliente.cidade || cliente.estado || null} />
          <InfoItem icon={MapPin} label="CEP" value={cliente.cep} />
        </InfoGrid>
      </Section>

      {/* Dados Energéticos */}
      <Section title="Dados Energéticos" icon={Zap}>
        <InfoGrid>
          <InfoItem icon={Building2} label="Concessionária" value={cliente.concessionaria} />
          <InfoItem icon={Zap} label="Classe Tarifária" value={cliente.classe_tarifaria} />
          <InfoItem icon={Activity} label="Subgrupo" value={cliente.subgrupo_tarifario} />
          <InfoItem icon={Calendar} label="Vencimento" value={cliente.vencimento_fatura} />
        </InfoGrid>
      </Section>

      {/* Consumo Mensal */}
      {hasConsumo && (
        <Section title="Consumo Mensal (kWh)" icon={BarChart3}>
          <div className="flex items-end gap-1 h-32 mt-2">
            {consumoData.map((value, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full relative" style={{ height: `${Math.max((value / maxConsumo) * 100, 2)}%` }}>
                  <div className="absolute inset-0 rounded-t bg-[#3B64CF] opacity-80 hover:opacity-100 transition-opacity" />
                </div>
                <span className="text-[8px] text-white/40">{MONTHS[i]}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 px-1">
            <span className="text-[10px] text-white/30">0</span>
            <span className="text-[10px] text-white/30">{maxConsumo.toLocaleString("pt-BR")} kWh</span>
          </div>
        </Section>
      )}

      {/* Geração Mensal */}
      {hasGeracao && (
        <Section title="Geração Mensal (kWh)" icon={TrendingUp}>
          <div className="flex items-end gap-1 h-32 mt-2">
            {geracaoData.map((value, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full relative" style={{ height: `${Math.max((value / maxGeracao) * 100, 2)}%` }}>
                  <div className="absolute inset-0 rounded-t bg-green-500 opacity-80 hover:opacity-100 transition-opacity" />
                </div>
                <span className="text-[8px] text-white/40">{MONTHS[i]}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 px-1">
            <span className="text-[10px] text-white/30">0</span>
            <span className="text-[10px] text-white/30">{maxGeracao.toLocaleString("pt-BR")} kWh</span>
          </div>
        </Section>
      )}

      {/* Observações */}
      {cliente.observacoes && (
        <Section title="Observações" icon={FileText}>
          <p className="text-xs text-white/60 whitespace-pre-wrap">{cliente.observacoes}</p>
        </Section>
      )}
    </div>
  );
}

// ─── Tab: GD ───

function TabGD({
  propostas,
  axsPropostas,
  clienteId,
  router,
}: {
  propostas: Oportunidade[];
  axsPropostas: AxsProposta[];
  clienteId: string;
  router: any;
}) {
  const allPropostas = [
    ...propostas.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      etapa: p.etapa,
      uc: p.uc,
      consumo: p.consumo_kwh,
      valor: p.valor_proposta,
      data: p.created_at,
      origem: "oportunidades" as const,
    })),
    ...axsPropostas.map((a) => ({
      id: a.id,
      titulo: `AXS - ${a.axs_card_id || a.id.slice(0, 8)}`,
      etapa: a.axs_status || "proposta",
      uc: null,
      consumo: null,
      valor: a.axs_mensalidade,
      data: a.created_at,
      origem: "axs" as const,
    })),
  ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Zap className="h-4 w-4 text-[#3B64CF]" />
          Propostas GD
          <span className="text-[10px] text-white/40 font-normal">({allPropostas.length})</span>
        </h3>
        <button
          onClick={() => router.push(`/clientes/${clienteId}/axs-novo`)}
          className="flex items-center gap-1.5 h-7 px-3 text-[11px] rounded-lg bg-[#3B64CF] text-white hover:bg-[#2d52b0] transition-colors"
        >
          <Plus className="h-3 w-3" />
          Nova Proposta GD
        </button>
      </div>

      {allPropostas.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Nenhuma proposta GD"
          description="Clique em 'Nova Proposta GD' para criar a primeira proposta."
        />
      ) : (
        <div className="space-y-2">
          {allPropostas.map((p) => (
            <div
              key={`${p.origem}-${p.id}`}
              className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white truncate">{p.titulo}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge className={cn("text-[9px] border", getEtapaColor(p.etapa))}>
                      {p.etapa}
                    </Badge>
                    {p.origem === "axs" && (
                      <Badge className="text-[9px] bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        AXS
                      </Badge>
                    )}
                  </div>
                </div>
                {p.valor != null && (
                  <span className="text-[11px] font-semibold text-[#3B64CF] whitespace-nowrap">
                    {formatCurrency(p.valor)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-white/40">
                {p.uc && (
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    UC: {p.uc}
                  </span>
                )}
                {p.consumo != null && (
                  <span className="flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" />
                    {p.consumo.toLocaleString("pt-BR")} kWh
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(p.data)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: RECIEE ───

function TabReciee({
  faturas,
  analises,
  totalFaturas,
  totalAnalises,
  valorEstimado,
  expandedFatura,
  toggleFatura,
  clienteId,
  router,
}: {
  faturas: FaturaReciee[];
  analises: AnaliseReciee[];
  totalFaturas: number;
  totalAnalises: number;
  valorEstimado: number;
  expandedFatura: string | null;
  toggleFatura: (id: string) => void;
  clienteId: string;
  router: any;
}) {
  return (
    <div className="space-y-3">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard
          icon={Receipt}
          label="Faturas"
          value={totalFaturas.toString()}
          color="text-[#3B64CF]"
        />
        <SummaryCard
          icon={FileWarning}
          label="Análises"
          value={totalAnalises.toString()}
          color="text-yellow-400"
        />
        <SummaryCard
          icon={DollarSign}
          label="Recup."
          value={valorEstimado > 0 ? formatCurrency(valorEstimado) : "R$ 0"}
          color="text-green-400"
        />
      </div>

      {/* Faturas List */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Receipt className="h-4 w-4 text-[#3B64CF]" />
          Faturas RECIEE
        </h3>
        <button
          onClick={() => router.push(`/clientes/${clienteId}/editar`)}
          className="flex items-center gap-1.5 h-7 px-3 text-[11px] rounded-lg border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Upload className="h-3 w-3" />
          Upload Faturas
        </button>
      </div>

      {faturas.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma fatura registrada"
          description="Faça o upload das faturas para iniciar a análise RECIEE."
        />
      ) : (
        <div className="space-y-2">
          {faturas.map((f) => {
            const isExpanded = expandedFatura === f.id;
            const fAnalises = analises.filter((a) => a.fatura_id === f.id);
            return (
              <div
                key={f.id}
                className="rounded-xl bg-white/5 border border-white/10 overflow-hidden"
              >
                <button
                  onClick={() => toggleFatura(f.id)}
                  className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">
                        {f.competencia || "Sem competência"}
                      </span>
                      {f.bandeira && (
                        <Badge className={cn(
                          "text-[9px]",
                          f.bandeira.toLowerCase().includes("vermelha")
                            ? "bg-red-500/20 text-red-400"
                            : f.bandeira.toLowerCase().includes("amarela")
                            ? "bg-yellow-500/20 text-yellow-400"
                            : f.bandeira.toLowerCase().includes("verde")
                            ? "bg-green-500/20 text-green-400"
                            : "bg-slate-500/20 text-slate-400"
                        )}>
                          {f.bandeira}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-white/40">
                      {f.consumo_kwh != null && (
                        <span>{f.consumo_kwh.toLocaleString("pt-BR")} kWh</span>
                      )}
                      {f.valor_total != null && (
                        <span>{formatCurrency(f.valor_total)}</span>
                      )}
                      {fAnalises.length > 0 && (
                        <span className="text-yellow-400/70">{fAnalises.length} análise(s)</span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-white/30 shrink-0" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-white/30 shrink-0" />
                  )}
                </button>

                {isExpanded && fAnalises.length > 0 && (
                  <div className="border-t border-white/10 p-3 space-y-2 bg-white/[0.02]">
                    {fAnalises.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg bg-[#0f1d32] border border-white/5">
                        <div className={cn("h-6 w-6 rounded-md flex items-center justify-center shrink-0", getSeveridadeColor(a.severidade || ""))}>
                          <Info className="h-3 w-3" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {a.macro_indice && (
                              <span className="text-[10px] font-medium text-white/80">{a.macro_indice}</span>
                            )}
                            {a.severidade && (
                              <Badge className={cn("text-[8px]", getSeveridadeColor(a.severidade))}>
                                {a.severidade}
                              </Badge>
                            )}
                          </div>
                          {a.descricao && (
                            <p className="text-[10px] text-white/50 mt-0.5">{a.descricao}</p>
                          )}
                        </div>
                        {a.valor_estimado != null && a.valor_estimado > 0 && (
                          <span className="text-[10px] font-semibold text-green-400 whitespace-nowrap">
                            {formatCurrency(a.valor_estimado)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: ATENDIMENTOS ───

function TabAtendimentos({ atendimentos }: { atendimentos: Atendimento[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Headphones className="h-4 w-4 text-[#3B64CF]" />
        Atendimentos
        <span className="text-[10px] text-white/40 font-normal">({atendimentos.length})</span>
      </h3>

      {atendimentos.length === 0 ? (
        <EmptyState
          icon={Headphones}
          title="Nenhum atendimento registrado"
          description="Os atendimentos aparecerão aqui quando forem criados."
        />
      ) : (
        <div className="space-y-2">
          {atendimentos.map((a) => {
            const CanalIcon = getCanalIcon(a.canal);
            return (
              <div
                key={a.id}
                className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                    <CanalIcon className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">
                        {a.canal || "Canal não informado"}
                      </span>
                      {a.status && (
                        <Badge className={cn(
                          "text-[9px]",
                          a.status.toLowerCase() === "concluido" || a.status.toLowerCase() === "concluído"
                            ? "bg-green-500/20 text-green-400"
                            : a.status.toLowerCase() === "em andamento" || a.status.toLowerCase() === "ativo"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : a.status.toLowerCase() === "cancelado"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-slate-500/20 text-slate-400"
                        )}>
                          {a.status}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-white/40">
                      {a.telefone_cliente && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {a.telefone_cliente}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(a.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab: OPORTUNIDADES ───

function TabOportunidades({
  oportunidades,
  oportunidadesPorEtapa,
}: {
  oportunidades: Oportunidade[];
  oportunidadesPorEtapa: Record<string, Oportunidade[]>;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-[#3B64CF]" />
        Oportunidades
        <span className="text-[10px] text-white/40 font-normal">({oportunidades.length})</span>
      </h3>

      {oportunidades.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="Nenhuma oportunidade"
          description="As oportunidades cadastradas para este cliente aparecerão aqui."
        />
      ) : (
        <>
          {/* Etapa summary */}
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(oportunidadesPorEtapa).map(([etapa, items]) => (
              <Badge
                key={etapa}
                className={cn("text-[9px] border", getEtapaColor(etapa))}
              >
                {etapa}: {items.length}
              </Badge>
            ))}
          </div>

          {/* All oportunidades grouped by etapa */}
          {Object.entries(oportunidadesPorEtapa).map(([etapa, items]) => (
            <div key={etapa} className="space-y-2">
              <h4 className="text-[11px] font-medium text-white/60 flex items-center gap-2">
                <Badge className={cn("text-[9px] border", getEtapaColor(etapa))}>
                  {etapa}
                </Badge>
                <span className="text-white/30">({items.length})</span>
              </h4>
              <div className="space-y-1.5">
                {items.map((o) => (
                  <div
                    key={o.id}
                    className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-white truncate">{o.titulo}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {o.tipo && (
                            <Badge className="text-[9px] bg-slate-500/20 text-slate-400 border border-slate-500/30">
                              {o.tipo}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {o.valor_proposta != null && (
                        <span className="text-[11px] font-semibold text-[#3B64CF] whitespace-nowrap">
                          {formatCurrency(o.valor_proposta)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-white/40">
                      {o.uc && (
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          UC: {o.uc}
                        </span>
                      )}
                      {o.consumo_kwh != null && (
                        <span className="flex items-center gap-1">
                          <BarChart3 className="h-3 w-3" />
                          {o.consumo_kwh.toLocaleString("pt-BR")} kWh
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(o.created_at)}
                      </span>
                    </div>
                    {o.descricao && (
                      <p className="text-[10px] text-white/40 mt-2 line-clamp-2">{o.descricao}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Shared Components ───

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-[#3B64CF]" />
        <span className="text-xs font-semibold text-white">{title}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function InfoGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">{children}</div>;
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3 w-3 text-white/30 mt-0.5 shrink-0" />
      <div>
        <p className="text-[9px] text-white/30 uppercase tracking-wider">{label}</p>
        <p className="text-[11px] text-white/80 leading-tight mt-0.5">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-10">
      <Icon className="h-8 w-8 mx-auto mb-3 text-white/15" />
      <p className="text-xs font-medium text-white/50">{title}</p>
      <p className="text-[10px] text-white/30 mt-1">{description}</p>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
      <Icon className={cn("h-4 w-4 mx-auto mb-1", color)} />
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="text-[9px] text-white/40 mt-0.5">{label}</p>
    </div>
  );
}

function Badge({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded-md font-medium whitespace-nowrap",
        className
      )}
    >
      {children}
    </span>
  );
}
