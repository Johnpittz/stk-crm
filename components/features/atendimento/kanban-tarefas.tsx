"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { MoreHorizontal, Clock, AlertCircle, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { NovaTarefaModal } from "./nova-tarefa-modal";

const colunas = [
  { id: "a_fazer", titulo: "A Fazer", cor: "bg-slate-100" },
  { id: "em_andamento", titulo: "Andamento", cor: "bg-blue-50" },
  { id: "concluida", titulo: "Concluído", cor: "bg-emerald-50" },
];

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

const coresPrioridade: Record<string, string> = {
  baixa: "bg-slate-100 text-slate-700",
  media: "bg-blue-100 text-blue-700",
  alta: "bg-orange-100 text-orange-700",
  urgente: "bg-red-100 text-red-700",
};

interface Tarefa {
  id: string;
  titulo: string;
  tipo: string;
  prioridade: string;
  data_inicio: string | null;
  hora_inicio: string | null;
  coluna_kanban: string;
  ordem: number;
  clientes: { id: string; nome_razao_social: string } | null;
}

export function KanbanTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchTarefas = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/tarefas", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (res.ok) {
        setTarefas(data.tarefas || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTarefas();
  }, [fetchTarefas]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId) return;

    const novaColuna = destination.droppableId;
    const tarefasNaColunaDestino = tarefas.filter((t) => t.coluna_kanban === novaColuna);
    const novaOrdem = tarefasNaColunaDestino.length;

    // Atualiza otimisticamente no UI
    setTarefas((prev) =>
      prev.map((t) =>
        t.id === draggableId
          ? { ...t, coluna_kanban: novaColuna, ordem: novaOrdem }
          : t
      )
    );

    // Chama API para persistir
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch("/api/tarefas", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: draggableId,
          coluna_kanban: novaColuna,
          ordem: novaOrdem,
        }),
      });
    } catch (err) {
      console.error(err);
      // Reverte se erro
      fetchTarefas();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta tarefa?")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/tarefas?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setTarefas((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getTarefasPorColuna = (colunaId: string) =>
    tarefas
      .filter((t) => t.coluna_kanban === colunaId)
      .sort((a, b) => a.ordem - b.ordem);

  const formatHora = (hora: string | null) => {
    if (!hora) return "";
    return hora.substring(0, 5);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            📋 Kanban de Tarefas
          </CardTitle>
          <NovaTarefaModal onSuccess={fetchTarefas} />
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Carregando tarefas...
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-3 gap-3 px-3 pb-3 h-full overflow-hidden">
              {colunas.map((coluna) => (
                <div
                  key={coluna.id}
                  className={cn("flex flex-col rounded-lg", coluna.cor)}
                >
                  {/* Header da Coluna */}
                  <div className="flex items-center justify-between p-2 border-b border-slate-200/50">
                    <h3 className="font-semibold text-sm text-slate-700">{coluna.titulo}</h3>
                    <Badge variant="secondary" className="bg-white/80">
                      {getTarefasPorColuna(coluna.id).length}
                    </Badge>
                  </div>

                  {/* Lista de Tarefas */}
                  <Droppable droppableId={coluna.id}>
                    {(provided, snapshot) => (
                      <ScrollArea className="flex-1 p-2 h-0">
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "space-y-2 min-h-[100px]",
                            snapshot.isDraggingOver && "bg-slate-200/50 rounded-lg"
                          )}
                        >
                          {getTarefasPorColuna(coluna.id).map((tarefa, index) => (
                            <Draggable
                              key={tarefa.id}
                              draggableId={tarefa.id}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "bg-white rounded-lg p-2 shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing group",
                                    snapshot.isDragging && "shadow-lg ring-2 ring-blue-500 rotate-2"
                                  )}
                                >
                                  <div className="flex items-start justify-between mb-1">
                                    <Badge
                                      variant="secondary"
                                      className={cn(
                                        "text-[10px] px-1.5 py-0.5",
                                        coresPrioridade[tarefa.prioridade] || coresPrioridade.media
                                      )}
                                    >
                                      {tarefa.prioridade === "urgente" && (
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                      )}
                                      {tarefa.prioridade}
                                    </Badge>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-slate-400 hover:text-red-500"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(tarefa.id);
                                        }}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                      >
                                        <MoreHorizontal className="h-4 w-4 text-slate-400" />
                                      </Button>
                                    </div>
                                  </div>

                                  <p className="font-medium text-slate-900 text-xs mb-1">
                                    {iconesTarefa[tarefa.tipo] || "📋"} {tarefa.titulo}
                                  </p>

                                  <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span className="truncate max-w-[100px]">
                                      {tarefa.clientes?.nome_razao_social || "—"}
                                    </span>
                                    {tarefa.hora_inicio && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatHora(tarefa.hora_inicio)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      </ScrollArea>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        )}
      </CardContent>
    </Card>
  );
}
