"use client";

import { useState, useEffect, useCallback } from "react";
import { Check, MapPin, Phone, MessageCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { ModalDetalhesTarefa } from "./modal-detalhes-tarefa";

const iconesTarefa: Record<string, string> = {
  visita: "🏢",
  ligacao: "📞",
  whatsapp: "💬",
  email: "📧",
  reuniao: "🤝",
  follow_up: "🔄",
  prospeccao: "🔍",
  outro: "📋",
};

interface AgendaItem {
  id: string;
  hora_inicio: string | null;
  titulo: string;
  descricao: string | null;
  clientes: { id: string; nome_razao_social: string } | null;
  tipo: string;
  prioridade: string;
  status: string;
  coluna_kanban: string;
  data_inicio: string | null;
  data_fim: string | null;
  hora_fim: string | null;
  resultado: string | null;
  observacao_resultado: string | null;
}

export function AgendaDia() {
  const [itens, setItens] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tarefaSelecionada, setTarefaSelecionada] = useState<AgendaItem | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [hoje, setHoje] = useState<string>("");
  const [hojeFormatado, setHojeFormatado] = useState<string>("");
  const supabase = createClient();

  useEffect(() => {
    const now = new Date();
    setHoje(now.toISOString().split("T")[0]);
    setHojeFormatado(now.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }));
  }, []);

  const fetchAgenda = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/tarefas?data=${hoje}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (res.ok) {
        setItens(data.tarefas || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, hoje]);

  useEffect(() => {
    fetchAgenda();
  }, [fetchAgenda]);

  const handleConcluir = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/tarefas", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, coluna_kanban: "concluida", status: "concluida" }),
      });

      if (res.ok) {
        setItens((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, coluna_kanban: "concluida", status: "concluida" }
              : item
          )
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isConcluido = (item: AgendaItem) => item.coluna_kanban === "concluida";
  const isEmAndamento = (item: AgendaItem) => item.coluna_kanban === "em_andamento";

  const formatHora = (hora: string | null) => {
    if (!hora) return "—";
    return hora.substring(0, 5);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          📅 Agenda do Dia
          {hojeFormatado && (
            <span className="text-xs font-normal text-slate-400">
              {hojeFormatado}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Carregando...
          </div>
        ) : itens.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Nenhuma tarefa para hoje
          </div>
        ) : (
          <ScrollArea className="h-full px-3">
            <div className="space-y-2 relative">
              {/* Linha do tempo */}
              <div className="absolute left-[52px] top-4 bottom-4 w-px bg-slate-200" />

              {itens.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 relative cursor-pointer hover:bg-slate-50 rounded-lg -mx-1 px-1 py-0.5 transition-colors"
                  onClick={() => {
                    setTarefaSelecionada(item);
                    setModalAberto(true);
                  }}
                >
                  {/* Hora */}
                  <div className="w-12 text-right">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isConcluido(item) ? "text-slate-400" : "text-slate-700"
                      )}
                    >
                      {formatHora(item.hora_inicio)}
                    </span>
                  </div>

                  {/* Marcador */}
                  <div
                    className={cn(
                      "relative z-10 w-3 h-3 rounded-full mt-1.5 border-2",
                      isConcluido(item)
                        ? "bg-emerald-500 border-emerald-500"
                        : isEmAndamento(item)
                        ? "bg-blue-500 border-blue-500 animate-pulse"
                        : "bg-white border-slate-300"
                    )}
                  />

                  {/* Conteúdo */}
                  <div
                    className={cn(
                      "flex-1 pb-4",
                      isConcluido(item) && "opacity-60"
                    )}
                  >
                    <div
                      className={cn(
                        "p-3 rounded-lg border",
                        isConcluido(item)
                          ? "bg-slate-50 border-slate-200"
                          : isEmAndamento(item)
                          ? "bg-blue-50 border-blue-200"
                          : "bg-white border-slate-200"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">
                              {iconesTarefa[item.tipo] || "📋"}
                            </span>
                            <span
                              className={cn(
                                "font-medium text-sm",
                                isConcluido(item)
                                  ? "text-slate-500 line-through"
                                  : "text-slate-900"
                              )}
                            >
                              {item.titulo}
                            </span>
                            {isEmAndamento(item) && (
                              <Badge
                                variant="secondary"
                                className="bg-blue-100 text-blue-700 text-xs"
                              >
                                Agora
                              </Badge>
                            )}
                          </div>

                          {item.clientes?.nome_razao_social && (
                            <p className="text-xs text-slate-500 mb-1">
                              {item.clientes.nome_razao_social}
                            </p>
                          )}

                          {/* Ações */}
                          <div className="flex items-center gap-2 mt-2">
                            {!isConcluido(item) && (
                              <>
                                {item.tipo === "visita" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs gap-1"
                                  >
                                    <MapPin className="h-3 w-3" />
                                    Check-in
                                  </Button>
                                )}
                                {(item.tipo === "ligacao" ||
                                  item.tipo === "whatsapp" ||
                                  item.tipo === "follow_up") && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs gap-1"
                                    >
                                      <Phone className="h-3 w-3" />
                                      Ligar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs gap-1"
                                    >
                                      <MessageCircle className="h-3 w-3" />
                                      Whats
                                    </Button>
                                  </>
                                )}
                              </>
                            )}

                            {isConcluido(item) && (
                              <Badge
                                variant="secondary"
                                className="bg-emerald-100 text-emerald-700 text-xs"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Concluído
                              </Badge>
                            )}
                          </div>
                        </div>

                        {!isConcluido(item) && !isEmAndamento(item) && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-400 hover:text-emerald-600"
                            onClick={() => handleConcluir(item.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      <ModalDetalhesTarefa
        tarefa={tarefaSelecionada as any}
        aberto={modalAberto}
        onClose={() => {
          setModalAberto(false);
          setTarefaSelecionada(null);
        }}
        onAtualizar={fetchAgenda}
      />
    </Card>
  );
}
