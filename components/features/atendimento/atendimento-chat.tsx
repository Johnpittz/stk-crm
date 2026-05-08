"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Phone, Send, Check, User, MessageCircle, X, ArrowRightLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Mensagem {
  id: string;
  remetente: string;
  conteudo: string;
  created_at: string;
  enviada_por?: string | null;
}

interface Atendimento {
  id: string;
  telefone_cliente: string;
  nome_cliente: string;
  status: string;
  ultima_mensagem?: string | null;
  ultima_mensagem_data?: string | null;
  ultima_mensagem_remetente?: string | null;
  nao_lido?: boolean;
  created_at?: string;
  cliente_id?: string | null;
  clientes?: { id: string; nome_razao_social: string; telefone?: string; celular?: string } | null;
}

interface AtendimentoChatProps {
  atendimento: Atendimento | null;
  open: boolean;
  onClose: () => void;
  onMarcarResolvido?: (id: string) => void;
  onMensagemEnviada?: () => void;
}

interface Vendedor {
  id: string;
  nome_completo: string;
  cargo: string;
}

export function AtendimentoChat({ atendimento, open, onClose, onMarcarResolvido, onMensagemEnviada }: AtendimentoChatProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [modoTransferencia, setModoTransferencia] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const fetchMensagens = useCallback(async () => {
    if (!atendimento) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/atendimentos/mensagens?atendimento_id=${atendimento.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        let msgs = data.mensagens || [];
        
        // Se não há mensagens na tabela mas o atendimento tem ultima_mensagem (atendimentos antigos)
        if (msgs.length === 0 && atendimento.ultima_mensagem) {
          msgs = [{
            id: "virtual-" + atendimento.id,
            remetente: "cliente",
            conteudo: atendimento.ultima_mensagem,
            created_at: atendimento.ultima_mensagem_data || atendimento.created_at || new Date().toISOString(),
            enviada_por: null,
          }];
        }
        
        setMensagens(msgs);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [atendimento, supabase]);

  // Busca vendedores para transferência
  const fetchVendedores = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log("[Transferencia] Sem sessao");
        return;
      }

      const res = await fetch("/api/vendedores", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      console.log("[Transferencia] Status API:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("[Transferencia] Vendedores brutos:", data.vendedores?.length);
        console.log("[Transferencia] Cargos:", data.vendedores?.map((v: any) => v.cargo));
        const todos = data.vendedores || [];
        // Filtra: só vendedores, com nome preenchido, e diferente do usuário logado
        const userId = session.user.id;
        const filtrados = todos.filter((v: Vendedor) => {
          const cargo = (v.cargo || "").toLowerCase().trim();
          const isVendedor = cargo === "vendedor" || cargo === "vendedora" || cargo === "gerente_comercial" || cargo === "admin" || cargo === "diretor";
          const temNome = v.nome_completo && v.nome_completo.trim().length > 0;
          const naoEU = v.id !== userId;
          return isVendedor && temNome && naoEU;
        });
        console.log("[Transferencia] Filtrados:", filtrados.length);
        setVendedores(filtrados);
      } else {
        const errText = await res.text();
        console.error("[Transferencia] Erro API:", errText);
      }
    } catch (err) {
      console.error("[Transferencia] Catch:", err);
    }
  }, [supabase]);

  useEffect(() => {
    if (open && modoTransferencia) {
      console.log("[Transferencia] Buscando vendedores...");
      fetchVendedores();
    }
  }, [open, modoTransferencia, fetchVendedores]);

  const transferirAtendimento = async (novoVendedorId: string) => {
    if (!atendimento || !novoVendedorId) return;
    setTransferindo(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/atendimentos", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: atendimento.id, vendedor_id: novoVendedorId }),
      });

      if (res.ok) {
        setModoTransferencia(false);
        onClose();
        onMensagemEnviada?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTransferindo(false);
    }
  };

  // Marca como lido quando abre o chat
  const marcarComoLido = useCallback(async () => {
    if (!atendimento || !atendimento.nao_lido) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch("/api/atendimentos", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: atendimento.id, nao_lido: false }),
      });
    } catch (err) {
      console.error(err);
    }
  }, [atendimento, supabase]);

  // Reseta modo transferência quando fecha o dialog ou muda de atendimento
  useEffect(() => {
    if (!open) {
      setModoTransferencia(false);
    }
  }, [open]);

  useEffect(() => {
    if (open && atendimento) {
      fetchMensagens();
      marcarComoLido();
    }
  }, [open, atendimento, fetchMensagens, marcarComoLido]);

  // Scroll to bottom quando mensagens mudam
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  // Polling: atualiza mensagens a cada 3s (Realtime desabilitado para evitar reconexões em loop)
  useEffect(() => {
    if (!atendimento || !open) return;

    const interval = setInterval(() => {
      fetchMensagens();
    }, 3000);

    return () => clearInterval(interval);
  }, [atendimento, open, fetchMensagens]);

  const enviarMensagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaMensagem.trim() || !atendimento) return;

    setEnviando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/atendimentos/mensagens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          atendimento_id: atendimento.id,
          conteudo: novaMensagem.trim(),
          remetente: "vendedor",
        }),
      });

      if (res.ok) {
        setNovaMensagem("");
        fetchMensagens();
        onMensagemEnviada?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEnviando(false);
    }
  };

  const formatarHora = (data: string) => {
    const d = new Date(data);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const nomeCliente = atendimento?.clientes?.nome_razao_social || atendimento?.nome_cliente || "Cliente";
  const telefone = atendimento?.clientes?.telefone || atendimento?.clientes?.celular || atendimento?.telefone_cliente || "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b border-slate-100 shrink-0">
          {modoTransferencia ? (
            <DialogTitle className="text-sm font-semibold text-slate-900">
              Transferir atendimento para:
            </DialogTitle>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
                  {nomeCliente.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold text-slate-900">
                    {nomeCliente}
                  </DialogTitle>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Phone className="h-3 w-3" />
                    <span>{telefone}</span>
                    {atendimento?.status === "aberto" && (
                      <Badge variant="secondary" className="h-4 text-[9px] bg-green-100 text-green-700 px-1.5">
                        Aberto
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs gap-1 text-slate-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => setModoTransferencia(true)}
                  title="Transferir atendimento"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  Transferir
                </Button>
                {onMarcarResolvido && atendimento && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1 border-green-600 text-green-700 hover:bg-green-50"
                    onClick={() => {
                      onMarcarResolvido(atendimento.id);
                      onClose();
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Resolver
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Conteudo: mensagens OU transferencia */}
        {modoTransferencia ? (
          <div className="flex-1 overflow-y-auto p-4 bg-white">
            {vendedores.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Carregando vendedores...
              </div>
            ) : (
              <div className="space-y-1">
                {vendedores.map((v) => (
                  <button
                    key={v.id}
                    disabled={transferindo}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-green-50 text-left transition-colors disabled:opacity-50 border border-transparent hover:border-green-200"
                    onClick={() => transferirAtendimento(v.id)}
                  >
                    <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                      {v.nome_completo.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{v.nome_completo}</p>
                      <p className="text-xs text-slate-400">Clique para transferir</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Área de mensagens */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[50vh] bg-slate-50/50">
              {loading ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                  Carregando mensagens...
                </div>
              ) : mensagens.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-2">
                  <MessageCircle className="h-8 w-8 opacity-40" />
                  <p>Nenhuma mensagem ainda</p>
                </div>
              ) : (
                mensagens.map((msg) => {
                  const isCliente = msg.remetente === "cliente";
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex",
                        isCliente ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                          isCliente
                            ? "bg-green-600 text-white rounded-br-sm"
                            : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
                        )}
                      >
                        <p>{msg.conteudo}</p>
                        <span
                          className={cn(
                            "text-[10px] mt-1 block text-right",
                            isCliente ? "text-green-200" : "text-slate-400"
                          )}
                        >
                          {formatarHora(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input */}
            <form
              onSubmit={enviarMensagem}
              className="px-4 py-3 border-t border-slate-100 shrink-0 bg-white"
            >
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Digite sua resposta..."
                  value={novaMensagem}
                  onChange={(e) => setNovaMensagem(e.target.value)}
                  className="flex-1"
                  disabled={enviando}
                />
                <Button
                  type="submit"
                  size="icon"
                  className="h-9 w-9 bg-green-600 hover:bg-green-700 shrink-0"
                  disabled={enviando || !novaMensagem.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
