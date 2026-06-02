"use client";

import { MessageCircle, Check, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
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

interface ListaAtendimentosLateralProps {
  atendimentos: Atendimento[];
  loading: boolean;
  onRefresh: () => void;
  onAbrirChat: (a: Atendimento) => void;
}

export function ListaAtendimentosLateral({
  atendimentos,
  loading,
  onRefresh,
  onAbrirChat,
}: ListaAtendimentosLateralProps) {
  const supabase = createClient();

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
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const horaAtendimento = (data: string) => {
    return new Date(data).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageCircle className="h-4 w-4 text-green-600" />
            Atendimentos
            <Badge variant="secondary" className="text-xs">
              {atendimentos.length}
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Carregando...
          </div>
        ) : atendimentos.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Nenhum atendimento
          </div>
        ) : (
          <ScrollArea className="h-full px-3">
            <div className="space-y-2 pb-4">
              {atendimentos.map((a) => {
                const isNaoLido = a.nao_lido;
                const isCliente = a.ultima_mensagem_remetente === "cliente";
                const hora = a.ultima_mensagem_data
                  ? horaAtendimento(a.ultima_mensagem_data)
                  : "";
                const iniciais = (
                  a.clientes?.nome_razao_social ||
                  a.nome_cliente ||
                  "C"
                )
                  .substring(0, 2)
                  .toUpperCase();

                return (
                  <div
                    key={a.id}
                    className={cn(
                      "flex items-start gap-2 p-2.5 rounded-lg cursor-pointer transition-all border",
                      isNaoLido
                        ? "bg-green-50/60 border-green-200 hover:bg-green-50"
                        : "bg-white border-slate-200 hover:border-green-300 hover:shadow-sm"
                    )}
                    onClick={() => onAbrirChat(a)}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div
                        className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold",
                          isNaoLido
                            ? "bg-green-600 text-white"
                            : "bg-slate-200 text-slate-600"
                        )}
                      >
                        {iniciais}
                      </div>
                      {isNaoLido && (
                        <span className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-red-500 rounded-full border-2 border-white" />
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            "text-xs truncate",
                            isNaoLido
                              ? "font-bold text-slate-900"
                              : "font-semibold text-slate-700"
                          )}
                        >
                          {a.clientes?.nome_razao_social ||
                            a.nome_cliente ||
                            "Cliente"}
                        </span>
                        {hora && (
                          <span
                            className={cn(
                              "text-[10px] shrink-0",
                              isNaoLido
                                ? "text-green-700 font-medium"
                                : "text-slate-400"
                            )}
                          >
                            {hora}
                          </span>
                        )}
                      </div>

                      {a.ultima_mensagem && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {a.ultima_mensagem_remetente === "vendedor" ? (
                            <span className="text-slate-400">Você: </span>
                          ) : (
                            <span
                              className={
                                isNaoLido
                                  ? "text-green-700 font-medium"
                                  : "text-slate-400"
                              }
                            >
                              Cliente:{" "}
                            </span>
                          )}
                          {a.ultima_mensagem}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[9px] text-slate-400">
                          {a.telefone_cliente}
                        </span>
                        <div className="flex items-center gap-1">
                          {a.status === "aberto" && (
                            <Badge
                              variant="secondary"
                              className="text-[9px] px-1 py-0 h-4 bg-green-100 text-green-700"
                            >
                              Aberto
                            </Badge>
                          )}
                          {a.status === "fechado" && (
                            <Badge
                              variant="secondary"
                              className="text-[9px] px-1 py-0 h-4 bg-slate-100 text-slate-600"
                            >
                              Fechado
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ação rápida */}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFechar(a.id);
                      }}
                      title="Marcar como resolvido"
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
