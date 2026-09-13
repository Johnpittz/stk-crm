1|"use client";
2|
3|import { useState, useEffect, useRef, useCallback } from "react";
4|import { Button } from "@/components/ui/button";
5|import { ScrollArea } from "@/components/ui/scroll-area";
6|import { Input } from "@/components/ui/input";
7|import { Badge } from "@/components/ui/badge";
8|import { Phone, Send, Check, User, MessageCircle, X, ArrowRightLeft, Paperclip, Mic, Square } from "lucide-react";
9|import { createClient } from "@/lib/supabase/client";
10|import { cn } from "@/lib/utils";
11|import { AlertaContaDetectada } from "./alerta-conta-detectada";
12|
13|interface Mensagem {
14|  id: string;
15|  remetente: string;
16|  conteudo: string;
17|  created_at: string;
18|  enviada_por?: string | null;
19|  url_audio?: string | null;
20|  media_url?: string | null;
21|  media_type?: string | null;
22|  file_name?: string | null;
23|  whatsapp_message_id?: string | null;
24|  media_key?: string | null;
25|}
26|
27|interface Atendimento {
28|  id: string;
29|  telefone_cliente: string;
30|  nome_cliente: string;
31|  status: string;
32|  ultima_mensagem?: string | null;
33|  ultima_mensagem_data?: string | null;
34|  ultima_mensagem_remetente?: string | null;
35|  nao_lido?: boolean;
36|  created_at?: string;
37|  cliente_id?: string | null;
38|  instancia?: string | null;
39|  clientes?: { id: string; nome_razao_social: string; telefone?: string; celular?: string } | null;
40|}
41|
42|interface InstanciaWhatsApp {
43|  id: string;
44|  name: string;
45|  number: string;
46|  status: string;
47|}
48|
49|interface ChatInlineProps {
50|  atendimento: Atendimento | null;
51|  onMarcarResolvido?: (id: string) => void;
52|  onMensagemEnviada?: () => void;
53|  onFechar?: () => void;
54|  /** Instância selecionada globalmente na página */
55|  instancia?: string;
56|  /** Lista de instâncias disponíveis (para info no header) */
57|  instancias?: InstanciaWhatsApp[];
58|  /** Mensagens vindas do polling externo (page-data) */
59|  mensagensExternas?: any[];
60|}
61|
62|interface Vendedor {
63|  id: string;
64|  nome_completo: string;
65|  cargo: string;
66|}
67|
68|export function ChatInline({ atendimento, onMarcarResolvido, onMensagemEnviada, onFechar, instancia, instancias, mensagensExternas }: ChatInlineProps) {
69|  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
70|  const [novaMensagem, setNovaMensagem] = useState("");
71|  const [loading, setLoading] = useState(false);
72|  const [enviando, setEnviando] = useState(false);
73|  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
74|  const [modoTransferencia, setModoTransferencia] = useState(false);
75|  const [transferindo, setTransferindo] = useState(false);
76|  const scrollRef = useRef<HTMLDivElement>(null);
77|  const supabase = createClient();
78|  const fileInputRef = useRef<HTMLInputElement>(null);
79|  
80|  // States para gravação de áudio
81|  const [isRecording, setIsRecording] = useState(false);
82|  const [recordingTime, setRecordingTime] = useState(0);
83|  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
84|  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
85|  const audioChunksRef = useRef<Blob[]>([]);
86|
87|  // State para alerta de conta detectada
88|  const [alertaConta, setAlertaConta] = useState<{
89|    detectou: boolean;
90|    confianca: number;
91|    dados: any;
92|    mensagemId?: string;
93|  } | null>(null);
94|
95|  // Determinar instância a usar: se atendimento tem instância própria, usa ela; senão usa a global
96|  const instanciaAtivo = atendimento?.instancia || instancia || undefined;
97|
98|  // Encontrar info da instância ativa para exibir no header
99|  const instanciaInfo = instancias?.find(i => i.name === instanciaAtivo);
100|
101|
102|  // Busca vendedores para transferência
103|  const fetchVendedores = useCallback(async () => {
104|    try {
105|      const { data: { session } } = await supabase.auth.getSession();
106|      if (!session) return;
107|
108|      const res = await fetch("/api/vendedores", {
109|        headers: { Authorization: `Bearer ${session.access_token}` },
110|      });
111|
112|      if (res.ok) {
113|        const data = await res.json();
114|        const todos = data.vendedores || [];
115|        const userId = session.user.id;
116|        const filtrados = todos.filter((v: Vendedor) => {
117|          const cargo = (v.cargo || "").toLowerCase().trim();
118|          const isVendedor = cargo === "vendedor" || cargo === "vendedora" || cargo === "gerente_comercial" || cargo === "admin" || cargo === "diretor";
119|          const temNome = v.nome_completo && v.nome_completo.trim().length > 0;
120|          const naoEU = v.id !== userId;
121|          return isVendedor && temNome && naoEU;
122|        });
123|        setVendedores(filtrados);
124|      }
125|    } catch (err) {
126|      console.error(err);
127|    }
128|  }, [supabase]);
129|
130|  useEffect(() => {
131|    if (modoTransferencia) {
132|      fetchVendedores();
133|    }
134|  }, [modoTransferencia, fetchVendedores]);
135|
136|  const transferirAtendimento = async (novoVendedorId: string) => {
137|    if (!atendimento || !novoVendedorId) return;
138|    setTransferindo(true);
139|    try {
140|      const { data: { session } } = await supabase.auth.getSession();
141|      if (!session) return;
142|
143|      const res = await fetch("/api/atendimentos", {
144|        method: "PATCH",
145|        headers: {
146|          "Content-Type": "application/json",
147|          Authorization: `Bearer ${session.access_token}`,
148|        },
149|        body: JSON.stringify({ id: atendimento.id, vendedor_id: novoVendedorId }),
150|      });
151|
152|      if (res.ok) {
153|        setModoTransferencia(false);
154|        onMensagemEnviada?.();
155|      }
156|    } catch (err) {
157|      console.error(err);
158|    } finally {
159|      setTransferindo(false);
160|    }
161|  };
162|
163|  // Marca como lido quando abre o chat
164|  const marcarComoLido = useCallback(async () => {
165|    if (!atendimento || !atendimento.nao_lido) return;
166|    try {
167|      const { data: { session } } = await supabase.auth.getSession();
168|      if (!session) return;
169|
170|      await fetch("/api/atendimentos", {
171|        method: "PATCH",
172|        headers: {
173|          "Content-Type": "application/json",
174|          Authorization: `Bearer ${session.access_token}`,
175|        },
176|        body: JSON.stringify({ id: atendimento.id, nao_lido: false }),
177|      });
178|    } catch (err) {
179|      console.error(err);
180|    }
181|  }, [atendimento, supabase]);
182|
183|  // Reseta modo transferência quando muda de atendimento
184|  useEffect(() => {
185|    setModoTransferencia(false);
186|  }, [atendimento?.id]);
187|
188|  // Sincronizar mensagens do celular ao abrir conversa e a cada 30s
189|  const syncFromEvolution = useCallback(async () => {
190|    if (!atendimento?.telefone_cliente) return;
191|    try {
192|      await fetch("/api/atendimentos/sync-from-evolution", {
193|        method: "POST",
194|        headers: { "Content-Type": "application/json" },
195|        body: JSON.stringify({ telefone: atendimento.telefone_cliente }),
196|      });
197|      // Recarregar mensagens após sync
198|      // Mensagens serão atualizadas pelo polling da página
199|    } catch (err) {
200|      // Silencioso - sync é best-effort
201|    }
202|  }, [atendimento]);
203|
204|  // Detectar conta de energia em mensagens novas
205|  const detectarConta = useCallback(async (mensagem: Mensagem) => {
206|    // Só analisar mensagens de cliente com imagem ou PDF
207|    if (mensagem.remetente !== "cliente") return;
208|    if (!mensagem.media_url && !mensagem.file_name) return;
209|    
210|    const isMedia = mensagem.media_type?.startsWith("image/") || 
211|                    mensagem.media_type === "application/pdf" ||
212|                    mensagem.file_name?.endsWith(".pdf");
213|    if (!isMedia) return;
214|
215|    try {
216|      const { data: { session } } = await supabase.auth.getSession();
217|      if (!session) return;
218|
219|      // Primeiro, analisar nome do arquivo
220|      const res = await fetch("/api/atendimentos/detectar-conta", {
221|        method: "POST",
222|        headers: {
223|          "Content-Type": "application/json",
224|          Authorization: `Bearer ${session.access_token}`,
225|        },
226|        body: JSON.stringify({
227|          nome_arquivo: mensagem.file_name || "",
228|          tipo_arquivo: mensagem.media_type || "",
229|          texto_mensagem: mensagem.conteudo || "",
230|        }),
231|      });
232|
233|      if (res.ok) {
234|        const resultado = await res.json();
235|        if (resultado.detectou || resultado.confianca >= 0.3) {
236|          setAlertaConta({
237|            detectou: resultado.detectou,
238|            confianca: resultado.confianca,
239|            dados: resultado.dados_extraidos || {},
240|            mensagemId: mensagem.id,
241|          });
242|        }
243|      }
244|    } catch (err) {
245|      console.error("Erro ao detectar conta:", err);
246|    }
247|  }, [supabase]);
248|
249|  // Verificar última mensagem quando mensagens mudam
250|  useEffect(() => {
251|    if (mensagens.length > 0) {
252|      const ultimaMsg = mensagens[mensagens.length - 1];
253|      // Só verificar se é nova (últimos 60 segundos)
254|      const msgTime = new Date(ultimaMsg.created_at).getTime();
255|      const agora = Date.now();
256|      if (agora - msgTime < 60000) {
257|        detectarConta(ultimaMsg);
258|      }
259|    }
260|  }, [mensagens, detectarConta]);
261|
262|  // Scroll to bottom quando mensagens mudam
263|  // Ref rastreia qual atendimento_id ainda precisa de scroll forçado pro final
264|  const pendingScrollChatId = useRef<string | null>(null);
265|
266|  // Ao trocar de conversa, marca que precisa de scroll forçado
267|  useEffect(() => {
268|    pendingScrollChatId.current = atendimento?.id || null;
269|  }, [atendimento?.id]);
270|
271|  // Sempre que mensagens atualizam, verifica se precisa scrollar pro final
272|  useEffect(() => {
273|    if (!scrollRef.current || mensagens.length === 0) return;
274|    const el = scrollRef.current;
275|
276|    const doScroll = () => {
277|      if (pendingScrollChatId.current) {
278|        // Primeira vez depois de trocar de conversa — sempre vai pro final
279|        el.scrollTop = el.scrollHeight;
280|        pendingScrollChatId.current = null;
281|      } else {
282|        // Só rola pro fundo se já estiver perto do fundo
283|        const noFundo = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
284|        if (noFundo) {
285|          el.scrollTop = el.scrollHeight;
286|        }
287|      }
288|    };
289|
290|    // Double-rAF garante que o DOM já pintou com as mensagens novas
291|    requestAnimationFrame(() => {
292|      requestAnimationFrame(doScroll);
293|    });
294|  }, [mensagens]);
295|
296|  // Sincronizar mensagens externas (vindas do polling único da página)
297|  // Detecta troca de conversa e limpa mensagens imediatamente para evitar
298|  // que mensagens antigas consumam a flag de scroll
299|  const prevAtendimentoIdRef = useRef<string | null>(null);
300|  useEffect(() => {
301|    // Detectar troca de conversa — limpar mensagens e aguardar dados novos
302|    if (atendimento?.id !== prevAtendimentoIdRef.current) {
303|      prevAtendimentoIdRef.current = atendimento?.id || null;
304|      setMensagens([]);
305|      setLoading(true);
306|      return; // Não processar mensagensExternas desatualizadas
307|    }
308|
309|    if (mensagensExternas && mensagensExternas.length > 0) {
310|      const msgs = mensagensExternas.map((m: any) => ({
311|        id: m.id,
312|        remetente: m.remetente,
313|        conteudo: m.conteudo,
314|        created_at: m.created_at,
315|        enviada_por: m.enviada_por,
316|        url_audio: m.url_audio,
317|        media_url: m.media_url,
318|        media_type: m.media_type,
319|        file_name: m.file_name,
320|        whatsapp_message_id: m.whatsapp_message_id,
321|        media_key: m.media_key,
322|      }));
323|      setMensagens(msgs);
324|      setLoading(false);
325|    } else if (mensagensExternas && mensagensExternas.length === 0 && atendimento) {
326|      // Se não há mensagens na tabela mas o atendimento tem ultima_mensagem
327|      if (atendimento.ultima_mensagem) {
328|        setMensagens([{
329|          id: "virtual-" + atendimento.id,
330|          remetente: "cliente",
331|          conteudo: atendimento.ultima_mensagem,
332|          created_at: atendimento.ultima_mensagem_data || atendimento.created_at || new Date().toISOString(),
333|          enviada_por: null,
334|        }]);
335|      } else {
336|        setMensagens([]);
337|      }
338|      setLoading(false);
339|    }
340|  }, [mensagensExternas, atendimento]);
341|
342|  // Sync inicial com Evolution API ao abrir conversa
343|  useEffect(() => {
344|    if (atendimento) {
345|      marcarComoLido();
346|      const timer = setTimeout(() => {
347|        syncFromEvolution();
348|      }, 5000);
349|      return () => clearTimeout(timer);
350|    }
351|  }, [atendimento?.id, marcarComoLido, syncFromEvolution]);
352|
353|  const enviarMensagem = async (e: React.FormEvent) => {
354|    e.preventDefault();
355|    if (!novaMensagem.trim() || !atendimento) return;
356|
357|    setEnviando(true);
358|    try {
359|      const { data: { session } } = await supabase.auth.getSession();
360|      if (!session) return;
361|
362|      const res = await fetch("/api/atendimentos/mensagens", {
363|        method: "POST",
364|        headers: {
365|          "Content-Type": "application/json",
366|          Authorization: `Bearer ${session.access_token}`,
367|        },
368|        body: JSON.stringify({
369|          atendimento_id: atendimento.id,
370|          conteudo: novaMensagem.trim(),
371|          remetente: "vendedor",
372|          instance: instanciaAtivo,
373|        }),
374|      });
375|
376|      if (res.ok) {
377|        setNovaMensagem("");
378|        onMensagemEnviada?.();
379|        onMensagemEnviada?.();
380|      }
381|    } catch (err) {
382|      console.error(err);
383|    } finally {
384|      setEnviando(false);
385|    }
386|  };
387|
388|  // Enviar arquivo
389|  const enviarArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
390|    const file = e.target.files?.[0];
391|    if (!file || !atendimento) return;
392|
393|    setEnviando(true);
394|    try {
395|      const reader = new FileReader();
396|      reader.onload = async () => {
397|        const base64 = (reader.result as string).split(",")[1];
398|        const isImage = file.type.startsWith("image/");
399|        const isAudio = file.type.startsWith("audio/");
400|        const isVideo = file.type.startsWith("video/");
401|
402|        let mediatype = "document";
403|        if (isImage) mediatype = "image";
404|        else if (isAudio) mediatype = "audio";
405|        else if (isVideo) mediatype = "video";
406|
407|        const res = await fetch("/api/send/media", {
408|          method: "POST",
409|          headers: { "Content-Type": "application/json" },
410|          body: JSON.stringify({
411|            number: atendimento.telefone_cliente,
412|            mediatype,
413|            mimetype: file.type,
414|            media: base64,
415|            fileName: file.name,
416|            instance: instanciaAtivo,
417|          }),
418|        });
419|
420|        if (res.ok) {
421|          // Lê a media_url da resposta (URL do Supabase Storage)
422|          const resDataArq = await res.json().catch(() => ({}));
423|          const mediaUrlArq = resDataArq.media_url || null;
424|
425|          // Salvar no banco
426|          const { data: { session } } = await supabase.auth.getSession();
427|          if (session) {
428|            await fetch("/api/atendimentos/mensagens", {
429|              method: "POST",
430|              headers: {
431|                "Content-Type": "application/json",
432|                Authorization: `Bearer ${session.access_token}`,
433|              },
434|              body: JSON.stringify({
435|                atendimento_id: atendimento.id,
436|                conteudo: `[${mediatype}]`,
437|                remetente: "vendedor",
438|                media_url: mediaUrlArq,
439|                media_type: mediatype,
440|                file_name: file.name,
441|              }),
442|            });
443|          }
444|          onMensagemEnviada?.();
445|          onMensagemEnviada?.();
446|        }
447|        setEnviando(false);
448|      };
449|      reader.readAsDataURL(file);
450|    } catch (err) {
451|      console.error("Erro ao enviar arquivo:", err);
452|      setEnviando(false);
453|    }
454|    // Limpar input
455|    e.target.value = "";
456|  };
457|
458|  // Gravar áudio
459|  const iniciarGravacao = async () => {
460|    try {
461|      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
462|      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
463|      mediaRecorderRef.current = mediaRecorder;
464|      audioChunksRef.current = [];
465|
466|      mediaRecorder.ondataavailable = (event) => {
467|        if (event.data.size > 0) {
468|          audioChunksRef.current.push(event.data);
469|        }
470|      };
471|
472|      mediaRecorder.onstop = async () => {
473|        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm;codecs=opus" });
474|        const reader = new FileReader();
475|        reader.onload = async () => {
476|          const base64 = (reader.result as string).split(",")[1];
477|
478|          if (atendimento) {
479|            try {
480|              const res = await fetch("/api/send/media", {
481|                method: "POST",
482|                headers: { "Content-Type": "application/json" },
483|                body: JSON.stringify({
484|                  number: atendimento.telefone_cliente,
485|                  mediatype: "audio",
486|                  mimetype: "audio/ogg; codecs=opus",
487|                  media: base64,
488|                  instance: instanciaAtivo,
489|                }),
490|              });
491|
492|              if (res.ok) {
493|                // Lê a media_url da resposta (URL do Supabase Storage)
494|                const resData = await res.json().catch(() => ({}));
495|                const mediaUrlSalvo = resData.media_url || null;
496|
497|                // Salvar no banco
498|                const { data: { session } } = await supabase.auth.getSession();
499|                if (session) {
500|                  await fetch("/api/atendimentos/mensagens", {
501|