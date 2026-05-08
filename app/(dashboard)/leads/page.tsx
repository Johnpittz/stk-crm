"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  MapPin,
  Building2,
  Phone,
  Mail,
  Import,
  Loader2,
  Filter,
  AlertTriangle,
  Info,
  ExternalLink,
  Briefcase,
  UserCheck,
  Target,
  List,
  Calendar,
  Tag,
  User,
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRightLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";

// ============================================================
// Types
// ============================================================

interface Empresa {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  telefone?: string;
  email?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  situacao_cadastral?: string;
  cnae_principal?: string;
  cnae_principal_descricao?: string;
  porte?: string;
  capital_social?: string;
}

interface Vendedor {
  id: string;
  nome_completo: string;
  cargo: string;
}

interface CidadeIBGE {
  id: number;
  nome: string;
}

interface Lead {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  telefone?: string;
  email?: string;
  cidade?: string;
  estado?: string;
  cnae_principal?: string;
  cnae_descricao?: string;
  porte?: string;
  status: "novo" | "em_atendimento" | "convertido" | "descartado";
  origem: string;
  vendedor_id?: string;
  vendedor?: { id: string; nome_completo: string } | null;
  importado_por: string;
  observacoes?: string;
  data_atribuicao?: string;
  created_at: string;
}

// ============================================================
// Constants
// ============================================================

