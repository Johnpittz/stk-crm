1|"use client";
2|
3|import { useState, useEffect, useCallback } from "react";
4|import {
5|  Select,
6|  SelectContent,
7|  SelectItem,
8|  SelectTrigger,
9|  SelectValue,
10|} from "@/components/ui/select";
11|import {
12|  DragDropContext,
13|  Droppable,
14|  Draggable,
15|  DropResult,
16|} from "@hello-pangea/dnd";
17|import { Clock, AlertCircle, Trash2, MoreHorizontal } from "lucide-react";
18|import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
19|import { Button } from "@/components/ui/button";
20|import { Badge } from "@/components/ui/badge";
21|import { cn } from "@/lib/utils";
22|import { createClient } from "@/lib/supabase/client";
23|import { NovaOportunidadeModal } from "./nova-oportunidade-modal";
24|import { ModalDetalhesOportunidade } from "./modal-detalhes-oportunidade";
25|
26|// ─── Colunas do Funil de Vendas ───
27|const colunas = [
28|  { id: "recebeu_conta", titulo: "Recebeu a Conta", cor: "#5b9bd5", icone: "📥" },
29|  { id: "proposta_feita", titulo: "Proposta a Ser Feita", cor: "#6ba3d6", icone: "📝" },
30|  { id: "proposta_apresentada", titulo: "Proposta Apresentada", cor: "#7fb8e8", icone: "📋" },
31|  { id: "apresentacao_realizada", titulo: "Apresentação Realizada", cor: "#8cc5f0", icone: "🎤" },
32|  { id: "contrato_enviado", titulo: "Contrato Enviado", cor: "#a3d4ff", icone: "📤" },
33|  { id: "contrato_assinado", titulo: "Contrato Assinado", cor: "#34d399", icone: "✅" },
34|  { id: "comissao_paga", titulo: "Comissão Paga", cor: "#4ade80", icone: "💰" },
35|];
36|
37|const coresPrioridade: Record<string, string> = {
38|  baixa: "bg-slate-500/20 text-slate-400 border-slate-500/30",
39|  media: "bg-blue-500/20 text-blue-400 border-blue-500/30",
40|  alta: "bg-orange-500/20 text-orange-400 border-orange-500/30",
41|  urgente: "bg-red-500/20 text-red-400 border-red-500/30",
42|};
43|
44|const origemConfig: Record<string, { icone: string; nome: string; cor: string }> = {
45|  prospeccao_b2b: { icone: "🔍", nome: "Prospecção", cor: "bg-emerald-500/15 text-emerald-400" },
46|  whatsapp: { icone: "💬", nome: "WhatsApp", cor: "bg-green-500/15 text-green-400" },
47|  indicacao: { icone: "🤝", nome: "Indicação", cor: "bg-purple-500/15 text-purple-400" },
48|  site: { icone: "🌐", nome: "Site", cor: "bg-blue-500/15 text-blue-400" },
49|  manual: { icone: "✋", nome: "Manual", cor: "bg-slate-500/15 text-slate-400" },
50|};
51|
52|interface Oportunidade {
53|  id: string;
54|  titulo: string;
55|  descricao: string | null;
56|  tipo: string;
57|  prioridade: string;
58|  status: string;
59|  data_inicio: string | null;
60|  hora_inicio: string | null;
61|  data_fim: string | null;
62|  hora_fim: string | null;
63|  resultado: string | null;
64|  observacao_resultado: string | null;
65|  valor_venda: number | null;
66|  cliente_nome: string | null;
67|  etapa: string;
68|  ordem: number;
69|  origem_lead: string | null;
70|  created_at: string;
71|  clientes: { id: string; nome_razao_social: string } | null;
72|}
73|
74|interface Atendimento {
75|  id: string;
76|  telefone_cliente: string;
77|  nome_cliente: string;
78|  assunto: string;
79|  ultima_mensagem: string;
80|  ultima_mensagem_data: string;
81|  status: string;
82|  transbordado: boolean;
83|  nao_lido: boolean;
84|  vendedor_interagiu: boolean;
85|  ultima_mensagem_remetente: string | null;
86|  data_fechamento?: string | null;
87|  clientes: { id: string; nome_razao_social: string } | null;
88|}
89|
90|interface KanbanOportunidadesProps {
91|  atendimentos: Atendimento[];
92|  onAbrirChat: (a: Atendimento) => void;
93|  onRefresh?: () => void;
94|  onOportunidadeAtualizada?: () => void;
95|  busca?: string;
96|  dataInicio?: string;
97|  dataFim?: string;
98|}
99|
100|export function KanbanOportunidades({
101|  atendimentos,
102|  onAbrirChat,
103|  onRefresh,
104|  onOportunidadeAtualizada,
105|  busca = "",
106|  dataInicio = "",
107|  dataFim = "",
108|}: KanbanTarefasProps) {
109|  const [oportunidades, setOportunidades] = useState<Tarefa[]>([]);
110|  const [loading, setLoading] = useState(true);
111|  const [oportunidadeSelecionada, setOportunidadeSelecionada] = useState<Tarefa | null>(null);
112|  const [modalAberto, setModalAberto] = useState(false);
113|  const [modalConcluindo, setModalConcluindo] = useState(false);
114|  const [filtroColuna, setFiltroColuna] = useState("__TODAS__");
115|  const supabase = createClient();
116|
117|  const fetchOportunidades = useCallback(async () => {
118|    setLoading(true);
119|    try {
120|      const {
121|        data: { session },
122|      } = await supabase.auth.getSession();
123|      if (!session) return;
124|
125|      const res = await fetch("/api/oportunidades", {
126|        headers: { Authorization: `Bearer ${session.access_token}` },
127|      });
128|
129|      const data = await res.json();
130|      if (res.ok) {
131|        setOportunidades(data.tarefas || []);
132|      }
133|    } catch (err) {
134|      console.error(err);
135|    } finally {
136|      setLoading(false);
137|    }
138|  }, [supabase]);
139|
140|  useEffect(() => {
141|    fetchOportunidades();
142|  }, [fetchOportunidades]);
143|
144|  useEffect(() => {
145|    if (onRefresh) fetchOportunidades();
146|  }, [atendimentos, onRefresh, fetchOportunidades]);
147|
148|  const onDragEnd = async (result: DropResult) => {
149|    if (!result.destination) return;
150|
151|    const { source, destination, draggableId } = result;
152|    if (source.droppableId === destination.droppableId) return;
153|
154|    const novaColuna = destination.droppableId;
155|
156|    // Última coluna = comissão paga → abre modal de conclusão
157|    if (novaColuna === "comissao_paga") {
158|      const oportunidadeArrastada = tarefas.find((t) => t.id === draggableId);
159|      if (oportunidadeArrastada) {
160|        setOportunidadeSelecionada(oportunidadeArrastada);
161|        setModalConcluindo(true);
162|        setModalAberto(true);
163|        return;
164|      }
165|    }
166|
167|    const oportunidadesNaColunaDestino = tarefas.filter((t) => t.etapa === novaColuna);
168|    const novaOrdem = oportunidadesNaColunaDestino.length;
169|
170|    setOportunidades((prev) =>
171|      prev.map((t) =>
172|        t.id === draggableId
173|          ? { ...t, etapa: novaColuna, ordem: novaOrdem }
174|          : t
175|      )
176|    );
177|
178|    try {
179|      const {
180|        data: { session },
181|      } = await supabase.auth.getSession();
182|      if (!session) return;
183|
184|      await fetch("/api/oportunidades", {
185|        method: "PATCH",
186|        headers: {
187|          "Content-Type": "application/json",
188|          Authorization: `Bearer ${session.access_token}`,
189|        },
190|        body: JSON.stringify({
191|          id: draggableId,
192|          etapa: novaColuna,
193|          ordem: novaOrdem,
194|        }),
195|      });
196|    } catch (err) {
197|      console.error(err);
198|      fetchOportunidades();
199|    }
200|  };
201|
202|  const handleDelete = async (id: string) => {
203|    if (!confirm("Excluir esta oportunidade?")) return;
204|
205|    try {
206|      const {
207|        data: { session },
208|      } = await supabase.auth.getSession();
209|      if (!session) return;
210|
211|      const res = await fetch(`/api/tarefas?id=${id}`, {
212|        method: "DELETE",
213|        headers: { Authorization: `Bearer ${session.access_token}` },
214|      });
215|
216|      if (res.ok) {
217|        setOportunidades((prev) => prev.filter((t) => t.id !== id));
218|      }
219|    } catch (err) {
220|      console.error(err);
221|    }
222|  };
223|
224|  const oportunidadesFiltradas = tarefas.filter((t) => {
225|    const termo = busca.toLowerCase().trim();
226|    const matchBusca =
227|      !termo ||
228|      t.titulo?.toLowerCase().includes(termo) ||
229|      t.descricao?.toLowerCase().includes(termo) ||
230|      t.clientes?.nome_razao_social?.toLowerCase().includes(termo);
231|
232|    let matchData = true;
233|    const temFiltroData = !!(dataInicio || dataFim);
234|    if (temFiltroData) {
235|      const dtInicio = dataInicio ? new Date(dataInicio + "T00:00:00") : null;
236|      const dtFim = dataFim ? new Date(dataFim + "T23:59:59") : null;
237|      const datas = [t.created_at, t.data_inicio, t.data_fim].filter(Boolean);
238|      if (datas.length > 0) {
239|        const dentroDoPeriodo = datas.some((d) => {
240|          const dt = new Date(d as string);
241|          if (dtInicio && dt < dtInicio) return false;
242|          if (dtFim && dt > dtFim) return false;
243|          return true;
244|        });
245|        if (!dentroDoPeriodo) matchData = false;
246|      }
247|    }
248|
249|    return matchBusca && matchData;
250|  });
251|
252|  const getOportunidadesPorColuna = (colunaId: string) =>
253|    oportunidadesFiltradas
254|      .filter((t) => t.etapa === colunaId)
255|      .sort((a, b) => a.ordem - b.ordem);
256|
257|  const formatHora = (hora: string | null) => {
258|    if (!hora) return "";
259|    return hora.substring(0, 5);
260|  };
261|
262|  return (
263|    <Card className="h-full flex flex-col border-[#1c2e4a] bg-[#0c1426]">
264|      <CardHeader className="pb-2 pt-3 px-4">
265|        <div className="flex items-center justify-between">
266|          <CardTitle className="flex items-center gap-2 text-sm font-semibold text-white">
267|            <span className="text-base">🗂️</span>
268|            Funil de Vendas
269|          </CardTitle>
270|          <div className="flex items-center gap-2">
271|            <Select value={filtroColuna} onValueChange={setFiltroColuna}>
272|              <SelectTrigger className="w-[140px] h-7 text-[11px] bg-[#14233c] border-[#1c2e4a] text-slate-300">
273|                <SelectValue placeholder="Todas" />
274|              </SelectTrigger>
275|              <SelectContent className="bg-[#14233c] border-[#1c2e4a]">
276|                <SelectItem value="__TODAS__">Todas as etapas</SelectItem>
277|                {colunas.map((c) => (
278|                  <SelectItem key={c.id} value={c.id}>
279|                    {c.icone} {c.titulo}
280|                  </SelectItem>
281|                ))}
282|              </SelectContent>
283|            </Select>
284|            <NovaOportunidadeModal onSuccess={fetchOportunidades} />
285|          </div>
286|        </div>
287|      </CardHeader>
288|
289|      <CardContent className="p-2 flex-1 min-h-0 overflow-hidden">
290|        {loading ? (
291|          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
292|            Carregando...
293|          </div>
294|        ) : (
295|          <DragDropContext onDragEnd={onDragEnd}>
296|            <div
297|              className={cn(
298|                "gap-3 h-full overflow-hidden",
299|                filtroColuna === "__TODAS__"
300|                  ? "grid pb-2"
301|                  : "grid grid-cols-1"
302|              )}
303|              style={filtroColuna === "__TODAS__" ? { gridTemplateColumns: "repeat(7, minmax(150px, 1fr))" } : undefined}
304|            >
305|              {colunas
306|                .filter((coluna) => filtroColuna === "__TODAS__" || coluna.id === filtroColuna)
307|                .map((coluna) => {
308|                  const oportunidadesColuna = getOportunidadesPorColuna(coluna.id);
309|                  const totalItems = oportunidadesColuna.length;
310|
311|                  return (
312|                    <div
313|                      key={coluna.id}
314|                      className={cn(
315|                        "flex flex-col rounded-xl min-h-0 min-w-0",
316|                        filtroColuna === "__TODAS__"
317|                          ? ""
318|                          : "w-full"
319|                      )}
320|                      style={{ backgroundColor: `${coluna.cor}15` }}
321|                    >
322|                      {/* Header da Coluna */}
323|                      <div
324|                        className="flex items-center justify-between px-3 py-2 border-b"
325|                        style={{ borderColor: `${coluna.cor}30` }}
326|                      >
327|                        <div className="flex items-center gap-1.5">
328|                          <span className="text-xs">{coluna.icone}</span>
329|                          <h3
330|                            className="font-bold text-xs uppercase tracking-wider"
331|                            style={{ color: coluna.cor }}
332|                          >
333|                            {coluna.titulo}
334|                          </h3>
335|                        </div>
336|                        <span
337|                          className="text-xs font-bold px-2 py-0.5 rounded-full"
338|                          style={{
339|                            backgroundColor: `${coluna.cor}25`,
340|                            color: coluna.cor,
341|                          }}
342|                        >
343|                          {totalItems}
344|                        </span>
345|                      </div>
346|
347|                      {/* Lista de Tarefas */}
348|                      <Droppable droppableId={coluna.id}>
349|                        {(provided, snapshot) => (
350|                          <div
351|                            ref={provided.innerRef}
352|                            {...provided.droppableProps}
353|                            className={cn(
354|                              "flex-1 overflow-y-auto px-3 py-3 min-h-0 space-y-2",
355|                              snapshot.isDraggingOver && "bg-white/5 rounded-lg"
356|                            )}
357|                          >
358|                            {oportunidadesColuna.map((tarefa, index) => (
359|                              <Draggable
360|                                key={oportunidade.id}
361|                                draggableId={oportunidade.id}
362|                                index={index}
363|                              >
364|                                {(provided, snapshot) => (
365|                                  <div
366|                                    ref={provided.innerRef}
367|                                    {...provided.draggableProps}
368|                                    {...provided.dragHandleProps}
369|                                    onClick={() => {
370|                                      setOportunidadeSelecionada(tarefa);
371|                                      setModalAberto(true);
372|                                    }}
373|                                    className={cn(
374|                                      "rounded-lg p-2.5 cursor-grab active:cursor-grabbing group transition-all border",
375|                                      "bg-[#14233c] border-[#1c2e4a] hover:border-[#3B64CF]/50 hover:bg-[#1a2d47]",
376|                                      snapshot.isDragging &&
377|                                        "shadow-lg shadow-black/30 ring-1 ring-[#3B64CF]/50 rotate-1"
378|                                    )}
379|                                  >
380|                                    {/* Prioridade + Ações */}
381|                                    <div className="flex items-center justify-between mb-1.5">
382|                                      <Badge
383|                                        variant="secondary"
384|                                        className={cn(
385|                                          "text-[9px] px-1.5 py-0 border font-medium",
386|                                          coresPrioridade[oportunidade.prioridade] || coresPrioridade.media
387|                                        )}
388|                                      >
389|                                        {oportunidade.prioridade === "urgente" && (
390|                                          <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
391|                                        )}
392|                                        {oportunidade.prioridade}
393|                                      </Badge>
394|                                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
395|                                        <Button
396|                                          variant="ghost"
397|                                          size="icon"
398|                                          className="h-5 w-5 text-slate-500 hover:text-red-400"
399|                                          onClick={(e) => {
400|                                            e.stopPropagation();
401|                                            handleDelete(oportunidade.id);
402|                                          }}
403|                                        >
404|                                          <Trash2 className="h-3 w-3" />
405|                                        </Button>
406|                                      </div>
407|                                    </div>
408|
409|                                    {/* Título */}
410|                                    <p className="font-medium text-white text-[11px] leading-tight mb-1.5 line-clamp-2">
411|                                      {oportunidade.titulo}
412|                                    </p>
413|
414|                                    {/* Origem */}
415|                                    {oportunidade.origem_lead && origemConfig[oportunidade.origem_lead] && (
416|                                      <Badge
417|                                        variant="secondary"
418|                                        className={cn(
419|                                          "text-[8px] px-1 py-0 mb-1.5 border-0",
420|                                          origemConfig[oportunidade.origem_lead].cor
421|                                        )}
422|                                      >
423|                                        {origemConfig[oportunidade.origem_lead].icone}{" "}
424|                                        {origemConfig[oportunidade.origem_lead].nome}
425|                                      </Badge>
426|                                    )}
427|
428|                                    {/* Footer */}
429|                                    <div className="flex items-center justify-between text-[10px] text-slate-500">
430|                                      <span className="truncate max-w-[100px]">
431|                                        {oportunidade.clientes?.nome_razao_social ||
432|                                          oportunidade.cliente_nome ||
433|                                          "—"}
434|                                      </span>
435|                                      {oportunidade.hora_inicio && (
436|                                        <span className="flex items-center gap-0.5 shrink-0">
437|                                          <Clock className="h-2.5 w-2.5" />
438|                                          {formatHora(oportunidade.hora_inicio)}
439|                                        </span>
440|                                      )}
441|                                    </div>
442|
443|                                    {/* Valor da venda */}
444|                                    {oportunidade.valor_venda && oportunidade.valor_venda > 0 && (
445|                                      <div className="mt-1.5 pt-1.5 border-t border-[#1c2e4a]">
446|                                        <span className="text-[10px] font-semibold text-[#3B64CF]">
447|                                          R${" "}
448|                                          {oportunidade.valor_venda.toLocaleString("pt-BR", {
449|                                            minimumFractionDigits: 2,
450|                                          })}
451|                                        </span>
452|                                      </div>
453|                                    )}
454|                                  </div>
455|                                )}
456|                              </Draggable>
457|                            ))}
458|                            {provided.placeholder}
459|
460|                            {/* Empty state */}
461|                            {oportunidadesColuna.length === 0 && (
462|                              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
463|                                <span className="text-2xl mb-2">{coluna.icone}</span>
464|                                <span className="text-xs font-medium">Arraste para aqui</span>
465|                              </div>
466|                            )}
467|                          </div>
468|                        )}
469|                      </Droppable>
470|                    </div>
471|                  );
472|                })}
473|            </div>
474|          </DragDropContext>
475|        )}
476|      </CardContent>
477|
478|      <ModalDetalhesOportunidade
479|        tarefa={oportunidadeSelecionada}
480|        aberto={modalAberto}
481|        onClose={() => {
482|          setModalAberto(false);
483|          setModalConcluindo(false);
484|          setOportunidadeSelecionada(null);
485|        }}
486|        onAtualizar={() => {
487|          fetchOportunidades();
488|          onOportunidadeAtualizada?.();
489|        }}
490|        iniciarConcluindo={modalConcluindo}
491|      />
492|    </Card>
493|  );
494|}
495|