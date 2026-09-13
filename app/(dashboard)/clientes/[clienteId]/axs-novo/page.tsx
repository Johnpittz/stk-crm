"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Zap,
  User,
  MapPin,
  BarChart3,
  MessageSquare,
  CreditCard,
  FileText,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Home,
  Building2,
  Factory,
  Tractor,
  Search,
  RefreshCw,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";

// ─── Types ───

interface Cliente {
  id: string;
  nome_completo: string | null;
  nome_razao_social: string | null;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  cidade: string | null;
  estado: string | null;
}

interface FormData {
  // Step 1 - Tipo
  tipo_imovel: "casa" | "comercio" | "industria" | "rural" | "";
  tipo_pessoa: "pf" | "pj";

  // Step 2 - Dados do Contratante
  cpf_cnpj: string;
  nome_razao_social: string;
  data_nascimento: string;
  email: string;
  telefone: string;
  whatsapp: string;

  // Step 3 - Endereço
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;

  // Step 4 - Informações de Consumo
  classe: string;
  subgrupo: string;

  // Step 5 - Fatura
  uc_instalacao: string;
  vencimento_dia: string;
  concessionaria: string;

  // Step 6 - Histórico de Consumo
  consumo_meses: Record<string, string>;
  geracao_propria: boolean;
  geracao_meses: Record<string, string>;

  // Step 7 - Observações
  observacoes: string;
}

const INITIAL_FORM: FormData = {
  tipo_imovel: "",
  tipo_pessoa: "pf",
  cpf_cnpj: "",
  nome_razao_social: "",
  data_nascimento: "",
  email: "",
  telefone: "",
  whatsapp: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  classe: "",
  subgrupo: "",
  uc_instalacao: "",
  vencimento_dia: "",
  concessionaria: "",
  consumo_meses: {
    jan: "", fev: "", mar: "", abr: "", mai: "", jun: "",
    jul: "", ago: "", set: "", out: "", nov: "", dez: "",
  },
  geracao_propria: false,
  geracao_meses: {
    jan: "", fev: "", mar: "", abr: "", mai: "", jun: "",
    jul: "", ago: "", set: "", out: "", nov: "", dez: "",
  },
  observacoes: "",
};

const STEPS = [
  { label: "Tipo", icon: Home },
  { label: "Contratante", icon: User },
  { label: "Endereço", icon: MapPin },
  { label: "Consumo", icon: Zap },
  { label: "Fatura", icon: CreditCard },
  { label: "Histórico", icon: BarChart3 },
  { label: "Observações", icon: MessageSquare },
  { label: "Revisão", icon: FileText },
];

const MONTHS = [
  { key: "jan", label: "Jan" },
  { key: "fev", label: "Fev" },
  { key: "mar", label: "Mar" },
  { key: "abr", label: "Abr" },
  { key: "mai", label: "Mai" },
  { key: "jun", label: "Jun" },
  { key: "jul", label: "Jul" },
  { key: "ago", label: "Ago" },
  { key: "set", label: "Set" },
  { key: "out", label: "Out" },
  { key: "nov", label: "Nov" },
  { key: "dez", label: "Dez" },
];

const TIPO_IMOVEL_OPTIONS = [
  { value: "casa", label: "Casa / Apartamento", icon: Home, desc: "Residencial" },
  { value: "comercio", label: "Comércio", icon: Building2, desc: "Comercial" },
  { value: "industria", label: "Indústria", icon: Factory, desc: "Industrial" },
  { value: "rural", label: "Rural", icon: Tractor, desc: "Rural / Agro" },
];

const CONCESSIONARIAS = [
  "CEMIG",
  "COPEL",
  "CPFL PAULISTA",
  "ELEKTRO",
  "ENERGISA MT",
  "EQUATORIAL GO",
];

const CLASSES = ["Residencial", "Comercial", "Industrial", "Rural"];

const SUBGRUPOS = [
  "B1", "B2", "B3",
  "A1", "A2", "A3", "A3a", "A4",
  "AS", "BS", "Rural",
];

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

// ─── Helpers ───

