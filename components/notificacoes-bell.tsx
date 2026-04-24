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

const iconesPorTipo: Record<string, any> = {
  atendimento_novo: MessageCircle,
  atendimento_mensagem: MessageCircle,
  tarefa_nova: Mail,
  transbordo: AlertTriangle,
  meta_alcancada: Target,
};

const coresPorTipo: Record<string, string> = {
  atendimento_novo: "bg-green-100 text-green-700",
  atendimento_mensagem: "bg-blue-100 text-blue-700",
  tarefa_nova: "bg-purple-100 text-purple-700",
  transbordo: "bg-amber-100 text-amber-700",
  meta_alcancada: "bg-emerald-100 text-emerald-700",
};

export function NotificacoesBell() {
  const [aberto, setAberto] = useState(false);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [toast, setToast] = useState<Notificacao | null>(null);
  const [audio] = useState(() => {
    if (typeof Audio !== "undefined") {
      return new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSA0PVanu8LdnGwU2k9n1unEiBC13yO/eizEIHWq+8+OZURE");
    }
    return null;
  });
  const supabase = createClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  const fetchNotificacoes = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/notificacoes", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;

      const data = await res.json();
      setNotificacoes(data.notificacoes || []);
      setNaoLidas(data.naoLidas || 0);
    } catch (err) {
      console.error("Erro ao buscar notificações:", err);
    }
  }, [supabase]);

  // Busca inicial e polling a cada 10s
  useEffect(() => {
    fetchNotificacoes();
    const interval = setInterval(fetchNotificacoes, 10000);
    return () => clearInterval(interval);
  }, [fetchNotificacoes]);

  // Realtime: escuta novas notificações na tabela
  useEffect(() => {
    const channel = supabase
      .channel("notificacoes-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
        },
        (payload) => {
          const nova = payload.new as Notificacao;
          setNotificacoes((prev) => [nova, ...prev]);
          setNaoLidas((prev) => prev + 1);
          setToast(nova);
          if (audio) audio.play().catch(() => {});

          if (toastTimer.current) clearTimeout(toastTimer.current);
          toastTimer.current = setTimeout(() => setToast(null), 5000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, audio]);

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
        className="relative"
        onClick={() => setAberto(!aberto)}
      >
        <Bell className="h-5 w-5 text-slate-600" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {aberto && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-sm text-slate-800">Notificações</h3>
            {naoLidas > 0 && (
              <button
                onClick={marcarTodasComoLidas}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <ScrollArea className="max-h-80">
            {notificacoes.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhuma notificação
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {notificacoes.map((n) => {
                  const Icone = iconesPorTipo[n.tipo] || Bell;
                  const cor = coresPorTipo[n.tipo] || "bg-slate-100 text-slate-700";
                  return (
                    <div
                      key={n.id}
                      className={`px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                        !n.lida ? "bg-blue-50/50" : ""
                      }`}
                      onClick={() => !n.lida && marcarComoLida(n.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${cor}`}>
                          <Icone className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {n.titulo}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                            {n.mensagem}
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[10px] text-slate-400">{formatarTempo(n.created_at)}</span>
                            {!n.lida && (
                              <Badge variant="secondary" className="h-4 text-[9px] bg-blue-100 text-blue-700 px-1.5">
                                Nova
                              </Badge>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={(e) => excluirNotificacao(n.id, e)}
                          className="text-slate-300 hover:text-red-500 transition-colors shrink-0 mt-0.5"
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
      {toast && (
        <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 fade-in duration-300">
          <div
            className="bg-white rounded-lg shadow-lg border border-slate-200 p-4 w-80 cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => {
              setToast(null);
              setAberto(true);
            }}
          >
            <div className="flex items-start gap-3">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${coresPorTipo[toast.tipo] || "bg-slate-100 text-slate-700"}`}>
                {(() => {
                  const Icone = iconesPorTipo[toast.tipo] || Bell;
                  return <Icone className="h-4 w-4" />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{toast.titulo}</p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{toast.mensagem}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
