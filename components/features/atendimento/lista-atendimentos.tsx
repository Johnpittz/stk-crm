"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageCircle, Phone, Check, X, Loader2, User, Hand } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { SimularWhatsAppModal } from "./simular-whatsapp-modal";
import { AtendimentoChat } from "./atendimento-chat";

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
  ultima_mensagem_remetente: string | null;
  clientes: { id: string; nome_razao_social: string } | null;
}

export function ListaAtendimentos() {
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatAberto, setChatAberto] = useState(false);
  const [atendimentoSelecionado, setAtendimentoSelecionado] = useState<Atendimento | null>(null);
  const supabase = createClient();

  const fetchAtendimentos = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAtendimentos();
  }, [fetchAtendimentos]);

  // Realtime: escuta atualizações na tabela atendimentos
  useEffect(() => {
    const channel = supabase
      .channel("atendimentos-realtime-lista")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "atendimentos",
        },
        (payload) => {
          const atualizado = payload.new as Atendimento;
          setAtendimentos((prev) =>
            prev.map((a) =>
              a.id === atualizado.id
                ? { ...a, ultima_mensagem: atualizado.ultima_mensagem, ultima_mensagem_data: atualizado.ultima_mensagem_data }
                : a
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const handleFechar = async (id: string) => {
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
        setAtendimentos((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssumir = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/atendimentos", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, assumir: true }),
      });

      if (res.ok) {
        // Remove da lista local (vai para o kanban)
        setAtendimentos((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatData = (data: string) => {
    if (!data) return "";
    const d = new Date(data);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-green-600" />
            Atendimentos WhatsApp
            <Badge variant="secondary">{atendimentos.length}</Badge>
          </CardTitle>
          <SimularWhatsAppModal onSuccess={fetchAtendimentos} />
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Carregando...
          </div>
        ) : atendimentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-3">
            <p>Nenhum atendimento pendente</p>
            <SimularWhatsAppModal onSuccess={fetchAtendimentos} />
          </div>
        ) : (
          <ScrollArea className="h-full px-3">
            <div className="space-y-2">
              {atendimentos.map((a) => (
                <div
                  key={a.id}
                  className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm cursor-pointer hover:border-green-300 hover:shadow-md transition-all"
                  onClick={() => {
                    setAtendimentoSelecionado(a);
                    setChatAberto(true);
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-sm", a.nao_lido ? "font-bold text-slate-900" : "font-semibold text-slate-700")}>
                          {a.clientes?.nome_razao_social || a.nome_cliente || "Cliente nao identificado"}
                        </span>
                        {a.nao_lido && (
                          <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" title="Nova mensagem" />
                        )}
                        {a.transbordado && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px]">
                            Transbordado
                          </Badge>
                        )}
                        {!a.transbordado && !a.clientes && (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-[10px]">
                            Não atribuído
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {a.telefone_cliente}
                      </p>

                      {a.ultima_mensagem && (
                        <p className={cn("text-xs mt-1 bg-slate-50 p-2 rounded", a.nao_lido ? "text-slate-900 font-medium" : "text-slate-500")}>
                          {a.ultima_mensagem_remetente === 'vendedor' ? (
                            <span className="text-slate-400">Você: </span>
                          ) : null}
                          {a.ultima_mensagem}
                        </p>
                      )}

                      {a.ultima_mensagem_data && (
                        <p className="text-[10px] text-slate-400 mt-1">
                          {formatData(a.ultima_mensagem_data)}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                          <Phone className="h-3 w-3" />
                          Ligar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-green-600 text-green-700 hover:bg-green-50">
                          <MessageCircle className="h-3 w-3" />
                          Whats
                        </Button>
                        {!a.clientes && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 border-purple-600 text-purple-700 hover:bg-purple-50"
                            onClick={() => handleAssumir(a.id)}
                          >
                            <Hand className="h-3 w-3" />
                            Assumir
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => handleFechar(a.id)}
                        title="Marcar como resolvido"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <AtendimentoChat
        atendimento={atendimentoSelecionado}
        open={chatAberto}
        onClose={() => {
          setChatAberto(false);
          setAtendimentoSelecionado(null);
        }}
        onMarcarResolvido={handleFechar}
        onMensagemEnviada={fetchAtendimentos}
      />
    </Card>
  );
}
