"use client";

import { useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { Plus, MoreHorizontal, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { tarefas as tarefasIniciais, Tarefa, iconesTarefa, coresPrioridade } from "@/lib/data/mock";
import { cn } from "@/lib/utils";

const colunas = [
  { id: "a_fazer", titulo: "A Fazer", cor: "bg-slate-100" },
  { id: "em_andamento", titulo: "Andamento", cor: "bg-blue-50" },
  { id: "concluida", titulo: "Concluído", cor: "bg-emerald-50" },
];

export function KanbanTarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>(tarefasIniciais);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId) return;

    setTarefas((prev) =>
      prev.map((t) =>
        t.id === draggableId
          ? { ...t, coluna: destination.droppableId as Tarefa["coluna"] }
          : t
      )
    );
  };

  const getTarefasPorColuna = (colunaId: string) =>
    tarefas.filter((t) => t.coluna === colunaId);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            📋 Kanban de Tarefas
          </CardTitle>
          <Button size="sm" className="gap-1 h-7 text-xs">
            <Plus className="h-3.5 w-3.5" />
            Nova Tarefa
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-3 gap-3 px-3 pb-3 h-full overflow-hidden">
            {colunas.map((coluna) => (
              <div
                key={coluna.id}
                className={cn(
                  "flex flex-col rounded-lg",
                  coluna.cor
                )}
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
                                  "bg-white rounded-lg p-2 shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing",
                                  snapshot.isDragging && "shadow-lg ring-2 ring-blue-500 rotate-2"
                                )}
                              >
                                <div className="flex items-start justify-between mb-1">
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      "text-[10px] px-1.5 py-0.5",
                                      coresPrioridade[tarefa.prioridade]
                                    )}
                                  >
                                    {tarefa.prioridade === "urgente" && (
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                    )}
                                    {tarefa.prioridade}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 -mr-1 -mt-1"
                                  >
                                    <MoreHorizontal className="h-4 w-4 text-slate-400" />
                                  </Button>
                                </div>

                                <p className="font-medium text-slate-900 text-xs mb-1">
                                  {iconesTarefa[tarefa.tipo]} {tarefa.titulo}
                                </p>

                                <div className="flex items-center justify-between text-xs text-slate-500">
                                  <span className="truncate max-w-[100px]">
                                    {tarefa.cliente}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {tarefa.hora}
                                  </span>
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
      </CardContent>
    </Card>
  );
}