function formatCPF(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

function formatCNPJ(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function formatCEP(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0,5)}-${d.slice(5)}`;
}

function formatDate(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
}

// ─── Main Component ───

export default function AxSNovoPage() {
  const params = useParams();
  const router = useRouter();
  const clienteId = params.clienteId as string;
  const supabase = createClient();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ─── Load client data ───
  useEffect(() => {
    const loadClient = async () => {
      try {
        // Try view first, then fallback to clientes table
        let clienteData: any = null;

        const { data: viewData } = await supabase
          .from("v_unified_clientes")
          .select("*")
          .eq("id", clienteId)
          .maybeSingle();

        if (viewData) {
          clienteData = viewData;
        } else {
          const { data: tableData } = await supabase
            .from("clientes")
            .select("*")
            .eq("id", clienteId)
            .maybeSingle();
          clienteData = tableData;
        }

        if (clienteData) {
          setCliente(clienteData);
          setForm((prev) => ({
            ...prev,
            nome_razao_social: clienteData.nome_completo || clienteData.nome || clienteData.nome_razao_social || "",
            cpf_cnpj: clienteData.cpf_cnpj || "",
            email: clienteData.email || "",
            telefone: clienteData.telefone || "",
            whatsapp: clienteData.whatsapp || "",
            cep: clienteData.cep || "",
            logradouro: clienteData.logradouro || "",
            numero: clienteData.numero || "",
            complemento: clienteData.complemento || "",
            bairro: clienteData.bairro || "",
            cidade: clienteData.cidade || "",
            estado: clienteData.estado || "",
            classe: clienteData.classe_tarifaria || clienteData.classe || "",
            subgrupo: clienteData.subgrupo_tarifario || clienteData.subgrupo || "",
            uc_instalacao: clienteData.instalacao || clienteData.uc || "",
            vencimento_dia: clienteData.vencimento_fatura || "",
            concessionaria: clienteData.concessionaria || "",
            geracao_propria: clienteData.geracao_propria || false,
            observacoes: clienteData.observacoes || "",
          }));
        }
      } catch (err) {
        console.error("Erro ao carregar cliente:", err);
      } finally {
        setLoading(false);
      }
    };
    loadClient();
  }, [clienteId, supabase]);

  // ─── Form helpers ───
  const set = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    []
  );

  const setConsumo = (mes: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      consumo_meses: { ...prev.consumo_meses, [mes]: value },
    }));
  };

  const setGeracao = (mes: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      geracao_meses: { ...prev.geracao_meses, [mes]: value },
    }));
  };

  // ─── ViaCEP auto-fill ───
  const buscarCEP = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;

    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          logradouro: data.logradouro || "",
          bairro: data.bairro || "",
          cidade: data.localidade || "",
          estado: data.uf || "",
        }));
      }
    } catch (err) {
      console.error("Erro ao buscar CEP:", err);
    } finally {
      setCepLoading(false);
    }
  };

  // ─── Navigation ───
  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // ─── Submit ───
  const handleEnviar = async () => {
    setSubmitting(true);
    setResult(null);

    try {
      // Step 1: Save/update client data directly in Supabase
      // NOTE: cpf_cnpj does NOT exist in the clientes table

      // Safe columns - only columns that DEFINITELY exist in the clientes table
      // NOTE: cpf_cnpj does NOT exist in clientes (it's in clientes_reciee)
      // We skip saving to clientes entirely if the table has minimal columns
      const safePayload: Record<string, any> = {};
      if (form.nome_razao_social.trim()) safePayload.nome_completo = form.nome_razao_social.trim();
      if (form.email.trim()) safePayload.email = form.email.trim();
      if (form.telefone.trim()) safePayload.telefone = form.telefone.trim();
      if (form.cidade.trim()) safePayload.cidade = form.cidade.trim();
      if (form.estado) safePayload.estado = form.estado;

      // Try saving - if it fails, skip saving entirely (AXS send is the priority)
      const { error: saveErr } = await supabase
        .from("clientes")
        .update(safePayload)
        .eq("id", clienteId);

      if (saveErr) {
        console.warn("Could not save to clientes table:", saveErr.message, "- continuing to AXS send");
      }

      // Step 2: Send to AXS
      const dadosProposta = {
        tipo_imovel: form.tipo_imovel,
        tipo_pessoa: form.tipo_pessoa,
        cpf_cnpj: form.cpf_cnpj.replace(/\D/g, ""),
        nome: form.nome_razao_social.trim(),
        data_nascimento: form.data_nascimento,
        email: form.email.trim(),
        telefone: form.telefone.trim(),
        whatsapp: form.whatsapp.trim(),
        cep: form.cep.replace(/\D/g, ""),
        logradouro: form.logradouro.trim(),
        numero: form.numero.trim(),
        complemento: form.complemento.trim(),
        bairro: form.bairro.trim(),
        cidade: form.cidade.trim(),
        estado: form.estado,
        classe: form.classe,
        subgrupo: form.subgrupo,
        uc_instalacao: form.uc_instalacao.trim(),
        vencimento_dia: form.vencimento_dia,
        concessionaria: form.concessionaria,
        consumo_meses: form.consumo_meses,
        geracao_propria: form.geracao_propria,
        geracao_meses: form.geracao_meses,
        observacoes: form.observacoes.trim(),
      };

      const axsRes = await fetch("/api/axs/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          dados_proposta: dadosProposta,
        }),
      });

      const axsData = await axsRes.json();

      if (!axsRes.ok) {
        throw new Error(axsData.error || "Erro ao enviar para AXS");
      }

      setResult({
        success: true,
        message: axsData.message || "Proposta enviada com sucesso!",
      });
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || "Erro inesperado ao enviar proposta",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Shared styles ───
  const inputCls =
    "h-9 text-sm bg-[#0f1d32] border-[#1c2e4a] text-white placeholder:text-white/30 focus:border-[#3B64CF] focus:ring-[#3B64CF]/30";
  const labelCls = "text-xs font-medium text-slate-400";
  const sectionCardCls = "border-[#1c2e4a] bg-[#14233c]";

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-9rem)]">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando dados do cliente...
        </div>
      </div>
    );
  }

  // ─── Success/Error result ───
  if (result) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className={sectionCardCls}>
          <CardContent className="py-12 px-8 text-center">
            {result.success ? (
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-green-400" />
            ) : (
              <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red-400" />
            )}
            <h2 className="text-xl font-bold text-white mb-2">
              {result.success ? "Proposta Enviada!" : "Erro ao Enviar"}
            </h2>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              {result.message}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                className="border-[#1c2e4a] text-slate-400 hover:text-white hover:bg-white/5"
                onClick={() => router.push(`/clientes/${clienteId}`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar ao Cliente
              </Button>
              {result.success && (
                <Button
                  className="bg-[#3B64CF] hover:bg-[#2d50a8] text-white"
                  onClick={() => router.push(`/clientes/${clienteId}/axs`)}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Ver AXS
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render step content ───
  const renderStep = () => {
    switch (currentStep) {
      case 0: return renderStepTipo();
      case 1: return renderStepContratante();
      case 2: return renderStepEndereco();
      case 3: return renderStepConsumo();
      case 4: return renderStepFatura();
      case 5: return renderStepHistorico();
      case 6: return renderStepObservacoes();
      case 7: return renderStepRevisao();
      default: return null;
    }
  };

  // ─── Step 1: Tipo ───
  const renderStepTipo = () => (
    <Card className={sectionCardCls}>
      <CardHeader className="pb-4 pt-5 px-6">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <Home className="h-4 w-4 text-[#3B64CF]" />
          Tipo de Imóvel
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-4">
        <p className="text-xs text-slate-400">
          Selecione o tipo de imóvel para esta proposta AXS
        </p>
        <div className="grid grid-cols-2 gap-3">
          {TIPO_IMOVEL_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = form.tipo_imovel === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set("tipo_imovel", opt.value as FormData["tipo_imovel"])}
                className={`p-4 rounded-lg border text-left transition-all ${
                  selected
                    ? "border-[#3B64CF] bg-[#3B64CF]/10"
                    : "border-[#1c2e4a] bg-[#0f1d32] hover:border-[#3B64CF]/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      selected
                        ? "bg-[#3B64CF]/20 text-[#3B64CF]"
                        : "bg-white/5 text-slate-500"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${selected ? "text-white" : "text-slate-300"}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-slate-500">{opt.desc}</p>
                  </div>
                </div>
                {selected && (
                  <div className="mt-2 ml-11">
                    <Check className="h-4 w-4 text-[#3B64CF]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <Separator className="bg-[#1c2e4a] my-4" />

        <div className="space-y-2">
          <Label className={labelCls}>Tipo de Pessoa</Label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => set("tipo_pessoa", "pf")}
              className={`flex-1 p-3 rounded-lg border text-sm transition-all ${
                form.tipo_pessoa === "pf"
                  ? "border-[#3B64CF] bg-[#3B64CF]/10 text-white"
                  : "border-[#1c2e4a] bg-[#0f1d32] text-slate-400 hover:border-[#3B64CF]/40"
              }`}
            >
              <User className="h-4 w-4 mx-auto mb-1" />
              Pessoa Física
            </button>
            <button
              type="button"
              onClick={() => set("tipo_pessoa", "pj")}
              className={`flex-1 p-3 rounded-lg border text-sm transition-all ${
                form.tipo_pessoa === "pj"
                  ? "border-[#3B64CF] bg-[#3B64CF]/10 text-white"
                  : "border-[#1c2e4a] bg-[#0f1d32] text-slate-400 hover:border-[#3B64CF]/40"
              }`}
            >
              <Building2 className="h-4 w-4 mx-auto mb-1" />
              Pessoa Jurídica
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Step 2: Dados do Contratante ───
  const renderStepContratante = () => (
    <Card className={sectionCardCls}>
      <CardHeader className="pb-4 pt-5 px-6">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <User className="h-4 w-4 text-[#3B64CF]" />
          Dados do Contratante
          <Badge className="text-[9px] bg-[#3B64CF]/20 text-[#3B64CF] ml-2">
            {form.tipo_pessoa === "pf" ? "PF" : "PJ"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {form.tipo_pessoa === "pf" ? (
            <>
              <div className="space-y-1.5">
                <Label className={labelCls}>CPF *</Label>
                <Input
                  value={form.cpf_cnpj}
                  onChange={(e) => set("cpf_cnpj", formatCPF(e.target.value))}
                  placeholder="000.000.000-00"
                  className={inputCls}
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className={labelCls}>Nome Completo *</Label>
                <Input
                  value={form.nome_razao_social}
                  onChange={(e) => set("nome_razao_social", e.target.value)}
                  placeholder="Nome completo do contratante"
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={labelCls}>Data de Nascimento</Label>
                <Input
                  value={form.data_nascimento}
                  onChange={(e) => set("data_nascimento", formatDate(e.target.value))}
                  placeholder="DD/MM/AAAA"
                  className={`${inputCls} [color-scheme:dark]`}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className={labelCls}>CNPJ *</Label>
                <Input
                  value={form.cpf_cnpj}
                  onChange={(e) => set("cpf_cnpj", formatCNPJ(e.target.value))}
                  placeholder="00.000.000/0000-00"
                  className={inputCls}
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className={labelCls}>Razão Social *</Label>
                <Input
                  value={form.nome_razao_social}
                  onChange={(e) => set("nome_razao_social", e.target.value)}
                  placeholder="Razão social da empresa"
                  className={inputCls}
                />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label className={labelCls}>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="email@exemplo.com"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Telefone</Label>
            <Input
              value={form.telefone}
              onChange={(e) => set("telefone", e.target.value)}
              placeholder="(00) 0000-0000"
              className={inputCls}
            />
          </div>
          {form.tipo_pessoa === "pf" && (
            <div className="space-y-1.5">
              <Label className={labelCls}>WhatsApp</Label>
              <Input
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value)}
                placeholder="(00) 99999-0000"
                className={inputCls}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  // ─── Step 3: Endereço ───
  const renderStepEndereco = () => (
    <Card className={sectionCardCls}>
      <CardHeader className="pb-4 pt-5 px-6">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <MapPin className="h-4 w-4 text-[#3B64CF]" />
          Endereço
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className={labelCls}>CEP</Label>
            <div className="relative">
              <Input
                value={form.cep}
                onChange={(e) => set("cep", formatCEP(e.target.value))}
                onBlur={() => buscarCEP(form.cep)}
                placeholder="00000-000"
                maxLength={9}
                className={`${inputCls} pr-9`}
              />
              <button
                type="button"
                onClick={() => buscarCEP(form.cep)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                disabled={cepLoading}
              >
                {cepLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className={labelCls}>Logradouro</Label>
            <Input
              value={form.logradouro}
              onChange={(e) => set("logradouro", e.target.value)}
              placeholder="Rua, Avenida, etc."
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Número</Label>
            <Input
              value={form.numero}
              onChange={(e) => set("numero", e.target.value)}
              placeholder="123"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Complemento</Label>
            <Input
              value={form.complemento}
              onChange={(e) => set("complemento", e.target.value)}
              placeholder="Sala, Andar, etc."
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Bairro</Label>
            <Input
              value={form.bairro}
              onChange={(e) => set("bairro", e.target.value)}
              placeholder="Centro"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Cidade</Label>
            <Input
              value={form.cidade}
              onChange={(e) => set("cidade", e.target.value)}
              placeholder="São Paulo"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Estado (UF)</Label>
            <Select value={form.estado} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger className={`${inputCls} text-white`}>
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1d32] border-[#1c2e4a] max-h-60 overflow-y-auto">
                {UF_OPTIONS.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Step 4: Informações de Consumo ───
  const renderStepConsumo = () => (
    <Card className={sectionCardCls}>
      <CardHeader className="pb-4 pt-5 px-6">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <Zap className="h-4 w-4 text-[#3B64CF]" />
          Informações de Consumo
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className={labelCls}>Classe Tarifária *</Label>
            <Select value={form.classe} onValueChange={(v) => set("classe", v)}>
              <SelectTrigger className={`${inputCls} text-white`}>
                <SelectValue placeholder="Selecione a classe..." />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1d32] border-[#1c2e4a]">
                {CLASSES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Subgrupo</Label>
            <Select value={form.subgrupo} onValueChange={(v) => set("subgrupo", v)}>
              <SelectTrigger className={`${inputCls} text-white`}>
                <SelectValue placeholder="Selecione o subgrupo..." />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1d32] border-[#1c2e4a] max-h-60 overflow-y-auto">
                {SUBGRUPOS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Step 5: Fatura ───
  const renderStepFatura = () => (
    <Card className={sectionCardCls}>
      <CardHeader className="pb-4 pt-5 px-6">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-[#3B64CF]" />
          Dados da Fatura
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className={labelCls}>UC (Instalação) *</Label>
            <Input
              value={form.uc_instalacao}
              onChange={(e) => set("uc_instalacao", e.target.value)}
              placeholder="Número da UC"
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Vencimento Dia</Label>
            <Select value={form.vencimento_dia} onValueChange={(v) => set("vencimento_dia", v)}>
              <SelectTrigger className={`${inputCls} text-white`}>
                <SelectValue placeholder="Dia..." />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1d32] border-[#1c2e4a] max-h-60 overflow-y-auto">
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <SelectItem key={d} value={String(d)}>Dia {d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Concessionária *</Label>
            <Select value={form.concessionaria} onValueChange={(v) => set("concessionaria", v)}>
              <SelectTrigger className={`${inputCls} text-white`}>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1d32] border-[#1c2e4a]">
                {CONCESSIONARIAS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Step 6: Histórico de Consumo ───
  const renderStepHistorico = () => (
    <Card className={sectionCardCls}>
      <CardHeader className="pb-4 pt-5 px-6">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#3B64CF]" />
          Histórico de Consumo
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6 space-y-4">
        <div>
          <Label className={`${labelCls} mb-2 block`}>Consumo Mensal (kWh)</Label>
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
            {MONTHS.map((m) => (
              <div key={m.key} className="space-y-1">
                <span className="text-[10px] text-slate-500 font-medium">{m.label}</span>
                <Input
                  type="number"
                  value={form.consumo_meses[m.key]}
                  onChange={(e) => setConsumo(m.key, e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className={`${inputCls} h-8 text-xs text-center`}
                />
              </div>
            ))}
          </div>
        </div>

        <Separator className="bg-[#1c2e4a] my-4" />

        <div className="flex items-center gap-3">
          <Switch
            id="geracao-propria"
            checked={form.geracao_propria}
            onCheckedChange={(checked) => set("geracao_propria", checked)}
          />
          <Label htmlFor="geracao-propria" className="text-sm text-slate-300 cursor-pointer">
            Possui geração própria (solar)
          </Label>
        </div>

        {form.geracao_propria && (
          <div>
            <Label className={`${labelCls} mb-2 block`}>Geração Própria (kWh)</Label>
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
              {MONTHS.map((m) => (
                <div key={m.key} className="space-y-1">
                  <span className="text-[10px] text-slate-500 font-medium">{m.label}</span>
                  <Input
                    type="number"
                    value={form.geracao_meses[m.key]}
                    onChange={(e) => setGeracao(m.key, e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className={`${inputCls} h-8 text-xs text-center`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ─── Step 7: Observações ───
  const renderStepObservacoes = () => (
    <Card className={sectionCardCls}>
      <CardHeader className="pb-4 pt-5 px-6">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#3B64CF]" />
          Observações
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="space-y-1.5">
          <Label className={labelCls}>Observações</Label>
          <Textarea
            value={form.observacoes}
            onChange={(e) => set("observacoes", e.target.value)}
            placeholder="Notas sobre a proposta, restrições, observações adicionais..."
            rows={6}
            className={`${inputCls} min-h-[150px] resize-y`}
          />
        </div>
      </CardContent>
    </Card>
  );

  // ─── Step 8: Revisão ───
  const renderStepRevisao = () => {
    const tipoImovelLabel = TIPO_IMOVEL_OPTIONS.find((t) => t.value === form.tipo_imovel)?.label || "—";
    const consumoTotal = Object.values(form.consumo_meses)
      .filter((v) => v !== "")
      .reduce((acc, v) => acc + (parseFloat(v) || 0), 0);

    return (
      <div className="space-y-4">
        <Card className={sectionCardCls}>
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Resumo da Proposta AXS
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            {/* Tipo */}
            <div className="p-3 rounded-lg bg-[#0f1d32] border border-[#1c2e4a]">
              <div className="flex items-center gap-2 mb-2">
                <Home className="h-3.5 w-3.5 text-[#3B64CF]" />
                <span className="text-[11px] font-semibold text-white uppercase">Tipo</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Imóvel:</span> <span className="text-white">{tipoImovelLabel}</span></div>
                <div><span className="text-slate-500">Pessoa:</span> <span className="text-white">{form.tipo_pessoa === "pf" ? "Física" : "Jurídica"}</span></div>
              </div>
            </div>

            {/* Contratante */}
            <div className="p-3 rounded-lg bg-[#0f1d32] border border-[#1c2e4a]">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-3.5 w-3.5 text-[#3B64CF]" />
                <span className="text-[11px] font-semibold text-white uppercase">Contratante</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Nome:</span> <span className="text-white">{form.nome_razao_social || "—"}</span></div>
                <div><span className="text-slate-500">{form.tipo_pessoa === "pf" ? "CPF" : "CNPJ"}:</span> <span className="text-white font-mono">{form.cpf_cnpj || "—"}</span></div>
                {form.data_nascimento && (
                  <div><span className="text-slate-500">Data Nasc.:</span> <span className="text-white">{form.data_nascimento}</span></div>
                )}
                <div><span className="text-slate-500">Email:</span> <span className="text-white">{form.email || "—"}</span></div>
                <div><span className="text-slate-500">Telefone:</span> <span className="text-white">{form.telefone || "—"}</span></div>
                {form.tipo_pessoa === "pf" && form.whatsapp && (
                  <div><span className="text-slate-500">WhatsApp:</span> <span className="text-white">{form.whatsapp}</span></div>
                )}
              </div>
            </div>

            {/* Endereço */}
            <div className="p-3 rounded-lg bg-[#0f1d32] border border-[#1c2e4a]">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-3.5 w-3.5 text-[#3B64CF]" />
                <span className="text-[11px] font-semibold text-white uppercase">Endereço</span>
              </div>
              <div className="text-xs text-white">
                {[
                  form.logradouro,
                  form.numero,
                  form.complemento,
                  form.bairro,
                  form.cidade,
                  form.estado,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
                {form.cep && <span className="text-slate-500 ml-2">CEP: {form.cep}</span>}
              </div>
            </div>

            {/* Consumo */}
            <div className="p-3 rounded-lg bg-[#0f1d32] border border-[#1c2e4a]">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-3.5 w-3.5 text-[#3B64CF]" />
                <span className="text-[11px] font-semibold text-white uppercase">Consumo & Fatura</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <div><span className="text-slate-500">Classe:</span> <span className="text-white">{form.classe || "—"}</span></div>
                <div><span className="text-slate-500">Subgrupo:</span> <span className="text-white">{form.subgrupo || "—"}</span></div>
                <div><span className="text-slate-500">UC:</span> <span className="text-white font-mono">{form.uc_instalacao || "—"}</span></div>
                <div><span className="text-slate-500">Vencimento:</span> <span className="text-white">{form.vencimento_dia ? `Dia ${form.vencimento_dia}` : "—"}</span></div>
                <div><span className="text-slate-500">Concessionária:</span> <span className="text-white">{form.concessionaria || "—"}</span></div>
                <div><span className="text-slate-500">Consumo Total:</span> <span className="text-white font-mono">{consumoTotal > 0 ? `${consumoTotal.toLocaleString("pt-BR")} kWh` : "—"}</span></div>
                <div><span className="text-slate-500">Geração Própria:</span> <span className="text-white">{form.geracao_propria ? "Sim" : "Não"}</span></div>
              </div>
            </div>

            {/* Observações */}
            {form.observacoes && (
              <div className="p-3 rounded-lg bg-[#0f1d32] border border-[#1c2e4a]">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-3.5 w-3.5 text-[#3B64CF]" />
                  <span className="text-[11px] font-semibold text-white uppercase">Observações</span>
                </div>
                <p className="text-xs text-slate-300 whitespace-pre-wrap">{form.observacoes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-400 hover:text-white hover:bg-white/5"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <Separator orientation="vertical" className="h-5 bg-[#1c2e4a]" />
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#3B64CF]" />
            Nova Proposta AXS
          </h1>
          {cliente && (
            <p className="text-xs text-slate-400">
              {cliente.nome_razao_social} · {cliente.cpf_cnpj}
            </p>
          )}
        </div>
      </div>

      {/* ─── Step Indicator ─── */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;
            return (
              <div key={idx} className="flex items-center flex-1 last:flex-initial">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isActive
                        ? "bg-[#3B64CF] text-white"
                        : isCompleted
                        ? "bg-green-500/20 text-green-400"
                        : "bg-white/5 text-slate-600"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span
                    className={`text-[10px] mt-1 whitespace-nowrap ${
                      isActive ? "text-[#3B64CF] font-medium" : "text-slate-600"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`h-px flex-1 mx-2 mt-[-14px] ${
                      idx < currentStep ? "bg-green-500/30" : "bg-[#1c2e4a]"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Step Content ─── */}
      <div className="mb-6">{renderStep()}</div>

      {/* ─── Navigation Buttons ─── */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 0 || submitting}
          className="border-[#1c2e4a] text-slate-400 hover:text-white hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Anterior
        </Button>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-600">
            Passo {currentStep + 1} de {STEPS.length}
          </span>

          {currentStep === STEPS.length - 1 ? (
            <Button
              onClick={handleEnviar}
              disabled={submitting}
              className="bg-[#3B64CF] hover:bg-[#2d50a8] text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando para AXS...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar para AXS
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={nextStep}
              disabled={submitting}
              className="bg-[#3B64CF] hover:bg-[#2d50a8] text-white"
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
