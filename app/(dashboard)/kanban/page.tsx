"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { KanbanTarefas } from "@/components/features/atendimento/kanban-tarefas";
import { PerformanceKanban } from "@/components/features/atendimento/performance-kanban";
import { createClient } from "@/lib/supabase/client";

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

export default function KanbanPage() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loadingAtendimentos, setLoadingAtendimentos] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const supabase = createClient();

  const [busca, setBusca] = useState("");
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

    return matchBusca && matchData;
  });

  const fetchAtendimentos = useCallback(async () => {
    setLoadingAtendimentos(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col overflow-hidden">
      {/* Métricas */}
      <div className="shrink-0">
        <PerformanceKanban refreshTrigger={refreshTrigger} />
      </div>

      {/* Filtros */}
      <div className="shrink-0 flex items-center gap-2 flex-wrap mt-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input
            placeholder="Buscar cliente, tarefa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-[220px] h-8 text-xs pl-7 bg-[#14233c] border-[#1c2e4a] text-white placeholder:text-slate-500"
          />
        </div>
        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="w-[130px] h-8 text-xs bg-[#14233c] border-[#1c2e4a] text-white"
          />
          <span className="text-slate-500 text-xs">→</span>
          <Input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="w-[130px] h-8 text-xs bg-[#14233c] border-[#1c2e4a] text-white"
          />
        </div>
        {(busca || dataInicio || dataFim) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1 text-slate-400 hover:text-white hover:bg-white/5"
            onClick={() => {
              setBusca("");
              setDataInicio("");
              setDataFim("");
            }}
          >
            <X className="h-3 w-3" />
            Limpar
          </Button>
        )}
      </div>

      {/* Kanban */}
      <div className="flex-1 min-h-0 mt-3 overflow-hidden">
        <KanbanTarefas
          atendimentos={atendimentosFiltrados}
          onAbrirChat={() => {}}
          onRefresh={fetchAtendimentos}
          onTarefaAtualizada={() => setRefreshTrigger((t) => t + 1)}
          busca={busca}
          dataInicio={dataInicio}
          dataFim={dataFim}
        />
      </div>
    </div>
  );
}
