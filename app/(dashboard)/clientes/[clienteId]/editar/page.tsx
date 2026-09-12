"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User,
  MapPin,
  Zap,
  BarChart3,
  MessageSquare,
  Save,
  ArrowLeft,
  Loader2,
  Search,
  Trash2,
  Pencil,
} from "lucide-react";

// ─── Types ───

interface FormData {
  // Dados Pessoais
  nome_razao_social: string;
  tipo: "pf" | "pj";
  cpf_cnpj: string;
  rg_ie: string;
  data_nascimento: string;
  email: string;
  telefone: string;
  whatsapp: string;
  celular: string;

  // Endereço
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;

  // Dados de Energia
  concessionaria: string;
  classe_tarifaria: string;
  subgrupo: string;
  uc_instalacao: string;
  vencimento_fatura: string;
  bandeira: string;

  // Consumo Mensal
  consumo_meses: Record<string, string>;
  geracao_propria: boolean;
  geracao_meses: Record<string, string>;

  // Observações / Classificação
  observacoes: string;
  status: string;
  classificacao: string;
  origem: string;
}

const INITIAL_FORM: FormData = {
  nome_razao_social: "",
  tipo: "pj",
  cpf_cnpj: "",
  rg_ie: "",
  data_nascimento: "",
  email: "",
  telefone: "",
  whatsapp: "",
  celular: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  concessionaria: "",
  classe_tarifaria: "",
  subgrupo: "",
  uc_instalacao: "",
  vencimento_fatura: "",
  bandeira: "",
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
  status: "prospect",
  classificacao: "",
  origem: "cadastro",
};

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

const CONCESSIONARIAS = [
  "CEMIG",
  "COPEL",
  "CPFL PAULISTA",
  "ELEKTRO",
  "ENERGISA MT",
  "EQUATORIAL GO",
];

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

const BANDEIRAS = ["Verde", "Amarela", "Vermelha P1", "Vermelha P2"];

// ─── Validation helpers ───

function validateCPF(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(digits[10]);
}

function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * weights1[i];
  let rest = sum % 11;
  const d1 = rest < 2 ? 0 : 11 - rest;
  if (parseInt(digits[12]) !== d1) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(digits[i]) * weights2[i];
  rest = sum % 11;
  const d2 = rest < 2 ? 0 : 11 - rest;
  return parseInt(digits[13]) === d2;
}

// ─── Map DB row → FormData ───

function mapClienteToForm(cliente: Record<string, any>): FormData {
  return {
    nome_razao_social: cliente.nome_razao_social || "",
    tipo: cliente.tipo_cliente || "pj",
    cpf_cnpj: cliente.cpf_cnpj || "",
    rg_ie: cliente.rg_ie || "",
    data_nascimento: cliente.data_nascimento
      ? String(cliente.data_nascimento).slice(0, 10)
      : "",
    email: cliente.email || "",
    telefone: cliente.telefone || "",
    whatsapp: cliente.whatsapp || "",
    celular: cliente.celular || "",
    cep: cliente.cep || "",
    logradouro: cliente.logradouro || cliente.endereco || "",
    numero: cliente.numero || "",
    complemento: cliente.complemento || "",
    bairro: cliente.bairro || "",
    cidade: cliente.cidade || "",
    estado: cliente.estado || "",
    concessionaria: cliente.concessionaria || "",
    classe_tarifaria: cliente.classe_tarifaria || "",
    subgrupo: cliente.subgrupo_tarifario || "",
    uc_instalacao: cliente.instalacao || "",
    vencimento_fatura: cliente.vencimento_fatura
      ? String(cliente.vencimento_fatura)
      : "",
    bandeira: cliente.bandeira || "",
    consumo_meses: {
      jan: cliente.consumo_jan != null ? String(cliente.consumo_jan) : "",
      fev: cliente.consumo_fev != null ? String(cliente.consumo_fev) : "",
      mar: cliente.consumo_mar != null ? String(cliente.consumo_mar) : "",
      abr: cliente.consumo_abr != null ? String(cliente.consumo_abr) : "",
      mai: cliente.consumo_mai != null ? String(cliente.consumo_mai) : "",
      jun: cliente.consumo_jun != null ? String(cliente.consumo_jun) : "",
      jul: cliente.consumo_jul != null ? String(cliente.consumo_jul) : "",
      ago: cliente.consumo_ago != null ? String(cliente.consumo_ago) : "",
      set: cliente.consumo_set != null ? String(cliente.consumo_set) : "",
      out: cliente.consumo_out != null ? String(cliente.consumo_out) : "",
      nov: cliente.consumo_nov != null ? String(cliente.consumo_nov) : "",
      dez: cliente.consumo_dez != null ? String(cliente.consumo_dez) : "",
    },
    geracao_propria: Boolean(cliente.geracao_propria),
    geracao_meses: {
      jan: cliente.geracao_jan != null ? String(cliente.geracao_jan) : "",
      fev: cliente.geracao_fev != null ? String(cliente.geracao_fev) : "",
      mar: cliente.geracao_mar != null ? String(cliente.geracao_mar) : "",
      abr: cliente.geracao_abr != null ? String(cliente.geracao_abr) : "",
      mai: cliente.geracao_mai != null ? String(cliente.geracao_mai) : "",
      jun: cliente.geracao_jun != null ? String(cliente.geracao_jun) : "",
      jul: cliente.geracao_jul != null ? String(cliente.geracao_jul) : "",
      ago: cliente.geracao_ago != null ? String(cliente.geracao_ago) : "",
      set: cliente.geracao_set != null ? String(cliente.geracao_set) : "",
      out: cliente.geracao_out != null ? String(cliente.geracao_out) : "",
      nov: cliente.geracao_nov != null ? String(cliente.geracao_nov) : "",
      dez: cliente.geracao_dez != null ? String(cliente.geracao_dez) : "",
    },
    observacoes: cliente.observacoes || "",
    status: cliente.status || "prospect",
    classificacao: cliente.classificacao || "",
    origem: cliente.origem || "cadastro",
  };
}