const CNAES_PRESETS = [
  { codigo: "4321501", label: "4321501 - Instalação elétrica (baixa tensão)" },
  { codigo: "4321502", label: "4321502 - Instalação elétrica (alta tensão)" },
  { codigo: "4110700", label: "4110700 - Incorporação de empreendimentos" },
  { codigo: "4399105", label: "4399105 - Obras de alvenaria" },
  { codigo: "4322301", label: "4322301 - Instalação de alarme e segurança" },
  { codigo: "2522300", label: "2522300 - Fabricação de artigos de material elétrico" },
  { codigo: "2712301", label: "2712301 - Fabricação de transformadores" },
  { codigo: "4751201", label: "4751201 - Comércio varejista de material elétrico" },
];

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  novo: { label: "Novo", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Tag },
  em_atendimento: { label: "Em Atendimento", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  convertido: { label: "Convertido", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  descartado: { label: "Descartado", color: "bg-slate-100 text-slate-700 border-slate-200", icon: XCircle },
};

// ============================================================
// Component
// ============================================================

export default function LeadsPage() {
  const supabase = createClient();

  // ---------- Auth & Role ----------
  const [user, setUser] = useState<{ id: string; cargo: string } | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);

  // ---------- Tab state ----------
  const [activeTab, setActiveTab] = useState("buscar");
  const [tabInicializado, setTabInicializado] = useState(false);

  // ---------- Search tab state ----------
  const [cnae, setCnae] = useState("4321501");
  const [uf, setUf] = useState("SP");
  const [cidade, setCidade] = useState("");
  const [cidades, setCidades] = useState<CidadeIBGE[]>([]);
  const [carregandoCidades, setCarregandoCidades] = useState(false);
  const [limite, setLimite] = useState("50");
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [fonteInfo, setFonteInfo] = useState<any>(null);

  // ---------- Queue tab state ----------
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregandoLeads, setCarregandoLeads] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [buscaLeads, setBuscaLeads] = useState("");
  const [atribuindoLeadId, setAtribuindoLeadId] = useState<string | null>(null);
  const [vendedorAtribuicao, setVendedorAtribuicao] = useState<string>("");
  const [totalLeads, setTotalLeads] = useState(0);
  const [obsEditando, setObsEditando] = useState<Record<string, string>>({});
  const [salvandoObs, setSalvandoObs] = useState<string | null>(null);

  // ---------- Distribuição modal ----------
  const [modalDistribuirAberto, setModalDistribuirAberto] = useState(false);
  const [quantidadePorVendedor, setQuantidadePorVendedor] = useState("5");
  const [previewDistribuicao, setPreviewDistribuicao] = useState<any>(null);
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [executandoDistribuicao, setExecutandoDistribuicao] = useState(false);

  // ============================================================
  // Init
  // ============================================================

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("cargo")
          .eq("id", user.id)
          .single();

        const cargo = profile?.cargo || "vendedor";
        setUser({ id: user.id, cargo });

        if (["diretor", "admin", "gerente_comercial"].includes(cargo)) {
          const { data: vends } = await supabase
            .from("profiles")
            .select("id, nome_completo, cargo")
            .order("nome_completo", { ascending: true });
          if (vends) setVendedores(vends);
        }
      }
    }
    init();
  }, []);

  // Aba inicial: vendedores vão direto para a fila
  useEffect(() => {
    if (user && !tabInicializado) {
      const gestor = ["diretor", "admin", "gerente_comercial"].includes(user.cargo);
      if (!gestor) {
        setActiveTab("fila");
      }
      setTabInicializado(true);
    }
  }, [user, tabInicializado]);

  // ============================================================
  // Cidades
  // ============================================================

  useEffect(() => {
    async function buscarCidades() {
      if (!uf) {
        setCidades([]);
        setCidade("");
        return;
      }
      setCarregandoCidades(true);
      try {
        const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`, {
          next: { revalidate: 86400 },
        });
        if (res.ok) {
          const data: CidadeIBGE[] = await res.json();
          setCidades(data.sort((a, b) => a.nome.localeCompare(b.nome)));
        }
      } catch (err) {
        console.error("Erro ao buscar cidades:", err);
      } finally {
        setCarregandoCidades(false);
      }
    }
    buscarCidades();
  }, [uf]);

  // ============================================================
  // Busca de empresas (CNPJ Aberto)
  // ============================================================

  async function handleBuscar() {
    setCarregando(true);
    setErro(null);
    setMensagem(null);
    setEmpresas([]);
    setSelecionadas(new Set());
    setFonteInfo(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const params = new URLSearchParams();
      params.set("cnae", cnae);
      params.set("uf", uf);
      if (cidade.trim()) params.set("cidade", cidade.trim());
      params.set("limite", limite);

      const res = await fetch(`/api/prospeccao?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const json = await res.json();

      if (!res.ok) {
        setErro(json.error || "Erro ao buscar empresas");
        return;
      }

      if (json.mensagem && !json.empresas?.length) {
        setFonteInfo(json);
        setErro(json.mensagem);
        return;
      }

      setEmpresas(json.empresas || []);
      setMensagem(`${json.total || 0} empresas encontradas`);
    } catch (err: any) {
      setErro(err.message || "Erro na busca");
    } finally {
      setCarregando(false);
    }
  }

  // ============================================================
  // Importar para leads (sem vendedor — entra na fila)
  // ============================================================

  async function handleImportar() {
    if (selecionadas.size === 0) {
      setErro("Selecione pelo menos uma empresa");
      return;
    }

    setImportando(true);
    setErro(null);
    setMensagem(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const selecionados = empresas.filter((e) => selecionadas.has(e.cnpj));

      const res = await fetch("/api/prospeccao", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          empresas: selecionados,
          cnae_filtro: cnae,
          uf_filtro: uf,
          cidade_filtro: cidade,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErro(json.error || "Erro ao importar");
        return;
      }

      const { resultados } = json;
      setMensagem(
        `Importação concluída! ${resultados.importados} importados para a fila de leads, ${resultados.duplicados} duplicados, ${resultados.erros} erros.`
      );
      setSelecionadas(new Set());
    } catch (err: any) {
      setErro(err.message || "Erro na importação");
    } finally {
      setImportando(false);
    }
  }

  // ============================================================
  // Fila de leads
  // ============================================================

  const buscarLeads = useCallback(async () => {
    setCarregandoLeads(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const params = new URLSearchParams();
      if (filtroStatus) params.set("status", filtroStatus);
      if (buscaLeads.trim()) params.set("busca", buscaLeads.trim());
      params.set("limit", "100");

      const res = await fetch(`/api/leads?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const json = await res.json();
      if (res.ok) {
        setLeads(json.leads || []);
        setTotalLeads(json.total || 0);
      } else {
        console.error("Erro ao buscar leads:", json.error);
      }
    } catch (err) {
      console.error("Erro ao buscar leads:", err);
    } finally {
      setCarregandoLeads(false);
    }
  }, [filtroStatus, buscaLeads]);

  useEffect(() => {
    if (activeTab === "fila") {
      buscarLeads();
    }
  }, [activeTab, filtroStatus, buscaLeads, buscarLeads]);

  async function handleAtribuir(leadId: string) {
    if (!vendedorAtribuicao) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: leadId,
          vendedor_id: vendedorAtribuicao,
          status: "em_atendimento",
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setAtribuindoLeadId(null);
        setVendedorAtribuicao("");
        buscarLeads();
      } else {
        console.error("Erro ao atribuir:", json.error);
      }
    } catch (err) {
      console.error("Erro ao atribuir:", err);
    }
  }

  async function handleMudarStatus(leadId: string, novoStatus: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: leadId, status: novoStatus }),
      });

      if (res.ok) {
        buscarLeads();
      }
    } catch (err) {
      console.error("Erro ao mudar status:", err);
    }
  }

  async function handleSalvarObservacao(leadId: string) {
    const texto = obsEditando[leadId];
    if (texto === undefined) return;

    setSalvandoObs(leadId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: leadId, observacoes: texto }),
      });

      if (res.ok) {
        setObsEditando((prev) => {
          const next = { ...prev };
          delete next[leadId];
          return next;
        });
        buscarLeads();
      }
    } catch (err) {
      console.error("Erro ao salvar observação:", err);
    } finally {
      setSalvandoObs(null);
    }
  }

  // ============================================================
  // Distribuição de leads
  // ============================================================

  async function carregarPreviewDistribuicao() {
    setCarregandoPreview(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/leads/distribuir", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quantidade_por_vendedor: parseInt(quantidadePorVendedor, 10),
          preview: true,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setPreviewDistribuicao(json);
      } else {
        setPreviewDistribuicao({ erro: json.error });
      }
    } catch (err) {
      console.error("Erro ao carregar preview:", err);
      setPreviewDistribuicao({ erro: "Erro ao carregar preview" });
    } finally {
      setCarregandoPreview(false);
    }
  }

  async function executarDistribuicao() {
    setExecutandoDistribuicao(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/leads/distribuir", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          quantidade_por_vendedor: parseInt(quantidadePorVendedor, 10),
          preview: false,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setModalDistribuirAberto(false);
        setPreviewDistribuicao(null);
        buscarLeads();
        setMensagem(
          `Distribuição concluída! ${json.total_distribuido} leads distribuídos para ${json.vendedores.length} vendedores.`
        );
      } else {
        setPreviewDistribuicao({ erro: json.error });
      }
    } catch (err) {
      console.error("Erro ao distribuir:", err);
      setPreviewDistribuicao({ erro: "Erro ao executar distribuição" });
    } finally {
      setExecutandoDistribuicao(false);
    }
  }

  // ============================================================
  // Helpers UI
  // ============================================================

  function toggleSelecao(cnpj: string) {
    const novo = new Set(selecionadas);
    if (novo.has(cnpj)) novo.delete(cnpj);
    else novo.add(cnpj);
    setSelecionadas(novo);
  }

  function toggleTodas() {
    if (selecionadas.size === empresas.length) setSelecionadas(new Set());
    else setSelecionadas(new Set(empresas.map((e) => e.cnpj)));
  }

  const isGestor = user && ["diretor", "admin", "gerente_comercial"].includes(user.cargo);

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <p className="text-slate-500">
          {isGestor
            ? "Busque empresas B2B e gerencie a fila de leads antes de convertê-los em clientes."
            : "Acompanhe seus leads atribuídos, registre observações e movimente o pipeline."}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn("grid w-full max-w-md", isGestor ? "grid-cols-2" : "grid-cols-1")}>
          {isGestor && (
            <TabsTrigger value="buscar">
              <Search className="h-4 w-4 mr-2" />
              Buscar Empresas
            </TabsTrigger>
          )}
          <TabsTrigger value="fila">
            <Inbox className="h-4 w-4 mr-2" />
            {isGestor ? "Fila de Leads" : "Meus Leads"}
            {totalLeads > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                {totalLeads}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ==========================================================
            ABA: BUSCAR EMPRESAS
            ========================================================== */}
        <TabsContent value="buscar" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-[#14919B]" />
                Filtros de Busca
              </CardTitle>
              <CardDescription>
                Escolha o CNAE da atividade e a localização das empresas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">CNAE</label>
                  <Select value={cnae} onValueChange={setCnae}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o CNAE" />
                    </SelectTrigger>
                    <SelectContent>
                      {CNAES_PRESETS.map((c) => (
                        <SelectItem key={c.codigo} value={c.codigo}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Estado (UF)</label>
                  <Select value={uf} onValueChange={setUf}>
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {UFS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Cidade (opcional)</label>
                  <Select value={cidade || "__TODAS__"} onValueChange={(v) => setCidade(v === "__TODAS__" ? "" : v)} disabled={carregandoCidades || cidades.length === 0}>
                    <SelectTrigger>
                      {carregandoCidades ? (
                        <span className="flex items-center gap-2 text-slate-400">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Carregando...
                        </span>
                      ) : (
                        <SelectValue placeholder="Todas as cidades" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__TODAS__">Todas as cidades</SelectItem>
                      {cidades.map((c) => (
                        <SelectItem key={c.id} value={c.nome}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Quantidade</label>
                  <Select value={limite} onValueChange={setLimite}>
                    <SelectTrigger>
                      <SelectValue placeholder="Limite" />
                    </SelectTrigger>
                    <SelectContent>
                      {["10", "25", "50", "100"].map((l) => (
                        <SelectItem key={l} value={l}>
                          {l} empresas
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4 flex-wrap">
                <Button
                  onClick={handleBuscar}
                  disabled={carregando}
                  className="bg-[#0D3B33] hover:bg-[#14919B]"
                >
                  {carregando ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Buscar Empresas
                </Button>
              </div>
            </CardContent>
          </Card>

          {erro && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">Atenção</p>
                  <p className="text-sm text-amber-700 mt-1">{erro}</p>
                  {fonteInfo?.instrucoes && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-medium text-amber-800">Para ativar a prospecção:</p>
                      <div className="space-y-1">
                        {Object.entries(fonteInfo.instrucoes).map(([key, value]: [string, any]) => (
                          <p key={key} className="text-sm text-amber-700">
                            • <strong>{key}:</strong> {value}
                          </p>
                        ))}
                      </div>
                      <div className="flex gap-3 mt-2">
                        <a
                          href="https://cnpjaberto.com.br"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-amber-800 underline hover:text-amber-900"
                        >
                          CNPJ Aberto <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {mensagem && !erro && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-emerald-600" />
                <p className="text-sm text-emerald-700">{mensagem}</p>
              </div>
            </div>
          )}

          {empresas.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-[#14919B]" />
                      Resultados da Busca
                    </CardTitle>
                    <CardDescription>
                      {empresas.length} empresas encontradas. Selecione as que deseja importar para a fila de leads.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      {selecionadas.size} selecionadas
                    </Badge>
                    <Button
                      onClick={handleImportar}
                      disabled={importando || selecionadas.size === 0}
                      className="bg-[#14919B] hover:bg-[#0D3B33]"
                    >
                      {importando ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Import className="h-4 w-4 mr-2" />
                      )}
                      Importar para Fila
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <Checkbox
                    checked={selecionadas.size === empresas.length && empresas.length > 0}
                    onCheckedChange={toggleTodas}
                  />
                  <span className="text-sm text-slate-600">Selecionar todas</span>
                </div>

                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {empresas.map((empresa) => (
                      <div
                        key={empresa.cnpj}
                        className={cn(
                          "flex items-start gap-3 p-4 rounded-lg border transition-colors",
                          selecionadas.has(empresa.cnpj)
                            ? "border-[#14919B] bg-[#14919B]/5"
                            : "hover:bg-slate-50"
                        )}
                      >
                        <div className="pt-1">
                          <Checkbox
                            checked={selecionadas.has(empresa.cnpj)}
                            onCheckedChange={() => toggleSelecao(empresa.cnpj)}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-slate-900 truncate">
                              {empresa.razao_social}
                            </h3>
                            {empresa.nome_fantasia && (
                              <Badge variant="outline" className="text-xs">
                                {empresa.nome_fantasia}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                              {empresa.cnpj}
                            </span>
                            {empresa.cnae_principal_descricao && (
                              <span className="truncate max-w-[300px]">
                                {empresa.cnae_principal_descricao}
                              </span>
                            )}
                            {empresa.porte && (
                              <Badge variant="secondary" className="text-[10px]">
                                {empresa.porte}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-slate-600 mt-2 flex-wrap">
                            {empresa.telefone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3 text-slate-400" />
                                {empresa.telefone}
                              </span>
                            )}
                            {empresa.email && (
                              <span className="flex items-center gap-1 truncate max-w-[250px]">
                                <Mail className="h-3 w-3 text-slate-400" />
                                {empresa.email}
                              </span>
                            )}
                            {(empresa.cidade || empresa.estado) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-slate-400" />
                                {empresa.cidade && empresa.estado
                                  ? `${empresa.cidade}/${empresa.estado}`
                                  : empresa.cidade || empresa.estado}
                              </span>
                            )}
                          </div>

                          {(empresa.logradouro || empresa.bairro) && (
                            <p className="text-xs text-slate-400 mt-1">
                              {empresa.logradouro}
                              {empresa.numero ? `, ${empresa.numero}` : ""}
                              {empresa.complemento ? ` - ${empresa.complemento}` : ""}
                              {empresa.bairro ? ` - ${empresa.bairro}` : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {!empresas.length && !carregando && !erro && (
            <Card className="bg-slate-50 border-dashed">
              <CardContent className="p-8 text-center">
                <Briefcase className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-medium text-slate-700">Como funciona?</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-lg mx-auto">
                  Escolha um CNAE de atividade (ex: instalação elétrica), selecione o estado e clique
                  em <strong>Buscar Empresas</strong>. O sistema consulta a base pública da Receita
                  Federal via CNPJ Aberto e retorna empresas ativas para importação.
                </p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
                  <div className="bg-white p-4 rounded-lg border">
                    <div className="text-[#14919B] font-bold text-lg">1</div>
                    <p className="text-sm font-medium mt-1">Filtre por CNAE</p>
                    <p className="text-xs text-slate-500">
                      Escolha a atividade econômica do seu cliente ideal.
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border">
                    <div className="text-[#14919B] font-bold text-lg">2</div>
                    <p className="text-sm font-medium mt-1">Selecione empresas</p>
                    <p className="text-xs text-slate-500">
                      Visualize dados e marque as que quer importar.
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border">
                    <div className="text-[#14919B] font-bold text-lg">3</div>
                    <p className="text-sm font-medium mt-1">Importe para a fila</p>
                    <p className="text-xs text-slate-500">
                      Os leads entram na fila para distribuição aos vendedores.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ==========================================================
            ABA: FILA DE LEADS
            ========================================================== */}
        <TabsContent value="fila" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Inbox className="h-5 w-5 text-[#14919B]" />
                    {isGestor ? "Fila de Leads" : "Meus Leads"}
                  </CardTitle>
                  <CardDescription>
                    {isGestor
                      ? "Gerencie leads importados, atribua vendedores e acompanhe o status."
                      : "Seus leads atribuídos. Registre observações e movimente o pipeline."}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <Input
                    placeholder="Buscar por empresa ou CNPJ..."
                    value={buscaLeads}
                    onChange={(e) => setBuscaLeads(e.target.value)}
                    className="w-[260px]"
                  />
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__TODOS__">Todos os status</SelectItem>
                      <SelectItem value="novo">Novo</SelectItem>
                      <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                      <SelectItem value="convertido">Convertido</SelectItem>
                      <SelectItem value="descartado">Descartado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={buscarLeads} disabled={carregandoLeads}>
                    {carregandoLeads ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                  {isGestor && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setModalDistribuirAberto(true);
                        setPreviewDistribuicao(null);
                        setQuantidadePorVendedor("5");
                      }}
                    >
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      Distribuir Leads
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {carregandoLeads ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#14919B]" />
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-12">
                  <Inbox className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">
                    {isGestor ? "Nenhum lead na fila" : "Nenhum lead atribuído a você"}
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    {isGestor
                      ? "Vá para a aba Buscar Empresas para importar leads."
                      : "Aguarde atribuição de novos leads pelo gestor."}
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3">
                    {leads.map((lead) => {
                      const statusConfig = STATUS_LABELS[lead.status] || STATUS_LABELS.novo;
                      const StatusIcon = statusConfig.icon;
                      const isAtribuindo = atribuindoLeadId === lead.id;

                      return (
                        <div
                          key={lead.id}
                          className="flex flex-col gap-3 p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow"
                        >
                          {/* Linha principal: Info + Actions */}
                          <div className="flex flex-col md:flex-row md:items-start gap-4">
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-slate-900 truncate">
                                  {lead.razao_social}
                                </h3>
                                {lead.nome_fantasia && (
                                  <Badge variant="outline" className="text-xs">
                                    {lead.nome_fantasia}
                                  </Badge>
                                )}
                                <Badge className={cn("text-xs border", statusConfig.color)}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusConfig.label}
                                </Badge>
                              </div>

                              <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                  {lead.cnpj}
                                </span>
                                {lead.cnae_descricao && (
                                  <span className="truncate max-w-[300px]">
                                    {lead.cnae_descricao}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-4 text-sm text-slate-600 mt-2 flex-wrap">
                                {lead.telefone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-slate-400" />
                                    {lead.telefone}
                                  </span>
                                )}
                                {lead.email && (
                                  <span className="flex items-center gap-1 truncate max-w-[200px]">
                                    <Mail className="h-3 w-3 text-slate-400" />
                                    {lead.email}
                                  </span>
                                )}
                                {(lead.cidade || lead.estado) && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3 text-slate-400" />
                                    {lead.cidade && lead.estado
                                      ? `${lead.cidade}/${lead.estado}`
                                      : lead.cidade || lead.estado}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 text-slate-400" />
                                  {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                                </span>
                              </div>

                              {lead.vendedor && (
                                <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                                  <UserCheck className="h-3 w-3" />
                                  Atribuído a: <strong>{lead.vendedor.nome_completo}</strong>
                                  {lead.data_atribuicao && (
                                    <span className="text-slate-400">
                                      em {new Date(lead.data_atribuicao).toLocaleDateString("pt-BR")}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-wrap md:justify-end">
                            {isGestor && !lead.vendedor_id && (
                              <>
                                {isAtribuindo ? (
                                  <div className="flex items-center gap-2">
                                    <Select
                                      value={vendedorAtribuicao}
                                      onValueChange={setVendedorAtribuicao}
                                    >
                                      <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="Selecionar vendedor" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {vendedores.map((v) => (
                                          <SelectItem key={v.id} value={v.id}>
                                            {v.nome_completo}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      size="sm"
                                      onClick={() => handleAtribuir(lead.id)}
                                      disabled={!vendedorAtribuicao}
                                      className="bg-[#14919B] hover:bg-[#0D3B33]"
                                    >
                                      <UserCheck className="h-4 w-4 mr-1" />
                                      Atribuir
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setAtribuindoLeadId(null);
                                        setVendedorAtribuicao("");
                                      }}
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setAtribuindoLeadId(lead.id);
                                      setVendedorAtribuicao("");
                                    }}
                                  >
                                    <UserCheck className="h-4 w-4 mr-1" />
                                    Atribuir
                                  </Button>
                                )}
                              </>
                            )}

                            {isGestor && lead.vendedor_id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setAtribuindoLeadId(lead.id);
                                  setVendedorAtribuicao(lead.vendedor_id || "");
                                }}
                              >
                                <ArrowRightLeft className="h-4 w-4 mr-1" />
                                Reatribuir
                              </Button>
                            )}

                            {/* Ações do vendedor */}
                            {!isGestor && lead.status === "novo" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMudarStatus(lead.id, "em_atendimento")}
                              >
                                <Clock className="h-4 w-4 mr-1" />
                                Iniciar Atendimento
                              </Button>
                            )}

                            {!isGestor && lead.status === "em_atendimento" && (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => handleMudarStatus(lead.id, "convertido")}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Converter
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-slate-500"
                                  onClick={() => handleMudarStatus(lead.id, "descartado")}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Descartar
                                </Button>
                              </>
                            )}

                            {!isGestor && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setObsEditando((prev) => ({
                                    ...prev,
                                    [lead.id]: lead.observacoes || "",
                                  }))
                                }
                              >
                                Editar Obs
                              </Button>
                            )}

                            {isGestor && (
                              <Select
                                value={lead.status}
                                onValueChange={(v) => handleMudarStatus(lead.id, v)}
                              >
                                <SelectTrigger className="w-[140px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="novo">Novo</SelectItem>
                                  <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                                  <SelectItem value="convertido">Convertido</SelectItem>
                                  <SelectItem value="descartado">Descartado</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                          </div>

                          {/* Observações - sempre abaixo da linha principal */}
                          {(lead.observacoes || obsEditando[lead.id] !== undefined) && (
                            <div className="w-full">
                              {obsEditando[lead.id] !== undefined ? (
                                <div className="flex gap-2 items-start">
                                  <textarea
                                    className="flex-1 min-h-[60px] text-sm border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-[#14919B]"
                                    placeholder="Registre aqui suas observações sobre o contato..."
                                    value={obsEditando[lead.id]}
                                    onChange={(e) =>
                                      setObsEditando((prev) => ({ ...prev, [lead.id]: e.target.value }))
                                    }
                                  />
                                  <div className="flex flex-col gap-1">
                                    <Button
                                      size="sm"
                                      onClick={() => handleSalvarObservacao(lead.id)}
                                      disabled={salvandoObs === lead.id}
                                      className="bg-[#14919B] hover:bg-[#0D3B33]"
                                    >
                                      {salvandoObs === lead.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        "Salvar"
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        setObsEditando((prev) => {
                                          const next = { ...prev };
                                          delete next[lead.id];
                                          return next;
                                        })
                                      }
                                    >
                                      Cancelar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="text-sm text-slate-600 bg-slate-50 p-2 rounded-md cursor-pointer hover:bg-slate-100 break-all"
                                  onClick={() =>
                                    setObsEditando((prev) => ({
                                      ...prev,
                                      [lead.id]: lead.observacoes || "",
                                    }))
                                  }
                                >
                                  {lead.observacoes || (
                                    <span className="text-slate-400 italic">
                                      Clique para adicionar observações...
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de Distribuição */}
      <Dialog open={modalDistribuirAberto} onOpenChange={setModalDistribuirAberto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-[#14919B]" />
              Distribuir Leads
            </DialogTitle>
            <DialogDescription>
              Defina quantos leads cada vendedor deve receber e visualize antes de confirmar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                Leads por vendedor:
              </label>
              <Select
                value={quantidadePorVendedor}
                onValueChange={(v) => {
                  setQuantidadePorVendedor(v);
                  setPreviewDistribuicao(null);
                }}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 5, 8, 10, 15, 20].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={carregarPreviewDistribuicao}
                disabled={carregandoPreview}
              >
                {carregandoPreview ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Search className="h-4 w-4 mr-1" />
                )}
                Visualizar
              </Button>
            </div>

            {previewDistribuicao?.erro && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {previewDistribuicao.erro}
              </div>
            )}

            {previewDistribuicao && !previewDistribuicao.erro && (
              <div className="rounded-md bg-slate-50 border p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">
                    Leads disponíveis: <strong>{previewDistribuicao.total_leads_disponiveis}</strong>
                  </span>
                  <span className="text-slate-600">
                    A distribuir: <strong className="text-[#14919B]">{previewDistribuicao.total_a_distribuir}</strong>
                  </span>
                </div>
                {previewDistribuicao.sobrarao > 0 && (
                  <p className="text-xs text-amber-600">
                    ⚠️ {previewDistribuicao.sobrarao} leads ficarão na fila após a distribuição.
                  </p>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase">Distribuição preview</p>
                  {previewDistribuicao.vendedores.map((item: any) => (
                    <div
                      key={item.vendedor.id}
                      className="flex items-center justify-between bg-white p-2 rounded border text-sm"
                    >
                      <span className="font-medium text-slate-700">
                        {item.vendedor.nome_completo}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {item.quantidade} leads
                      </Badge>
                    </div>
                  ))}
                </div>

                {previewDistribuicao.vendedores[0]?.leads?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-slate-500 uppercase">
                      Exemplos de leads a serem distribuídos
                    </p>
                    <div className="max-h-[120px] overflow-y-auto space-y-1">
                      {previewDistribuicao.vendedores[0].leads.slice(0, 5).map((lead: any) => (
                        <div key={lead.id} className="text-xs text-slate-600 bg-white p-1.5 rounded border">
                          <span className="font-medium">{lead.razao_social}</span>
                          <span className="text-slate-400 ml-2">{lead.cnpj}</span>
                          {(lead.cidade || lead.estado) && (
                            <span className="text-slate-400 ml-2">
                              {lead.cidade && lead.estado ? `${lead.cidade}/${lead.estado}` : lead.cidade || lead.estado}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setModalDistribuirAberto(false);
                setPreviewDistribuicao(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={executarDistribuicao}
              disabled={
                executandoDistribuicao ||
                !previewDistribuicao ||
                previewDistribuicao.erro ||
                previewDistribuicao.total_a_distribuir === 0
              }
              className="bg-[#14919B] hover:bg-[#0D3B33]"
            >
              {executandoDistribuicao ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRightLeft className="h-4 w-4 mr-2" />
              )}
              Confirmar Distribuição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
