"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Zap,
  Pencil,
  MessageSquare,
  FileText,
  ShoppingCart,
  Headphones,
  StickyNote,
  Trash2,
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ─── Tipos ───

interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf_cnpj: string | null;
  cidade: string | null;
  estado: string | null;
  whatsapp: string | null;
  concessionaria: string | null;
  status: string | null;
  classe_tarifaria: string | null;
  vencimento_fatura: string | null;
  instalacao: string | null;
  classificacao: string | null;
  origem: string;
  axs_card_id: string | null;
  axs_status: string | null;
}

interface Interacao {
  id: string;
  cliente_id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  dados: any;
  status: string | null;
  created_at: string;
}

interface InteracaoForm {
  tipo: string;
  titulo: string;
  descricao: string;
  dados: any;
  status: string;
}

// ─── Configuração de tipos ───

const TIPOS_INTERACAO: Record<string, { label: string; icon: any; cor: string }> = {
  reciee: { label: "RECIEE", icon: Zap, cor: "bg-yellow-500/20 text-yellow-400" },
  gd: { label: "Geração Distribuída", icon: Zap, cor: "bg-green-500/20 text-green-400" },
  chatbot: { label: "Chatbot", icon: MessageSquare, cor: "bg-blue-500/20 text-blue-400" },
  atendimento: { label: "Atendimento", icon: Headphones, cor: "bg-purple-500/20 text-purple-400" },
  venda: { label: "Venda", icon: ShoppingCart, cor: "bg-emerald-500/20 text-emerald-400" },
  suporte: { label: "Suporte", icon: Headphones, cor: "bg-orange-500/20 text-orange-400" },
  nota: { label: "Nota", icon: StickyNote, cor: "bg-slate-500/20 text-slate-400" },
};

const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo" },
  { value: "concluido", label: "Concluído" },
  { value: "pendente", label: "Pendente" },
  { value: "cancelado", label: "Cancelado" },
];

// ─── Página Principal ───

