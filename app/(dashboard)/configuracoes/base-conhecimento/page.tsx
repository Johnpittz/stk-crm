"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  Loader2,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

interface Entrada {
  id: string;
  categoria: string;
  titulo: string;
  conteudo: string;
  palavras_chave: string[];
  ativo: boolean;
  /** PEDIDO 2 (11/10): null = global; UUID = base de um vendedor. */
  vendedor_id?: string | null;
}

interface Curso {
  id: string;
  nome: string;
  url: string;
  descricao?: string | null;
  vendedor_id?: string | null;
  ativo: boolean;
}

interface Pessoa {
  id: string;
  nome: string;
}

/** Sentinel do Radix Select: item com value="" não é permitido. */
const GLOBAL = "__global";

const FORM_INICIAL = { categoria: "Geral", titulo: "", conteudo: "", palavras_chave: "", vendedor_id: "" };
const FORM_CURSO_INICIAL = { nome: "", url: "", vendedor_id: "" };

export default function BaseConhecimentoPage() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);
  // PEDIDO 2 — quem pode ser dono de uma entrada + cursos do SINERGIA
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [formCurso, setFormCurso] = useState(FORM_CURSO_INICIAL);
  const [salvandoCurso, setSalvandoCurso] = useState(false);

  async function carregarPessoas() {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, nome_completo, email")
      .order("nome_completo", { ascending: true });
    setPessoas(
      ((data as any[]) || []).map((p) => ({
        id: p.id,
        nome: p.nome_completo || (p.email ? String(p.email).split("@")[0] : "Sem nome"),
      })),
    );
  }

  async function carregarCursos() {
    const supabase = createClient();
    const { data } = await supabase
      .from("base_cursos")
      .select("*")
      .order("nome", { ascending: true });
    setCursos(((data as Curso[]) || []).filter((c) => c.ativo));
  }

  async function carregar() {
    setCarregando(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("base_conhecimento")
      .select("*")
      .order("categoria", { ascending: true })
      .order("titulo", { ascending: true });
    if (error) {
      toast.error(`Erro ao carregar a base: ${error.message}`);
    } else {
      setEntradas((data as Entrada[]) || []);
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
    carregarPessoas();
    carregarCursos();
  }, []);

  function editar(e: Entrada) {
    setEditandoId(e.id);
    setForm({
      categoria: e.categoria,
      titulo: e.titulo,
      conteudo: e.conteudo,
      palavras_chave: (e.palavras_chave || []).join(", "),
      vendedor_id: e.vendedor_id || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelar() {
    setEditandoId(null);
    setForm(FORM_INICIAL);
  }

  async function salvar() {
    if (!form.titulo.trim() || !form.conteudo.trim()) {
      toast.error("Título e conteúdo são obrigatórios.");
      return;
    }
    setSalvando(true);
    const supabase = createClient();
    const linha = {
      categoria: form.categoria.trim() || "Geral",
      titulo: form.titulo.trim(),
      conteudo: form.conteudo.trim(),
      palavras_chave: form.palavras_chave
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      // PEDIDO 2: "" (Global) vira null
      vendedor_id: form.vendedor_id && form.vendedor_id !== GLOBAL ? form.vendedor_id : null,
    };

    const { error } = editandoId
      ? await supabase.from("base_conhecimento").update(linha).eq("id", editandoId)
      : await supabase.from("base_conhecimento").insert({ ...linha, ativo: true });

    setSalvando(false);
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    toast.success(editandoId ? "Entrada atualizada." : "Entrada criada.");
    cancelar();
    carregar();
  }

  async function alternarAtivo(e: Entrada) {
    const supabase = createClient();
    const { error } = await supabase
      .from("base_conhecimento")
      .update({ ativo: !e.ativo })
      .eq("id", e.id);
    if (error) {
      toast.error(`Erro: ${error.message}`);
      return;
    }
    setEntradas((ant) => ant.map((x) => (x.id === e.id ? { ...x, ativo: !e.ativo } : x)));
  }

  async function excluir(e: Entrada) {
    if (!confirm(`Excluir "${e.titulo}" da base?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("base_conhecimento").delete().eq("id", e.id);
    if (error) {
      toast.error(`Erro ao excluir: ${error.message}`);
      return;
    }
    toast.success("Entrada excluída.");
    if (editandoId === e.id) cancelar();
    carregar();
  }

  // ── PEDIDO 2: cursos do SINERGIA (link/botão na base do vendedor) ──
  async function salvarCurso() {
    if (!formCurso.nome.trim() || !formCurso.url.trim()) {
      toast.error("Nome e link do curso são obrigatórios.");
      return;
    }
    setSalvandoCurso(true);
    const supabase = createClient();
    const { error } = await supabase.from("base_cursos").insert({
      nome: formCurso.nome.trim(),
      url: formCurso.url.trim(),
      vendedor_id: formCurso.vendedor_id && formCurso.vendedor_id !== GLOBAL ? formCurso.vendedor_id : null,
      ativo: true,
    });
    setSalvandoCurso(false);
    if (error) {
      toast.error(`Erro ao salvar o curso: ${error.message}`);
      return;
    }
    toast.success("Curso adicionado.");
    setFormCurso(FORM_CURSO_INICIAL);
    carregarCursos();
  }

  async function excluirCurso(c: Curso) {
    if (!confirm(`Remover o curso "${c.nome}" da lista?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("base_cursos").delete().eq("id", c.id);
    if (error) {
      toast.error(`Erro ao remover: ${error.message}`);
      return;
    }
    toast.success("Curso removido.");
    carregarCursos();
  }

  function nomeDePessoa(id: string | null | undefined): string {
    if (!id) return "Global";
    return pessoas.find((p) => p.id === id)?.nome || "Vendedor";
  }

  const ativas = entradas.filter((e) => e.ativo).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#3B64CF]" />
            Base de Conhecimento
          </h2>
          <p className="text-xs text-slate-400">
            O que a IA pode afirmar sobre a STK — fonte única de verdade do chatbot
          </p>
        </div>
        <Link href="/chatbot">
          <Button variant="outline" size="sm" className="h-8 text-xs border-[#1c2e4a] text-slate-400">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Voltar ao chatbot
          </Button>
        </Link>
      </div>

      {/* Aviso da regra (D7 + guardrail) */}
      <Card className="border-[#1c2e4a] bg-[#14233c]">
        <CardContent className="p-4 text-xs text-slate-400 space-y-1">
          <p>
            <span className="text-white font-semibold">Como a IA usa esta base:</span> responde dúvidas que estiverem
            aqui e pode puxar assunto sugerindo produtos/serviços cadastrados (D7).
          </p>
          <p>
            O que <span className="text-white">não</span> estiver aqui, ela <span className="text-white">não inventa</span>{" "}
            → devolve <code className="text-[#7ea2ff]">[[ENCAMINHAR]]</code>, o cliente recebe um recado e o vendedor é
            notificado com o motivo.
          </p>
          {ativas === 0 && (
            <p className="flex items-center gap-1.5 text-amber-400 pt-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Base sem nenhuma entrada ativa: a IA vai encaminhar TODA mensagem para o vendedor.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Form */}
      <Card className="border-[#1c2e4a] bg-[#14233c]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white">
            {editandoId ? "Editando entrada" : "Nova entrada"}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Uma pergunta/resposta por entrada. Quanto mais objetivo o conteúdo, melhor a resposta da IA.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Categoria</Label>
              <Input
                value={form.categoria}
                onChange={(ev) => setForm({ ...form, categoria: ev.target.value })}
                placeholder="Ex.: Produtos, Prazos, Cobertura"
                className="h-8 bg-[#0f1b30] border-[#1c2e4a] text-white text-xs"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs text-slate-400">Título</Label>
              <Input
                value={form.titulo}
                onChange={(ev) => setForm({ ...form, titulo: ev.target.value })}
                placeholder="Ex.: Prazo de entrega"
                className="h-8 bg-[#0f1b30] border-[#1c2e4a] text-white text-xs"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-400">Conteúdo (o que a IA vai dizer)</Label>
            <Textarea
              value={form.conteudo}
              onChange={(ev) => setForm({ ...form, conteudo: ev.target.value })}
              rows={4}
              placeholder="Ex.: Entregamos em até 48h úteis em toda a região metropolitana."
              className="bg-[#0f1b30] border-[#1c2e4a] text-white text-xs"
            />
          </div>

          {/* PEDIDO 2: dono da entrada — global ou de um vendedor */}
          <div className="space-y-1">
            <Label className="text-xs text-slate-400">Dono da entrada</Label>
            <Select
              value={form.vendedor_id || GLOBAL}
              onValueChange={(v) => setForm({ ...form, vendedor_id: v === GLOBAL ? "" : v })}
            >
              <SelectTrigger className="h-8 bg-[#0f1b30] border-[#1c2e4a] text-white text-xs">
                <SelectValue placeholder="Quem usa esta entrada?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GLOBAL}>🌍 Global — a IA usa em qualquer conversa</SelectItem>
                {pessoas.map((pes) => (
                  <SelectItem key={pes.id} value={pes.id}>
                    👤 {pes.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-slate-600">
              Escolha o vendedor para a IA usar esta entrada nas conversas DELE (somado às globais).
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-slate-400">Palavras-chave (separadas por vírgula)</Label>
            <Input
              value={form.palavras_chave}
              onChange={(ev) => setForm({ ...form, palavras_chave: ev.target.value })}
              placeholder="entrega, prazo, chega quando"
              className="h-8 bg-[#0f1b30] border-[#1c2e4a] text-white text-xs"
            />
            <p className="text-[10px] text-slate-600">
              Ajudam a auditoria da bateria de testes a medir se a pergunta é coberta pela base.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-8 text-xs bg-[#15317B] text-white"
              onClick={salvar}
              disabled={salvando}
            >
              {salvando ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
              {editandoId ? "Salvar alterações" : "Adicionar à base"}
            </Button>
            {editandoId && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-[#1c2e4a] text-slate-400"
                onClick={cancelar}
              >
                <X className="h-3 w-3 mr-1" />
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lista */}
      <Card className="border-[#1c2e4a] bg-[#14233c]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            Entradas cadastradas
            <Badge className="h-4 text-[9px] bg-[#3B64CF]">{ativas} ativas</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {carregando ? (
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Carregando...
            </div>
          ) : entradas.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Nenhuma entrada. Cadastre a primeira acima — sem ela, a IA não responde nada.
            </p>
          ) : (
            entradas.map((e) => (
              <div
                key={e.id}
                className={`rounded-md border border-[#1c2e4a] p-3 ${
                  e.ativo ? "bg-[#0f1b30]" : "bg-[#0b1526] opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-white">{e.titulo}</span>
                      <Badge className="h-4 text-[9px] bg-[#1c2e4a] text-slate-400">{e.categoria}</Badge>
                      <Badge
                        className={`h-4 text-[9px] ${
                          e.vendedor_id ? "bg-indigo-900/60 text-indigo-300" : "bg-[#1c2e4a] text-slate-500"
                        }`}
                      >
                        {e.vendedor_id ? `👤 ${nomeDePessoa(e.vendedor_id)}` : "🌍 Global"}
                      </Badge>
                      {!e.ativo && (
                        <Badge className="h-4 text-[9px] bg-amber-900/60 text-amber-400">inativa</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap break-words">{e.conteudo}</p>
                    {e.palavras_chave?.length > 0 && (
                      <p className="text-[10px] text-slate-600 mt-1">
                        chaves: {e.palavras_chave.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={e.ativo} onCheckedChange={() => alternarAtivo(e)} />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                      onClick={() => editar(e)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-500 hover:text-red-400"
                      onClick={() => excluir(e)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* PEDIDO 2 — Cursos do SINERGIA (botão/link na tela Minha Base) */}
      <Card className="border-[#1c2e4a] bg-[#14233c]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            Cursos do SINERGIA
            <Badge className="h-4 text-[9px] bg-[#3B64CF]">{cursos.length}</Badge>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Links que aparecem como botão na tela &quot;Minha Base&quot; do vendedor e abrem na plataforma de cursos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Nome do curso</Label>
              <Input
                value={formCurso.nome}
                onChange={(ev) => setFormCurso({ ...formCurso, nome: ev.target.value })}
                placeholder="Ex.: Prospecção B2B"
                className="h-8 bg-[#0f1b30] border-[#1c2e4a] text-white text-xs"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs text-slate-400">Link (URL do curso no SINERGIA)</Label>
              <Input
                value={formCurso.url}
                onChange={(ev) => setFormCurso({ ...formCurso, url: ev.target.value })}
                placeholder="https://sinergiahub.com.br/..."
                className="h-8 bg-[#0f1b30] border-[#1c2e4a] text-white text-xs"
              />
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs space-y-1">
              <Label className="text-xs text-slate-400">Para quem</Label>
              <Select
                value={formCurso.vendedor_id || GLOBAL}
                onValueChange={(v) => setFormCurso({ ...formCurso, vendedor_id: v === GLOBAL ? "" : v })}
              >
                <SelectTrigger className="h-8 bg-[#0f1b30] border-[#1c2e4a] text-white text-xs">
                  <SelectValue placeholder="Quem vê este curso?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GLOBAL}>🌍 Todos os vendedores</SelectItem>
                  {pessoas.map((pes) => (
                    <SelectItem key={pes.id} value={pes.id}>
                      👤 {pes.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-8 text-xs bg-[#15317B] text-white" onClick={salvarCurso} disabled={salvandoCurso}>
              {salvandoCurso ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
              Adicionar curso
            </Button>
          </div>

          {cursos.length === 0 ? (
            <p className="text-xs text-slate-500 py-2 text-center">Nenhum curso cadastrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {cursos.map((c) => (
                <div key={c.id} className="rounded-md border border-[#1c2e4a] bg-[#0f1b30] p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-white">{c.nome}</span>
                      <Badge className="h-4 text-[9px] bg-[#1c2e4a] text-slate-400">
                        {c.vendedor_id ? `👤 ${nomeDePessoa(c.vendedor_id)}` : "🌍 Todos"}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-slate-600 truncate">{c.url}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={c.url} target="_blank" rel="noreferrer" className="text-[10px] text-[#7ea2ff] hover:underline">
                      Abrir ↗
                    </a>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-500 hover:text-red-400"
                      onClick={() => excluirCurso(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
