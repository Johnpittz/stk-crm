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
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// ─── Types ───

interface ClienteUnificado {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf_cnpj: string | null;
  cidade: string | null;
  estado: string | null;
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
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteUnificado | null>(null);
  const [detalhesAberto, setDetalhesAberto] = useState(false);
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

  // ─── Abrir detalhes ───
  const abrirDetalhes = (cliente: ClienteUnificado) => {
    setClienteSelecionado(cliente);
    setDetalhesAberto(true);
  };

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

      {/* Lista */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500">
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
            <div className="space-y-2">
              {clientesFiltrados.map((cliente) => (
                <Card
                  key={cliente.id}
                  className="border-[#1c2e4a] bg-[#14233c] cursor-pointer hover:border-[#3B64CF]/30 transition-colors"
                  onClick={() => abrirDetalhes(cliente)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-white truncate">
                            {cliente.nome}
                          </h3>
                          <OrigemBadge origem={cliente.origem} />
                          {cliente.cidade && (
                            <span className="text-[10px] text-slate-500">
                              {cliente.cidade}{cliente.estado ? `/${cliente.estado}` : ""}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-slate-500">
                          {cliente.telefone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {cliente.telefone}
                            </span>
                          )}
                          {cliente.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {cliente.email}
                            </span>
                          )}
                          {cliente.cpf_cnpj && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {cliente.cpf_cnpj}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {cliente.tem_atendimento && (
                            <Badge variant="secondary" className="text-[9px] bg-blue-500/20 text-blue-400">
                              <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
                              Atendimento
                            </Badge>
                          )}
                          {cliente.tem_chatbot && (
                            <Badge variant="secondary" className="text-[9px] bg-purple-500/20 text-purple-400">
                              <Bot className="h-2.5 w-2.5 mr-0.5" />
                              Chatbot
                            </Badge>
                          )}
                          {cliente.tem_faturas_reciee && (
                            <Badge variant="secondary" className="text-[9px] bg-yellow-500/20 text-yellow-400">
                              <FileText className="h-2.5 w-2.5 mr-0.5" />
                              RECIEE
                            </Badge>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-600 shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Modal de Detalhes */}
      {clienteSelecionado && (
        <DetalhesCliente
          cliente={clienteSelecionado}
          aberto={detalhesAberto}
          onFechar={() => setDetalhesAberto(false)}
          onNavegar={(rota) => {
            setDetalhesAberto(false);
            router.push(rota);
          }}
        />
      )}
    </div>
  );
}

// ─── Badge de Origem ───

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

// ─── Modal de Detalhes do Cliente ───

function DetalhesCliente({
  cliente,
  aberto,
  onFechar,
  onNavegar,
}: {
  cliente: ClienteUnificado;
  aberto: boolean;
  onFechar: () => void;
  onNavegar: (rota: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"geral" | "chatbot" | "reciee" | "atendimentos">("geral");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [faturas, setFaturas] = useState<FaturaReciee[]>([]);
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (!aberto || !cliente) return;

    const carregarDetalhes = async () => {
      setLoadingDetalhes(true);

      // Buscar sessões de chatbot por telefone
      if (cliente.telefone) {
        const tel = cliente.telefone.replace(/\D/g, "");
        const telComUltimos8 = tel.slice(-8);
        const { data: sessions } = await supabase
          .from("chatbot_sessions")
          .select("*")
          .or(`telefone.eq.${tel},telefone.like.%${telComUltimos8}%`)
          .order("created_at", { ascending: false })
          .limit(10);
        setChatSessions(sessions || []);
      }

      // Buscar faturas RECIEE
      if (cliente.cpf_cnpj) {
        try {
          const { data: recieeClients, error: recieeErr } = await supabase
            .from("clientes_reciee")
            .select("id")
            .eq("cpf_cnpj", cliente.cpf_cnpj)
            .limit(1);

          if (recieeErr) {
            console.error("Erro ao buscar cliente RECIEE:", recieeErr.message);
          }

          const recieeClient = recieeClients?.[0];
          if (recieeClient) {
            const { data: f, error: fErr } = await supabase
              .from("faturas_reciee")
              .select("*")
              .eq("cliente_id", recieeClient.id)
              .order("competencia", { ascending: false })
              .limit(12);

            if (fErr) {
              console.error("Erro ao buscar faturas:", fErr.message);
            }
            setFaturas(f || []);
          }
        } catch (err) {
          console.error("Erro inesperado ao buscar faturas:", err);
        }
      }

      // Buscar atendimentos
      if (cliente.telefone) {
        const tel = cliente.telefone.replace(/\D/g, "");
        const telComUltimos8 = tel.slice(-8);
        const { data: atts } = await supabase
          .from("atendimentos")
          .select("id, telefone_cliente, nome_cliente, status, instancia, created_at, ultima_mensagem")
          .or(`telefone_cliente.eq.${tel},telefone_cliente.like.%${telComUltimos8}%`)
          .order("created_at", { ascending: false })
          .limit(10);
        setAtendimentos(atts || []);
      }

      setLoadingDetalhes(false);
    };

    carregarDetalhes();
  }, [aberto, cliente, supabase]);

  if (!aberto) return null;

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onFechar()}>
      <DialogContent className="bg-[#0f1d32] border-[#1c2e4a] max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white text-base">
              {cliente.nome}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {cliente.telefone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] border-[#1c2e4a] text-slate-400"
                  onClick={() => onNavegar(`/atendimento?telefone=${cliente.telefone}`)}
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Atendimento
                </Button>
              )}
              {cliente.origem === "reciee" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] border-[#1c2e4a] text-slate-400"
                  onClick={() => onNavegar("/reciee")}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  RECIEE
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="shrink-0 flex gap-1 mb-3">
          {[
            { key: "geral", label: "Geral" },
            { key: "chatbot", label: `Chatbot (${chatSessions.length})` },
            { key: "reciee", label: `RECIEE (${faturas.length})` },
            { key: "atendimentos", label: `Atendimentos (${atendimentos.length})` },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                activeTab === t.key
                  ? "bg-[#3B64CF] text-white"
                  : "bg-white/5 text-white/50 hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <ScrollArea className="flex-1 min-h-0">
          {loadingDetalhes ? (
            <div className="flex items-center justify-center h-32 text-slate-500 text-xs">
              Carregando detalhes...
            </div>
          ) : activeTab === "geral" ? (
            <div className="space-y-3">
              <InfoItem icon={<Phone className="h-3.5 w-3.5" />} label="Telefone" value={cliente.telefone} />
              <InfoItem icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={cliente.email} />
              <InfoItem icon={<Building2 className="h-3.5 w-3.5" />} label="CPF/CNPJ" value={cliente.cpf_cnpj} />
              <InfoItem icon={<Users className="h-3.5 w-3.5" />} label="Cidade" value={cliente.cidade ? `${cliente.cidade}${cliente.estado ? `/${cliente.estado}` : ""}` : null} />
              <div className="pt-2 border-t border-[#1c2e4a]">
                <p className="text-[10px] text-slate-500 mb-2">Origem</p>
                <OrigemBadge origem={cliente.origem} />
              </div>
            </div>
          ) : activeTab === "chatbot" ? (
            <div className="space-y-2">
              {chatSessions.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">Nenhuma sessão de chatbot</p>
              ) : (
                chatSessions.map((s) => (
                  <div key={s.id} className="p-3 rounded-lg bg-[#0a1628] border border-[#1c2e4a]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white">{s.nome_lead || s.telefone}</span>
                      <div className="flex items-center gap-2">
                        {s.classificacao && (
                          <Badge variant="secondary" className={`text-[9px] ${
                            s.classificacao === "A" ? "bg-red-500/20 text-red-400" :
                            s.classificacao === "B" ? "bg-orange-500/20 text-orange-400" :
                            s.classificacao === "C" ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-slate-500/20 text-slate-400"
                          }`}>
                            {s.classificacao}
                          </Badge>
                        )}
                        <Badge variant="secondary" className={`text-[9px] ${
                          s.status === "ativa" ? "bg-green-500/20 text-green-400" :
                          s.status === "concluida" ? "bg-blue-500/20 text-blue-400" :
                          "bg-slate-500/20 text-slate-400"
                        }`}>
                          {s.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {s.instancia} · {new Date(s.created_at).toLocaleDateString("pt-BR")}
                    </p>
                    {s.respostas && Object.keys(s.respostas).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {Object.entries(s.respostas).map(([key, val]: [string, any]) => (
                          <div key={key} className="text-[10px]">
                            <span className="text-slate-500">{key}:</span>{" "}
                            <span className="text-slate-300">{val?.texto || val?.chave || String(val)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : activeTab === "reciee" ? (
            <div className="space-y-2">
              {faturas.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">Nenhuma fatura RECIEE</p>
              ) : (
                faturas.map((f) => (
                  <div key={f.id} className="p-3 rounded-lg bg-[#0a1628] border border-[#1c2e4a]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white">
                        {f.competencia || "Sem competência"}
                      </span>
                      <span className="text-xs text-green-400">
                        {f.valor_total ? `R$ ${f.valor_total.toLocaleString("pt-BR")}` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
                      {f.consumo_kwh && <span>{f.consumo_kwh.toLocaleString()} kWh</span>}
                      {f.bandeira && <span>{f.bandeira}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {atendimentos.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">Nenhum atendimento</p>
              ) : (
                atendimentos.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 rounded-lg bg-[#0a1628] border border-[#1c2e4a] cursor-pointer hover:border-[#3B64CF]/30 transition-colors"
                    onClick={() => onNavegar("/atendimento")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white">
                        {a.nome_cliente || a.telefone_cliente}
                      </span>
                      <Badge variant="secondary" className={`text-[9px] ${
                        a.status === "aberto" ? "bg-green-500/20 text-green-400" : "bg-slate-500/20 text-slate-400"
                      }`}>
                        {a.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 truncate">
                      {a.ultima_mensagem || "Sem mensagem"}
                    </p>
                    <p className="text-[10px] text-slate-600">
                      {a.instancia} · {new Date(a.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ─── Item de Info ───

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-slate-500">{icon}</div>
      <div>
        <p className="text-[10px] text-slate-500">{label}</p>
        <p className="text-xs text-white">{value || "-"}</p>
      </div>
    </div>
  );
}
