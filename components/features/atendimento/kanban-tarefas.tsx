"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { MoreHorizontal, Clock, AlertCircle, Trash2, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { NovaTarefaModal } from "./nova-tarefa-modal";
import { ModalDetalhesTarefa } from "./modal-detalhes-tarefa";
import { CardAtendimentoKanban } from "./card-atendimento-kanban";

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

const origemConfig: Record<string, { icone: string; nome: string; cor: string }> = {
  prospeccao_b2b: { icone: "🔍", nome: "Prospecção", cor: "bg-emerald-100 text-emerald-700" },
  whatsapp: { icone: "💬", nome: "WhatsApp", cor: "bg-green-100 text-green-700" },
  indicacao: { icone: "🤝", nome: "Indicação", cor: "bg-purple-100 text-purple-700" },
  site: { icone: "🌐", nome: "Site", cor: "bg-blue-100 text-blue-700" },
  pixel: { icone: "📊", nome: "Pixel", cor: "bg-orange-100 text-orange-700" },
  api: { icone: "🔗", nome: "API", cor: "bg-cyan-100 text-cyan-700" },
  importacao: { icone: "📁", nome: "Importação", cor: "bg-slate-100 text-slate-700" },
  manual: { icone: "✋", nome: "Manual", cor: "bg-slate-100 text-slate-500" },
  evento: { icone: "🎪", nome: "Evento", cor: "bg-amber-100 text-amber-700" },
};

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  prioridade: string;
  status: string;
  data_inicio: string | null;
  hora_inicio: string | null;
  data_fim: string | null;
  hora_fim: string | null;
  resultado: string | null;
  observacao_resultado: string | null;
  coluna_kanban: string;
  ordem: number;
  origem_lead: string | null;
  created_at: string;
  clientes: { id: string; nome_razao_social: string } | null;
}

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

interface KanbanTarefasProps {
  atendimentos: Atendimento[];
  onAbrirChat: (a: Atendimento) => void;
  onRefresh?: () => void;
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
}

