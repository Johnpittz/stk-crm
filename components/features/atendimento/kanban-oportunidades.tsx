"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Clock, AlertCircle, Trash2, MoreHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { NovaOportunidadeModal } from "./nova-oportunidade-modal";
import { ModalDetalhesOportunidade } from "./modal-detalhes-oportunidade";

// ─── Colunas do Funil de Vendas ───
const colunas = [
  { id: "recebeu_conta", titulo: "Recebeu a Conta", cor: "#5b9bd5", icone: "📥" },
  { id: "proposta_feita", titulo: "Proposta a Ser Feita", cor: "#6ba3d6", icone: "📝" },
  { id: "proposta_apresentada", titulo: "Proposta Apresentada", cor: "#7fb8e8", icone: "📋" },
  { id: "apresentacao_realizada", titulo: "Apresentação Realizada", cor: "#8cc5f0", icone: "🎤" },
  { id: "contrato_enviado", titulo: "Contrato Enviado", cor: "#a3d4ff", icone: "📤" },
  { id: "contrato_assinado", titulo: "Contrato Assinado", cor: "#34d399", icone: "✅" },
  { id: "comissao_paga", titulo: "Comissão Paga", cor: "#4ade80", icone: "💰" },
];

const coresPrioridade: Record<string, string> = {
  baixa: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  media: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  alta: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  urgente: "bg-red-500/20 text-red-400 border-red-500/30",
};

const origemConfig: Record<string, { icone: string; nome: string; cor: string }> = {
  prospeccao_b2b: { icone: "🔍", nome: "Prospecção", cor: "bg-emerald-500/15 text-emerald-400" },
  whatsapp: { icone: "💬", nome: "WhatsApp", cor: "bg-green-500/15 text-green-400" },
  indicacao: { icone: "🤝", nome: "Indicação", cor: "bg-purple-500/15 text-purple-400" },
  site: { icone: "🌐", nome: "Site", cor: "bg-blue-500/15 text-blue-400" },
  manual: { icone: "✋", nome: "Manual", cor: "bg-slate-500/15 text-slate-400" },
};

interface Oportunidade {
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
  valor_venda: number | null;
  cliente_nome: string | null;
  etapa: string;
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

interface KanbanOportunidadesProps {
  atendimentos: Atendimento[];
  onAbrirChat: (a: Atendimento) => void;
  onRefresh?: () => void;
  onOportunidadeAtualizada?: () => void;
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
}

export function KanbanOportunidades({
  atendimentos,
  onAbrirChat,
  onRefresh,
  onOportunidadeAtualizada,
  busca = "",
  dataInicio = "",
  dataFim = "",
}: KanbanOportunidadesProps) {
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [oportunidadeSelecionada, setOportunidadeSelecionada] = useState<Oportunidade | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [modalConcluindo, setModalConcluindo] = useState(false);
  const [filtroColuna, setFiltroColuna] = useState("__TODAS__");
  const supabase = createClient();

  const fetchOportunidades = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/oportunidades", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (res.ok) {
        setOportunidades(data.oportunidades || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchOportunidades();
  }, [fetchOportunidades]);

