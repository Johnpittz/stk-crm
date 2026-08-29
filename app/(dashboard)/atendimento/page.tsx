"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { PerformanceRealTime } from "@/components/features/atendimento/performance-realtime";
import { ListaAtendimentosLateral } from "@/components/features/atendimento/lista-atendimentos-lateral";
import { ChatInline } from "@/components/features/atendimento/chat-inline";
import { TogglePresenca } from "@/components/features/atendimento/toggle-presenca";
import { ToggleIA } from "@/components/features/atendimento/toggle-ia";
import { PainelContato } from "@/components/features/atendimento/painel-contato";
import { FiltroEtiquetas } from "@/components/features/atendimento/filtro-etiquetas";
import { Search, Calendar, HelpCircle, Bell, Smartphone } from "lucide-react";
import { SimularWhatsAppModal } from "@/components/features/atendimento/simular-whatsapp-modal";
import { createClient } from "@/lib/supabase/client";
import { useUserProfile } from "@/lib/user-profile-context";

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
  instancia?: string | null;
  clientes: { id: string; nome_razao_social: string } | null;
}

interface InstanciaWhatsApp {
  id: string;
  name: string;
  number: string;
  status: string;
}

export default function AtendimentoPage() {
  const userProfile = useUserProfile();
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loadingAtendimentos, setLoadingAtendimentos] = useState(true);
  const supabase = createClient();

  // Filtros gerais (busca + data — status agora é por componente)
  const [busca, setBusca] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // Estado do chat inline e painel de contato
  const [atendimentoChat, setAtendimentoChat] = useState<Atendimento | null>(null);
  const [painelContatoAberto, setPainelContatoAberto] = useState(true);
  const [etiquetaFiltro, setEtiquetaFiltro] = useState<string | null>(null);
  const [atendimentosComEtiquetas, setAtendimentosComEtiquetas] = useState<Record<string, string[]>>({});

  // Dados do perfil vêm do context (server-side)
  const userCargo = userProfile?.cargo || "";
  const userInstance = userProfile?.whatsapp_instance || null;

  // Estado do seletor de instância WhatsApp
  const [instancias, setInstancias] = useState<InstanciaWhatsApp[]>([]);
  const [instanciaSelecionada, setInstanciaSelecionada] = useState<string>("todas");

  // Ref para controlar se deve atualizar a lista durante polling
  const isChatOpenRef = useRef(false);
  const atendimentosMapRef = useRef<Map<string, Atendimento>>(new Map());

  // OTIMIZAÇÃO: Usar endpoint unificado para carregar tudo de uma vez
  const fetchPageData = useCallback(async (silent = false) => {
    if (!silent) setLoadingAtendimentos(true);
    try {
      const res = await fetch("/api/atendimentos/page-data");
      if (!res.ok) return;
      
      const data = await res.json();
      
      // Atendimentos
      const novosAtendimentos = data.atendimentos || [];
      const newMap = new Map<string, Atendimento>();
      for (const a of novosAtendimentos) {
        const existente = atendimentosMapRef.current.get(a.id);
        if (existente && 
            existente.ultima_mensagem === a.ultima_mensagem &&
            existente.ultima_mensagem_data === a.ultima_mensagem_data &&
            existente.nao_lido === a.nao_lido) {
          newMap.set(a.id, existente);
        } else {
          newMap.set(a.id, a);
        }
      }
      atendimentosMapRef.current = newMap;
      setAtendimentos(novosAtendimentos.map((a: Atendimento) => newMap.get(a.id) || a));
      
      // Atualizar chat se aberto
      if (atendimentoChat) {
        const atualizado = newMap.get(atendimentoChat.id);
        if (atualizado) setAtendimentoChat(atualizado);
      }
      
      // Etiquetas
      setAtendimentosComEtiquetas(data.etiquetas || {});
      
      // Instâncias
      if (data.instancias && data.instancias.length > 0) {
        setInstancias(data.instancias);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoadingAtendimentos(false);
    }
  }, [atendimentoChat]);

  // Carregar dados na montagem
  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  // Filtrar atendimentos com useMemo para estabilidade
  const atendimentosFiltrados = useMemo(() => {
    return atendimentos.filter((a) => {
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

      // Filtro por etiqueta
      let matchEtiqueta = true;
      if (etiquetaFiltro) {
        const etiquetasDoAtendimento = atendimentosComEtiquetas[a.id] || [];
        matchEtiqueta = etiquetasDoAtendimento.includes(etiquetaFiltro);
      }

      // Filtro por instância
      let matchInstancia = true;
      if (instanciaSelecionada && instanciaSelecionada !== "todas") {
        matchInstancia = a.instancia === instanciaSelecionada;
      }

      return matchBusca && matchData && matchEtiqueta && matchInstancia;
    });
  }, [atendimentos, busca, dataInicio, dataFim, etiquetaFiltro, atendimentosComEtiquetas, instanciaSelecionada]);

  // Polling: atualiza lista a cada 30s em background (sem loading visual)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPageData(true); // silent = true
    , 10000); // Reduzido para 10s - indicador de mensagem nova aparece mais rápido
    return () => clearInterval(interval);
  }, [fetchPageData]);

  const handleAbrirChat = useCallback(async (a: Atendimento) => {
    const atual = atendimentosMapRef.current.get(a.id) || a;
    setAtendimentoChat(atual);

    // Marcar como lido (nao_lido = false)
    if (atual.nao_lido) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        await fetch("/api/atendimentos", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ id: atual.id, nao_lido: false }),
        });
        setAtendimentos((prev) =>
          prev.map((at) => (at.id === atual.id ? { ...at, nao_lido: false } : at))
        );
      } catch (err) {
        console.error("Erro ao marcar como lido:", err);
      }
    }
  }, [supabase]);

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
        await fetchPageData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Data de hoje formatada (client-only para evitar hydration mismatch)
  const [hoje, setHoje] = useState("");
  useEffect(() => {
    setHoje(
      new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    );
  }, []);

  // Contagem de conversas por instância
  const contarPorInstancia = useCallback((instName: string) => {
    if (instName === "todas") return atendimentos.length;
    return atendimentos.filter(a => a.instancia === instName).length;
  }, [atendimentos]);

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col overflow-hidden">
      
      {/* HEADER COMPACTO — Toggle + IA + Performance + Data + Busca + Ícones */}
      <div className="shrink-0 flex items-center gap-3 mb-2">
        <TogglePresenca />
        <ToggleIA />
        <PerformanceRealTime />

        <div className="flex items-center gap-3 ml-auto shrink-0">
          {/* Data */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-white/40">
            <Calendar className="h-3.5 w-3.5" />
            <span className="capitalize">{hoje}</span>
          </div>

          {/* Botão Simular WhatsApp — apenas para demonstração */}
          {userCargo === "demonstracao" && (
            <SimularWhatsAppModal onSuccess={fetchPageData} />
          )}

          {/* Busca geral */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <Input
              placeholder="Buscar..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-48 h-8 text-xs pl-7 bg-white/10 border-white/10 text-white placeholder:text-white/30 focus:border-[#14919B]"
            />
          </div>

          {/* Botão info painel lateral */}
          <button
            onClick={() => setPainelContatoAberto(!painelContatoAberto)}
            className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors ${
              painelContatoAberto
                ? "bg-[#14919B]/20 border-[#14919B]/30 text-[#14919B]"
                : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
            }`}
            title={painelContatoAberto ? "Fechar painel de contato" : "Abrir painel de contato"}
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* WhatsApp Web 3 COLUNAS: Lista + Chat + Painel Contato */}
      <div className="flex-1 min-h-0 flex border border-white/10 rounded-lg overflow-hidden bg-[#0a1628]">
        
        {/* PAINEL ESQUERDO: Lista de conversas */}
        <div className="w-[320px] min-w-[280px] flex flex-col border-r border-white/10 bg-[#0f1d32]">
          
          {/* SELETOR DE INSTÂNCIA WHATSAPP — apenas gestores veem os botões */}
          {instancias.length > 0 && !userInstance && (
            <div className="shrink-0 px-3 py-2 border-b border-white/10">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <Smartphone className="h-3.5 w-3.5 text-white/30 shrink-0" />
                {/* Botão "Todas" */}
                <button
                  onClick={() => setInstanciaSelecionada("todas")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                    instanciaSelecionada === "todas"
                      ? "bg-[#14919B] text-white"
                      : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                  }`}
                >
                  Todas ({contarPorInstancia("todas")})
                </button>
                {/* Botões por instância */}
                {instancias.map((inst) => (
                  <button
                    key={inst.name}
                    onClick={() => setInstanciaSelecionada(inst.name)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1 ${
                      instanciaSelecionada === inst.name
                        ? "bg-[#14919B] text-white"
                        : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${inst.status === "open" ? "bg-green-400" : "bg-red-400"}`} />
                    {inst.number ? `(${inst.number.slice(-4)})` : inst.name}
                    <span className="text-white/30 ml-0.5">{contarPorInstancia(inst.name)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Busca dentro da lista */}
          <div className="shrink-0 px-3 py-2 border-b border-white/10 space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <Input
                placeholder="Buscar conversa..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full h-8 text-xs pl-7 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#14919B]"
              />
            </div>
            <FiltroEtiquetas
              etiquetaSelecionada={etiquetaFiltro}
              onSelecionar={setEtiquetaFiltro}
            />
          </div>
          {/* Lista */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ListaAtendimentosLateral
              atendimentos={atendimentosFiltrados}
              loading={loadingAtendimentos}
              onRefresh={fetchPageData}
              onAbrirChat={handleAbrirChat}
              etiquetas={atendimentosComEtiquetas}
              selectedId={atendimentoChat?.id}
            />
          </div>
        </div>

        {/* PAINEL CENTRAL: Chat */}
        <div className="flex-1 min-w-0">
          <ChatInline
            atendimento={atendimentoChat}
            onMarcarResolvido={handleFecharAtendimento}
            onMensagemEnviada={fetchPageData}
            onFechar={() => setAtendimentoChat(null)}
            instancia={instanciaSelecionada !== "todas" ? instanciaSelecionada : undefined}
            instancias={instancias}
          />
        </div>

        {/* PAINEL DIREITO: Info do contato — só aparece quando conversa selecionada */}
        {painelContatoAberto && atendimentoChat && (
          <div className="w-[320px] min-w-[280px]">
            <PainelContato
              atendimento={atendimentoChat}
              onFechar={() => setAtendimentoChat(null)}
              onMarcarConcluido={handleFecharAtendimento}
              onEtiquetaChange={fetchPageData}
            />
          </div>
        )}
      </div>
    </div>
  );
}
