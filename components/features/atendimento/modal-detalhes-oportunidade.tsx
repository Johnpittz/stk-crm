1|"use client";
2|
3|import { useState, useEffect } from "react";
4|import {
5|  Dialog,
6|  DialogContent,
7|  DialogHeader,
8|  DialogTitle,
9|} from "@/components/ui/dialog";
10|import { Button } from "@/components/ui/button";
11|import { Badge } from "@/components/ui/badge";
12|import { Input } from "@/components/ui/input";
13|
14|import {
15|  Select,
16|  SelectContent,
17|  SelectItem,
18|  SelectTrigger,
19|  SelectValue,
20|} from "@/components/ui/select";
21|import { Label } from "@/components/ui/label";
22|import {
23|  Calendar,
24|  Clock,
25|  CheckCircle2,
26|  Trash2,
27|  ArrowRight,
28|  AlertCircle,
29|  Save,
30|  X,
31|  Check,
32|} from "lucide-react";
33|import { cn } from "@/lib/utils";
34|import { createClient } from "@/lib/supabase/client";
35|
36|interface OportunidadeCompleta {
37|  id: string;
38|  titulo: string;
39|  descricao: string | null;
40|  tipo: string;
41|  prioridade: string;
42|  status: string;
43|  etapa: string;
44|  data_inicio: string | null;
45|  hora_inicio: string | null;
46|  data_fim: string | null;
47|  hora_fim: string | null;
48|  resultado: string | null;
49|  observacao_resultado: string | null;
50|  valor_venda: number | null;
51|  cliente_nome: string | null;
52|  clientes: { id: string; nome_razao_social: string } | null;
53|}
54|
55|const iconesTarefa: Record<string, string> = {
56|  visita: "🏢",
57|  ligacao: "📞",
58|  whatsapp: "💬",
59|  email: "📧",
60|  reuniao: "🤝",
61|  follow_up: "🔄",
62|  prospeccao: "🔍",
63|  outro: "📋",
64|};
65|
66|const labelsTipo: Record<string, string> = {
67|  visita: "Visita",
68|  ligacao: "Ligação",
69|  whatsapp: "WhatsApp",
70|  email: "E-mail",
71|  reuniao: "Reunião",
72|  follow_up: "Follow-up",
73|  prospeccao: "Prospecção",
74|  outro: "Outro",
75|};
76|
77|const labelsResultado: Record<string, { label: string; cor: string }> = {
78|  sucesso: { label: "✅ Sucesso", cor: "bg-emerald-100 text-emerald-700" },
79|  insucesso: { label: "❌ Insucesso", cor: "bg-red-100 text-red-700" },
80|  remarcado: { label: "📅 Remarcado", cor: "bg-blue-100 text-blue-700" },
81|  sem_contato: { label: "📞 Sem contato", cor: "bg-amber-100 text-amber-700" },
82|  follow_up_necessario: { label: "🔄 Follow-up", cor: "bg-purple-100 text-purple-700" },
83|};
84|
85|const coresPrioridade: Record<string, string> = {
86|  baixa: "bg-slate-100 text-slate-700",
87|  media: "bg-blue-100 text-blue-700",
88|  alta: "bg-orange-100 text-orange-700",
89|  urgente: "bg-red-100 text-red-700",
90|};
91|
92|const opcoesObservacao: Record<string, string[]> = {
93|  sucesso: ["Venda fechada", "Orçamento enviado", "Reunião agendada", "Parceria firmada"],
94|  insucesso: ["Sem interesse", "Preço elevado", "Escolheu concorrente", "Não é público-alvo"],
95|  remarcado: ["Cliente pediu retorno", "Agenda lotada", "Aguardando decisão"],
96|  sem_contato: ["Não atendeu", "Número inválido", "Sem WhatsApp", "Caixa postal"],
97|  follow_up_necessario: ["Enviar orçamento", "Confirmar reunião", "Verificar disponibilidade", "Aguardando retorno"],
98|};
99|
100|interface ModalDetalhesOportunidadeProps {
101|  tarefa: OportunidadeCompleta | null;
102|  aberto: boolean;
103|  onClose: () => void;
104|  onAtualizar: () => void;
105|  iniciarConcluindo?: boolean;
106|}
107|
108|export function ModalDetalhesOportunidade({
109|  tarefa,
110|  aberto,
111|  onClose,
112|  onAtualizar,
113|  iniciarConcluindo = false,
114|}: ModalDetalhesOportunidadeProps) {
115|  const [editando, setEditando] = useState(false);
116|  const [concluindo, setConcluindo] = useState(false);
117|  const [salvando, setSalvando] = useState(false);
118|  const supabase = createClient();
119|
120|  const [form, setForm] = useState({
121|    titulo: "",
122|    descricao: "",
123|    prioridade: "media",
124|    valorVenda: "" as string,
125|  });
126|
127|  const [resultadoForm, setResultadoForm] = useState({
128|    resultado: "" as string,
129|    observacao: "" as string,
130|    valorVenda: "" as string,
131|  });
132|
133|  // Quando abre no modo conclusão, inicializa form
134|  useEffect(() => {
135|    if (aberto && iniciarConcluindo && tarefa && tarefa.etapa !== "concluida") {
136|      setConcluindo(true);
137|      setEditando(false);
138|      setForm({
139|        titulo: tarefa.titulo,
140|        descricao: tarefa.descricao || "",
141|        prioridade: tarefa.prioridade,
142|        valorVenda: "",
143|      });
144|      setResultadoForm({ resultado: "", observacao: "", valorVenda: "" });
145|    } else if (aberto && tarefa && !iniciarConcluindo) {
146|      // Inicializa form com dados da tarefa
147|      const valorFormatado = tarefa.valor_venda
148|        ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(tarefa.valor_venda)
149|        : "";
150|      setForm({
151|        titulo: tarefa.titulo,
152|        descricao: tarefa.descricao || "",
153|        prioridade: tarefa.prioridade,
154|        valorVenda: valorFormatado,
155|      });
156|    } else if (!aberto) {
157|      setConcluindo(false);
158|      setEditando(false);
159|      setResultadoForm({ resultado: "", observacao: "", valorVenda: "" });
160|    }
161|  }, [aberto, iniciarConcluindo, tarefa]);
162|
163|  const handleSalvarEdicao = async () => {
164|    if (!tarefa) return;
165|    setSalvando(true);
166|    try {
167|      const { data: { session } } = await supabase.auth.getSession();
168|      if (!session) return;
169|
170|      const body: any = {
171|        id: tarefa.id,
172|        titulo: form.titulo,
173|        descricao: form.descricao,
174|        prioridade: form.prioridade,
175|      };
176|
177|      if (tarefa.resultado === "sucesso" && form.valorVenda) {
178|        body.valor_venda = parseFloat(form.valorVenda.replace(/\./g, "").replace(",", "."));
179|      }
180|
181|      const res = await fetch("/api/oportunidades", {
182|        method: "PATCH",
183|        headers: {
184|          "Content-Type": "application/json",
185|          Authorization: `Bearer ${session.access_token}`,
186|        },
187|        body: JSON.stringify(body),
188|      });
189|
190|      if (res.ok) {
191|        setEditando(false);
192|        onAtualizar();
193|        onClose();
194|      }
195|    } catch (err) {
196|      console.error(err);
197|    } finally {
198|      setSalvando(false);
199|    }
200|  };
201|
202|  const handleMover = async (coluna: string) => {
203|    if (!tarefa) return;
204|
205|    if (coluna === "concluida") {
206|      setConcluindo(true);
207|      setForm({
208|        titulo: tarefa.titulo,
209|        descricao: tarefa.descricao || "",
210|        prioridade: tarefa.prioridade,
211|        valorVenda: "",
212|      });
213|      setResultadoForm({ resultado: "", observacao: "", valorVenda: "" });
214|      return;
215|    }
216|
217|    try {
218|      const { data: { session } } = await supabase.auth.getSession();
219|      if (!session) return;
220|
221|      await fetch("/api/oportunidades", {
222|        method: "PATCH",
223|        headers: {
224|          "Content-Type": "application/json",
225|          Authorization: `Bearer ${session.access_token}`,
226|        },
227|        body: JSON.stringify({
228|          id: tarefa.id,
229|          etapa: coluna,
230|          status: coluna === "em_andamento" ? "em_andamento" : "pendente",
231|        }),
232|      });
233|      onAtualizar();
234|      onClose();
235|    } catch (err) {
236|      console.error(err);
237|    }
238|  };
239|
240|  const handleConfirmarConclusao = async () => {
241|    if (!tarefa) return;
242|    if (!resultadoForm.resultado) return;
243|    if (!resultadoForm.observacao) return;
244|    if (resultadoForm.resultado === "sucesso" && !resultadoForm.valorVenda) return;
245|
246|    setSalvando(true);
247|    try {
248|      const { data: { session } } = await supabase.auth.getSession();
249|      if (!session) return;
250|
251|      const body: any = {
252|        id: tarefa.id,
253|        etapa: "concluida",
254|        status: "concluida",
255|        titulo: form.titulo,
256|        descricao: form.descricao,
257|        prioridade: form.prioridade,
258|        resultado: resultadoForm.resultado,
259|        observacao_resultado: resultadoForm.observacao,
260|      };
261|
262|      if (resultadoForm.resultado === "sucesso" && resultadoForm.valorVenda) {
263|        body.valor_venda = parseFloat(resultadoForm.valorVenda.replace(/\./g, "").replace(",", "."));
264|      }
265|
266|      await fetch("/api/oportunidades", {
267|        method: "PATCH",
268|        headers: {
269|          "Content-Type": "application/json",
270|          Authorization: `Bearer ${session.access_token}`,
271|        },
272|        body: JSON.stringify(body),
273|      });
274|      setConcluindo(false);
275|      onAtualizar();
276|      onClose();
277|    } catch (err) {
278|      console.error(err);
279|    } finally {
280|      setSalvando(false);
281|    }
282|  };
283|
284|  const handleExcluir = async () => {
285|    if (!tarefa) return;
286|    if (!confirm("Excluir esta tarefa?")) return;
287|
288|    try {
289|      const { data: { session } } = await supabase.auth.getSession();
290|      if (!session) return;
291|
292|      const res = await fetch(`/api/tarefas?id=${tarefa.id}`, {
293|        method: "DELETE",
294|        headers: { Authorization: `Bearer ${session.access_token}` },
295|      });
296|
297|      if (res.ok) {
298|        onAtualizar();
299|        onClose();
300|      }
301|    } catch (err) {
302|      console.error(err);
303|    }
304|  };
305|
306|  const formatData = (data: string | null) => {
307|    if (!data) return "—";
308|    return new Date(data).toLocaleDateString("pt-BR");
309|  };
310|
311|  if (!tarefa) return null;
312|
313|  const isConcluida = tarefa.etapa === "concluida";
314|  const isAndamento = tarefa.etapa === "em_andamento";
315|  const podeEditar = isConcluida;
316|  const podeConcluir = isAndamento;
317|
318|  return (
319|    <Dialog open={aberto} onOpenChange={(open) => !open && onClose()}>
320|      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
321|        <DialogHeader>
322|          <div className="flex items-center gap-2">
323|            <span className="text-xl">{iconesTarefa[tarefa.tipo] || "📋"}</span>
324|            {(editando || concluindo) ? (
325|              <Input
326|                value={form.titulo}
327|                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
328|                className="font-semibold text-lg h-9"
329|              />
330|            ) : (
331|              <DialogTitle className="text-lg">{tarefa.titulo}</DialogTitle>
332|            )}
333|          </div>
334|        </DialogHeader>
335|
336|        <div className="space-y-4">
337|          {/* Metadados */}
338|          <div className="flex flex-wrap items-center gap-2">
339|            <Badge variant="secondary" className={cn(coresPrioridade[tarefa.prioridade] || coresPrioridade.media)}>
340|              {tarefa.prioridade === "urgente" && <AlertCircle className="h-3 w-3 mr-1" />}
341|              {(editando || concluindo) ? form.prioridade : tarefa.prioridade}
342|            </Badge>
343|            <Badge variant="outline" className="text-xs">{labelsTipo[tarefa.tipo] || tarefa.tipo}</Badge>
344|            <Badge variant="secondary" className={cn(
345|              isConcluida ? "bg-emerald-100 text-emerald-700" : isAndamento ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
346|            )}>
347|              {isConcluida ? "Concluído" : isAndamento ? "Andamento" : "A Fazer"}
348|            </Badge>
349|          </div>
350|
351|          {/* Cliente */}
352|          {(tarefa.clientes?.nome_razao_social || tarefa.cliente_nome) && (
353|            <div className="text-sm">
354|              <span className="text-slate-500">Cliente:</span>{" "}
355|              <span className="font-medium">{tarefa.clientes?.nome_razao_social || tarefa.cliente_nome}</span>
356|            </div>
357|          )}
358|
359|          {/* Datas */}
360|          <div className="grid grid-cols-2 gap-3 text-sm">
361|            <div>
362|              <span className="text-slate-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Início</span>
363|              <span className="font-medium">{formatData(tarefa.data_inicio)}</span>
364|            </div>
365|            <div>
366|              <span className="text-slate-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Prazo</span>
367|              <span className="font-medium">{formatData(tarefa.data_fim)}</span>
368|            </div>
369|          </div>
370|
371|          {/* Descrição */}
372|          <div>
373|            <Label className="text-xs text-slate-500">Descrição</Label>
374|            {(editando || concluindo) ? (
375|              <textarea
376|                value={form.descricao}
377|                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
378|                rows={3}
379|                className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
380|              />
381|            ) : (
382|              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{tarefa.descricao || "Sem descrição"}</p>
383|            )}
384|          </div>
385|
386|          {/* Resultado (só mostra se tiver sido concluída com resultado) */}
387|          {tarefa.resultado && !concluindo && (
388|            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
389|              <Label className="text-xs text-slate-500">Resultado da execução</Label>
390|              <div className="flex items-center gap-2 mt-1 mb-2">
391|                <Badge variant="secondary" className={cn(labelsResultado[tarefa.resultado]?.cor || "bg-slate-100 text-slate-700")}>
392|                  {labelsResultado[tarefa.resultado]?.label || tarefa.resultado}
393|                </Badge>
394|              </div>
395|              {tarefa.observacao_resultado && (
396|                <p className="text-sm text-slate-700 whitespace-pre-wrap">{tarefa.observacao_resultado}</p>
397|              )}
398|              {tarefa.resultado === "sucesso" && tarefa.valor_venda && (
399|                <div className="mt-2 pt-2 border-t border-slate-200">
400|                  <span className="text-xs text-slate-500">Valor da Venda:</span>
401|                  <span className="ml-2 text-sm font-bold text-emerald-700">
402|                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(tarefa.valor_venda)}
403|                  </span>
404|                </div>
405|              )}
406|            </div>
407|          )}
408|
409|          {/* Campo valor editável no modo edição (concluída com sucesso) */}
410|          {editando && tarefa.resultado === "sucesso" && (
411|            <div>
412|              <Label className="text-xs">Valor da Venda (R$)</Label>
413|              <Input
414|                type="text"
415|                placeholder="0,00"
416|                value={form.valorVenda}
417|                onChange={(e) => {
418|                  let v = e.target.value.replace(/\D/g, "");
419|                  if (v.length > 2) {
420|                    v = v.replace(/(\d{2})$/, ",$1");
421|                    v = v.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
422|                  }
423|                  setForm((f) => ({ ...f, valorVenda: v }));
424|                }}
425|                className="mt-1"
426|              />
427|            </div>
428|          )}
429|
430|          {/* Formulário de conclusão (título/desc/prioridade já editáveis acima) */}
431|          {concluindo && (
432|            <div className="space-y-3 border-t pt-3 bg-slate-50 -mx-6 px-6 pb-3">
433|              <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
434|                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
435|                Registrar resultado da tarefa
436|              </h4>
437|
438|              {/* Prioridade */}
439|              <div>
440|                <Label className="text-xs">Prioridade</Label>
441|                <Select value={form.prioridade} onValueChange={(v) => setForm((f) => ({ ...f, prioridade: v }))}>
442|                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
443|                  <SelectContent>
444|                    <SelectItem value="baixa">Baixa</SelectItem>
445|                    <SelectItem value="media">Média</SelectItem>
446|                    <SelectItem value="alta">Alta</SelectItem>
447|                    <SelectItem value="urgente">Urgente</SelectItem>
448|                  </SelectContent>
449|                </Select>
450|              </div>
451|
452|              {/* Resultado */}
453|              <div>
454|                <Label className="text-xs">Resultado *</Label>
455|                <Select value={resultadoForm.resultado} onValueChange={(v) => setResultadoForm((f) => ({ ...f, resultado: v, observacao: "" }))}>
456|                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
457|                  <SelectContent>
458|                    <SelectItem value="sucesso">✅ Sucesso — contato/negociação realizada</SelectItem>
459|                    <SelectItem value="insucesso">❌ Insucesso — não houve interesse</SelectItem>
460|                    <SelectItem value="remarcado">📅 Remarcado — agendado para outro dia</SelectItem>
461|                    <SelectItem value="sem_contato">📞 Sem contato — não atendeu</SelectItem>
462|                    <SelectItem value="follow_up_necessario">🔄 Follow-up necessário</SelectItem>
463|                  </SelectContent>
464|                </Select>
465|              </div>
466|
467|              {/* Observação do resultado */}
468|              <div>
469|                <Label className="text-xs">Observação do resultado *</Label>
470|                <Select
471|                  value={resultadoForm.observacao}
472|                  onValueChange={(v) => setResultadoForm((f) => ({ ...f, observacao: v }))}
473|                  disabled={!resultadoForm.resultado}
474|                >
475|                  <SelectTrigger className="mt-1">
476|                    <SelectValue placeholder={resultadoForm.resultado ? "Selecione..." : "Selecione o resultado primeiro"} />
477|                  </SelectTrigger>
478|                  <SelectContent>
479|                    {(opcoesObservacao[resultadoForm.resultado] || []).map((opcao) => (
480|                      <SelectItem key={opcao} value={opcao}>{opcao}</SelectItem>
481|                    ))}
482|                  </SelectContent>
483|                </Select>
484|              </div>
485|
486|              {/* Valor da venda (só se Sucesso) */}
487|              {resultadoForm.resultado === "sucesso" && (
488|                <div>
489|                  <Label className="text-xs">Valor da Venda (R$) *</Label>
490|                  <Input
491|                    type="text"
492|                    placeholder="0,00"
493|                    value={resultadoForm.valorVenda}
494|                    onChange={(e) => {
495|                      let v = e.target.value.replace(/\D/g, "");
496|                      if (v.length > 2) {
497|                        v = v.replace(/(\d{2})$/, ",$1");
498|                        v = v.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
499|                      }
500|                      setResultadoForm((f) => ({ ...f, valorVenda: v }));
501|