// ─── Main Component ───

export default function EditarClientePage() {
  const router = useRouter();
  const params = useParams();
  const clienteId = params.clienteId as string;
  const supabase = createClient();

  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ─── Fetch client data ───
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!clienteId) return;

    const fetchCliente = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`/api/clientes/${clienteId}`, { headers });
        const result = await res.json();

        if (!res.ok) {
          setFetchError(result.error || "Erro ao carregar cliente.");
          return;
        }

        setForm(mapClienteToForm(result.cliente));
      } catch (err: any) {
        setFetchError(err.message || "Erro inesperado ao carregar cliente.");
      } finally {
        setFetching(false);
      }
    };

    fetchCliente();
  }, [clienteId, supabase]);

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

  // ─── Validation ───
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.nome_razao_social.trim()) {
      newErrors.nome_razao_social = "Nome/Razão Social é obrigatório";
    }

    if (form.cpf_cnpj.trim()) {
      const digits = form.cpf_cnpj.replace(/\D/g, "");
      if (form.tipo === "pf" && digits.length === 11) {
        if (!validateCPF(digits)) newErrors.cpf_cnpj = "CPF inválido";
      } else if (form.tipo === "pj" && digits.length === 14) {
        if (!validateCNPJ(digits)) newErrors.cpf_cnpj = "CNPJ inválido";
      } else if (digits.length !== 0) {
        newErrors.cpf_cnpj = "CPF deve ter 11 ou CNPJ 14 dígitos";
      }
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Email inválido";
    }

    if (form.cep) {
      const cepDigits = form.cep.replace(/\D/g, "");
      if (cepDigits.length !== 8) {
        newErrors.cep = "CEP deve ter 8 dígitos";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Submit ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setSubmitError("Sessão expirada. Faça login novamente.");
        setLoading(false);
        return;
      }

      // Build payload with all the fields
      const payload: Record<string, any> = {
        nome_razao_social: form.nome_razao_social.trim(),
        tipo: form.tipo,
        cpf_cnpj: form.cpf_cnpj.trim() || null,
        rg_ie: form.rg_ie.trim() || null,
        data_nascimento: form.data_nascimento || null,
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        celular: form.celular.trim() || null,
        cep: form.cep.trim() || null,
        logradouro: form.logradouro.trim() || null,
        numero: form.numero.trim() || null,
        complemento: form.complemento.trim() || null,
        bairro: form.bairro.trim() || null,
        cidade: form.cidade.trim() || null,
        estado: form.estado || null,
        concessionaria: form.concessionaria || null,
        classe_tarifaria: form.classe_tarifaria.trim() || null,
        subgrupo: form.subgrupo.trim() || null,
        uc_instalacao: form.uc_instalacao.trim() || null,
        vencimento_fatura: form.vencimento_fatura || null,
        bandeira: form.bandeira || null,
        geracao_propria: form.geracao_propria,
        observacoes: form.observacoes.trim() || null,
        status: form.status,
        classificacao: form.classificacao.trim() || null,
        origem: form.origem,
      };

      // Add consumption data
      const consumoValues = Object.entries(form.consumo_meses)
        .filter(([, v]) => v.trim() !== "")
        .map(([mes, valor]) => ({ mes, valor: parseFloat(valor) || 0 }));
      if (consumoValues.length > 0) {
        payload.consumo_mensal = consumoValues;
      }

      // Add generation data if enabled
      if (form.geracao_propria) {
        const geracaoValues = Object.entries(form.geracao_meses)
          .filter(([, v]) => v.trim() !== "")
          .map(([mes, valor]) => ({ mes, valor: parseFloat(valor) || 0 }));
        if (geracaoValues.length > 0) {
          payload.geracao_mensal = geracaoValues;
        }
      }

      const res = await fetch(`/api/clientes/${clienteId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (!res.ok) {
        setSubmitError(result.error || "Erro ao salvar cliente.");
        setLoading(false);
        return;
      }

      router.push(`/clientes/${clienteId}`);
    } catch (err: any) {
      setSubmitError(err.message || "Erro inesperado ao salvar.");
      setLoading(false);
    }
  };

  // ─── Delete ───
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        setSubmitError("Sessão expirada. Faça login novamente.");
        setDeleting(false);
        setDeleteDialogOpen(false);
        return;
      }

      const res = await fetch(`/api/clientes/${clienteId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await res.json();

      if (!res.ok) {
        setSubmitError(result.error || "Erro ao excluir cliente.");
        setDeleting(false);
        setDeleteDialogOpen(false);
        return;
      }

      router.push("/clientes");
    } catch (err: any) {
      setSubmitError(err.message || "Erro inesperado ao excluir.");
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  // ─── Shared input class ───
  const inputCls =
    "h-9 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#3B64CF] focus:ring-[#3B64CF]/30";
  const labelCls = "text-xs font-medium text-slate-400";

  // ─── Section wrapper ───
  const Section = ({
    icon,
    title,
    children,
  }: {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
  }) => (
    <Card className="border-[#1c2e4a] bg-[#14233c]">
      <CardHeader className="pb-4 pt-5 px-6">
        <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-6 pb-6">{children}</CardContent>
    </Card>
  );

  // ─── Loading state ───
  if (fetching) {
    return (
      <div className="max-w-5xl mx-auto pb-12">
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
          <h1 className="text-lg font-bold text-white">
            Editar Cliente
          </h1>
        </div>
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="h-8 w-8 text-[#3B64CF] animate-spin mb-4" />
          <p className="text-sm text-slate-400">Carregando dados do cliente...</p>
        </div>
      </div>
    );
  }

  // ─── Error loading state ───
  if (fetchError) {
    return (
      <div className="max-w-5xl mx-auto pb-12">
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
          <h1 className="text-lg font-bold text-white">
            Editar Cliente
          </h1>
        </div>
        <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
          {fetchError}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Header */}
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
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          <Pencil className="h-4 w-4 text-[#3B64CF]" />
          Editar Cliente
        </h1>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={loading || deleting}
          className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Excluir
        </Button>
      </div>

      {submitError && (
        <div className="mb-4 rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ═══════ Dados Pessoais ═══════ */}
        <Section
          icon={<User className="h-4 w-4 text-[#3B64CF]" />}
          title="Dados Pessoais"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Nome / Razão Social - spans 2 cols */}
            <div className="md:col-span-2 space-y-1.5">
              <Label className={labelCls}>
                Nome / Razão Social <span className="text-red-400">*</span>
              </Label>
              <Input
                value={form.nome_razao_social}
                onChange={(e) => set("nome_razao_social", e.target.value)}
                placeholder="Ex: Rede ABC Ltda"
                className={inputCls}
              />
              {errors.nome_razao_social && (
                <p className="text-[11px] text-red-400">{errors.nome_razao_social}</p>
              )}
            </div>

            {/* Tipo */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Tipo</Label>
              <Select
                value={form.tipo}
                onValueChange={(v) => set("tipo", v as "pf" | "pj")}
              >
                <SelectTrigger className={`${inputCls} text-white`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1d32] border-[#1c2e4a]">
                  <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                  <SelectItem value="pf">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* CPF/CNPJ */}
            <div className="space-y-1.5">
              <Label className={labelCls}>
                {form.tipo === "pf" ? "CPF" : "CNPJ"}
              </Label>
              <Input
                value={form.cpf_cnpj}
                onChange={(e) => set("cpf_cnpj", e.target.value)}
                placeholder={form.tipo === "pf" ? "000.000.000-00" : "00.000.000/0000-00"}
                className={inputCls}
              />
              {errors.cpf_cnpj && (
                <p className="text-[11px] text-red-400">{errors.cpf_cnpj}</p>
              )}
            </div>

            {/* RG/IE */}
            <div className="space-y-1.5">
              <Label className={labelCls}>
                {form.tipo === "pf" ? "RG" : "IE"}
              </Label>
              <Input
                value={form.rg_ie}
                onChange={(e) => set("rg_ie", e.target.value)}
                placeholder={form.tipo === "pf" ? "RG" : "Inscrição Estadual"}
                className={inputCls}
              />
            </div>

            {/* Data de Nascimento */}
            <div className="space-y-1.5">
              <Label className={labelCls}>
                {form.tipo === "pf" ? "Data de Nascimento" : "Data de Abertura"}
              </Label>
              <Input
                type="date"
                value={form.data_nascimento}
                onChange={(e) => set("data_nascimento", e.target.value)}
                className={`${inputCls} [color-scheme:dark]`}
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="email@empresa.com"
                className={inputCls}
              />
              {errors.email && (
                <p className="text-[11px] text-red-400">{errors.email}</p>
              )}
            </div>

            {/* Telefone */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={(e) => set("telefone", e.target.value)}
                placeholder="(11) 3000-0000"
                className={inputCls}
              />
            </div>

            {/* WhatsApp */}
            <div className="space-y-1.5">
              <Label className={labelCls}>WhatsApp</Label>
              <Input
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value)}
                placeholder="(11) 99999-9999"
                className={inputCls}
              />
            </div>

            {/* Celular */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Celular</Label>
              <Input
                value={form.celular}
                onChange={(e) => set("celular", e.target.value)}
                placeholder="(11) 98888-8888"
                className={inputCls}
              />
            </div>
          </div>
        </Section>

        {/* ═══════ Endereço ═══════ */}
        <Section
          icon={<MapPin className="h-4 w-4 text-[#3B64CF]" />}
          title="Endereço"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* CEP */}
            <div className="space-y-1.5">
              <Label className={labelCls}>CEP</Label>
              <div className="relative">
                <Input
                  value={form.cep}
                  onChange={(e) => set("cep", e.target.value)}
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
              {errors.cep && (
                <p className="text-[11px] text-red-400">{errors.cep}</p>
              )}
            </div>

            {/* Logradouro */}
            <div className="md:col-span-2 space-y-1.5">
              <Label className={labelCls}>Logradouro</Label>
              <Input
                value={form.logradouro}
                onChange={(e) => set("logradouro", e.target.value)}
                placeholder="Rua, Avenida, etc."
                className={inputCls}
              />
            </div>

            {/* Número */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Número</Label>
              <Input
                value={form.numero}
                onChange={(e) => set("numero", e.target.value)}
                placeholder="123"
                className={inputCls}
              />
            </div>

            {/* Complemento */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Complemento</Label>
              <Input
                value={form.complemento}
                onChange={(e) => set("complemento", e.target.value)}
                placeholder="Sala, Andar, etc."
                className={inputCls}
              />
            </div>

            {/* Bairro */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Bairro</Label>
              <Input
                value={form.bairro}
                onChange={(e) => set("bairro", e.target.value)}
                placeholder="Centro"
                className={inputCls}
              />
            </div>

            {/* Cidade */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Cidade</Label>
              <Input
                value={form.cidade}
                onChange={(e) => set("cidade", e.target.value)}
                placeholder="São Paulo"
                className={inputCls}
              />
            </div>

            {/* Estado */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Estado (UF)</Label>
              <Select
                value={form.estado}
                onValueChange={(v) => set("estado", v)}
              >
                <SelectTrigger className={`${inputCls} text-white`}>
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1d32] border-[#1c2e4a] max-h-60 overflow-y-auto">
                  {UF_OPTIONS.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        {/* ═══════ Dados de Energia ═══════ */}
        <Section
          icon={<Zap className="h-4 w-4 text-[#3B64CF]" />}
          title="Dados de Energia"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Concessionária */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Concessionária</Label>
              <Select
                value={form.concessionaria}
                onValueChange={(v) => set("concessionaria", v)}
              >
                <SelectTrigger className={`${inputCls} text-white`}>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1d32] border-[#1c2e4a]">
                  {CONCESSIONARIAS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Classe Tarifária */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Classe Tarifária</Label>
              <Input
                value={form.classe_tarifaria}
                onChange={(e) => set("classe_tarifaria", e.target.value)}
                placeholder="Ex: Residencial, Comercial"
                className={inputCls}
              />
            </div>

            {/* Subgrupo */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Subgrupo</Label>
              <Input
                value={form.subgrupo}
                onChange={(e) => set("subgrupo", e.target.value)}
                placeholder="Ex: B1, A3"
                className={inputCls}
              />
            </div>

            {/* UC (Instalação) */}
            <div className="space-y-1.5">
              <Label className={labelCls}>UC (Instalação)</Label>
              <Input
                value={form.uc_instalacao}
                onChange={(e) => set("uc_instalacao", e.target.value)}
                placeholder="Número da UC"
                className={inputCls}
              />
            </div>

            {/* Vencimento Fatura */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Vencimento Fatura</Label>
              <Select
                value={form.vencimento_fatura}
                onValueChange={(v) => set("vencimento_fatura", v)}
              >
                <SelectTrigger className={`${inputCls} text-white`}>
                  <SelectValue placeholder="Dia..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1d32] border-[#1c2e4a] max-h-60 overflow-y-auto">
                  {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      Dia {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Bandeira */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Bandeira</Label>
              <Select
                value={form.bandeira}
                onValueChange={(v) => set("bandeira", v)}
              >
                <SelectTrigger className={`${inputCls} text-white`}>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1d32] border-[#1c2e4a]">
                  {BANDEIRAS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        {/* ═══════ Consumo Mensal ═══════ */}
        <Section
          icon={<BarChart3 className="h-4 w-4 text-[#3B64CF]" />}
          title="Consumo Mensal"
        >
          {/* Consumo Grid */}
          <div className="mb-4">
            <Label className={`${labelCls} mb-2 block`}>Consumo (kWh)</Label>
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

          {/* Geração Própria Toggle */}
          <div className="flex items-center gap-3 mb-4">
            <Switch
              id="geracao-propria"
              checked={form.geracao_propria}
              onCheckedChange={(checked) => set("geracao_propria", checked)}
            />
            <Label
              htmlFor="geracao-propria"
              className="text-sm text-slate-300 cursor-pointer"
            >
              Possui geração própria (solar)
            </Label>
          </div>

          {/* Geração Própria Grid (conditional) */}
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
        </Section>

        {/* ═══════ Observações e Classificação ═══════ */}
        <Section
          icon={<MessageSquare className="h-4 w-4 text-[#3B64CF]" />}
          title="Observações e Classificação"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Observações - spans full width */}
            <div className="md:col-span-3 space-y-1.5">
              <Label className={labelCls}>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => set("observacoes", e.target.value)}
                placeholder="Notas sobre o cliente, histórico, preferências..."
                rows={4}
                className={`${inputCls} min-h-[100px] resize-y`}
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v)}
              >
                <SelectTrigger className={`${inputCls} text-white`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1d32] border-[#1c2e4a]">
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="churn">Churn</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Classificação */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Classificação</Label>
              <Input
                value={form.classificacao}
                onChange={(e) => set("classificacao", e.target.value)}
                placeholder="Ex: VIP, Premium, Standard"
                className={inputCls}
              />
            </div>

            {/* Origem */}
            <div className="space-y-1.5">
              <Label className={labelCls}>Origem</Label>
              <Select
                value={form.origem}
                onValueChange={(v) => set("origem", v)}
              >
                <SelectTrigger className={`${inputCls} text-white`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1d32] border-[#1c2e4a]">
                  <SelectItem value="cadastro">Cadastro</SelectItem>
                  <SelectItem value="reciee">RECIEE</SelectItem>
                  <SelectItem value="chatbot">Chatbot</SelectItem>
                  <SelectItem value="disparo">Disparo</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="atendimento">Atendimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        {/* ═══════ Action Buttons ═══════ */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
            className="border-[#1c2e4a] text-slate-400 hover:text-white hover:bg-white/5"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-[#3B64CF] hover:bg-[#2d50a8] text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      </form>

      {/* ═══════ Delete Confirmation Dialog ═══════ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-[#14233c] border-[#1c2e4a] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Excluir Cliente</DialogTitle>
            <DialogDescription className="text-slate-400">
              Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
              className="border-[#1c2e4a] text-slate-400 hover:text-white hover:bg-white/5"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