export default function ClienteDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const clienteId = params.clienteId as string;
  const supabase = createClient();

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [form, setForm] = useState<InteracaoForm>({
    tipo: "nota",
    titulo: "",
    descricao: "",
    dados: {},
    status: "ativo",
  });
  const [salvando, setSalvando] = useState(false);

  // ─── Carregar dados ───

  const carregarCliente = useCallback(async () => {
    try {
      // Tentar buscar da view unificada primeiro
      const { data, error } = await supabase
        .from("v_unified_clientes")
        .select("*")
        .eq("id", clienteId)
        .maybeSingle();

      if (error || !data) {
        // Fallback: buscar direto da tabela clientes
        const { data: fallback } = await supabase
          .from("clientes")
          .select("*")
          .eq("id", clienteId)
          .maybeSingle();

        if (fallback) {
          setCliente({
            id: fallback.id,
            nome: fallback.nome_completo || fallback.nome_razao_social || "Sem nome",
            telefone: fallback.telefone || null,
            email: fallback.email || null,
            cpf_cnpj: fallback.cpf_cnpj || null,
            cidade: fallback.cidade || null,
            estado: fallback.estado || null,
            whatsapp: fallback.whatsapp || null,
            concessionaria: fallback.concessionaria || null,
            status: fallback.status || null,
            classe_tarifaria: fallback.classe_tarifaria || null,
            vencimento_fatura: fallback.vencimento_fatura || null,
            instalacao: fallback.instalacao || null,
            classificacao: fallback.classificacao || null,
            origem: "cadastro",
            axs_card_id: fallback.axs_card_id || null,
            axs_status: fallback.axs_status || null,
          });
          return;
        }
      } else {
        setCliente({
          id: data.id,
          nome: data.nome || "Sem nome",
          telefone: data.telefone || null,
          email: data.email || null,
          cpf_cnpj: data.cpf_cnpj || null,
          cidade: data.cidade || null,
          estado: data.estado || null,
          whatsapp: null,
          concessionaria: null,
          status: null,
          classe_tarifaria: null,
          vencimento_fatura: null,
          instalacao: null,
          classificacao: null,
          origem: data.origem || "cadastro",
          axs_card_id: null,
          axs_status: null,
        });
        return;
      }
    } catch (err) {
      console.error("Erro ao carregar cliente:", err);
    }
  }, [supabase, clienteId]);

  const carregarInteracoes = useCallback(async () => {
    try {
      const res = await fetch(`/api/clientes/${clienteId}/interactions`);
      const data = await res.json();
      setInteracoes(data.interacoes || []);
    } catch (err) {
      console.error(err);
    }
  }, [clienteId]);

  useEffect(() => {
    Promise.all([carregarCliente(), carregarInteracoes()]).then(() =>
      setLoading(false)
    );
  }, [carregarCliente, carregarInteracoes]);

  // ─── Criar interação ───

  const criarInteracao = async () => {
    if (!form.titulo.trim()) return;
    setSalvando(true);
    try {
      await fetch(`/api/clientes/${clienteId}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ tipo: "nota", titulo: "", descricao: "", dados: {}, status: "ativo" });
      setDialogAberto(false);
      await carregarInteracoes();
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  // ─── Deletar interação ───

  const deletarInteracao = async (id: string) => {
    try {
      await fetch(`/api/clientes/${clienteId}/interactions?id=${id}`, {
        method: "DELETE",
      });
      await carregarInteracoes();
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Agrupar por tipo ───

  const interacoesPorTipo = interacoes.reduce((acc, i) => {
    if (!acc[i.tipo]) acc[i.tipo] = [];
    acc[i.tipo].push(i);
    return acc;
  }, {} as Record<string, Interacao[]>);

  // ─── Renderização ───

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-9rem)]">
        <div className="text-slate-500 text-sm">Carregando cliente...</div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-9rem)] text-slate-500">
        <p className="text-sm mb-4">Cliente não encontrado</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/clientes")}>
          <ArrowLeft className="h-3 w-3 mr-1" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white"
            onClick={() => router.push("/clientes")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <User className="h-5 w-5 text-[#3B64CF]" />
              {cliente.nome}
            </h2>
            <p className="text-xs text-slate-400">
              {cliente.cpf_cnpj || "Sem CPF/CNPJ"} · {cliente.cidade && cliente.estado ? `${cliente.cidade}/${cliente.estado}` : cliente.cidade || "Sem localização"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Edit Button */}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-[#1c2e4a] text-slate-300 hover:text-white hover:bg-[#1c2e4a]"
            onClick={() => router.push(`/clientes/${clienteId}/editar`)}
          >
            <Pencil className="h-3 w-3 mr-1" />
            Editar
          </Button>
          {/* AXS Button */}
          <Button
            size="sm"
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => router.push(`/clientes/${clienteId}/axs-novo`)}
          >
            <Zap className="h-3 w-3 mr-1" />
            Criar Proposta AXS
          </Button>
          <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 bg-[#15317B] hover:bg-[#1a3d8f] text-white">
              <Plus className="h-3 w-3 mr-1" />
              Nova Interação
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#14233c] border-[#1c2e4a]">
            <DialogHeader>
              <DialogTitle className="text-white">Nova Interação</DialogTitle>
              <DialogDescription className="text-slate-400">
                Registre uma nova interação com este cliente
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Tipo</label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger className="h-8 text-xs bg-[#0f1d32] border-[#1c2e4a] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#14233c] border-[#1c2e4a]">
                      {Object.entries(TIPOS_INTERACAO).map(([key, t]) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Status</label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="h-8 text-xs bg-[#0f1d32] border-[#1c2e4a] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#14233c] border-[#1c2e4a]">
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value} className="text-xs">
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Título</label>
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ex: Fatura RECIEE referente a Jan/2026"
                  className="h-8 text-xs bg-[#0f1d32] border-[#1c2e4a] text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Descrição</label>
                <Textarea
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Detalhes desta interação..."
                  className="text-xs bg-[#0f1d32] border-[#1c2e4a] text-white min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-[#1c2e4a] text-slate-400"
                onClick={() => setDialogAberto(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-[#15317B] hover:bg-[#1a3d8f] text-white"
                onClick={criarInteracao}
                disabled={salvando || !form.titulo.trim()}
              >
                {salvando ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Info do Cliente */}
      <Card className="border-[#1c2e4a] bg-[#14233c]">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <User className="h-3.5 w-3.5" />
              <span>{cliente.nome}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Building2 className="h-3.5 w-3.5" />
              <span>{cliente.cpf_cnpj || "Sem documento"}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Phone className="h-3.5 w-3.5" />
              <span>{cliente.telefone || "Sem telefone"}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <Mail className="h-3.5 w-3.5" />
              <span>{cliente.email || "Sem email"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(TIPOS_INTERACAO).map(([key, config]) => {
          const count = interacoesPorTipo[key]?.length || 0;
          const Icon = config.icon;
          return (
            <Card key={key} className="border-[#1c2e4a] bg-[#14233c]">
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${config.cor}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{count}</p>
                  <p className="text-[10px] text-slate-500">{config.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Lista de Interações */}
      <Card className="border-[#1c2e4a] bg-[#14233c]">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-semibold text-white">
            Histórico de Interações
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {interacoes.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <FileText className="h-8 w-8 mx-auto mb-2 text-slate-600" />
              <p className="text-xs">Nenhuma interação registrada</p>
              <p className="text-[10px] text-slate-600 mt-1">
                Clique em "Nova Interação" para começar
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {interacoes.map((interacao) => {
                const config = TIPOS_INTERACAO[interacao.tipo] || TIPOS_INTERACAO.nota;
                const Icon = config.icon;
                return (
                  <div
                    key={interacao.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-[#0f1d32] border border-[#1c2e4a]"
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${config.cor}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-white truncate">
                          {interacao.titulo}
                        </span>
                        <Badge variant="secondary" className={`text-[9px] ${config.cor}`}>
                          {config.label}
                        </Badge>
                        {interacao.status && interacao.status !== "ativo" && (
                          <Badge variant="secondary" className="text-[9px] bg-slate-500/20 text-slate-400">
                            {interacao.status}
                          </Badge>
                        )}
                      </div>
                      {interacao.descricao && (
                        <p className="text-[11px] text-slate-400 mb-1 line-clamp-2">
                          {interacao.descricao}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(interacao.created_at).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(interacao.created_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-500 hover:text-red-400 shrink-0"
                      onClick={() => deletarInteracao(interacao.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
