"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Pencil, Phone, Mail, Calendar, FileText, Plus, ChevronDown, ChevronRight,
  Check, X, Zap, Receipt, UserPlus, Loader2, AlertCircle, Save, Link2,
  User, FileSpreadsheet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ETIQUETAS_DISPONIVEIS } from "@/lib/etiquetas";

// ─── Types ───

interface Atendimento {
  id: string;
  telefone_cliente: string;
  nome_cliente: string;
  status: string;
  created_at?: string;
  cliente_id?: string | null;
  clientes?: {
    id: string;
    nome_razao_social: string;
    telefone?: string;
    celular?: string;
    email?: string;
    cpf?: string;
    cnpj_cpf?: string;
    instalacao?: string;
    concessionaria?: string;
    classe_tarifaria?: string;
    subgrupo_tarifario?: string;
    bandeira?: string;
    estado?: string;
    cidade?: string;
    endereco?: string;
    bairro?: string;
    cep?: string;
    whatsapp?: string;
    razao_social?: string;
    nome_fantasia?: string;
  } | null;
}

interface PainelContatoProps {
  atendimento: Atendimento | null;
  onFechar: () => void;
  onMarcarConcluido?: (id: string) => void;
  onEtiquetaChange?: () => void;
  onClienteCriado?: () => void;
}

type AbaAtiva = "dados" | "propostas";
type TipoProposta = "gd" | "reciee" | null;

// ─── Options ───

const CONCESSIONARIAS = [
  "CEMIG", "COPEL", "CPFL PAULISTA", "ELEKTRO", "ENERGISA MT",
  "EQUATORIAL GO", "CELESC", "ENEL", "CPFL SANTA CRUZ"
];

const CLASSES_TARIFARIAS = ["Residencial", "Comercial", "Industrial", "Rural", "Poder Público"];

const SUBGRUPOS = ["B1", "B2", "B3", "A1", "A2", "A3", "A3a", "A4", "AS"];

const BANDEIRAS = ["Verde", "Amarela", "Vermelha P1", "Vermelha P2"];

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const DISTRIBUIDORAS = ["CEMIG", "EQUATORIAL GO", "ENERGISA GO", "COPEL", "CPFL PAULISTA", "ELEKTRO"];

const SUBGRUPOS_RECIEE = ["A1", "A2", "A3", "A3a", "A4", "AS", "B1", "B2", "B3"];

const MODALIDADES = ["Convencional", "Horária Azul", "Horária Verde", "Branca", "Monômia"];

const CLASSES_RECIEE = ["Residencial", "Comercial", "Industrial", "Rural", "Poder Público", "Iluminação Pública"];

const TENSOES = ["Baixa", "Média", "Alta"];

const REGIMES_TRIBUTARIOS = ["Simples Nacional", "Lucro Presumido", "Lucro Real", "Isento", "Não Contribuinte"];

const GRUPOS = ["A", "B"];

// ─── Section Component ───

interface SecaoProps {
  titulo: string;
  children: React.ReactNode;
  badge?: number;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
}

