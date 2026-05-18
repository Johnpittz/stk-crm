"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Trash2,
  ArrowRight,
  AlertCircle,
  Save,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface TarefaCompleta {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  prioridade: string;
  status: string;
  coluna_kanban: string;
  data_inicio: string | null;
  hora_inicio: string | null;
  data_fim: string | null;
  hora_fim: string | null;
  resultado: string | null;
  observacao_resultado: string | null;
  clientes: { id: string; nome_razao_social: string } | null;
}

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

const labelsTipo: Record<string, string> = {
  visita: "Visita",
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  reuniao: "Reunião",
  follow_up: "Follow-up",
  prospeccao: "Prospecção",
  outro: "Outro",
};

const labelsResultado: Record<string, { label: string; cor: string }> = {
  sucesso: { label: "✅ Sucesso", cor: "bg-emerald-100 text-emerald-700" },
  insucesso: { label: "❌ Insucesso", cor: "bg-red-100 text-red-700" },
  remarcado: { label: "📅 Remarcado", cor: "bg-blue-100 text-blue-700" },
  sem_contato: { label: "📞 Sem contato", cor: "bg-amber-100 text-amber-700" },
  follow_up_necessario: { label: "🔄 Follow-up", cor: "bg-purple-100 text-purple-700" },
};

const coresPrioridade: Record<string, string> = {
  baixa: "bg-slate-100 text-slate-700",
  media: "bg-blue-100 text-blue-700",
  alta: "bg-orange-100 text-orange-700",
  urgente: "bg-red-100 text-red-700",
};

interface ModalDetalhesTarefaProps {
  tarefa: TarefaCompleta | null;
  aberto: boolean;
  onClose: () => void;
  onAtualizar: () => void;
  iniciarConcluindo?: boolean;
}