  useEffect(() => {
    if (onRefresh) fetchOportunidades();
  }, [atendimentos, onRefresh, fetchOportunidades]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const novaColuna = destination.droppableId;

    // Última coluna = comissão paga → abre modal de conclusão
    if (novaColuna === "comissao_paga") {
      const oportunidadeArrastada = oportunidades.find((t) => t.id === draggableId);
      if (oportunidadeArrastada) {
        setOportunidadeSelecionada(oportunidadeArrastada);
        setModalConcluindo(true);
        setModalAberto(true);
        return;
      }
    }

    const oportunidadesNaColunaDestino = oportunidades.filter((t) => t.etapa === novaColuna);
    const novaOrdem = oportunidadesNaColunaDestino.length;

    setOportunidades((prev) =>
      prev.map((t) =>
        t.id === draggableId
          ? { ...t, etapa: novaColuna, ordem: novaOrdem }
          : t
      )
    );

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      await fetch("/api/oportunidades", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: draggableId,
          etapa: novaColuna,
          ordem: novaOrdem,
        }),
      });
    } catch (err) {
      console.error(err);
      fetchOportunidades();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta oportunidade?")) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/oportunidades?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        setOportunidades((prev) => prev.filter((t) => t.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const oportunidadesFiltradas = oportunidades.filter((t) => {
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
    }

    return matchBusca && matchData;
  });

  const getOportunidadesPorColuna = (colunaId: string) =>
    oportunidadesFiltradas
      .filter((t) => t.etapa === colunaId)
      .sort((a, b) => a.ordem - b.ordem);

  const formatHora = (hora: string | null) => {
    if (!hora) return "";
    return hora.substring(0, 5);
  };

  return (
    <Card className="h-full flex flex-col border-[#1c2e4a] bg-[#0c1426]">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="text-base">🗂️</span>
            Funil de Vendas
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filtroColuna} onValueChange={setFiltroColuna}>
              <SelectTrigger className="w-[140px] h-7 text-[11px] bg-[#14233c] border-[#1c2e4a] text-slate-300">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="bg-[#14233c] border-[#1c2e4a]">
                <SelectItem value="__TODAS__">Todas as etapas</SelectItem>
                {colunas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icone} {c.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <NovaOportunidadeModal onSuccess={fetchOportunidades} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-2 flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Carregando...
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div
              className={cn(
                "gap-3 h-full overflow-hidden",
                filtroColuna === "__TODAS__"
                  ? "grid pb-2"
                  : "grid grid-cols-1"
              )}
              style={filtroColuna === "__TODAS__" ? { gridTemplateColumns: "repeat(7, minmax(150px, 1fr))" } : undefined}
            >
              {colunas
                .filter((coluna) => filtroColuna === "__TODAS__" || coluna.id === filtroColuna)
                .map((coluna) => {
                  const oportunidadesColuna = getOportunidadesPorColuna(coluna.id);
                  const totalItems = oportunidadesColuna.length;

                  return (
                    <div
                      key={coluna.id}
                      className={cn(
                        "flex flex-col rounded-xl min-h-0 min-w-0",
                        filtroColuna === "__TODAS__"
                          ? ""
                          : "w-full"
                      )}
                      style={{ backgroundColor: `${coluna.cor}15` }}
                    >
                      {/* Header da Coluna */}
                      <div
                        className="flex items-center justify-between px-3 py-2 border-b"
                        style={{ borderColor: `${coluna.cor}30` }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{coluna.icone}</span>
                          <h3
                            className="font-bold text-xs uppercase tracking-wider"
                            style={{ color: coluna.cor }}
                          >
                            {coluna.titulo}
                          </h3>
                        </div>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${coluna.cor}25`,
                            color: coluna.cor,
                          }}
                        >
                          {totalItems}
                        </span>
                      </div>

                      {/* Lista de Oportunidades */}
                      <Droppable droppableId={coluna.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "flex-1 overflow-y-auto px-3 py-3 min-h-0 space-y-2",
                              snapshot.isDraggingOver && "bg-white/5 rounded-lg"
                            )}
                          >
                            {oportunidadesColuna.map((oportunidade, index) => (
                              <Draggable
                                key={oportunidade.id}
                                draggableId={oportunidade.id}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => {
                                      setOportunidadeSelecionada(oportunidade);
                                      setModalAberto(true);
                                    }}
                                    className={cn(
                                      "rounded-lg p-2.5 cursor-grab active:cursor-grabbing group transition-all border",
                                      "bg-[#14233c] border-[#1c2e4a] hover:border-[#3B64CF]/50 hover:bg-[#1a2d47]",
                                      snapshot.isDragging &&
                                        "shadow-lg shadow-black/30 ring-1 ring-[#3B64CF]/50 rotate-1"
                                    )}
                                  >
                                    {/* Prioridade + Ações */}
                                    <div className="flex items-center justify-between mb-1.5">
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "text-[9px] px-1.5 py-0 border font-medium",
                                          coresPrioridade[oportunidade.prioridade] || coresPrioridade.media
                                        )}
                                      >
                                        {oportunidade.prioridade === "urgente" && (
                                          <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                                        )}
                                        {oportunidade.prioridade}
                                      </Badge>
                                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 text-slate-500 hover:text-red-400"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(oportunidade.id);
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Título */}
                                    <p className="font-medium text-white text-[11px] leading-tight mb-1.5 line-clamp-2">
                                      {oportunidade.titulo}
                                    </p>

                                    {/* Origem */}
                                    {oportunidade.origem_lead && origemConfig[oportunidade.origem_lead] && (
                                      <Badge
                                        variant="secondary"
                                        className={cn(
                                          "text-[8px] px-1 py-0 mb-1.5 border-0",
                                          origemConfig[oportunidade.origem_lead].cor
                                        )}
                                      >
                                        {origemConfig[oportunidade.origem_lead].icone}{" "}
                                        {origemConfig[oportunidade.origem_lead].nome}
                                      </Badge>
                                    )}

                                    {/* Footer */}
                                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                                      <span className="truncate max-w-[100px]">
                                        {oportunidade.clientes?.nome_razao_social ||
                                          oportunidade.cliente_nome ||
                                          "—"}
                                      </span>
                                      {oportunidade.hora_inicio && (
                                        <span className="flex items-center gap-0.5 shrink-0">
                                          <Clock className="h-2.5 w-2.5" />
                                          {formatHora(oportunidade.hora_inicio)}
                                        </span>
                                      )}
                                    </div>

                                    {/* Valor da venda */}
                                    {oportunidade.valor_venda && oportunidade.valor_venda > 0 && (
                                      <div className="mt-1.5 pt-1.5 border-t border-[#1c2e4a]">
                                        <span className="text-[10px] font-semibold text-[#3B64CF]">
                                          R${" "}
                                          {oportunidade.valor_venda.toLocaleString("pt-BR", {
                                            minimumFractionDigits: 2,
                                          })}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}

                            {/* Empty state */}
                            {oportunidadesColuna.length === 0 && (
                              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                                <span className="text-2xl mb-2">{coluna.icone}</span>
                                <span className="text-xs font-medium">Arraste para aqui</span>
                              </div>
                            )}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
            </div>
          </DragDropContext>
        )}
      </CardContent>

      <ModalDetalhesOportunidade
        oportunidade={oportunidadeSelecionada}
        aberto={modalAberto}
        onClose={() => {
          setModalAberto(false);
          setModalConcluindo(false);
          setOportunidadeSelecionada(null);
        }}
        onAtualizar={() => {
          fetchOportunidades();
          onOportunidadeAtualizada?.();
        }}
        iniciarConcluindo={modalConcluindo}
      />
    </Card>
  );
}