function Secao({ titulo, children, badge, defaultOpen = false, icon }: SecaoProps) {
  const [aberta, setAberta] = useState(defaultOpen);

  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5 transition-colors"
        onClick={() => setAberta(!aberta)}
      >
        <span className="flex items-center gap-2">
          {icon}
          {titulo}
        </span>
        <div className="flex items-center gap-2">
          {badge !== undefined && badge > 0 && (
            <span className="text-xs bg-[#3B64CF] text-white px-1.5 py-0.5 rounded-full">{badge}</span>
          )}
          {aberta ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          )}
        </div>
      </button>
      {aberta && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

// ─── Main Component ───

export function PainelContato({ atendimento, onFechar, onMarcarConcluido, onEtiquetaChange, onClienteCriado }: PainelContatoProps) {
  // ─── State ───
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>("dados");
  const [etiquetasBusca, setEtiquetasBusca] = useState("");
  const [etiquetasVinculadas, setEtiquetasVinculadas] = useState<string[]>([]);
  const [loadingEtiquetas, setLoadingEtiquetas] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [tipoProposta, setTipoProposta] = useState<TipoProposta>(null);
  const [mostrarFormCliente, setMostrarFormCliente] = useState(false);
  const [mostrarFormEnriquecer, setMostrarFormEnriquecer] = useState(false);
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);
  const [verificandoDuplicata, setVerificandoDuplicata] = useState(false);
  const [verificandoTelefone, setVerificandoTelefone] = useState(false);
  const [clienteIdLocal, setClienteIdLocal] = useState<string | null>(null);

  // ─── Form Cliente (cadastro básico) ───
  const [formCliente, setFormCliente] = useState({
    nome_razao_social: "",
    telefone: "",
    celular: "",
    email: "",
    cnpj_cpf: "",
    cidade: "",
    estado: "",
  });

  // ─── Form Enriquecer (dados completos) ───
  const [formEnriquecer, setFormEnriquecer] = useState({
    nome_razao_social: "",
    razao_social: "",
    nome_fantasia: "",
    telefone: "",
    celular: "",
    whatsapp: "",
    email: "",
    cnpj_cpf: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    data_nascimento: "",
    observacoes: "",
  });

  // ─── Proposta GD State ───
  const [gdForm, setGdForm] = useState({
    concessionaria: "",
    instalacao: "",
    classe_tarifaria: "",
    subgrupo_tarifario: "",
    bandeira: "",
    consumo_mensal: "",
  });

  // ─── Proposta RECIEE State ───
  const [recieeForm, setRecieeForm] = useState({
    uc: "",
    estado: "GO",
    distribuidora: "CEMIG",
    subgrupo: "B3",
    modalidade: "Convencional",
    classe: "Comercial",
    tensao: "Baixa",
    regime_tributario: "Simples Nacional",
    grupo: "B",
  });

  const supabase = createClient();

  // ─── Effects ───

  const fetchEtiquetas = useCallback(async () => {
    if (!atendimento) return;
    setLoadingEtiquetas(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/atendimentos/etiquetas?atendimento_id=${atendimento.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setEtiquetasVinculadas(data.etiquetas?.map((e: any) => e.etiqueta) || []);
      }
    } catch (err) {
      console.error("Erro ao buscar etiquetas:", err);
    } finally {
      setLoadingEtiquetas(false);
    }
  }, [atendimento, supabase]);

  // Verificar se telefone já existe e vincular automaticamente
  const verificarEVDincular = useCallback(async (telefone: string, atendimentoId: string) => {
    if (!telefone) return;
    setVerificandoTelefone(true);
    try {
      const res = await fetch("/api/clientes/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "telefone", value: telefone }),
      });
      const data = await res.json();
      if (data.exists && data.cliente && data.source === "clientes") {
        // Vincula automaticamente ao cliente existente
        const { error } = await supabase
          .from("atendimentos")
          .update({ cliente_id: data.cliente.id })
          .eq("id", atendimentoId);
        
        if (!error) {
          // Atualiza estado local imediatamente
          setClienteIdLocal(data.cliente.id);
          // Chama callback para atualizar os dados
          onClienteCriado?.();
        }
      }
    } catch (err) {
      console.error("Erro ao verificar e vincular:", err);
    } finally {
      setVerificandoTelefone(false);
    }
  }, [supabase, onClienteCriado]);

  useEffect(() => {
    if (atendimento) {
      fetchEtiquetas();
      setEtiquetasBusca("");
      setTipoProposta(null);
      setMostrarFormCliente(false);
      setMostrarFormEnriquecer(false);
      setMensagemErro(null);
      setMensagemSucesso(null);
      setAbaAtiva("dados");
      setClienteIdLocal(atendimento.cliente_id || null);

      // Verificar se telefone já existe e vincular automaticamente (só se NÃO tem cliente vinculado)
      if (!atendimento.cliente_id) {
        const tel = atendimento.clientes?.telefone || atendimento.clientes?.celular || atendimento.telefone_cliente;
        if (tel) {
          verificarEVDincular(tel, atendimento.id);
        }
      }

      // Pré-preencher com dados do atendimento
      const dadosBasicos = {
        nome_razao_social: atendimento.clientes?.nome_razao_social || atendimento.nome_cliente || "",
        telefone: atendimento.clientes?.telefone || atendimento.clientes?.celular || atendimento.telefone_cliente || "",
        celular: atendimento.clientes?.celular || "",
        email: atendimento.clientes?.email || "",
        cnpj_cpf: atendimento.clientes?.cnpj_cpf || "",
        cidade: atendimento.clientes?.cidade || "",
        estado: atendimento.clientes?.estado || "",
      };
      setFormCliente(dadosBasicos);

      // Pré-preencher form enriquecer se tem cliente
      if (atendimento.clientes) {
        const c = atendimento.clientes;
        setFormEnriquecer({
          nome_razao_social: c.nome_razao_social || "",
          razao_social: c.razao_social || "",
          nome_fantasia: c.nome_fantasia || "",
          telefone: c.telefone || "",
          celular: c.celular || "",
          whatsapp: c.whatsapp || "",
          email: c.email || "",
          cnpj_cpf: c.cnpj_cpf || "",
          endereco: c.endereco || "",
          numero: (c as any).numero || "",
          complemento: (c as any).complemento || "",
          bairro: (c as any).bairro || "",
          cidade: c.cidade || "",
          estado: c.estado || "",
          cep: (c as any).cep || "",
          data_nascimento: (c as any).data_nascimento || "",
          observacoes: (c as any).observacoes || "",
        });

        setGdForm({
          concessionaria: c.concessionaria || "",
          instalacao: c.instalacao || "",
          classe_tarifaria: c.classe_tarifaria || "",
          subgrupo_tarifario: c.subgrupo_tarifario || "",
          bandeira: c.bandeira || "",
          consumo_mensal: "",
        });
        setRecieeForm((prev) => ({
          ...prev,
          uc: c.instalacao || "",
          estado: c.estado || "GO",
        }));
      }
    } else {
      setEtiquetasVinculadas([]);
    }
  }, [atendimento, fetchEtiquetas, verificarEVDincular]);

  // ─── Handlers ───

  const vincularEtiqueta = async (etiqueta: string) => {
    if (!atendimento) return;
    setSalvando(etiqueta);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/atendimentos/etiquetas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ atendimento_id: atendimento.id, etiqueta }),
      });

      if (res.ok) {
        setEtiquetasVinculadas((prev) => [...prev, etiqueta]);
        onEtiquetaChange?.();
      }
    } catch (err) {
      console.error("Erro ao vincular etiqueta:", err);
    } finally {
      setSalvando(null);
    }
  };

  const removerEtiqueta = async (etiqueta: string) => {
    if (!atendimento) return;
    setSalvando(etiqueta);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/atendimentos/etiquetas?atendimento_id=${atendimento.id}&etiqueta=${encodeURIComponent(etiqueta)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setEtiquetasVinculadas((prev) => prev.filter((e) => e !== etiqueta));
        onEtiquetaChange?.();
      }
    } catch (err) {
      console.error("Erro ao remover etiqueta:", err);
    } finally {
      setSalvando(null);
    }
  };

  const verificarDuplicata = async (field: string, value: string): Promise<boolean> => {
    if (!value || value.length < 3) return false;
    setVerificandoDuplicata(true);
    try {
      const res = await fetch("/api/clientes/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
      const data = await res.json();
      if (data.exists) {
        setMensagemErro(`Já existe cliente com este ${field === "uc" ? "UC" : "CPF/CNPJ"}: ${data.cliente?.nome_razao_social || data.cliente?.nome || "Cliente encontrado"}`);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Erro ao verificar duplicata:", err);
      return false;
    } finally {
      setVerificandoDuplicata(false);
    }
  };

  // Criar CLIENTE (cadastro básico)
  const criarCliente = async () => {
    if (!atendimento) return;
    setSalvandoCliente(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      if (formCliente.cnpj_cpf) {
        const duplicado = await verificarDuplicata("cpf_cnpj", formCliente.cnpj_cpf);
        if (duplicado) return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...formCliente,
          telefone: formCliente.telefone || atendimento.telefone_cliente,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setMensagemErro(data.error);
        return;
      }

      await supabase
        .from("atendimentos")
        .update({ cliente_id: data.cliente.id })
        .eq("id", atendimento.id);

      setMensagemSucesso("Cliente criado com sucesso!");
      setMostrarFormCliente(false);
      onClienteCriado?.();
    } catch (err: any) {
      setMensagemErro(err.message || "Erro ao criar cliente");
    } finally {
      setSalvandoCliente(false);
    }
  };

  // Enriquecer cadastro do cliente
  const enriquecerCliente = async () => {
    const cid = clienteIdLocal || atendimento?.cliente_id;
    if (!cid) return;
    setSalvandoCliente(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/clientes/${cid}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formEnriquecer),
      });

      const data = await res.json();
      if (data.error) {
        setMensagemErro(data.error);
        return;
      }

      setMensagemSucesso("Cadastro enriquecido com sucesso!");
      setMostrarFormEnriquecer(false);
      onClienteCriado?.();
    } catch (err: any) {
      setMensagemErro(err.message || "Erro ao enriquecer cadastro");
    } finally {
      setSalvandoCliente(false);
    }
  };

  // Criar Proposta GD
  const criarPropostaGD = async () => {
    const cid = clienteIdLocal || atendimento?.cliente_id;
    if (!cid) {
      setMensagemErro("Vincule um cliente primeiro antes de criar uma proposta GD");
      return;
    }
    setSalvandoCliente(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      if (gdForm.instalacao) {
        const duplicada = await verificarDuplicata("uc", gdForm.instalacao);
        if (duplicada) return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/clientes/${cid}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          concessionaria: gdForm.concessionaria,
          instalacao: gdForm.instalacao,
          classe_tarifaria: gdForm.classe_tarifaria,
          subgrupo_tarifario: gdForm.subgrupo_tarifario,
          bandeira: gdForm.bandeira,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setMensagemErro(data.error);
        return;
      }

      setMensagemSucesso("Proposta GD salva com sucesso!");
      onClienteCriado?.();
    } catch (err: any) {
      setMensagemErro(err.message || "Erro ao salvar proposta GD");
    } finally {
      setSalvandoCliente(false);
    }
  };

  // Criar Proposta RECIEE
  const criarPropostaRECIEE = async () => {
    const cid = clienteIdLocal || atendimento?.cliente_id;
    if (!cid) {
      setMensagemErro("Vincule um cliente primeiro antes de criar uma proposta RECIEE");
      return;
    }
    setSalvandoCliente(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      if (recieeForm.uc) {
        const duplicada = await verificarDuplicata("uc", recieeForm.uc);
        if (duplicada) return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Busca dados do cliente do banco (funciona tanto com vínculo direto quanto automático)
      const { data: cliente } = await supabase
        .from("clientes")
        .select("nome_razao_social, cnpj_cpf")
        .eq("id", cid)
        .single();
      
      if (!cliente) {
        setMensagemErro("Dados do cliente não encontrados");
        return;
      }

      const res = await fetch("/api/reciee/clientes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nome: cliente.nome_razao_social,
          cpf_cnpj: cliente.cnpj_cpf,
          ...recieeForm,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setMensagemErro(data.error);
        return;
      }

      setMensagemSucesso("Proposta RECIEE criada com sucesso!");
      onClienteCriado?.();
    } catch (err: any) {
      setMensagemErro(err.message || "Erro ao criar proposta RECIEE");
    } finally {
      setSalvandoCliente(false);
    }
  };

  // ─── Render ───

  if (!atendimento) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-white/30 gap-3 bg-[#0f1d32] border-l border-white/10">
        <FileText className="h-12 w-12 opacity-20" />
        <p className="text-xs text-center px-4">Selecione uma conversa para ver as informações</p>
      </div>
    );
  }

  const nome = atendimento?.clientes?.nome_razao_social || atendimento?.nome_cliente || "Cliente";
  const telefone = atendimento?.clientes?.telefone || atendimento?.clientes?.celular || atendimento?.telefone_cliente || "";
  const email = (atendimento?.clientes as any)?.email || "";
  const cpf = (atendimento?.clientes as any)?.cnpj_cpf || "";
  const iniciais = nome.substring(0, 2).toUpperCase();
  const statusAberto = atendimento.status === "aberto";
  const temCliente = !!(clienteIdLocal || atendimento?.cliente_id);

  const etiquetasFiltradas = ETIQUETAS_DISPONIVEIS.filter(
    (e) =>
      e.toLowerCase().includes(etiquetasBusca.toLowerCase()) &&
      !etiquetasVinculadas.includes(e)
  );

  return (
    <div className="h-full flex flex-col bg-[#0f1d32] border-l border-white/10 overflow-y-auto">
      {/* Header: Nome + editar */}
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-bold text-white truncate">{nome}</h3>
          {temCliente && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0 text-white/40 hover:text-white"
              onClick={() => window.open(`/clientes/${clienteIdLocal || atendimento?.cliente_id}`, "_blank")}
              title="Ver perfil completo"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <p className="text-xs text-white/40">{telefone}</p>
      </div>

      {/* Avatar grande */}
      <div className="flex justify-center py-3">
        <div className="h-[72px] w-[72px] rounded-full bg-[#3B64CF]/20 flex items-center justify-center text-2xl font-bold text-[#3B64CF]">
          {iniciais}
        </div>
      </div>

      {/* Status + Marcar como Concluído */}
      <div className="px-4 pb-3 flex items-center gap-3">
        <span className="text-sm text-white/60">
          Atendimento está{" "}
          <span className={cn("font-semibold", statusAberto ? "text-emerald-400" : "text-white/40")}>
            {statusAberto ? "Aberto" : "Concluído"}
          </span>
        </span>
        {statusAberto && onMarcarConcluido && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-green-700 hover:bg-green-50 hover:text-green-800 px-2"
            onClick={() => onMarcarConcluido(atendimento.id)}
          >
            <Check className="h-3.5 w-3.5" />
            Concluir
          </Button>
        )}
      </div>

      {/* Dados do contato */}
      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-3 text-sm">
          <Phone className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-slate-700">{telefone}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Mail className="h-4 w-4 text-slate-400 shrink-0" />
          <span className={cn(email ? "text-slate-700" : "text-slate-400")}>
            {email || "E-mail"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
          <span className="text-slate-700">
            {atendimento.created_at
              ? new Date(atendimento.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Data de inscrição"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <FileText className="h-4 w-4 text-slate-400 shrink-0" />
          <span className={cn(cpf ? "text-slate-700" : "text-slate-400")}>
            {cpf || "CPF/CNPJ"}
          </span>
        </div>
      </div>

      {/* Botões de ação do cliente */}
      <div className="px-4 pb-3">
        {temCliente ? (
          // Já tem cliente vinculado → Mostrar "Enriquecer com detalhes"
          <Button
            className={cn(
              "w-full gap-2",
              mostrarFormEnriquecer
                ? "bg-slate-600 hover:bg-slate-500 text-white"
                : "bg-[#3B64CF] hover:bg-[#2D4FA3] text-white"
            )}
            onClick={() => setMostrarFormEnriquecer(!mostrarFormEnriquecer)}
          >
            <Pencil className="h-4 w-4" />
            {mostrarFormEnriquecer ? "Fechar" : "Enriquecer com detalhes"}
          </Button>
        ) : (
          // Não existe cliente → "Criar Cliente"
          <Button
            className="w-full bg-[#3B64CF] hover:bg-[#2D4FA3] text-white gap-2"
            onClick={() => setMostrarFormCliente(true)}
          >
            <UserPlus className="h-4 w-4" />
            Criar Cliente
          </Button>
        )}
      </div>

      {/* Formulário de criação de cliente */}
      {mostrarFormCliente && (
        <div className="px-4 pb-3 border-t border-white/10 pt-3">
          <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Novo Cliente
          </h4>
          <div className="space-y-2">
            <Input
              placeholder="Nome / Razão Social *"
              value={formCliente.nome_razao_social}
              onChange={(e) => setFormCliente({ ...formCliente, nome_razao_social: e.target.value })}
              className="h-10 text-sm"
            />
            <Input
              placeholder="CPF/CNPJ"
              value={formCliente.cnpj_cpf}
              onChange={(e) => setFormCliente({ ...formCliente, cnpj_cpf: e.target.value })}
              className="h-10 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Telefone"
                value={formCliente.telefone}
                onChange={(e) => setFormCliente({ ...formCliente, telefone: e.target.value })}
                className="h-10 text-sm"
              />
              <Input
                placeholder="Celular"
                value={formCliente.celular}
                onChange={(e) => setFormCliente({ ...formCliente, celular: e.target.value })}
                className="h-10 text-sm"
              />
            </div>
            <Input
              placeholder="E-mail"
              value={formCliente.email}
              onChange={(e) => setFormCliente({ ...formCliente, email: e.target.value })}
              className="h-10 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Cidade"
                value={formCliente.cidade}
                onChange={(e) => setFormCliente({ ...formCliente, cidade: e.target.value })}
                className="h-10 text-sm"
              />
              <select
                value={formCliente.estado}
                onChange={(e) => setFormCliente({ ...formCliente, estado: e.target.value })}
                className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
              >
                <option value="">UF</option>
                {ESTADOS.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-[#3B64CF] hover:bg-[#2D4FA3] text-white gap-2"
                onClick={criarCliente}
                disabled={salvandoCliente || verificandoDuplicata || !formCliente.nome_razao_social}
              >
                {salvandoCliente ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {salvandoCliente ? "Salvando..." : "Salvar"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setMostrarFormCliente(false)}
                disabled={salvandoCliente}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Formulário enriquecer cadastro */}
      {mostrarFormEnriquecer && (
        <div className="px-4 pb-3 border-t border-white/10 pt-3">
          <h4 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Enriquecer Cadastro
          </h4>
          <div className="space-y-2">
            <Input
              placeholder="Nome / Razão Social"
              value={formEnriquecer.nome_razao_social}
              onChange={(e) => setFormEnriquecer({ ...formEnriquecer, nome_razao_social: e.target.value })}
              className="h-10 text-sm"
            />
            <Input
              placeholder="Razão Social"
              value={formEnriquecer.razao_social}
              onChange={(e) => setFormEnriquecer({ ...formEnriquecer, razao_social: e.target.value })}
              className="h-10 text-sm"
            />
            <Input
              placeholder="Nome Fantasia"
              value={formEnriquecer.nome_fantasia}
              onChange={(e) => setFormEnriquecer({ ...formEnriquecer, nome_fantasia: e.target.value })}
              className="h-10 text-sm"
            />
            <Input
              placeholder="CPF/CNPJ"
              value={formEnriquecer.cnpj_cpf}
              onChange={(e) => setFormEnriquecer({ ...formEnriquecer, cnpj_cpf: e.target.value })}
              className="h-10 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Telefone"
                value={formEnriquecer.telefone}
                onChange={(e) => setFormEnriquecer({ ...formEnriquecer, telefone: e.target.value })}
                className="h-10 text-sm"
              />
              <Input
                placeholder="Celular"
                value={formEnriquecer.celular}
                onChange={(e) => setFormEnriquecer({ ...formEnriquecer, celular: e.target.value })}
                className="h-10 text-sm"
              />
            </div>
            <Input
              placeholder="WhatsApp"
              value={formEnriquecer.whatsapp}
              onChange={(e) => setFormEnriquecer({ ...formEnriquecer, whatsapp: e.target.value })}
              className="h-10 text-sm"
            />
            <Input
              placeholder="E-mail"
              value={formEnriquecer.email}
              onChange={(e) => setFormEnriquecer({ ...formEnriquecer, email: e.target.value })}
              className="h-10 text-sm"
            />
            <Input
              placeholder="Endereço"
              value={formEnriquecer.endereco}
              onChange={(e) => setFormEnriquecer({ ...formEnriquecer, endereco: e.target.value })}
              className="h-10 text-sm"
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Nº"
                value={formEnriquecer.numero}
                onChange={(e) => setFormEnriquecer({ ...formEnriquecer, numero: e.target.value })}
                className="h-10 text-sm"
              />
              <Input
                placeholder="Compl."
                value={formEnriquecer.complemento}
                onChange={(e) => setFormEnriquecer({ ...formEnriquecer, complemento: e.target.value })}
                className="h-10 text-sm"
              />
              <Input
                placeholder="CEP"
                value={formEnriquecer.cep}
                onChange={(e) => setFormEnriquecer({ ...formEnriquecer, cep: e.target.value })}
                className="h-10 text-sm"
              />
            </div>
            <Input
              placeholder="Bairro"
              value={formEnriquecer.bairro}
              onChange={(e) => setFormEnriquecer({ ...formEnriquecer, bairro: e.target.value })}
              className="h-10 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Cidade"
                value={formEnriquecer.cidade}
                onChange={(e) => setFormEnriquecer({ ...formEnriquecer, cidade: e.target.value })}
                className="h-10 text-sm"
              />
              <select
                value={formEnriquecer.estado}
                onChange={(e) => setFormEnriquecer({ ...formEnriquecer, estado: e.target.value })}
                className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
              >
                <option value="">UF</option>
                {ESTADOS.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <Input
              placeholder="Data de Nascimento"
              type="date"
              value={formEnriquecer.data_nascimento}
              onChange={(e) => setFormEnriquecer({ ...formEnriquecer, data_nascimento: e.target.value })}
              className="h-10 text-sm"
            />
            <textarea
              placeholder="Observações"
              value={formEnriquecer.observacoes}
              onChange={(e) => setFormEnriquecer({ ...formEnriquecer, observacoes: e.target.value })}
              className="h-20 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2 py-1.5 w-full resize-none"
            />
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 bg-[#3B64CF] hover:bg-[#2D4FA3] text-white gap-2"
                onClick={enriquecerCliente}
                disabled={salvandoCliente}
              >
                {salvandoCliente ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {salvandoCliente ? "Salvando..." : "Salvar"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setMostrarFormEnriquecer(false)}
                disabled={salvandoCliente}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ABAS: Dados | Propostas (só quando tem cliente) */}
      {temCliente && (
        <div className="border-t border-white/10">
          {/* Tabs */}
          <div className="flex">
            <button
              className={cn(
                "flex-1 py-2.5 text-xs font-medium transition-colors",
                abaAtiva === "dados"
                  ? "text-[#3B64CF] border-b-2 border-[#3B64CF]"
                  : "text-white/50 hover:text-white/70"
              )}
              onClick={() => setAbaAtiva("dados")}
            >
              <User className="h-3.5 w-3.5 inline mr-1" />
              Dados
            </button>
            <button
              className={cn(
                "flex-1 py-2.5 text-xs font-medium transition-colors",
                abaAtiva === "propostas"
                  ? "text-[#3B64CF] border-b-2 border-[#3B64CF]"
                  : "text-white/50 hover:text-white/70"
              )}
              onClick={() => setAbaAtiva("propostas")}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 inline mr-1" />
              Propostas
            </button>
          </div>

          {/* Aba Dados */}
          {abaAtiva === "dados" && (
            <div className="px-4 py-3 text-xs text-white/50">
              Informações do cliente vinculado.
            </div>
          )}

          {/* Aba Propostas */}
          {abaAtiva === "propostas" && (
            <div>
              <div className="px-4 py-3">
                <p className="text-xs text-white/50 mb-2">
                  Selecione o tipo de proposta:
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={tipoProposta === "gd" ? "default" : "outline"}
                    className={cn(
                      "flex-1 gap-1",
                      tipoProposta === "gd" ? "bg-green-600 hover:bg-green-700" : ""
                    )}
                    onClick={() => setTipoProposta(tipoProposta === "gd" ? null : "gd")}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    GD
                  </Button>
                  <Button
                    size="sm"
                    variant={tipoProposta === "reciee" ? "default" : "outline"}
                    className={cn(
                      "flex-1 gap-1",
                      tipoProposta === "reciee" ? "bg-yellow-600 hover:bg-yellow-700" : ""
                    )}
                    onClick={() => setTipoProposta(tipoProposta === "reciee" ? null : "reciee")}
                  >
                    <Receipt className="h-3.5 w-3.5" />
                    RECIEE
                  </Button>
                </div>
              </div>

              {tipoProposta === "gd" && (
                <div className="px-4 pb-3 space-y-2">
                  <h4 className="text-xs font-medium text-green-400 flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5" />
                    Proposta GD
                  </h4>
                  <select
                    value={gdForm.concessionaria}
                    onChange={(e) => setGdForm({ ...gdForm, concessionaria: e.target.value })}
                    className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2 w-full"
                  >
                    <option value="">Concessionária *</option>
                    {CONCESSIONARIAS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="UC / Instalação *"
                    value={gdForm.instalacao}
                    onChange={(e) => setGdForm({ ...gdForm, instalacao: e.target.value })}
                    className="h-10 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={gdForm.classe_tarifaria}
                      onChange={(e) => setGdForm({ ...gdForm, classe_tarifaria: e.target.value })}
                      className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
                    >
                      <option value="">Classe</option>
                      {CLASSES_TARIFARIAS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      value={gdForm.subgrupo_tarifario}
                      onChange={(e) => setGdForm({ ...gdForm, subgrupo_tarifario: e.target.value })}
                      className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
                    >
                      <option value="">Subgrupo</option>
                      {SUBGRUPOS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <select
                    value={gdForm.bandeira}
                    onChange={(e) => setGdForm({ ...gdForm, bandeira: e.target.value })}
                    className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2 w-full"
                  >
                    <option value="">Bandeira</option>
                    {BANDEIRAS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="Consumo mensal (kWh)"
                    type="number"
                    value={gdForm.consumo_mensal}
                    onChange={(e) => setGdForm({ ...gdForm, consumo_mensal: e.target.value })}
                    className="h-10 text-sm"
                  />
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                    onClick={criarPropostaGD}
                    disabled={salvandoCliente || verificandoDuplicata || !gdForm.concessionaria || !gdForm.instalacao}
                  >
                    {salvandoCliente ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {salvandoCliente ? "Salvando..." : "Salvar Proposta GD"}
                  </Button>
                </div>
              )}

              {tipoProposta === "reciee" && (
                <div className="px-4 pb-3 space-y-2">
                  <h4 className="text-xs font-medium text-yellow-400 flex items-center gap-1">
                    <Receipt className="h-3.5 w-3.5" />
                    Proposta RECIEE
                  </h4>
                  <Input
                    placeholder="UC *"
                    value={recieeForm.uc}
                    onChange={(e) => setRecieeForm({ ...recieeForm, uc: e.target.value })}
                    className="h-10 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={recieeForm.estado}
                      onChange={(e) => setRecieeForm({ ...recieeForm, estado: e.target.value })}
                      className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
                    >
                      <option value="">UF *</option>
                      {ESTADOS.map((uf) => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                    <select
                      value={recieeForm.distribuidora}
                      onChange={(e) => setRecieeForm({ ...recieeForm, distribuidora: e.target.value })}
                      className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
                    >
                      <option value="">Distribuidora *</option>
                      {DISTRIBUIDORAS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={recieeForm.subgrupo}
                      onChange={(e) => setRecieeForm({ ...recieeForm, subgrupo: e.target.value })}
                      className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
                    >
                      <option value="">Subgrupo</option>
                      {SUBGRUPOS_RECIEE.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <select
                      value={recieeForm.modalidade}
                      onChange={(e) => setRecieeForm({ ...recieeForm, modalidade: e.target.value })}
                      className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
                    >
                      <option value="">Modalidade</option>
                      {MODALIDADES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={recieeForm.classe}
                      onChange={(e) => setRecieeForm({ ...recieeForm, classe: e.target.value })}
                      className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
                    >
                      <option value="">Classe</option>
                      {CLASSES_RECIEE.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      value={recieeForm.tensao}
                      onChange={(e) => setRecieeForm({ ...recieeForm, tensao: e.target.value })}
                      className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
                    >
                      <option value="">Tensão</option>
                      {TENSOES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={recieeForm.regime_tributario}
                      onChange={(e) => setRecieeForm({ ...recieeForm, regime_tributario: e.target.value })}
                      className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
                    >
                      <option value="">Regime</option>
                      {REGIMES_TRIBUTARIOS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <select
                      value={recieeForm.grupo}
                      onChange={(e) => setRecieeForm({ ...recieeForm, grupo: e.target.value })}
                      className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
                    >
                      <option value="">Grupo</option>
                      {GRUPOS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    className="w-full bg-yellow-600 hover:bg-yellow-700 text-white gap-2"
                    onClick={criarPropostaRECIEE}
                    disabled={salvandoCliente || verificandoDuplicata || !recieeForm.uc}
                  >
                    {salvandoCliente ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {salvandoCliente ? "Salvando..." : "Salvar Proposta RECIEE"}
                  </Button>
                </div>
              )}

              {!tipoProposta && (
                <div className="px-4 pb-4 text-center">
                  <p className="text-xs text-white/30">
                    Selecione GD ou RECIEE acima
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Mensagens de erro/sucesso */}
      {mensagemErro && (
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2 p-2 rounded-md bg-red-50 border border-red-200">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{mensagemErro}</p>
            <button onClick={() => setMensagemErro(null)} className="ml-auto shrink-0">
              <X className="h-3 w-3 text-red-500" />
            </button>
          </div>
        </div>
      )}

      {mensagemSucesso && (
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2 p-2 rounded-md bg-green-50 border border-green-200">
            <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
            <p className="text-xs text-green-700">{mensagemSucesso}</p>
            <button onClick={() => setMensagemSucesso(null)} className="ml-auto shrink-0">
              <X className="h-3 w-3 text-green-500" />
            </button>
          </div>
        </div>
      )}

      {/* Etiquetas */}
      <div className="border-t border-white/10 mt-auto">
        <Secao titulo="Etiquetas" badge={etiquetasVinculadas.length}>
          <div className="space-y-2">
            <Input
              placeholder="Busca"
              value={etiquetasBusca}
              onChange={(e) => setEtiquetasBusca(e.target.value)}
              className="h-8 text-xs"
            />
            {etiquetasVinculadas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {etiquetasVinculadas.map((et) => (
                  <Badge
                    key={et}
                    variant="secondary"
                    className={cn(
                      "text-[10px] px-2 py-0.5 h-5 bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200",
                      salvando === et && "opacity-50"
                    )}
                    onClick={() => removerEtiqueta(et)}
                  >
                    {et} <X className="h-2.5 w-2.5 ml-0.5" />
                  </Badge>
                ))}
              </div>
            )}
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {etiquetasFiltradas.map((etiqueta) => (
                <button
                  key={etiqueta}
                  disabled={salvando === etiqueta}
                  className="w-full text-left px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                  onClick={() => vincularEtiqueta(etiqueta)}
                >
                  {salvando === etiqueta ? "Salvando..." : etiqueta}
                </button>
              ))}
              {etiquetasFiltradas.length === 0 && (
                <p className="text-xs text-slate-400 py-1">
                  {loadingEtiquetas ? "Carregando..." : "Nenhuma etiqueta encontrada"}
                </p>
              )}
            </div>
          </div>
        </Secao>
      </div>
    </div>
  );
}
