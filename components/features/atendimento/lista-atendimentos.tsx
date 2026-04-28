"use client";

import { useState } from "react";
import { MessageCircle, Check, Loader2 } from "lucide-react";
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

interface ListaAtendimentosProps {
  atendimentos: Atendimento[];
  loading: boolean;
  onRefresh: () => void;
}

export function ListaAtendimentos({ atendimentos, loading, onRefresh }: ListaAtendimentosProps) {
  const [chatAberto, setChatAberto] = useState(false);
  const [atendimentoSelecionado, setAtendimentoSelecionado] = useState<Atendimento | null>(null);
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
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
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
          <SimularWhatsAppModal onSuccess={onRefresh} />
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
            <SimularWhatsAppModal onSuccess={onRefresh} />
          </div>
        ) : (
          <ScrollArea className="h-full px-3">
            <div className="space-y-2">
              {atendimentos.map((a) => {
                const isNaoLido = a.nao_lido;
                const isCliente = a.ultima_mensagem_remetente === "cliente";
                const hora = a.ultima_mensagem_data
                  ? new Date(a.ultima_mensagem_data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                  : "";
                const iniciais = (a.clientes?.nome_razao_social || a.nome_cliente || "C").substring(0, 2).toUpperCase();

                return (
                  <div
                    key={a.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all",
                      isNaoLido
                        ? "bg-green-50/60 border border-green-200 hover:bg-green-50"
                        : "bg-white border border-slate-200 hover:border-green-300 hover:shadow-sm"
                    )}
                    onClick={() => {
                      setAtendimentoSelecionado(a);
                      setChatAberto(true);
                    }}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div
                        className={cn(
                          "h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold",
                          isNaoLido ? "bg-green-600 text-white" : "bg-slate-200 text-slate-600"
                        )}
                      >
                        {iniciais}
                      </div>
                      {isNaoLido && (
                        <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                          1
                        </span>
                      )}
                    </div>

                    {/* Conteudo */}
                    <div className="flex-1 min-w-0">
                      {/* Linha topo: nome + hora + badges */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("text-sm truncate", isNaoLido ? "font-bold text-slate-900" : "font-semibold text-slate-700")}>
                          {a.clientes?.nome_razao_social || a.nome_cliente || "Cliente não identificado"}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hora && (
                            <span className={cn("text-[11px]", isNaoLido ? "text-green-700 font-medium" : "text-slate-400")}>
                              {hora}
                            </span>
                          )}
                          {isNaoLido && (
                            <Badge className="h-5 text-[10px] bg-red-500 text-white border-0 px-1.5">NOVO</Badge>
                          )}
                        </div>
                      </div>

                      {/* Preview mensagem */}
                      {a.ultima_mensagem && (
                        <div className="flex items-center gap-1 mt-0.5">
                          {a.ultima_mensagem_remetente === "vendedor" ? (
                            <Check className="h-3 w-3 text-green-500 shrink-0" />
                          ) : isNaoLido ? (
                            <span className="h-2 w-2 bg-green-500 rounded-full shrink-0 animate-pulse" />
                          ) : null}
                          <p className={cn("text-xs truncate", isNaoLido && isCliente ? "text-slate-900 font-medium" : "text-slate-500")}>
                            {a.ultima_mensagem_remetente === "vendedor" ? (
                              <span className="text-slate-400">Você: </span>
                            ) : (
                              <span className={isNaoLido ? "text-green-700 font-medium" : "text-slate-400"}>Cliente: </span>
                            )}
                            {a.ultima_mensagem}
                          </p>
                        </div>
                      )}

                      {/* Telefone */}
                      <p className="text-[10px] text-slate-400 mt-0.5">{a.telefone_cliente}</p>
                    </div>

                    {/* Acoes rapidas */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFechar(a.id);
                        }}
                        title="Marcar como resolvido"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
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
        onMensagemEnviada={onRefresh}
      />
    </Card>
  );
}
