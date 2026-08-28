"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Check, Trash2, MessageCircle, Mail, AlertTriangle, Target, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  dados: Record<string, any>;
  lida: boolean;
  created_at: string;
}

interface PreferenciasNotificacoes {
  canal_push: boolean;
  som_ativado: boolean;
  notif_atendimentos: boolean;
  notif_tarefas: boolean;
  notif_oportunidades: boolean;
  notif_metas_campanhas: boolean;
  notif_prospeccao: boolean;
}

const iconesPorTipo: Record<string, any> = {
  atendimento_novo: MessageCircle,
  atendimento_mensagem: MessageCircle,
  tarefa_nova: Mail,
  transbordo: AlertTriangle,
  meta_alcancada: Target,
};

const coresPorTipo: Record<string, string> = {
  atendimento_novo: "bg-emerald-500/20 text-emerald-400",
  atendimento_mensagem: "bg-blue-500/20 text-blue-400",
  tarefa_nova: "bg-purple-500/20 text-purple-400",
  transbordo: "bg-amber-500/20 text-amber-400",
  meta_alcancada: "bg-emerald-500/20 text-emerald-400",
};

export function NotificacoesBell() {
  const [aberto, setAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [toastNotif, setToastNotif] = useState<Notificacao | null>(null);
  const [prefs, setPrefs] = useState<PreferenciasNotificacoes | null>(null);
  const [audio] = useState(() => {
    if (typeof Audio !== "undefined") {
      return new Audio("/sounds/notification.wav");
    }
    return null;
  });
  const supabase = createClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const notificacoesIdsRef = useRef<Set<string>>(new Set());

  // Verifica se uma notificação deve ser mostrada de acordo com as preferências
  const deveMostrarNotif = useCallback((tipo: string): boolean => {
    if (!prefs) return false; // não mostra nada até carregar prefs
    if (!prefs.canal_push) return false;

    const tipoLower = tipo.toLowerCase();
    if (tipoLower.includes("atendimento") || tipoLower.includes("transbordo")) {
      return prefs.notif_atendimentos;
    }
    if (tipoLower.includes("tarefa") || tipoLower.includes("prospec")) {
      return prefs.notif_tarefas;
    }
    if (tipoLower.includes("oportunidade")) {
      return prefs.notif_oportunidades;
    }
    if (tipoLower.includes("meta") || tipoLower.includes("campanha")) {
      return prefs.notif_metas_campanhas;
    }
    return true;
  }, [prefs]);

  const fetchNotificacoes = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/notificacoes", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      const novasNotifs: Notificacao[] = data.notificacoes || [];
      const novasNaoLidas = data.naoLidas || 0;

      // Detecta notificações novas usando ref (sem dependência do state)
      const idsAnteriores = notificacoesIdsRef.current;
      const notifsRealmenteNovas = novasNotifs.filter((n) => !idsAnteriores.has(n.id) && !n.lida);

      // Atualiza o ref com os IDs atuais
      notificacoesIdsRef.current = new Set(novasNotifs.map((n) => n.id));

      setNotificacoes(novasNotifs);
      setNaoLidas(novasNaoLidas);

      // Mostra toast e toca som apenas para notificações permitidas
      const notifParaToast = notifsRealmenteNovas.find((n) => deveMostrarNotif(n.tipo));
      if (notifParaToast) {
        setToastNotif(notifParaToast);
        if (audio && prefs?.som_ativado !== false) {
          audio.play().catch(() => {});
        }
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToastNotif(null), 5000);
      }
    } catch (err) {
      console.error("Erro ao buscar notificações:", err);
    }
  }, [supabase, audio, prefs, deveMostrarNotif]);

  // Busca preferências de notificações (direto do Supabase)
  useEffect(() => {
    async function fetchPrefs() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error } = await supabase
          .from("preferencias_notificacoes")
          .select("*")
          .eq("user_id", user.id)
          .single();
        // Ignora erros de tabela inexistente (406/42P01) ou registro não encontrado
        if (error && (error.code === "PGRST116" || error.message?.includes("does not exist") || error.code === "42P01")) return;
        if (error) return;
        if (data) {
          setPrefs({
            canal_push: data.canal_push ?? true,
            som_ativado: data.som_ativado ?? true,
            notif_atendimentos: data.notif_atendimentos ?? true,
            notif_tarefas: data.notif_tarefas ?? true,
            notif_oportunidades: data.notif_oportunidades ?? true,
            notif_metas_campanhas: data.notif_metas_campanhas ?? true,
            notif_prospeccao: data.notif_prospeccao ?? true,
          });
        }
      } catch {
        // silent fail - tabela pode não existir
      }
    }
    fetchPrefs();
  }, [supabase]);

  // Busca inicial e polling a cada 120s (pausa quando aba invisível)
  // Reduzido de 60s para 120s para economizar recursos na Vercel (plano free)
  useEffect(() => {
    fetchNotificacoes();
    let interval: NodeJS.Timeout;
    
    const startPolling = () => {
      interval = setInterval(fetchNotificacoes, 120000);
    };
    
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchNotificacoes();
        startPolling();
      } else {
        clearInterval(interval);
      }
    };
    
    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchNotificacoes]);

  // Realtime removido: o Supabase Realtime estava causando reconexões WebSocket em loop,
  // sobrecarregando o navegador. O polling a cada 30s (acima) já mantém as notificações atualizadas.
  // Quando o Realtime for habilitado no dashboard do Supabase, pode-se restaurar este useEffect.

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const marcarComoLida = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/notificacoes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
        setNaoLidas((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const marcarTodasComoLidas = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/notificacoes", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ todas: true }),
      });

      if (res.ok) {
        setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
        setNaoLidas(0);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const excluirNotificacao = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/notificacoes?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const removida = notificacoes.find((n) => n.id === id);
        setNotificacoes((prev) => prev.filter((n) => n.id !== id));
        if (removida && !removida.lida) {
          setNaoLidas((prev) => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatarTempo = (data: string) => {
    const agora = new Date();
    const notif = new Date(data);
    const diff = Math.floor((agora.getTime() - notif.getTime()) / 1000);
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Botão do sininho */}
      <Button
        variant="ghost"
        size="icon"
        className="relative text-white/60 hover:text-white hover:bg-white/10"
        onClick={() => setAberto(!aberto)}
      >
        <Bell className="h-5 w-5" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#0D3B33]">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {aberto && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#0f1d32] rounded-xl shadow-xl border border-white/10 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="font-semibold text-sm text-white">Notificações</h3>
            {naoLidas > 0 && (
              <button
                onClick={marcarTodasComoLidas}
                className="text-xs text-[#14919B] hover:text-[#14919B]/80 font-medium"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <ScrollArea className="h-[400px]">
            {notificacoes.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-white/30">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhuma notificação
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notificacoes.map((n) => {
                  const Icone = iconesPorTipo[n.tipo] || Bell;
                  const cor = coresPorTipo[n.tipo] || "bg-white/10 text-white/60";
                  return (
                    <div
                      key={n.id}
                      className={`px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors ${
                        !n.lida ? "bg-[#14919B]/10" : ""
                      }`}
                      onClick={() => !n.lida && marcarComoLida(n.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${cor}`}>
                          <Icone className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white break-words">
                            {n.titulo}
                          </p>
                          <p className="text-xs text-white/50 mt-0.5 break-words">
                            {n.mensagem}
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-white/30">{formatarTempo(n.created_at)}</span>
                            {!n.lida && (
                              <Badge variant="secondary" className="h-4 text-[9px] bg-[#14919B]/20 text-[#14919B] px-1.5">
                                Nova
                              </Badge>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => excluirNotificacao(n.id, e)}
                          className="text-white/20 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Toast flutuante */}
      {toastNotif && (
        <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 fade-in duration-300">
          <div
            className="bg-[#0f1d32] rounded-lg shadow-lg border border-white/10 p-4 w-80 cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => {
              setToastNotif(null);
              setAberto(true);
            }}
          >
            <div className="flex items-start gap-3">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${coresPorTipo[toastNotif.tipo] || "bg-white/10 text-white/60"}`}>
                {(() => {
                  const Icone = iconesPorTipo[toastNotif.tipo] || Bell;
                  return <Icone className="h-4 w-4" />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{toastNotif.titulo}</p>
                <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{toastNotif.mensagem}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
