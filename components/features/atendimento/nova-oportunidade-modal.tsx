1|"use client";
2|
3|import { useState, useEffect } from "react";
4|import { Plus, Loader2 } from "lucide-react";
5|import { Button } from "@/components/ui/button";
6|import {
7|  Dialog,
8|  DialogContent,
9|  DialogHeader,
10|  DialogTitle,
11|  DialogTrigger,
12|} from "@/components/ui/dialog";
13|import { Input } from "@/components/ui/input";
14|import { Label } from "@/components/ui/label";
15|import {
16|  Select,
17|  SelectContent,
18|  SelectItem,
19|  SelectTrigger,
20|  SelectValue,
21|} from "@/components/ui/select";
22|import { createClient } from "@/lib/supabase/client";
23|
24|interface NovaOportunidadeModalProps {
25|  onSuccess?: () => void;
26|}
27|
28|export function NovaOportunidadeModal({ onSuccess }: NovaOportunidadeModalProps) {
29|  const [open, setOpen] = useState(false);
30|  const [loading, setLoading] = useState(false);
31|
32|  const [titulo, setTitulo] = useState("");
33|  const [clienteNome, setClienteNome] = useState("");
34|  const [tipo, setTipo] = useState("ligacao");
35|  const [prioridade, setPrioridade] = useState("media");
36|  const [dataInicio, setDataInicio] = useState("");
37|  const [horaInicio, setHoraInicio] = useState("");
38|  const [descricao, setDescricao] = useState("");
39|
40|  const supabase = createClient();
41|
42|  useEffect(() => {
43|    if (open) {
44|      // Preenche data de hoje por padrão
45|      const hoje = new Date().toISOString().split("T")[0];
46|      setDataInicio(hoje);
47|    }
48|  }, [open]);
49|
50|  const handleSubmit = async (e: React.FormEvent) => {
51|    e.preventDefault();
52|    if (!titulo || !tipo) return;
53|
54|    setLoading(true);
55|    try {
56|      const { data: { session } } = await supabase.auth.getSession();
57|      if (!session) return;
58|
59|      const res = await fetch("/api/oportunidades", {
60|        method: "POST",
61|        headers: {
62|          "Content-Type": "application/json",
63|          Authorization: `Bearer ${session.access_token}`,
64|        },
65|        body: JSON.stringify({
66|          titulo,
67|          cliente_nome: clienteNome || null,
68|          tipo,"
69|          tipo,
70|          prioridade,
71|          data_inicio: dataInicio || null,
72|          hora_inicio: horaInicio || null,
73|          descricao: descricao || null,
74|        }),
75|      });
76|
77|      if (res.ok) {
78|        setOpen(false);
79|        resetForm();
80|        onSuccess?.();
81|      }
82|    } catch (err) {
83|      console.error(err);
84|    } finally {
85|      setLoading(false);
86|    }
87|  };
88|
89|  const resetForm = () => {
90|    setTitulo("");
91|    setClienteNome("");
92|    setTipo("ligacao");
93|    setPrioridade("media");
94|    setDataInicio("");
95|    setHoraInicio("");
96|    setDescricao("");
97|  };
98|
99|  return (
100|    <Dialog open={open} onOpenChange={setOpen}>
101|      <DialogTrigger asChild>
102|        <Button size="sm" className="gap-1 h-7 text-xs">
103|          <Plus className="h-3.5 w-3.5" />
104|          Nova Tarefa
105|        </Button>
106|      </DialogTrigger>
107|      <DialogContent className="sm:max-w-md">
108|        <DialogHeader>
109|          <DialogTitle>Nova Tarefa</DialogTitle>
110|        </DialogHeader>
111|        <form onSubmit={handleSubmit} className="space-y-4">
112|          <div className="space-y-2">
113|            <Label htmlFor="titulo">Título *</Label>
114|            <Input
115|              id="titulo"
116|              placeholder="Ex: Follow up proposta"
117|              value={titulo}
118|              onChange={(e) => setTitulo(e.target.value)}
119|              required
120|            />
121|          </div>
122|
123|          <div className="space-y-2">
124|            <Label htmlFor="cliente">Cliente</Label>
125|            <Input
126|              id="cliente"
127|              placeholder="Ex: Empresa ABC Ltda"
128|              value={clienteNome}
129|              onChange={(e) => setClienteNome(e.target.value)}
130|            />
131|          </div>
132|
133|          <div className="grid grid-cols-2 gap-3">
134|            <div className="space-y-2">
135|              <Label htmlFor="tipo">Tipo *</Label>
136|              <Select value={tipo} onValueChange={setTipo}>
137|                <SelectTrigger>
138|                  <SelectValue />
139|                </SelectTrigger>
140|                <SelectContent>
141|                  <SelectItem value="ligacao">📞 Ligação</SelectItem>
142|                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
143|                  <SelectItem value="email">📧 Email</SelectItem>
144|                  <SelectItem value="visita">🏢 Visita</SelectItem>
145|                  <SelectItem value="reuniao">🤝 Reunião</SelectItem>
146|                  <SelectItem value="follow_up">🔄 Follow-up</SelectItem>
147|                  <SelectItem value="prospeccao">🔍 Prospecção</SelectItem>
148|                  <SelectItem value="outro">📋 Outro</SelectItem>
149|                </SelectContent>
150|              </Select>
151|            </div>
152|
153|            <div className="space-y-2">
154|              <Label htmlFor="prioridade">Prioridade</Label>
155|              <Select value={prioridade} onValueChange={setPrioridade}>
156|                <SelectTrigger>
157|                  <SelectValue />
158|                </SelectTrigger>
159|                <SelectContent>
160|                  <SelectItem value="baixa">Baixa</SelectItem>
161|                  <SelectItem value="media">Média</SelectItem>
162|                  <SelectItem value="alta">Alta</SelectItem>
163|                  <SelectItem value="urgente">Urgente</SelectItem>
164|                </SelectContent>
165|              </Select>
166|            </div>
167|          </div>
168|
169|          <div className="grid grid-cols-2 gap-3">
170|            <div className="space-y-2">
171|              <Label htmlFor="data">Data</Label>
172|              <Input
173|                id="data"
174|                type="date"
175|                value={dataInicio}
176|                onChange={(e) => setDataInicio(e.target.value)}
177|              />
178|            </div>
179|            <div className="space-y-2">
180|              <Label htmlFor="hora">Hora</Label>
181|              <Input
182|                id="hora"
183|                type="time"
184|                value={horaInicio}
185|                onChange={(e) => setHoraInicio(e.target.value)}
186|              />
187|            </div>
188|          </div>
189|
190|          <div className="space-y-2">
191|            <Label htmlFor="descricao">Descrição / Observação</Label>
192|            <textarea
193|              id="descricao"
194|              rows={3}
195|              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
196|              placeholder="Detalhes da tarefa..."
197|              value={descricao}
198|              onChange={(e) => setDescricao(e.target.value)}
199|            />
200|          </div>
201|
202|          <div className="flex justify-end gap-2 pt-2">
203|            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
204|              Cancelar
205|            </Button>
206|            <Button type="submit" disabled={loading || !titulo}>
207|              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar Tarefa"}
208|            </Button>
209|          </div>
210|        </form>
211|      </DialogContent>
212|    </Dialog>
213|  );
214|}
215|