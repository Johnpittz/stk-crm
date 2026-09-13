"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Phone,
  Mail,
  Building2,
  Zap,
  MessageSquare,
  Bot,
  FileText,
  ChevronRight,
  ExternalLink,
  X,
  Eye,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ───

interface ClienteUnificado {
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
  data_nascimento: string | null;
  razao_social: string | null;
  axs_status: string | null;
  origem: "cadastro" | "reciee" | "chatbot" | "disparo" | "whatsapp" | "atendimento";
  tem_atendimento: boolean;
  tem_chatbot: boolean;
  tem_faturas_reciee: boolean;
  ultima_interacao: string | null;
}

interface ChatSession {
  id: string;
  telefone: string;
  nome_lead: string | null;
  classificacao: string | null;
  status: string;
  instancia: string | null;
  respostas: Record<string, any>;
  created_at: string;
}

interface FaturaReciee {
  id: string;
  competencia: string | null;
  consumo_kwh: number | null;
  valor_total: number | null;
  bandeira: string | null;
  created_at: string;
}

// ─── Página Principal ───

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteUnificado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState<string>("todos");
  const [clienteParaDeletar, setClienteParaDeletar] = useState<ClienteUnificado | null>(null);
  const [deletando, setDeletando] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // ─── Carregar dados da view unificada ───
  const carregarClientes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("v_unified_clientes")
        .select("*")
        .order("nome");

      if (error) {
        console.error("Erro ao carregar clientes:", error.message);
        // Fallback: buscar da tabela clientes
        const { data: fallback } = await supabase
          .from("clientes")
          .select("*")
          .order("nome_razao_social");

        if (fallback) {
          setClientes(
            fallback.map((c: any) => ({
              id: c.id,
              nome: c.nome_razao_social || "Sem nome",
              telefone: c.telefone || null,
              email: c.email || null,
              cpf_cnpj: c.cpf_cnpj || null,
              cidade: c.cidade || null,
              estado: c.estado || null,
              whatsapp: c.whatsapp || null,
              concessionaria: c.concessionaria || null,
              status: c.status || null,
              classe_tarifaria: c.classe_tarifaria || null,
              vencimento_fatura: c.vencimento_fatura || null,
              instalacao: c.instalacao || null,
              classificacao: c.classificacao || null,
              data_nascimento: c.data_nascimento || null,
              razao_social: c.razao_social || null,
              axs_status: c.axs_status || null,
              origem: "cadastro" as const,
              tem_atendimento: false,
              tem_chatbot: false,
              tem_faturas_reciee: false,
              ultima_interacao: c.created_at || null,
            }))
          );
        }
      } else if (data) {
        setClientes(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    carregarClientes();
  }, [carregarClientes]);

  // ─── Deletar cliente ───
  const handleDeletarCliente = async () => {
    if (!clienteParaDeletar) return;
    setDeletando(true);
    try {
      // Desvincular de atendimentos (setar cliente_id = null)
      await supabase
        .from("atendimentos")
        .update({ cliente_id: null })
        .eq("cliente_id", clienteParaDeletar.id);

      // Deletar cliente
      const res = await fetch(`/api/clientes/${clienteParaDeletar.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setClientes((prev) => prev.filter((c) => c.id !== clienteParaDeletar.id));
        setClienteParaDeletar(null);
      } else {
        const data = await res.json();
        alert(`Erro: ${data.error || "Não foi possível excluir"}`);
      }
    } catch (err) {
      alert("Erro ao excluir cliente");
    } finally {
      setDeletando(false);
    }
  };

  // ─── Filtrar ───
  const clientesFiltrados = clientes.filter((c) => {
    const matchBusca =
      !busca ||
      c.nome.toLowerCase().includes(busca.toLowerCase()) ||
      c.telefone?.includes(busca) ||
      c.email?.toLowerCase().includes(busca.toLowerCase()) ||
      c.cpf_cnpj?.includes(busca);

    const matchOrigem = filtroOrigem === "todos" || c.origem === filtroOrigem;

    return matchBusca && matchOrigem;
  });

  // ─── Estatísticas ───
  const stats = {
    total: clientes.length,
    gd: clientes.filter((c) => c.origem === "chatbot" || c.origem === "disparo").length,
    reciee: clientes.filter((c) => c.origem === "reciee").length,
    atendimentos: clientes.filter((c) => c.tem_atendimento).length,
  };

  // ─── Status badge helper ───
  function StatusBadge({ status }: { status: string | null }) {
    if (!status) return <span className="text-[10px] text-slate-500">-</span>;
    const s = status.toLowerCase();
    const color =
      s === "ativo" || s === "ativa"
        ? "bg-green-500/20 text-green-400"
        : s === "inativo" || s === "inativa"
          ? "bg-red-500/20 text-red-400"
          : "bg-slate-500/20 text-slate-400";
    return (
      <Badge variant="secondary" className={`text-[10px] ${color}`}>
        {status}
      </Badge>
    );
  }

  // ─── Origem badge helper ───
  function OrigemBadge({ origem }: { origem: string }) {
    const config: Record<string, { label: string; color: string }> = {
      cadastro: { label: "Cadastro", color: "bg-slate-500/20 text-slate-400" },
      reciee: { label: "RECIEE", color: "bg-yellow-500/20 text-yellow-400" },
      chatbot: { label: "GD", color: "bg-green-500/20 text-green-400" },
      disparo: { label: "Disparo", color: "bg-orange-500/20 text-orange-400" },
      whatsapp: { label: "WhatsApp", color: "bg-emerald-500/20 text-emerald-400" },
      atendimento: { label: "Atendimento", color: "bg-blue-500/20 text-blue-400" },
    };
    const c = config[origem] || config.cadastro;
    return (
      <Badge variant="secondary" className={`text-[9px] ${c.color}`}>
        {c.label}
      </Badge>
    );
  }

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-[#3B64CF]" />
            Clientes
          </h2>
          <p className="text-xs text-slate-400">
            {stats.total} clientes cadastrados · {stats.gd} GD · {stats.reciee} RECIEE
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-[#1c2e4a] text-slate-400"
            onClick={carregarClientes}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Atualizar
          </Button>
          <Link href="/clientes/novo">
            <Button
              size="sm"
              className="h-8 text-xs bg-[#3B64CF] hover:bg-[#2d4fa0] text-white"
            >
              <Plus className="h-3 w-3 mr-1" />
              Novo Cliente
            </Button>
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="shrink-0 flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <Input
            placeholder="Buscar por nome, telefone, email ou CPF/CNPJ..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-8 text-xs pl-7 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#3B64CF]"
          />
        </div>
        <div className="flex gap-1">
          {[
            { value: "todos", label: "Todos" },
            { value: "cadastro", label: "Cadastro" },
            { value: "reciee", label: "RECIEE" },
            { value: "chatbot", label: "Chatbot" },
            { value: "disparo", label: "Disparo" },
            { value: "whatsapp", label: "WhatsApp" },
            { value: "atendimento", label: "Atendimento" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltroOrigem(f.value)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                filtroOrigem === f.value
                  ? "bg-[#3B64CF] text-white"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="flex-1 min-h-0 overflow-hidden rounded-lg border border-[#1c2e4a]">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Carregando clientes...
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Users className="h-12 w-12 mb-4 text-slate-600" />
            <p className="text-sm">Nenhum cliente encontrado</p>
            <p className="text-xs text-slate-600 mt-1">
              Clientes aparecem aqui quando criam atendimento, participam de chatbot ou são importados
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10 bg-[#0a1628] border-b border-[#1c2e4a]">
                <tr>
                  <th className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    CPF/CNPJ
                  </th>
                  <th className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Cidade/UF
                  </th>
                  <th className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Telefone/WhatsApp
                  </th>
                  <th className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Concessionária
                  </th>
                  <th className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-8" />
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map((cliente) => (
                  <tr
                    key={cliente.id}
                    className="border-b border-[#1c2e4a]/50 hover:bg-[#1c2e4a]/30 transition-colors cursor-pointer"
                    onClick={() => router.push(`/clientes/${cliente.id}`)}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium text-white truncate">
                          {cliente.nome}
                        </span>
                        <OrigemBadge origem={cliente.origem} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-300 whitespace-nowrap">
                      {cliente.cpf_cnpj || <span className="text-slate-600">-</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-300 whitespace-nowrap">
                      {cliente.cidade && cliente.estado
                        ? `${cliente.cidade}/${cliente.estado}`
                        : cliente.cidade || <span className="text-slate-600">-</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-300 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        {cliente.telefone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-slate-500" />
                            {cliente.telefone}
                          </span>
                        )}
                        {cliente.whatsapp && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3 text-green-400" />
                            {cliente.whatsapp}
                          </span>
                        )}
                        {!cliente.telefone && !cliente.whatsapp && (
                          <span className="text-slate-600">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-300 truncate max-w-[140px]">
                      {cliente.concessionaria || <span className="text-slate-600">-</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={cliente.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          className="p-1 rounded hover:bg-red-500/20 transition-colors"
                          title="Excluir cliente"
                          onClick={(e) => {
                            e.stopPropagation();
                            setClienteParaDeletar(cliente);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-slate-500 hover:text-red-400" />
                        </button>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </div>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={!!clienteParaDeletar} onOpenChange={() => setClienteParaDeletar(null)}>
        <DialogContent className="bg-[#0f1d32] border border-[#1c2e4a] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-400" />
              Excluir Cliente
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-300">
              Tem certeza que deseja excluir <strong className="text-white">{clienteParaDeletar?.nome}</strong>?
            </p>
            <p className="text-xs text-slate-500 mt-2">
              O cliente será removido, mas os atendimentos anteriores serão mantidos.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-[#1c2e4a] text-slate-400"
              onClick={() => setClienteParaDeletar(null)}
              disabled={deletando}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeletarCliente}
              disabled={deletando}
            >
              {deletando ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
