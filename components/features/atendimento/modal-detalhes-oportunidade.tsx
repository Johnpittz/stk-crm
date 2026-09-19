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

// ─── Colunas do Funil de Vendas (mesmo do Kanban) ───
const colunas = [
  { id: "recebeu_conta", titulo: "Recebeu a Conta", cor: "#5b9bd5", icone: "📥" },
  { id: "proposta_feita", titulo: "Proposta a Ser Feita", cor: "#6ba3d6", icone: "📝" },
  { id: "proposta_apresentada", titulo: "Proposta Apresentada", cor: "#7fb8e8", icone: "📋" },
  { id: "apresentacao_realizada", titulo: "Apresentação Realizada", cor: "#8cc5f0", icone: "🎤" },
  { id: "contrato_enviado", titulo: "Contrato Enviado", cor: "#a3d4ff", icone: "📤" },
  { id: "contrato_assinado", titulo: "Contrato Assinado", cor: "#34d399", icone: "✅" },
  { id: "comissao_paga", titulo: "Comissão Paga", cor: "#4ade80", icone: "💰" },
];

const origemConfig: Record<string, { icone: string; nome: string; cor: string }> = {
  prospeccao_b2b: { icone: "🔍", nome: "Prospecção", cor: "bg-emerald-500/15 text-emerald-400" },
  whatsapp: { icone: "💬", nome: "WhatsApp", cor: "bg-green-500/15 text-green-400" },
  indicacao: { icone: "🤝", nome: "Indicação", cor: "bg-purple-500/15 text-purple-400" },
  site: { icone: "🌐", nome: "Site", cor: "bg-blue-500/15 text-blue-400" },
  manual: { icone: "✋", nome: "Manual", cor: "bg-slate-500/15 text-slate-400" },
};

