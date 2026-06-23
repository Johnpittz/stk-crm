"use client";

import { Clock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

interface CardAtendimentoKanbanProps {
  atendimento: Atendimento;
  onAbrirChat: (a: Atendimento) => void;
  disabled?: boolean;
}

export function CardAtendimentoKanban({
  atendimento,
  onAbrirChat,
  disabled = false,
}: CardAtendimentoKanbanProps) {
  const a = atendimento;
  const isNaoLido = a.nao_lido;

  const horaAtendimento = (data: string) => {
    return new Date(data).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={cn(
        "bg-white rounded-lg p-3 shadow-sm border transition-all",
        isNaoLido
          ? "border-green-400 bg-green-50/50"
          : "border-slate-200",
        disabled && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between mb-1.5">
        <Badge
          variant="secondary"
          className="text-[11px] px-2 py-0.5 bg-green-100 text-green-700"
        >
          <MessageCircle className="h-3.5 w-3.5 mr-1" />
          ATENDIMENTO
        </Badge>
        <div className="flex items-center gap-1">
          {isNaoLido && (
            <Badge className="h-5 text-[10px] bg-red-500 text-white border-0 px-1.5">
              NOVO
            </Badge>
          )}
        </div>
      </div>

      <p className="font-medium text-slate-900 text-sm mb-1.5 truncate">
        {a.clientes?.nome_razao_social || a.nome_cliente || "Cliente não identificado"}
      </p>

      {a.ultima_mensagem && (
        <p className="text-xs text-slate-500 truncate mb-1.5">
          {a.ultima_mensagem_remetente === "vendedor" ? (
            <span className="text-slate-400">Você: </span>
          ) : (
            <span className={isNaoLido ? "text-green-700 font-medium" : "text-slate-400"}>
              Cliente:{" "}
            </span>
          )}
          {a.ultima_mensagem}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{a.telefone_cliente}</span>
        {a.ultima_mensagem_data && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {horaAtendimento(a.ultima_mensagem_data)}
          </span>
        )}
      </div>

      {!disabled && (
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-3 h-8 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50 hover:text-green-800"
          onClick={() => onAbrirChat(a)}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Abrir Chat
        </Button>
      )}
    </div>
  );
}