"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Bot,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  Settings,
  Play,
  Pause,
  Trash2,
  Plus,
  Search,
  Filter,
} from "lucide-react";

// ─── Tipos ───

interface ChatbotFlow {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  instancia: string | null;
  mensagem_inicial: string;
  horario_comercial: any;
  created_at: string;
  stats: {
    total: number;
    ativas: number;
  };
}

interface ChatSession {
  id: string;
  telefone: string;
  flow_id: string;
  step_atual: string;
  respostas: Record<string, any>;
  classificacao: string | null;
  status: string;
  instancia: string | null;
  nome_lead: string | null;
  ultimo_contato: string;
  created_at: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  remetente: 'bot' | 'cliente' | 'ia';
  conteudo: string;
  step_chave: string | null;
  created_at: string;
}

// ─── Página Principal ───

export default function ChatbotPage() {
  const [activeTab, setActiveTab] = useState<"flows" | "sessions" | "stats">("flows");
  const [fluxos, setFluxos] = useState<ChatbotFlow[]>([]);
  const [sessoes, setSessoes] = useState<ChatSession[]>([]);
  const [sessaoSelecionada, setSessaoSelecionada] = useState<ChatSession | null>(null);
  const [mensagens, setMensagens] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState("todos");

  // ─── Carregar Dados ───

  const carregarFluxos = async () => {
    try {
      const res = await fetch("/api/chatbot/flows");
      const data = await res.json();
      setFluxos(data.fluxos || []);
    } catch (err) {
      console.error(err);
    }
  };

  const carregarSessoes = async () => {
    try {
      let url = "/api/chatbot/sessions?limit=50";
      if (filtroStatus !== "todos") {
        url += `&status=${filtroStatus}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setSessoes(data.sessoes || []);
    } catch (err) {
      console.error(err);
    }
  };

  const carregarMensagens = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/chatbot/sessions?id=${sessionId}`);
      const data = await res.json();
      setMensagens(data.mensagens || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([carregarFluxos(), carregarSessoes()]).then(() => setLoading(false));
  }, [filtroStatus]);

  useEffect(() => {
    if (sessaoSelecionada) {
      carregarMensagens(sessaoSelecionada.id);
    }
  }, [sessaoSelecionada]);

  // ─── Ações ───

  const toggleFluxo = async (id: string, ativo: boolean) => {
    try {
      await fetch("/api/chatbot/flows", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ativo: !ativo }),
      });
      carregarFluxos();
    } catch (err) {
      console.error(err);
    }
  };

  const encerrarSessao = async (id: string) => {
    try {
      await fetch("/api/chatbot/sessions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "cancelada" }),
      });
      carregarSessoes();
      setSessaoSelecionada(null);
    } catch (err) {
      console.error(err);
    }
  };

  const deletarSessao = async (id: string) => {
    try {
      await fetch(`/api/chatbot/sessions?id=${id}`, { method: "DELETE" });
      carregarSessoes();
      setSessaoSelecionada(null);
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Renderização ───

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-9rem)]">
        <div className="text-slate-500 text-sm">Carregando chatbot...</div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Bot className="h-5 w-5 text-[#3B64CF]" />
            Chatbot Inteligente
          </h2>
          <p className="text-xs text-slate-400">
            Fluxos de qualificação automática de leads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-[#1c2e4a] text-slate-400"
            onClick={() => {
              carregarFluxos();
              carregarSessoes();
            }}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex gap-2 mb-4">
        <Button
          variant={activeTab === "flows" ? "default" : "outline"}
          size="sm"
          className={`h-8 text-xs ${
            activeTab === "flows"
              ? "bg-[#15317B] text-white"
              : "border-[#1c2e4a] text-slate-400"
          }`}
          onClick={() => setActiveTab("flows")}
        >
          <Settings className="h-3 w-3 mr-1" />
          Fluxos
        </Button>
        <Button
          variant={activeTab === "sessions" ? "default" : "outline"}
          size="sm"
          className={`h-8 text-xs ${
            activeTab === "sessions"
              ? "bg-[#15317B] text-white"
              : "border-[#1c2e4a] text-slate-400"
          }`}
          onClick={() => setActiveTab("sessions")}
        >
          <MessageSquare className="h-3 w-3 mr-1" />
          Sessões
          {sessoes.filter(s => s.status === "ativa").length > 0 && (
            <Badge className="ml-1 h-4 text-[9px] bg-[#3B64CF]">
              {sessoes.filter(s => s.status === "ativa").length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "flows" ? (
          <FluxosTab fluxos={fluxos} onToggle={toggleFluxo} />
        ) : (
          <SessoesTab
            sessoes={sessoes}
            sessaoSelecionada={sessaoSelecionada}
            mensagens={mensagens}
            onSelecionar={setSessaoSelecionada}
            onEncerrar={encerrarSessao}
            onDeletar={deletarSessao}
            filtroStatus={filtroStatus}
            onFiltroChange={setFiltroStatus}
          />
        )}
      </div>
    </div>
  );
}

// ─── Tab de Fluxos ───

function FluxosTab({
  fluxos,
  onToggle,
}: {
  fluxos: ChatbotFlow[];
  onToggle: (id: string, ativo: boolean) => void;
}) {
  return (
    <div className="h-full overflow-y-auto space-y-3">
      {fluxos.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
          <Bot className="h-12 w-12 mb-4 text-slate-600" />
          <p className="text-sm">Nenhum fluxo configurado</p>
          <p className="text-xs text-slate-600 mt-1">
            Crie fluxos de qualificação automática
          </p>
        </div>
      ) : (
        fluxos.map((fluxo) => (
          <Card
            key={fluxo.id}
            className="border-[#1c2e4a] bg-[#14233c]"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-white">
                      {fluxo.nome}
                    </h3>
                    <Badge
                      variant="secondary"
                      className={`text-[9px] ${
                        fluxo.ativo
                          ? "bg-green-500/20 text-green-400"
                          : "bg-slate-500/20 text-slate-400"
                      }`}
                    >
                      {fluxo.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  {fluxo.descricao && (
                    <p className="text-xs text-slate-400 mb-2">
                      {fluxo.descricao}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {fluxo.stats.total} sessões
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fluxo.stats.ativas} ativas
                    </span>
                    {fluxo.instancia && (
                      <span className="flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        {fluxo.instancia}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-white"
                    onClick={() => onToggle(fluxo.id, fluxo.ativo)}
                  >
                    {fluxo.ativo ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// ─── Tab de Sessões ───

function SessoesTab({
  sessoes,
  sessaoSelecionada,
  mensagens,
  onSelecionar,
  onEncerrar,
  onDeletar,
  filtroStatus,
  onFiltroChange,
}: {
  sessoes: ChatSession[];
  sessaoSelecionada: ChatSession | null;
  mensagens: ChatMessage[];
  onSelecionar: (s: ChatSession | null) => void;
  onEncerrar: (id: string) => void;
  onDeletar: (id: string) => void;
  filtroStatus: string;
  onFiltroChange: (v: string) => void;
}) {
  return (
    <div className="h-full flex gap-4 overflow-hidden">
      {/* Lista de Sessões */}
      <div className="w-1/3 flex flex-col min-h-0">
        <div className="shrink-0 flex items-center gap-2 mb-3">
          <Select value={filtroStatus} onValueChange={onFiltroChange}>
            <SelectTrigger className="w-[120px] h-7 text-[11px] bg-[#14233c] border-[#1c2e4a] text-slate-300">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-[#14233c] border-[#1c2e4a]">
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativa">Ativas</SelectItem>
              <SelectItem value="concluida">Concluídas</SelectItem>
              <SelectItem value="encaminhada">Encaminhadas</SelectItem>
              <SelectItem value="timeout">Timeout</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {sessoes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <MessageSquare className="h-8 w-8 mb-2 text-slate-600" />
              <p className="text-xs">Nenhuma sessão</p>
            </div>
          ) : (
            sessoes.map((sessao) => (
              <div
                key={sessao.id}
                onClick={() => onSelecionar(sessao)}
                className={`p-3 rounded-lg cursor-pointer transition-all border ${
                  sessaoSelecionada?.id === sessao.id
                    ? "bg-[#15317B]/20 border-[#15317B]/50"
                    : "bg-[#14233c] border-[#1c2e4a] hover:border-[#3B64CF]/30"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-white">
                    {sessao.nome_lead || sessao.telefone}
                  </span>
                  <Badge
                    variant="secondary"
                    className={`text-[9px] ${
                      sessao.status === "ativa"
                        ? "bg-green-500/20 text-green-400"
                        : sessao.status === "concluida"
                        ? "bg-blue-500/20 text-blue-400"
                        : "bg-slate-500/20 text-slate-400"
                    }`}
                  >
                    {sessao.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>{sessao.telefone}</span>
                  {sessao.classificacao && (
                    <Badge
                      variant="secondary"
                      className={`text-[9px] ${
                        sessao.classificacao === "A"
                          ? "bg-red-500/20 text-red-400"
                          : sessao.classificacao === "B"
                          ? "bg-orange-500/20 text-orange-400"
                          : sessao.classificacao === "C"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-slate-500/20 text-slate-400"
                      }`}
                    >
                      {sessao.classificacao}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detalhes da Sessão */}
      <div className="flex-1 flex flex-col min-h-0">
        {sessaoSelecionada ? (
          <SessaoDetalhes
            sessao={sessaoSelecionada}
            mensagens={mensagens}
            onEncerrar={onEncerrar}
            onDeletar={onDeletar}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            <div className="text-center">
              <Eye className="h-8 w-8 mx-auto mb-2 text-slate-600" />
              <p className="text-xs">Selecione uma sessão para ver detalhes</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detalhes da Sessão ───

function SessaoDetalhes({
  sessao,
  mensagens,
  onEncerrar,
  onDeletar,
}: {
  sessao: ChatSession;
  mensagens: ChatMessage[];
  onEncerrar: (id: string) => void;
  onDeletar: (id: string) => void;
}) {
  return (
    <Card className="flex-1 flex flex-col border-[#1c2e4a] bg-[#14233c] min-h-0">
      <CardHeader className="pb-2 pt-3 px-4 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#3B64CF]" />
            {sessao.nome_lead || sessao.telefone}
          </CardTitle>
          <div className="flex items-center gap-2">
            {sessao.status === "ativa" && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => onEncerrar(sessao.id)}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Encerrar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] border-red-700/30 text-red-500 hover:bg-red-700/10"
              onClick={() => {
                if (confirm('Deletar esta sessão e todas as mensagens?')) {
                  onDeletar(sessao.id);
                }
              }}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Deletar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-hidden p-0 flex flex-col">
        {/* Info */}
        <div className="px-4 py-2 border-b border-[#1c2e4a] shrink-0">
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span>{sessao.telefone}</span>
            <span>Etapa: {sessao.step_atual}</span>
            {sessao.classificacao && (
              <Badge
                variant="secondary"
                className={`text-[9px] ${
                  sessao.classificacao === "A"
                    ? "bg-red-500/20 text-red-400"
                    : sessao.classificacao === "B"
                    ? "bg-orange-500/20 text-orange-400"
                    : sessao.classificacao === "C"
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-slate-500/20 text-slate-400"
                }`}
              >
                Lead {sessao.classificacao}
              </Badge>
            )}
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {mensagens.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.remetente === "cliente" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.remetente === "cliente"
                    ? "bg-[#15317B] text-white"
                    : "bg-[#1c2e4a] text-slate-300"
                }`}
              >
                <p className="text-xs whitespace-pre-wrap">{msg.conteudo}</p>
                <p className="text-[9px] text-slate-500 mt-1">
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR")}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Respostas Coletadas */}
        {Object.keys(sessao.respostas).length > 0 && (
          <div className="px-4 py-2 border-t border-[#1c2e4a] shrink-0">
            <p className="text-[10px] text-slate-500 mb-1">Respostas:</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(sessao.respostas).map(([chave, valor]) => (
                <Badge
                  key={chave}
                  variant="secondary"
                  className="text-[9px] bg-[#1c2e4a] text-slate-300"
                >
                  {chave}: {typeof valor === "object" ? valor.texto || valor.chave : String(valor)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
