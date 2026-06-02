"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PerformanceRealTime } from "@/components/features/atendimento/performance-realtime";
import { KanbanTarefas } from "@/components/features/atendimento/kanban-tarefas";
import { MotorOportunidades } from "@/components/features/atendimento/motor-oportunidades";
import { ListaAtendimentos } from "@/components/features/atendimento/lista-atendimentos";
import { ListaAtendimentosLateral } from "@/components/features/atendimento/lista-atendimentos-lateral";
import { AtendimentoChat } from "@/components/features/atendimento/atendimento-chat";
import { TogglePresenca } from "@/components/features/atendimento/toggle-presenca";
import { ClipboardList, Target, MessageCircle, Search, X, Download, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Atendimento {
  id: string;
  telefone_cliente: string;
  nome_cliente: string;
  assunto: string;
  ultima_mensagem: string;
  ultima_mensagem_data: string;
  status: string;
  transbordado: boolean;
  nao_lido: boolean;
  vendedor_interagiu: boolean;
  ultima_mensagem_remetente: string | null;
  data_fechamento?: string | null;
  clientes: { id: string; nome_razao_social: string } | null;
}

export default function AtendimentoPage() {
  const [abaAtiva, setAbaAtiva] = useState("trabalho");
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loadingAtendimentos, setLoadingAtendimentos] = useState(true);
  const supabase = createClient();

  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("__TODOS__");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const atendimentosFiltrados = atendimentos.filter((a) => {
    const termo = busca.toLowerCase().trim();
    const matchBusca =
      !termo ||
      a.nome_cliente?.toLowerCase().includes(termo) ||
      a.telefone_cliente?.toLowerCase().includes(termo) ||
      a.assunto?.toLowerCase().includes(termo) ||
      a.ultima_mensagem?.toLowerCase().includes(termo);

    const matchStatus =
      filtroStatus === "__TODOS__" || a.status === filtroStatus;

    let matchData = true;
    if (dataInicio || dataFim) {
      const dataMsg = a.ultima_mensagem_data
        ? new Date(a.ultima_mensagem_data)
        : null;
      if (dataMsg) {
        const inicio = dataInicio ? new Date(dataInicio + "T00:00:00") : null;
        const fim = dataFim ? new Date(dataFim + "T23:59:59") : null;
        if (inicio && dataMsg < inicio) matchData = false;
        if (fim && dataMsg > fim) matchData = false;
      }
    }

    return matchBusca && matchStatus && matchData;
  });

  // Estado do chat
  const [chatAberto, setChatAberto] = useState(false);
  const [atendimentoChat, setAtendimentoChat] = useState<Atendimento | null>(null);

  const fetchAtendimentos = useCallback(async () => {
    setLoadingAtendimentos(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/atendimentos", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (res.ok) {
        setAtendimentos(data.atendimentos || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAtendimentos(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAtendimentos();
  }, [fetchAtendimentos]);

  const naoLidosCount = atendimentos.filter((a) => a.nao_lido).length;

  const handleAbrirChat = (a: Atendimento) => {
    setAtendimentoChat(a);
    setChatAberto(true);
  };

  const handleFecharChat = () => {
    setChatAberto(false);
    setAtendimentoChat(null);
  };

  const handleFecharAtendimento = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/atendimentos", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, status: "fechado" }),
      });

      if (res.ok) {
        fetchAtendimentos();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col overflow-hidden">
      
      {/* HEADER - Toggle + Performance */}
      <div className="shrink-0 space-y-2">
        <TogglePresenca />
        <PerformanceRealTime />
      </div>

      {/* ABAS */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="flex-1 flex flex-col min-h-0 mt-2">
        <TabsList className="grid w-full grid-cols-3 h-9 shrink-0">
          <TabsTrigger value="trabalho" className="gap-1 text-xs">
            <ClipboardList className="h-3.5 w-3.5" />
            Meu Trabalho
          </TabsTrigger>
          <TabsTrigger value="oportunidades" className="gap-1 text-xs">
            <Target className="h-3.5 w-3.5" />
            Oportunidades
          </TabsTrigger>
          <TabsTrigger value="atendimentos" className="gap-1 text-xs relative">
            <MessageCircle className="h-3.5 w-3.5" />
            Atendimentos
            {naoLidosCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {naoLidosCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* FILTROS — visíveis em todas as abas que usam atendimentos */}
        <div className="shrink-0 flex items-center gap-2 flex-wrap mt-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Buscar por nome, telefone..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-[220px] h-8 text-xs pl-7"
            />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__TODOS__">Todos os status</SelectItem>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="fechado">Fechado</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-[130px] h-8 text-xs"
            />
            <span className="text-slate-400 text-xs">→</span>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-[130px] h-8 text-xs"
            />
          </div>
          {(busca || filtroStatus !== "__TODOS__" || dataInicio || dataFim) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => {
                setBusca("");
                setFiltroStatus("__TODOS__");
                setDataInicio("");
                setDataFim("");
              }}
            >
              <X className="h-3 w-3" />
              Limpar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => {
              const csv = [
                ["Nome", "Telefone", "Status", "Última Mensagem", "Data"],
                ...atendimentosFiltrados.map((a) => [
                  `"${(a.nome_cliente || "").replace(/"/g, "'")}"`,
                  `"${a.telefone_cliente || ""}"`,
                  a.status,
                  `"${(a.ultima_mensagem || "").replace(/"/g, "'")}"`,
                  a.ultima_mensagem_data
                    ? new Date(a.ultima_mensagem_data).toLocaleString("pt-BR")
                    : "",
                ]),
              ]
                .map((row) => row.join(";"))
                .join("\n");
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `atendimentos_${new Date().toISOString().split("T")[0]}.csv`;
              link.click();
            }}
            disabled={atendimentosFiltrados.length === 0}
          >
            <Download className="h-3 w-3" />
            Exportar CSV
          </Button>
        </div>

        <div className="flex-1 min-h-0 mt-2 overflow-hidden">
          
          {/* ABA 1: MEU TRABALHO — Kanban (2/3) + Atendimentos Lateral (1/3) */}
          <TabsContent value="trabalho" className="h-full mt-0 data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 h-full">
              <div className="lg:col-span-2 h-full overflow-hidden">
                <KanbanTarefas
                  atendimentos={atendimentosFiltrados}
                  onAbrirChat={handleAbrirChat}
                />
              </div>
              <div className="h-full overflow-hidden">
                <ListaAtendimentosLateral
                  atendimentos={atendimentosFiltrados}
                  loading={loadingAtendimentos}
                  onRefresh={fetchAtendimentos}
                  onAbrirChat={handleAbrirChat}
                />
              </div>
            </div>
          </TabsContent>

          {/* ABA 2: OPORTUNIDADES */}
          <TabsContent value="oportunidades" className="h-full mt-0 data-[state=inactive]:hidden">
            <div className="h-full overflow-hidden">
              <MotorOportunidades />
            </div>
          </TabsContent>

          {/* ABA 3: ATENDIMENTOS WHATSAPP */}
          <TabsContent value="atendimentos" className="h-full mt-0 data-[state=inactive]:hidden">
            <div className="h-full overflow-hidden">
              <ListaAtendimentos
                atendimentos={atendimentosFiltrados}
                loading={loadingAtendimentos}
                onRefresh={fetchAtendimentos}
                onAbrirChat={handleAbrirChat}
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Chat global */}
      <AtendimentoChat
        atendimento={atendimentoChat}
        open={chatAberto}
        onClose={handleFecharChat}
        onMarcarResolvido={handleFecharAtendimento}
        onMensagemEnviada={fetchAtendimentos}
      />
    </div>
  );
}
