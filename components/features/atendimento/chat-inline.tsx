"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Phone, Send, Check, User, MessageCircle, X, ArrowRightLeft, Paperclip, Mic, Square } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface Mensagem {
  id: string;
  remetente: string;
  conteudo: string;
  created_at: string;
  enviada_por?: string | null;
  url_audio?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  file_name?: string | null;
  whatsapp_message_id?: string | null;
  media_key?: string | null;
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
  instancia?: string | null;
  clientes?: { id: string; nome_razao_social: string; telefone?: string; celular?: string } | null;
}

interface InstanciaWhatsApp {
  id: string;
  name: string;
  number: string;
  status: string;
}

interface ChatInlineProps {
  atendimento: Atendimento | null;
  onMarcarResolvido?: (id: string) => void;
  onMensagemEnviada?: () => void;
  onFechar?: () => void;
  /** Instância selecionada globalmente na página */
  instancia?: string;
  /** Lista de instâncias disponíveis (para info no header) */
  instancias?: InstanciaWhatsApp[];
  /** Mensagens vindas do polling externo (page-data) */
  mensagensExternas?: any[];
}

interface Vendedor {
  id: string;
  nome_completo: string;
  cargo: string;
}

export function ChatInline({ atendimento, onMarcarResolvido, onMensagemEnviada, onFechar, instancia, instancias, mensagensExternas }: ChatInlineProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [modoTransferencia, setModoTransferencia] = useState(false);
  const [transferindo, setTransferindo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // States para gravação de áudio
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Determinar instância a usar: se atendimento tem instância própria, usa ela; senão usa a global
  const instanciaAtivo = atendimento?.instancia || instancia || undefined;

  // Encontrar info da instância ativa para exibir no header
  const instanciaInfo = instancias?.find(i => i.name === instanciaAtivo);


  // Busca vendedores para transferência
  const fetchVendedores = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/vendedores", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const todos = data.vendedores || [];
        const userId = session.user.id;
        const filtrados = todos.filter((v: Vendedor) => {
          const cargo = (v.cargo || "").toLowerCase().trim();
          const isVendedor = cargo === "vendedor" || cargo === "vendedora" || cargo === "gerente_comercial" || cargo === "admin" || cargo === "diretor";
          const temNome = v.nome_completo && v.nome_completo.trim().length > 0;
          const naoEU = v.id !== userId;
          return isVendedor && temNome && naoEU;
        });
        setVendedores(filtrados);
      }
    } catch (err) {
      console.error(err);
    }
  }, [supabase]);

  useEffect(() => {
    if (modoTransferencia) {
      fetchVendedores();
    }
  }, [modoTransferencia, fetchVendedores]);

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

  // Reseta modo transferência quando muda de atendimento
  useEffect(() => {
    setModoTransferencia(false);
  }, [atendimento?.id]);

  // Sincronizar mensagens do celular ao abrir conversa e a cada 30s
  const syncFromEvolution = useCallback(async () => {
    if (!atendimento?.telefone_cliente) return;
    try {
      await fetch("/api/atendimentos/sync-from-evolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone: atendimento.telefone_cliente }),
      });
      // Recarregar mensagens após sync
      // Mensagens serão atualizadas pelo polling da página
    } catch (err) {
      // Silencioso - sync é best-effort
    }
  }, [atendimento]);

  // Scroll to bottom quando mensagens mudam
  // Ref rastreia qual atendimento_id ainda precisa de scroll forçado pro final
  const pendingScrollChatId = useRef<string | null>(null);

  // Ao trocar de conversa, marca que precisa de scroll forçado
  useEffect(() => {
    pendingScrollChatId.current = atendimento?.id || null;
  }, [atendimento?.id]);

  // Sempre que mensagens atualizam, verifica se precisa scrollar pro final
  useEffect(() => {
    if (!scrollRef.current || mensagens.length === 0) return;
    const el = scrollRef.current;

    const doScroll = () => {
      if (pendingScrollChatId.current) {
        // Primeira vez depois de trocar de conversa — sempre vai pro final
        el.scrollTop = el.scrollHeight;
        pendingScrollChatId.current = null;
      } else {
        // Só rola pro fundo se já estiver perto do fundo
        const noFundo = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        if (noFundo) {
          el.scrollTop = el.scrollHeight;
        }
      }
    };

    // Double-rAF garante que o DOM já pintou com as mensagens novas
    requestAnimationFrame(() => {
      requestAnimationFrame(doScroll);
    });
  }, [mensagens]);

  // Sincronizar mensagens externas (vindas do polling único da página)
  // Detecta troca de conversa e limpa mensagens imediatamente para evitar
  // que mensagens antigas consumam a flag de scroll
  const prevAtendimentoIdRef = useRef<string | null>(null);
  useEffect(() => {
    // Detectar troca de conversa — limpar mensagens e aguardar dados novos
    if (atendimento?.id !== prevAtendimentoIdRef.current) {
      prevAtendimentoIdRef.current = atendimento?.id || null;
      setMensagens([]);
      setLoading(true);
      return; // Não processar mensagensExternas desatualizadas
    }

    if (mensagensExternas && mensagensExternas.length > 0) {
      const msgs = mensagensExternas.map((m: any) => ({
        id: m.id,
        remetente: m.remetente,
        conteudo: m.conteudo,
        created_at: m.created_at,
        enviada_por: m.enviada_por,
        url_audio: m.url_audio,
        media_url: m.media_url,
        media_type: m.media_type,
        file_name: m.file_name,
        whatsapp_message_id: m.whatsapp_message_id,
        media_key: m.media_key,
      }));
      setMensagens(msgs);
      setLoading(false);
    } else if (mensagensExternas && mensagensExternas.length === 0 && atendimento) {
      // Se não há mensagens na tabela mas o atendimento tem ultima_mensagem
      if (atendimento.ultima_mensagem) {
        setMensagens([{
          id: "virtual-" + atendimento.id,
          remetente: "cliente",
          conteudo: atendimento.ultima_mensagem,
          created_at: atendimento.ultima_mensagem_data || atendimento.created_at || new Date().toISOString(),
          enviada_por: null,
        }]);
      } else {
        setMensagens([]);
      }
      setLoading(false);
    }
  }, [mensagensExternas, atendimento]);

  // Sync inicial com Evolution API ao abrir conversa
  useEffect(() => {
    if (atendimento) {
      marcarComoLido();
      const timer = setTimeout(() => {
        syncFromEvolution();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [atendimento?.id, marcarComoLido, syncFromEvolution]);

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
          instance: instanciaAtivo,
        }),
      });

      if (res.ok) {
        setNovaMensagem("");
        onMensagemEnviada?.();
        onMensagemEnviada?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEnviando(false);
    }
  };

  // Enviar arquivo
  const enviarArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !atendimento) return;

    setEnviando(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const isImage = file.type.startsWith("image/");
        const isAudio = file.type.startsWith("audio/");
        const isVideo = file.type.startsWith("video/");

        let mediatype = "document";
        if (isImage) mediatype = "image";
        else if (isAudio) mediatype = "audio";
        else if (isVideo) mediatype = "video";

        const res = await fetch("/api/send/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            number: atendimento.telefone_cliente,
            mediatype,
            mimetype: file.type,
            media: base64,
            fileName: file.name,
            instance: instanciaAtivo,
          }),
        });

        if (res.ok) {
          // Lê a media_url da resposta (URL do Supabase Storage)
          const resDataArq = await res.json().catch(() => ({}));
          const mediaUrlArq = resDataArq.media_url || null;

          // Salvar no banco
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await fetch("/api/atendimentos/mensagens", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                atendimento_id: atendimento.id,
                conteudo: `[${mediatype}]`,
                remetente: "vendedor",
                media_url: mediaUrlArq,
                media_type: mediatype,
                file_name: file.name,
              }),
            });
          }
          onMensagemEnviada?.();
          onMensagemEnviada?.();
        }
        setEnviando(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Erro ao enviar arquivo:", err);
      setEnviando(false);
    }
    // Limpar input
    e.target.value = "";
  };

  // Gravar áudio
  const iniciarGravacao = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm;codecs=opus" });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(",")[1];

          if (atendimento) {
            try {
              const res = await fetch("/api/send/media", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  number: atendimento.telefone_cliente,
                  mediatype: "audio",
                  mimetype: "audio/ogg; codecs=opus",
                  media: base64,
                  instance: instanciaAtivo,
                }),
              });

              if (res.ok) {
                // Lê a media_url da resposta (URL do Supabase Storage)
                const resData = await res.json().catch(() => ({}));
                const mediaUrlSalvo = resData.media_url || null;

                // Salvar no banco
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                  await fetch("/api/atendimentos/mensagens", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                      atendimento_id: atendimento.id,
                      conteudo: "[Áudio]",
                      remetente: "vendedor",
                      media_type: "audio",
                      media_url: mediaUrlSalvo,
                    }),
                  });
                }
                onMensagemEnviada?.();
                onMensagemEnviada?.();
              }
            } catch (err) {
              console.error("Erro ao enviar áudio:", err);
            }
          }
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Erro ao iniciar gravação:", err);
    }
  };

  const pararGravacao = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  const formatarTempo = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatarHora = (data: string) => {
    const d = new Date(data);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  // Função para renderizar mídia
  const renderMidia = (msg: Mensagem) => {
    if (!msg.media_url && !msg.media_type) return null;

    const isWhatsAppCdn = msg.media_url?.includes("mmg.whatsapp.net");
    const isDataUrl = msg.media_url?.startsWith("data:");
    const isSupabaseStorage = msg.media_url?.includes("supabase.co/storage");

    let mediaUrl: string | null = null;
    if (isWhatsAppCdn && msg.id && !msg.id.startsWith("virtual-")) {
      mediaUrl = `/api/media-download?msg_id=${msg.id}&type=${msg.media_type || "image"}`;
    } else if (isDataUrl || isSupabaseStorage) {
      mediaUrl = msg.media_url!;
    } else if (msg.media_url) {
      mediaUrl = `/api/media?url=${encodeURIComponent(msg.media_url)}&type=${msg.media_type || "image"}`;
    }

    switch (msg.media_type) {
      case "image":
        if (mediaUrl && !mediaUrl.includes("[media_proxy_needed]")) {
          return <img src={mediaUrl} alt="Imagem" className="max-w-[250px] rounded-lg cursor-pointer hover:opacity-90" onClick={() => window.open(mediaUrl, "_blank")} />;
        }
        return <div className="flex items-center gap-2 text-white/40 text-xs"><span className="text-lg">🖼️</span>Imagem recebida</div>;
      case "audio":
        if (mediaUrl && !mediaUrl.includes("[media_proxy_needed]")) {
          // Usar endpoint de download com descriptografia para áudio do WhatsApp
          const audioSrc = msg.id && !msg.id.startsWith("virtual-")
            ? `/api/media-download?msg_id=${msg.id}&type=audio`
            : mediaUrl;
          return (
            <div className="flex items-center gap-2 min-w-[180px]">
              <span className="text-lg">🎵</span>
              <audio controls preload="metadata" className="h-8 flex-1" style={{ filter: "invert(1) hue-rotate(180deg)" }}>
                <source src={audioSrc} />
              </audio>
            </div>
          );
        }
        return <div className="flex items-center gap-2 text-white/40 text-xs"><span className="text-lg">🎵</span>Áudio recebido</div>;
      case "video":
        if (mediaUrl && !mediaUrl.includes("[media_proxy_needed]")) {
          return <video src={mediaUrl} controls className="max-w-[250px] rounded-lg" />;
        }
        return <div className="flex items-center gap-2 text-white/40 text-xs"><span className="text-lg">🎬</span>Vídeo recebido</div>;
      case "document":
        if (mediaUrl && !mediaUrl.includes("[media_proxy_needed]")) {
          return (
            <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
              <span className="text-2xl">📄</span>
              <span className="text-sm truncate">{msg.file_name || "Documento"}</span>
            </a>
          );
        }
        return <div className="flex items-center gap-2 text-white/40 text-xs"><span className="text-lg">📄</span>{msg.file_name || "Documento recebido"}</div>;
      case "sticker":
        if (mediaUrl && !mediaUrl.includes("[media_proxy_needed]")) {
          return <img src={mediaUrl} alt="Sticker" className="max-h-32" />;
        }
        return <div className="text-white/40 text-xs">📎 Figurinha</div>;
      default:
        return null;
    }
  };

  // Se nenhum atendimento selecionado, mostra placeholder
  if (!atendimento) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-white/30 gap-3 bg-[#0a1628]">
        <MessageCircle className="h-16 w-16 opacity-20" />
        <p className="text-sm">Selecione uma conversa para iniciar</p>
      </div>
    );
  }

  const nomeCliente = atendimento?.clientes?.nome_razao_social || atendimento?.nome_cliente || "Cliente";
  const telefone = atendimento?.clientes?.telefone || atendimento?.clientes?.celular || atendimento?.telefone_cliente || "";

  return (
    <div className="h-full flex flex-col bg-[#0a1628]">
      {/* Header do Chat — simplificado (nome + telefone + instância + ações) */}
      <div className="shrink-0 px-4 py-2.5 border-b border-white/10 bg-[#0f1d32]">
        {modoTransferencia ? (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-white/60 hover:text-white"
              onClick={() => setModoTransferencia(false)}
            >
              <X className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-white">Transferir para:</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#3B64CF]/20 flex items-center justify-center text-[#3B64CF] font-bold text-xs shrink-0">
                {nomeCliente.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{nomeCliente}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-white/40">{telefone}</span>
                  {instanciaInfo && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3B64CF]/20 text-[#3B64CF] font-medium">
                      {instanciaInfo.number ? `(${instanciaInfo.number.slice(-4)})` : instanciaInfo.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs gap-1 text-white/50 hover:text-[#3B64CF] hover:bg-[#3B64CF]/10"
                onClick={() => setModoTransferencia(true)}
                title="Transferir atendimento"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
              </Button>
              {onFechar && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs gap-1 text-slate-400 hover:text-slate-600"
                  onClick={onFechar}
                  title="Fechar chat"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

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
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0a1628] min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full text-white/30 text-sm">
                Carregando mensagens...
              </div>
            ) : mensagens.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/30 text-sm gap-2">
                <MessageCircle className="h-8 w-8 opacity-40" />
                <p>Nenhuma mensagem ainda</p>
              </div>
            ) : (
              mensagens.map((msg) => {
                const isCliente = msg.remetente === "cliente";
                const isOperador = msg.remetente === "operador" || msg.remetente === "vendedor";
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      isOperador ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        isOperador
                          ? "bg-[#3B64CF] text-white rounded-br-sm"
                          : "bg-white/10 border border-white/10 text-white/90 rounded-bl-sm"
                      )}
                    >
                      {/* Renderizar mídia ou texto */}
                      {renderMidia(msg) || (
                        <p className="whitespace-pre-wrap break-words">{msg.conteudo}</p>
                      )}
                      
                      {/* Timestamp */}
                      <span
                        className={cn(
                          "text-[10px] mt-1 block text-right",
                          isOperador ? "text-white/50" : "text-white/30"
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
          <div className="px-4 py-3 border-t border-white/10 shrink-0 bg-[#0f1d32]">
            {isRecording ? (
              // Modo gravação
              <div className="flex items-center gap-3">
                <span className="text-red-500 animate-pulse text-lg">🔴</span>
                <span className="text-sm font-medium text-white">{formatarTempo(recordingTime)}</span>
                <Button
                  type="button"
                  onClick={pararGravacao}
                  size="icon"
                  className="h-9 w-9 bg-red-600 hover:bg-red-700 shrink-0"
                >
                  <Square className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              // Modo input normal
              <form onSubmit={enviarMensagem} className="flex items-center gap-2">
                {/* Botão de arquivo */}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={enviarArquivo}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-white/40 hover:text-white hover:bg-white/10"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={enviando}
                  title="Enviar arquivo"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                {/* Botão de gravação */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-white/40 hover:text-white hover:bg-white/10"
                  onClick={iniciarGravacao}
                  disabled={enviando}
                  title="Gravar áudio"
                >
                  <Mic className="h-4 w-4" />
                </Button>

                {/* Input de texto */}
                <Input
                  placeholder="Digite sua resposta..."
                  value={novaMensagem}
                  onChange={(e) => setNovaMensagem(e.target.value)}
                  className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#3B64CF]"
                  disabled={enviando}
                />

                {/* Botão enviar */}
                <Button
                  type="submit"
                  size="icon"
                  className="h-9 w-9 bg-[#3B64CF] hover:bg-[#3B64CF]/80 shrink-0"
                  disabled={enviando || !novaMensagem.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
