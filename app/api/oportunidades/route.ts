1|import { createClient } from "@/lib/supabase/server";
2|import { NextRequest, NextResponse } from "next/server";
3|
4|export const dynamic = "force-dynamic";
5|
6|/**
7| * GET    /api/oportunidades          - Lista oportunidades do vendedor
8| * POST   /api/oportunidades          - Cria nova oportunidade
9| * PATCH  /api/oportunidades          - Atualiza oportunidade
10| * DELETE /api/oportunidades?id=xxx   - Deleta oportunidade
11| */
12|
13|// GET - Lista oportunidades
14|export async function GET(request: NextRequest) {
15|  const supabase = await createClient();
16|  const { data: { user }, error: authError } = await supabase.auth.getUser();
17|  if (authError || !user) {
18|    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
19|  }
20|
21|  const { searchParams } = new URL(request.url);
22|  const etapa = searchParams.get("etapa");
23|
24|  // Verificar se é gestor
25|  const { data: meuPerfil } = await supabase
26|    .from("profiles")
27|    .select("cargo")
28|    .eq("id", user.id)
29|    .single();
30|  const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");
31|
32|  let query = supabase
33|    .from("oportunidades")
34|    .select("*, clientes(id, nome_razao_social, telefone, celular)")
35|    .order("ordem", { ascending: true })
36|    .order("created_at", { ascending: false })
37|    .limit(200);
38|
39|  // Se não é gestor, vê só as suas
40|  if (!isGestor) {
41|    query = query.eq("vendedor_id", user.id);
42|  }
43|
44|  if (etapa) {
45|    query = query.eq("etapa", etapa);
46|  }
47|
48|  let oportunidades: any[] = [];
49|  try {
50|    const { data, error } = await query;
51|    if (error) {
52|      console.warn("[API oportunidades] Query falhou:", error.message);
53|    } else {
54|      oportunidades = data || [];
55|    }
56|  } catch (queryErr: any) {
57|    console.warn("[API oportunidades] Exceção:", queryErr?.message);
58|  }
59|
60|  return NextResponse.json({ oportunidades });
61|}
62|
63|// POST - Criar oportunidade
64|export async function POST(request: NextRequest) {
65|  const supabase = await createClient();
66|  const { data: { user }, error: authError } = await supabase.auth.getUser();
67|  if (authError || !user) {
68|    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
69|  }
70|
71|  const body = await request.json();
72|  const {
73|    cliente_id,
74|    atendimento_id,
75|    cliente_nome,
76|    titulo,
77|    descricao,
78|    tipo = "gd",
79|    prioridade = "media",
80|    uc,
81|    consumo_kwh,
82|    concessionaria,
83|    valor_proposta,
84|    data_inicio,
85|    hora_inicio,
86|  } = body;
87|
88|  if (!titulo) {
89|    return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });
90|  }
91|
92|  // Pega a maior ordem do vendedor
93|  let ultimaOrdem: { ordem?: number } | null = null;
94|  try {
95|    const result = await supabase
96|      .from("oportunidades")
97|      .select("ordem")
98|      .eq("vendedor_id", user.id)
99|      .eq("etapa", "recebeu_conta")
100|      .order("ordem", { ascending: false })
101|      .limit(1)
102|      .single();
103|    ultimaOrdem = result.data;
104|  } catch {
105|    // tabela pode não existir ainda
106|  }
107|
108|  const novaOrdem = (ultimaOrdem?.ordem || 0) + 1;
109|
110|  const { data: oportunidade, error } = await supabase
111|    .from("oportunidades")
112|    .insert({
113|      vendedor_id: user.id,
114|      cliente_id: cliente_id || null,
115|      atendimento_id: atendimento_id || null,
116|      cliente_nome: cliente_nome || null,
117|      titulo,
118|      descricao: descricao || null,
119|      tipo,
120|      prioridade,
121|      etapa: "recebeu_conta",
122|      ordem: novaOrdem,
123|      uc: uc || null,
124|      consumo_kwh: consumo_kwh || null,
125|      concessionaria: concessionaria || null,
126|      valor_proposta: valor_proposta || null,
127|      data_inicio: data_inicio || null,
128|      hora_inicio: hora_inicio || null,
129|    })
130|    .select("*, clientes(id, nome_razao_social)")
131|    .single();
132|
133|  if (error) {
134|    return NextResponse.json({ error: error.message }, { status: 500 });
135|  }
136|
137|  // Registrar no histórico
138|  await supabase.from("oportunidade_historico").insert({
139|    oportunidade_id: oportunidade.id,
140|    etapa_anterior: null,
141|    etapa_nova: "recebeu_conta",
142|    observacao: "Oportunidade criada",
143|    created_by: user.id,
144|  });
145|
146|  return NextResponse.json({ success: true, oportunidade });
147|}
148|
149|// PATCH - Atualizar oportunidade
150|export async function PATCH(request: NextRequest) {
151|  const supabase = await createClient();
152|  const { data: { user }, error: authError } = await supabase.auth.getUser();
153|  if (authError || !user) {
154|    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
155|  }
156|
157|  const body = await request.json();
158|  const {
159|    id,
160|    titulo,
161|    descricao,
162|    prioridade,
163|    etapa,
164|    ordem,
165|    status,
166|    resultado,
167|    observacao_resultado,
168|    valor_venda,
169|    valor_proposta,
170|    cliente_nome,
171|    uc,
172|    consumo_kwh,
173|    concessionaria,
174|  } = body;
175|
176|  if (!id) {
177|    return NextResponse.json({ error: "ID da oportunidade é obrigatório" }, { status: 400 });
178|  }
179|
180|  // Verificar permissão (só as suas, a menos que seja gestor)
181|  const { data: oportunidadeAtual } = await supabase
182|    .from("oportunidades")
183|    .select("vendedor_id")
184|    .eq("id", id)
185|    .single();
186|
187|  const { data: meuPerfil } = await supabase
188|    .from("profiles")
189|    .select("cargo")
190|    .eq("id", user.id)
191|    .single();
192|  const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");
193|
194|  if (!isGestor && oportunidadeAtual?.vendedor_id !== user.id) {
195|    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
196|  }
197|
198|  const updateData: any = {};
199|  if (cliente_nome !== undefined) updateData.cliente_nome = cliente_nome;
200|  if (titulo !== undefined) updateData.titulo = titulo;
201|  if (descricao !== undefined) updateData.descricao = descricao;
202|  if (prioridade !== undefined) updateData.prioridade = prioridade;
203|  if (ordem !== undefined) updateData.ordem = ordem;
204|  if (resultado !== undefined) updateData.resultado = resultado;
205|  if (observacao_resultado !== undefined) updateData.observacao_resultado = observacao_resultado;
206|  if (valor_venda !== undefined) updateData.valor_venda = valor_venda;
207|  if (valor_proposta !== undefined) updateData.valor_proposta = valor_proposta;
208|  if (uc !== undefined) updateData.uc = uc;
209|  if (consumo_kwh !== undefined) updateData.consumo_kwh = consumo_kwh;
210|  if (concessionaria !== undefined) updateData.concessionaria = concessionaria;
211|
212|  // Se mudou de etapa, registrar no histórico
213|  if (etapa !== undefined && etapa !== oportunidadeAtual?.etapa) {
214|    updateData.etapa = etapa;
215|
216|    await supabase.from("oportunidade_historico").insert({
217|      oportunidade_id: id,
218|      etapa_anterior: oportunidadeAtual?.etapa,
219|      etapa_nova: etapa,
220|      observacao: observacao_resultado || null,
221|      created_by: user.id,
222|    });
223|
224|    // Se moveu para comissao_paga, marcar data_fechamento
225|    if (etapa === "comissao_paga") {
226|      updateData.data_fechamento = new Date().toISOString().split("T")[0];
227|      updateData.resultado = "sucesso";
228|    }
229|  }
230|
231|  const { data: oportunidade, error } = await supabase
232|    .from("oportunidades")
233|    .update(updateData)
234|    .eq("id", id)
235|    .select("*, clientes(id, nome_razao_social)")
236|    .single();
237|
238|  if (error || !oportunidade) {
239|    console.error("[API PATCH oportunidades] Error:", error);
240|    return NextResponse.json({ error: "Oportunidade não encontrada ou sem permissão", details: error?.message }, { status: 404 });
241|  }
242|
243|  return NextResponse.json({ success: true, oportunidade });
244|}
245|
246|// DELETE - Deletar oportunidade
247|export async function DELETE(request: NextRequest) {
248|  const supabase = await createClient();
249|  const { data: { user }, error: authError } = await supabase.auth.getUser();
250|  if (authError || !user) {
251|    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
252|  }
253|
254|  const { searchParams } = new URL(request.url);
255|  const id = searchParams.get("id");
256|
257|  if (!id) {
258|    return NextResponse.json({ error: "ID da oportunidade é obrigatório" }, { status: 400 });
259|  }
260|
261|  // Verificar permissão
262|  const { data: oportunidadeAtual } = await supabase
263|    .from("oportunidades")
264|    .select("vendedor_id")
265|    .eq("id", id)
266|    .single();
267|
268|  const { data: meuPerfil } = await supabase
269|    .from("profiles")
270|    .select("cargo")
271|    .eq("id", user.id)
272|    .single();
273|  const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");
274|
275|  if (!isGestor && oportunidadeAtual?.vendedor_id !== user.id) {
276|    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
277|  }
278|
279|  const { error } = await supabase.from("oportunidades").delete().eq("id", id);
280|
281|  if (error) {
282|    return NextResponse.json({ error: error.message }, { status: 500 });
283|  }
284|
285|  return NextResponse.json({ success: true });
286|}
287|