export function KanbanTarefas({ atendimentos, onAbrirChat, onRefresh, busca = "", dataInicio = "", dataFim = "" }: KanbanTarefasProps) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [tarefaSelecionada, setTarefaSelecionada] = useState<Tarefa | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalConcluindo, setModalConcluindo] = useState(false);
  const [filtroColuna, setFiltroColuna] = useState("__TODAS__");
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

  // Recarrega tarefas quando atendimentos mudam externamente
  useEffect(() => {
    if (onRefresh) fetchTarefas();
  }, [atendimentos, onRefresh, fetchTarefas]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId) return;

    const novaColuna = destination.droppableId;

    // Se arrastou para "Concluído", abre o modal para preencher resultado
    if (novaColuna === "concluida") {
      const tarefaArrastada = tarefas.find((t) => t.id === draggableId);
      if (tarefaArrastada) {
        setTarefaSelecionada(tarefaArrastada);
        setModalConcluindo(true);
        setModalAberto(true);
        // Não move ainda — o modal vai cuidar da conclusão
        return;
      }
    }

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

  const tarefasFiltradas = tarefas.filter((t) => {
    const termo = busca.toLowerCase().trim();
    const matchBusca =
      !termo ||
      t.titulo?.toLowerCase().includes(termo) ||
      t.descricao?.toLowerCase().includes(termo) ||
      t.clientes?.nome_razao_social?.toLowerCase().includes(termo);

    let matchData = true;
    const temFiltroData = !!(dataInicio || dataFim);
    if (temFiltroData) {
      const dtInicio = dataInicio ? new Date(dataInicio + "T00:00:00") : null;
      const dtFim = dataFim ? new Date(dataFim + "T23:59:59") : null;
      // Verifica se QUALQUER data da tarefa (criação, início ou fim) está no período
      const datas = [t.created_at, t.data_inicio, t.data_fim].filter(Boolean);
      if (datas.length > 0) {
        const dentroDoPeriodo = datas.some((d) => {
          const dt = new Date(d as string);
          if (dtInicio && dt < dtInicio) return false;
          if (dtFim && dt > dtFim) return false;
          return true;
        });
        if (!dentroDoPeriodo) matchData = false;
      }
      // Tarefa SEM nenhuma data → sempre aparece
    }

    return matchBusca && matchData;
  });

  const getTarefasPorColuna = (colunaId: string) =>
    tarefasFiltradas
      .filter((t) => t.coluna_kanban === colunaId)
      .sort((a, b) => a.ordem - b.ordem);

  const getAtendimentosPorColuna = (colunaId: string) => {
    const emAndamento = (a: Atendimento) =>
      a.vendedor_interagiu === true || a.ultima_mensagem_remetente === "vendedor";

    if (colunaId === "a_fazer") {
      return atendimentos.filter((a) => a.status === "aberto" && !emAndamento(a));
    }
    if (colunaId === "em_andamento") {
      return atendimentos.filter((a) => a.status === "aberto" && emAndamento(a));
    }
    if (colunaId === "concluida") {
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
      return atendimentos.filter(
        (a) =>
          a.status === "fechado" &&
          new Date(a.data_fechamento || a.ultima_mensagem_data || 0) > seteDiasAtras
      );
    }
    return [];
  };

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
          <div className="flex items-center gap-2">
            <Select value={filtroColuna} onValueChange={setFiltroColuna}>
              <SelectTrigger className="w-[130px] h-7 text-[11px]">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__TODAS__">Todas</SelectItem>
                <SelectItem value="a_fazer">A Fazer</SelectItem>
                <SelectItem value="em_andamento">Andamento</SelectItem>
                <SelectItem value="concluida">Concluído</SelectItem>
              </SelectContent>
            </Select>
            <NovaTarefaModal onSuccess={fetchTarefas} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Carregando tarefas...
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className={cn(
              "gap-3 px-3 pb-3 h-full overflow-hidden",
              filtroColuna === "__TODAS__" ? "grid grid-cols-3" : "grid grid-cols-1"
            )}>
              {colunas
                .filter((coluna) => filtroColuna === "__TODAS__" || coluna.id === filtroColuna)
                .map((coluna) => {
                const tarefasColuna = getTarefasPorColuna(coluna.id);
                const atendimentosColuna = getAtendimentosPorColuna(coluna.id);
                const totalItems = tarefasColuna.length + atendimentosColuna.length;

                return (
                <div
                  key={coluna.id}
                  className={cn("flex flex-col rounded-lg h-full min-h-0", coluna.cor)}
                >
                  {/* Header da Coluna */}
                  <div className="flex items-center justify-between p-2 border-b border-slate-200/50">
                    <h3 className="font-semibold text-sm text-slate-700">{coluna.titulo}</h3>
                    <Badge variant="secondary" className="bg-white/80">
                      {totalItems}
                    </Badge>
                  </div>

                  {/* Lista de Tarefas */}
                  <Droppable droppableId={coluna.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex-1 overflow-y-auto px-2 pb-10 min-h-0 space-y-2",
                          snapshot.isDraggingOver && "bg-slate-200/50 rounded-lg"
                        )}
                      >
                          {/* Atendimentos na coluna */}
                          {atendimentosColuna.map((a) => (
                            <CardAtendimentoKanban
                              key={`at-${a.id}`}
                              atendimento={a}
                              onAbrirChat={onAbrirChat}
                            />
                          ))}

                          {tarefasColuna.map((tarefa, index) => (
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
                                  onClick={() => {
                                    setTarefaSelecionada(tarefa);
                                    setModalAberto(true);
                                  }}
                                  className={cn(
                                    "bg-white rounded-lg p-2 shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing group hover:shadow-md hover:border-blue-300 transition-all",
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

<div className="flex items-center gap-1.5 mb-1 flex-wrap">
  <p className="font-medium text-slate-900 text-xs truncate">
    {iconesTarefa[tarefa.tipo] || "📋"} {tarefa.titulo}
  </p>
  {tarefa.origem_lead && origemConfig[tarefa.origem_lead] && (
    <Badge
      variant="secondary"
      className={cn(
        "text-[9px] px-1.5 py-0 flex-shrink-0",
        origemConfig[tarefa.origem_lead].cor
      )}
    >
      {origemConfig[tarefa.origem_lead].icone} {origemConfig[tarefa.origem_lead].nome}
    </Badge>
  )}
</div>

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
                    )}
                  </Droppable>
                </div>
              )})}
            </div>
          </DragDropContext>
        )}
      </CardContent>

      <ModalDetalhesTarefa
        tarefa={tarefaSelecionada}
        aberto={modalAberto}
        onClose={() => {
          setModalAberto(false);
          setModalConcluindo(false);
          setTarefaSelecionada(null);
        }}
        onAtualizar={fetchTarefas}
        iniciarConcluindo={modalConcluindo}
      />
    </Card>
  );
}
