"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { PerformanceRealTime } from "@/components/features/atendimento/performance-realtime";
import { ListaAtendimentosLateral } from "@/components/features/atendimento/lista-atendimentos-lateral";
import { ChatInline } from "@/components/features/atendimento/chat-inline";
import { TogglePresenca } from "@/components/features/atendimento/toggle-presenca";
import { Search } from "lucide-react";
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

export default function AtendimentoPage() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loadingAtendimentos, setLoadingAtendimentos] = useState(true);
  const supabase = createClient();

  // Filtros gerais (busca + data — status agora é por componente)
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

  // Estado do chat inline
  const [atendimentoChat, setAtendimentoChat] = useState<Atendimento | null>(null);

  const fetchAtendimentos = useCallback(async (silent = false) => {
    if (!silent) setLoadingAtendimentos(true);
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
      if (!silent) setLoadingAtendimentos(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAtendimentos();
  }, [fetchAtendimentos]);

  // Polling: atualiza lista a cada 15s em background (sem loading visual)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAtendimentos(true); // silent = true
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchAtendimentos]);

  const naoLidosCount = atendimentos.filter((a) => a.nao_lido).length;

  const handleAbrirChat = (a: Atendimento) => {
    setAtendimentoChat(a);
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
        setAtendimentoChat(null);
        await fetchAtendimentos();
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

      {/* WhatsApp Web: Lista + Chat inline */}
      <div className="flex-1 min-h-0 mt-2 flex gap-0 border border-slate-200 rounded-lg overflow-hidden bg-white">
        {/* Painel esquerdo: Lista de conversas */}
        <div className="w-[380px] min-w-[320px] flex flex-col border-r border-slate-200 bg-white">
          {/* Header da lista */}
          <div className="shrink-0 px-3 py-2.5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">Conversas</h3>
          </div>
          {/* Busca */}
          <div className="shrink-0 px-3 py-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Buscar conversa..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full h-8 text-xs pl-7"
              />
            </div>
          </div>
          {/* Lista de conversas */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ListaAtendimentosLateral
              atendimentos={atendimentosFiltrados}
              loading={loadingAtendimentos}
              onRefresh={fetchAtendimentos}
              onAbrirChat={handleAbrirChat}
            />
          </div>
        </div>

        {/* Painel direito: Chat inline */}
        <div className="flex-1 min-w-0">
          <ChatInline
            atendimento={atendimentoChat}
            onMarcarResolvido={handleFecharAtendimento}
            onMensagemEnviada={fetchAtendimentos}
            onFechar={() => setAtendimentoChat(null)}
          />
        </div>
      </div>
    </div>
  );
}