export function ModalDetalhesTarefa({
  tarefa,
  aberto,
  onClose,
  onAtualizar,
  iniciarConcluindo = false,
}: ModalDetalhesTarefaProps) {
  const [editando, setEditando] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const supabase = createClient();

  // Quando o modal abre/fecha, reseta estados internos
  useEffect(() => {
    if (aberto && iniciarConcluindo && tarefa && tarefa.coluna_kanban !== "concluida") {
      setConcluindo(true);
      setEditando(false);
    } else if (!aberto) {
      setConcluindo(false);
      setEditando(false);
      setResultadoForm({ resultado: "", observacao: "" });
    }
  }, [aberto, iniciarConcluindo, tarefa]);

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    prioridade: "media",
    data_fim: "",
    hora_inicio: "",
  });

  const [resultadoForm, setResultadoForm] = useState({
    resultado: "" as string,
    observacao: "",
  });

  // Inicializa form quando tarefa muda
  const iniciarEdicao = () => {
    if (!tarefa) return;
    setForm({
      titulo: tarefa.titulo,
      descricao: tarefa.descricao || "",
      prioridade: tarefa.prioridade,
      data_fim: tarefa.data_fim || "",
      hora_inicio: tarefa.hora_inicio || "",
    });
    setEditando(true);
  };

  const handleSalvar = async () => {
    if (!tarefa) return;
    setSalvando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/tarefas", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: tarefa.id,
          titulo: form.titulo,
          descricao: form.descricao,
          prioridade: form.prioridade,
          data_fim: form.data_fim || null,
          hora_inicio: form.hora_inicio || null,
        }),
      });

      if (res.ok) {
        setEditando(false);
        onAtualizar();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  const handleMover = async (coluna: string) => {
    if (!tarefa) return;

    // Se for concluir, exige preenchimento do resultado
    if (coluna === "concluida") {
      setConcluindo(true);
      return;
    }

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
          id: tarefa.id,
          coluna_kanban: coluna,
          status: coluna === "em_andamento" ? "em_andamento" : "pendente",
        }),
      });
      onAtualizar();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmarConclusao = async () => {
    if (!tarefa) return;
    if (!resultadoForm.resultado) return;

    setSalvando(true);
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
          id: tarefa.id,
          coluna_kanban: "concluida",
          status: "concluida",
          resultado: resultadoForm.resultado,
          observacao_resultado: resultadoForm.observacao,
        }),
      });
      setConcluindo(false);
      onAtualizar();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!tarefa) return;
    if (!confirm("Excluir esta tarefa?")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/tarefas?id=${tarefa.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        onAtualizar();
        onClose();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatData = (data: string | null) => {
    if (!data) return "—";
    return new Date(data).toLocaleDateString("pt-BR");
  };

  const isAtrasada = (dataFim: string | null) => {
    if (!dataFim) return false;
    return new Date(dataFim) < new Date();
  };

  if (!tarefa) return null;

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="text-xl">{iconesTarefa[tarefa.tipo] || "📋"}</span>
            {editando ? (
              <Input
                value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                className="font-semibold text-lg h-9"
              />
            ) : (
              <DialogTitle className="text-lg">{tarefa.titulo}</DialogTitle>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Metadados */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className={cn(
                coresPrioridade[tarefa.prioridade] || coresPrioridade.media
              )}
            >
              {tarefa.prioridade === "urgente" && (
                <AlertCircle className="h-3 w-3 mr-1" />
              )}
              {tarefa.prioridade}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {labelsTipo[tarefa.tipo] || tarefa.tipo}
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                tarefa.coluna_kanban === "concluida"
                  ? "bg-emerald-100 text-emerald-700"
                  : tarefa.coluna_kanban === "em_andamento"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-100 text-slate-700"
              )}
            >
              {tarefa.coluna_kanban === "concluida"
                ? "Concluído"
                : tarefa.coluna_kanban === "em_andamento"
                ? "Andamento"
                : "A Fazer"}
            </Badge>
          </div>

          {/* Cliente */}
          {tarefa.clientes?.nome_razao_social && (
            <div className="text-sm">
              <span className="text-slate-500">Cliente:</span>{" "}
              <span className="font-medium">{tarefa.clientes.nome_razao_social}</span>
            </div>
          )}

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Início
              </span>
              <span className="font-medium">{formatData(tarefa.data_inicio)}</span>
            </div>
            <div>
              <span className="text-slate-500 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Prazo
              </span>
              <span
                className={cn(
                  "font-medium",
                  isAtrasada(tarefa.data_fim) && "text-red-600"
                )}
              >
                {formatData(tarefa.data_fim)}
                {isAtrasada(tarefa.data_fim) && (
                  <span className="text-xs ml-1">(atrasada)</span>
                )}
              </span>
            </div>
            {tarefa.hora_inicio && (
              <div>
                <span className="text-slate-500 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> Hora
                </span>
                <span className="font-medium">{tarefa.hora_inicio.substring(0, 5)}</span>
              </div>
            )}
          </div>

          {/* Descrição */}
          <div>
            <Label className="text-xs text-slate-500">Descrição</Label>
            {editando ? (
              <textarea
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            ) : (
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                {tarefa.descricao || "Sem descrição"}
              </p>
            )}
          </div>

          {/* Resultado (só mostra se tiver sido concluída) */}
          {tarefa.resultado && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <Label className="text-xs text-slate-500">Resultado da execução</Label>
              <div className="flex items-center gap-2 mt-1 mb-2">
                <Badge
                  variant="secondary"
                  className={cn(
                    labelsResultado[tarefa.resultado]?.cor || "bg-slate-100 text-slate-700"
                  )}
                >
                  {labelsResultado[tarefa.resultado]?.label || tarefa.resultado}
                </Badge>
              </div>
              {tarefa.observacao_resultado && (
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {tarefa.observacao_resultado}
                </p>
              )}
            </div>
          )}

          {/* Campos editáveis (só no modo edição) */}
          {editando && (
            <div className="space-y-3 border-t pt-3">
              <div>
                <Label className="text-xs">Prioridade</Label>
                <Select
                  value={form.prioridade}
                  onValueChange={(v) => setForm((f) => ({ ...f, prioridade: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Prazo (data)</Label>
                  <Input
                    type="date"
                    value={form.data_fim}
                    onChange={(e) => setForm((f) => ({ ...f, data_fim: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Hora</Label>
                  <Input
                    type="time"
                    value={form.hora_inicio}
                    onChange={(e) => setForm((f) => ({ ...f, hora_inicio: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Formulário de conclusão obrigatório */}
          {concluindo && (
            <div className="space-y-3 border-t pt-3 bg-slate-50 -mx-6 px-6 pb-3">
              <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Registrar resultado da tarefa
              </h4>

              <div>
                <Label className="text-xs">Resultado *</Label>
                <Select
                  value={resultadoForm.resultado}
                  onValueChange={(v) => setResultadoForm((f) => ({ ...f, resultado: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sucesso">✅ Sucesso — contato/negociação realizada</SelectItem>
                    <SelectItem value="insucesso">❌ Insucesso — não houve interesse</SelectItem>
                    <SelectItem value="remarcado">📅 Remarcado — agendado para outro dia</SelectItem>
                    <SelectItem value="sem_contato">📞 Sem contato — não atendeu</SelectItem>
                    <SelectItem value="follow_up_necessario">🔄 Follow-up necessário</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Observação do resultado *</Label>
                <textarea
                  value={resultadoForm.observacao}
                  onChange={(e) => setResultadoForm((f) => ({ ...f, observacao: e.target.value }))}
                  rows={3}
                  placeholder="Descreva o que aconteceu..."
                  className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleConfirmarConclusao}
                  disabled={salvando || !resultadoForm.resultado || !resultadoForm.observacao.trim()}
                  className="gap-1"
                >
                  <Check className="h-4 w-4" />
                  {salvando ? "Salvando..." : "Confirmar conclusão"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConcluindo(false);
                    setResultadoForm({ resultado: "", observacao: "" });
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Ações */}
          {!concluindo && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
              {editando ? (
                <>
                  <Button
                    size="sm"
                    onClick={handleSalvar}
                    disabled={salvando}
                    className="gap-1"
                  >
                    <Save className="h-4 w-4" />
                    {salvando ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditando(false)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={iniciarEdicao}>
                    ✏️ Editar
                  </Button>

                  {tarefa.coluna_kanban !== "em_andamento" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMover("em_andamento")}
                    >
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Andamento
                    </Button>
                  )}

                  {tarefa.coluna_kanban !== "concluida" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMover("concluida")}
                      className="text-emerald-600 hover:text-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Concluir
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleExcluir}
                    className="text-red-500 hover:text-red-600 ml-auto"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