interface OportunidadeCompleta {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  prioridade: string;
  status: string;
  etapa: string;
  data_inicio: string | null;
  hora_inicio: string | null;
  data_fim: string | null;
  hora_fim: string | null;
  resultado: string | null;
  observacao_resultado: string | null;
  valor_venda: number | null;
  cliente_nome: string | null;
  origem_lead: string | null;
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

const opcoesObservacao: Record<string, string[]> = {
  sucesso: ["Venda fechada", "Orçamento enviado", "Reunião agendada", "Parceria firmada"],
  insucesso: ["Sem interesse", "Preço elevado", "Escolheu concorrente", "Não é público-alvo"],
  remarcado: ["Cliente pediu retorno", "Agenda lotada", "Aguardando decisão"],
  sem_contato: ["Não atendeu", "Número inválido", "Sem WhatsApp", "Caixa postal"],
  follow_up_necessario: ["Enviar orçamento", "Confirmar reunião", "Verificar disponibilidade", "Aguardando retorno"],
};

interface ModalDetalhesOportunidadeProps {
  oportunidade: OportunidadeCompleta | null;
  aberto: boolean;
  onClose: () => void;
  onAtualizar: () => void;
  iniciarConcluindo?: boolean;
}

export function ModalDetalhesOportunidade({
  oportunidade,
  aberto,
  onClose,
  onAtualizar,
  iniciarConcluindo = false,
}: ModalDetalhesOportunidadeProps) {
  const [editando, setEditando] = useState(false);
  const [concluindo, setConcluindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const supabase = createClient();

  const [form, setForm] = useState({
    titulo: "",
    descricao: "",
    prioridade: "media",
    valorVenda: "" as string,
  });

  const [resultadoForm, setResultadoForm] = useState({
    resultado: "" as string,
    observacao: "" as string,
    valorVenda: "" as string,
  });

  // Quando abre no modo conclusão, inicializa form
  useEffect(() => {
    if (aberto && iniciarConcluindo && oportunidade && oportunidade.etapa !== "concluida") {
      setConcluindo(true);
      setEditando(false);
      setForm({
        titulo: oportunidade.titulo,
        descricao: oportunidade.descricao || "",
        prioridade: oportunidade.prioridade,
        valorVenda: "",
      });
      setResultadoForm({ resultado: "", observacao: "", valorVenda: "" });
    } else if (aberto && oportunidade && !iniciarConcluindo) {
      // Inicializa form com dados da oportunidade
      const valorFormatado = oportunidade.valor_venda
        ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(oportunidade.valor_venda)
        : "";
      setForm({
        titulo: oportunidade.titulo,
        descricao: oportunidade.descricao || "",
        prioridade: oportunidade.prioridade,
        valorVenda: valorFormatado,
      });
    } else if (!aberto) {
      setConcluindo(false);
      setEditando(false);
      setResultadoForm({ resultado: "", observacao: "", valorVenda: "" });
    }
  }, [aberto, iniciarConcluindo, oportunidade]);

  const handleSalvarEdicao = async () => {
    if (!oportunidade) return;
    setSalvando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const body: any = {
        id: oportunidade.id,
        titulo: form.titulo,
        descricao: form.descricao,
        prioridade: form.prioridade,
      };

      if (oportunidade.resultado === "sucesso" && form.valorVenda) {
        body.valor_venda = parseFloat(form.valorVenda.replace(/\./g, "").replace(",", "."));
      }

      const res = await fetch("/api/oportunidades", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setEditando(false);
        onAtualizar();
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  const handleMover = async (coluna: string) => {
    if (!oportunidade) return;

    if (coluna === "concluida") {
      setConcluindo(true);
      setForm({
        titulo: oportunidade.titulo,
        descricao: oportunidade.descricao || "",
        prioridade: oportunidade.prioridade,
        valorVenda: "",
      });
      setResultadoForm({ resultado: "", observacao: "", valorVenda: "" });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch("/api/oportunidades", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: oportunidade.id,
          etapa: coluna,
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
    if (!oportunidade) return;
    if (!resultadoForm.resultado) return;
    if (!resultadoForm.observacao) return;
    if (resultadoForm.resultado === "sucesso" && !resultadoForm.valorVenda) return;

    setSalvando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const body: any = {
        id: oportunidade.id,
        etapa: "concluida",
        status: "concluida",
        titulo: form.titulo,
        descricao: form.descricao,
        prioridade: form.prioridade,
        resultado: resultadoForm.resultado,
        observacao_resultado: resultadoForm.observacao,
      };

      if (resultadoForm.resultado === "sucesso" && resultadoForm.valorVenda) {
        body.valor_venda = parseFloat(resultadoForm.valorVenda.replace(/\./g, "").replace(",", "."));
      }

      await fetch("/api/oportunidades", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
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
    if (!oportunidade) return;
    if (!confirm("Excluir esta oportunidade?")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/oportunidades?id=${oportunidade.id}`, {
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

  if (!oportunidade) return null;

  const isConcluida = oportunidade.etapa === "concluida";
  const isAndamento = oportunidade.etapa === "em_andamento";
  const podeEditar = isConcluida;
  const podeConcluir = isAndamento;

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto bg-[#0c1426] border-[#1c2e4a] text-white">
        {/* Header */}
        <DialogHeader className="pb-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{iconesTarefa[oportunidade.tipo] || "📋"}</span>
            <div className="flex-1 min-w-0">
              {(editando || concluindo) ? (
                <Input
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                  className="font-semibold text-lg h-9 bg-[#14233c] border-[#1c2e4a] text-white"
                />
              ) : (
                <DialogTitle className="text-lg font-bold text-white truncate">
                  {oportunidade.titulo}
                </DialogTitle>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Etapa + Prioridade */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className={cn(
              "text-xs px-3 py-1 font-semibold",
              isConcluida ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
            )}>
              {isConcluida ? "✅ Concluída" : colunas.find(c => c.id === oportunidade.etapa)?.titulo || oportunidade.etapa}
            </Badge>
            <Badge variant="secondary" className={cn(
              "text-xs px-2 py-0.5",
              coresPrioridade[oportunidade.prioridade] || coresPrioridade.media
            )}>
              {oportunidade.prioridade === "urgente" && <AlertCircle className="h-3 w-3 mr-1" />}
              {oportunidade.prioridade}
            </Badge>
            {oportunidade.origem_lead && origemConfig[oportunidade.origem_lead] && (
              <Badge variant="secondary" className={cn("text-xs px-2 py-0.5", origemConfig[oportunidade.origem_lead].cor)}>
                {origemConfig[oportunidade.origem_lead].icone} {origemConfig[oportunidade.origem_lead].nome}
              </Badge>
            )}
          </div>

          {/* Cliente */}
          {(oportunidade.clientes?.nome_razao_social || oportunidade.cliente_nome) && (
            <div className="flex items-center gap-3 p-3 bg-[#14233c] rounded-xl border border-[#1c2e4a]">
              <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-sm shrink-0">
                {(oportunidade.clientes?.nome_razao_social || oportunidade.cliente_nome || "").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{oportunidade.clientes?.nome_razao_social || oportunidade.cliente_nome}</p>
                <p className="text-xs text-slate-400">Cliente</p>
              </div>
            </div>
          )}

          {/* Valor da Venda */}
          {oportunidade.valor_venda && oportunidade.valor_venda > 0 && (
            <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <span className="text-sm text-emerald-400">💰 Valor da Venda</span>
              <span className="text-lg font-bold text-emerald-400">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(oportunidade.valor_venda)}
              </span>
            </div>
          )}

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#14233c] rounded-xl border border-[#1c2e4a]">
              <span className="text-slate-400 flex items-center gap-1.5 text-xs mb-1">
                <Calendar className="h-3.5 w-3.5" /> Início
              </span>
              <span className="text-sm font-medium text-white">{formatData(oportunidade.data_inicio)}</span>
            </div>
            <div className="p-3 bg-[#14233c] rounded-xl border border-[#1c2e4a]">
              <span className="text-slate-400 flex items-center gap-1.5 text-xs mb-1">
                <Calendar className="h-3.5 w-3.5" /> Prazo
              </span>
              <span className="text-sm font-medium text-white">{formatData(oportunidade.data_fim)}</span>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <Label className="text-xs text-slate-400 mb-1 block">Descrição</Label>
            {(editando || concluindo) ? (
              <textarea
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-[#1c2e4a] bg-[#14233c] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              />
            ) : (
              <p className="text-sm text-slate-300 whitespace-pre-wrap bg-[#14233c] p-3 rounded-xl border border-[#1c2e4a]">
                {oportunidade.descricao || "Sem descrição"}
              </p>
            )}
          </div>

          {/* Resultado (só mostra se tiver sido concluída com resultado) */}
          {oportunidade.resultado && !concluindo && (
            <div className="bg-[#14233c] rounded-xl p-3 border border-[#1c2e4a]">
              <Label className="text-xs text-slate-400">Resultado da execução</Label>
              <div className="flex items-center gap-2 mt-1 mb-2">
                <Badge variant="secondary" className={cn(labelsResultado[oportunidade.resultado]?.cor || "bg-slate-100 text-slate-700")}>
                  {labelsResultado[oportunidade.resultado]?.label || oportunidade.resultado}
                </Badge>
              </div>
              {oportunidade.observacao_resultado && (
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{oportunidade.observacao_resultado}</p>
              )}
              {oportunidade.resultado === "sucesso" && oportunidade.valor_venda && (
                <div className="mt-2 pt-2 border-t border-[#1c2e4a]">
                  <span className="text-xs text-slate-400">Valor da Venda:</span>
                  <span className="ml-2 text-sm font-bold text-emerald-400">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(oportunidade.valor_venda)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Campo valor editável no modo edição (concluída com sucesso) */}
          {editando && oportunidade.resultado === "sucesso" && (
            <div>
              <Label className="text-xs text-slate-400">Valor da Venda (R$)</Label>
              <Input
                type="text"
                placeholder="0,00"
                value={form.valorVenda}
                onChange={(e) => {
                  let v = e.target.value.replace(/\D/g, "");
                  if (v.length > 2) {
                    v = v.replace(/(\d{2})$/, ",$1");
                    v = v.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                  }
                  setForm((f) => ({ ...f, valorVenda: v }));
                }}
                className="mt-1 bg-[#14233c] border-[#1c2e4a] text-white"
              />
            </div>
          )}

          {/* Formulário de conclusão */}
          {concluindo && (
            <div className="space-y-3 border-t border-[#1c2e4a] pt-3 bg-[#0a1020] -mx-6 px-6 pb-3 rounded-b-xl">
              <h4 className="font-semibold text-sm text-white flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Registrar resultado da oportunidade
              </h4>

              {/* Prioridade */}
              <div>
                <Label className="text-xs text-slate-400">Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm((f) => ({ ...f, prioridade: v }))}>
                  <SelectTrigger className="mt-1 bg-[#14233c] border-[#1c2e4a] text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#14233c] border-[#1c2e4a]">
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Resultado */}
              <div>
                <Label className="text-xs text-slate-400">Resultado *</Label>
                <Select value={resultadoForm.resultado} onValueChange={(v) => setResultadoForm((f) => ({ ...f, resultado: v, observacao: "" }))}>
                  <SelectTrigger className="mt-1 bg-[#14233c] border-[#1c2e4a] text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent className="bg-[#14233c] border-[#1c2e4a]">
                    <SelectItem value="sucesso">✅ Sucesso — contato/negociação realizada</SelectItem>
                    <SelectItem value="insucesso">❌ Insucesso — não houve interesse</SelectItem>
                    <SelectItem value="remarcado">📅 Remarcado — agendado para outro dia</SelectItem>
                    <SelectItem value="sem_contato">📞 Sem contato — não atendeu</SelectItem>
                    <SelectItem value="follow_up_necessario">🔄 Follow-up necessário</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Observação do resultado */}
              <div>
                <Label className="text-xs text-slate-400">Observação do resultado *</Label>
                <Select
                  value={resultadoForm.observacao}
                  onValueChange={(v) => setResultadoForm((f) => ({ ...f, observacao: v }))}
                  disabled={!resultadoForm.resultado}
                >
                  <SelectTrigger className="mt-1 bg-[#14233c] border-[#1c2e4a] text-white">
                    <SelectValue placeholder={resultadoForm.resultado ? "Selecione..." : "Selecione o resultado primeiro"} />
                  </SelectTrigger>
                  <SelectContent className="bg-[#14233c] border-[#1c2e4a]">
                    {(opcoesObservacao[resultadoForm.resultado] || []).map((opcao) => (
                      <SelectItem key={opcao} value={opcao}>{opcao}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Valor da venda (só se Sucesso) */}
              {resultadoForm.resultado === "sucesso" && (
                <div>
                  <Label className="text-xs text-slate-400">Valor da Venda (R$) *</Label>
                  <Input
                    type="text"
                    placeholder="0,00"
                    value={resultadoForm.valorVenda}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, "");
                      if (v.length > 2) {
                        v = v.replace(/(\d{2})$/, ",$1");
                        v = v.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                      }
                      setResultadoForm((f) => ({ ...f, valorVenda: v }));
                    }}
                    className="mt-1 bg-[#14233c] border-[#1c2e4a] text-white"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleConfirmarConclusao}
                  disabled={
                    salvando || !resultadoForm.resultado || !resultadoForm.observacao ||
                    (resultadoForm.resultado === "sucesso" && !resultadoForm.valorVenda)
                  }
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Check className="h-4 w-4" />
                  {salvando ? "Salvando..." : "Confirmar conclusão"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setConcluindo(false);
                    setResultadoForm({ resultado: "", observacao: "", valorVenda: "" });
                  }}
                  className="border-[#1c2e4a] text-slate-300 hover:bg-[#14233c]"
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Ações */}
          {!concluindo && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#1c2e4a]">
              {editando ? (
                <>
                  <Button size="sm" onClick={handleSalvarEdicao} disabled={salvando} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">
                    <Save className="h-4 w-4" />
                    {salvando ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditando(false);
                    const valorFormatado = oportunidade.valor_venda
                      ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(oportunidade.valor_venda) : "";
                    setForm({ titulo: oportunidade.titulo, descricao: oportunidade.descricao || "", prioridade: oportunidade.prioridade, valorVenda: valorFormatado });
                  }} className="border-[#1c2e4a] text-slate-300 hover:bg-[#14233c]">
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  {podeEditar && (
                    <Button size="sm" variant="outline" onClick={() => setEditando(true)} className="border-[#1c2e4a] text-slate-300 hover:bg-[#14233c]">
                      ✏️ Editar
                    </Button>
                  )}

                  {!isAndamento && !isConcluida && (
                    <Button size="sm" variant="outline" onClick={() => handleMover("em_andamento")} className="border-[#1c2e4a] text-slate-300 hover:bg-[#14233c]">
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Andamento
                    </Button>
                  )}

                  {podeConcluir && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMover("concluida")}
                      className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Concluir
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleExcluir}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 ml-auto"
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