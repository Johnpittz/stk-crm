"use client";

/**
 * PEDIDO 2 (11/10) — MINHA BASE: o que o vendedor enxerga da base de
 * conhecimento + os botões dos cursos do SINERGIA.
 *
 * - Entradas: as GLOBAIS + as dele (nunca a de outro vendedor) — a mesma
 *   filtragem que a IA usa (filtrarBasePorVendedor).
 * - Cursos: links que abrem a plataforma do SINERGIA em nova aba.
 * - Somente leitura: quem edita é a gestão, em Configurações → Base.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, Loader2, ArrowLeft, Globe, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { filtrarBasePorVendedor, type EntradaConhecimento } from "@/lib/base-conhecimento";

interface Curso {
  id: string;
  nome: string;
  url: string;
  descricao?: string | null;
  vendedor_id?: string | null;
  ativo: boolean;
}

export default function MinhaBasePage() {
  const [entradas, setEntradas] = useState<EntradaConhecimento[]>([]);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [meuNome, setMeuNome] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: sessao } = await supabase.auth.getSession();
      const userId = sessao?.session?.user?.id ?? null;

      const { data: perfil } = await supabase
        .from("profiles")
        .select("nome_completo")
        .eq("id", userId)
        .single();
      setMeuNome(perfil?.nome_completo || "");

      // Entradas: globais + as minhas (mesmo filtro da IA)
      const { data: todas, error: erroBase } = await supabase
        .from("base_conhecimento")
        .select("*")
        .order("categoria", { ascending: true })
        .order("titulo", { ascending: true });
      if (erroBase) {
        setAviso(
          erroBase.message.includes("vendedor_id")
            ? "O banco ainda está sendo atualizado — avise o administrador para rodar a migration 096."
            : `Erro ao carregar a base: ${erroBase.message}`,
        );
      } else {
        setEntradas(filtrarBasePorVendedor((todas as EntradaConhecimento[]) || [], userId));
      }

      // Cursos do SINERGIA visíveis para mim
      const { data: cursosBrutos, error: erroCursos } = await supabase
        .from("base_cursos")
        .select("*")
        .order("nome", { ascending: true });
      if (!erroCursos) {
        const lista = (cursosBrutos as Curso[]) || [];
        setCursos(lista.filter((c) => c.ativo && (!c.vendedor_id || !userId || c.vendedor_id === userId)));
      }

      setCarregando(false);
    })();
  }, []);

  const minhas = entradas.filter((e) => !!e.vendedor_id);
  const globais = entradas.filter((e) => !e.vendedor_id);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#3B64CF]" />
            Minha Base{meuNome ? ` — ${meuNome}` : ""}
          </h2>
          <p className="text-xs text-slate-400">
            O que a IA usa nas suas conversas + seus cursos do SINERGIA (somente leitura)
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline" size="sm" className="h-8 text-xs border-[#1c2e4a] text-slate-400">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Voltar
          </Button>
        </Link>
      </div>

      {aviso && (
        <Card className="border-amber-800 bg-amber-950/40">
          <CardContent className="p-3 text-xs text-amber-300">{aviso}</CardContent>
        </Card>
      )}

      {/* Explicação */}
      <Card className="border-[#1c2e4a] bg-[#14233c]">
        <CardContent className="p-4 text-xs text-slate-400 space-y-1">
          <p>
            <span className="text-white font-semibold">Como funciona:</span> quando um cliente escreve para você,
            a IA responde usando <span className="text-white">estas entradas</span> — as globais da STK somadas às
            suas.
          </p>
          <p>
            Não encontra na base? Ela <span className="text-white">não inventa</span>: avisa o cliente e você assume
            a conversa.
          </p>
        </CardContent>
      </Card>

      {/* Entradas */}
      <Card className="border-[#1c2e4a] bg-[#14233c]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            Entradas da base
            <Badge className="h-4 text-[9px] bg-[#3B64CF]">{entradas.length}</Badge>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            👤 = suas (só a IA nas suas conversas usa) · 🌍 = globais (todas as conversas)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {carregando ? (
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Carregando...
            </div>
          ) : entradas.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              Sua base ainda está vazia — peça à gestão para cadastrar entradas para você.
            </p>
          ) : (
            <>
              {minhas.length > 0 && (
                <p className="text-[10px] uppercase tracking-wide text-indigo-300 flex items-center gap-1">
                  <User className="h-3 w-3" /> Suas entradas ({minhas.length})
                </p>
              )}
              {minhas.map((e) => (
                <div key={e.id} className="rounded-md border border-indigo-900/60 bg-[#0f1b30] p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-white">{e.titulo}</span>
                    <Badge className="h-4 text-[9px] bg-indigo-900/60 text-indigo-300">{e.categoria}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap break-words">{e.conteudo}</p>
                </div>
              ))}
              <p className="text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1 pt-1">
                <Globe className="h-3 w-3" /> Globais ({globais.length})
              </p>
              {globais.map((e) => (
                <div key={e.id} className="rounded-md border border-[#1c2e4a] bg-[#0b1526] p-3 opacity-80">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-200">{e.titulo}</span>
                    <Badge className="h-4 text-[9px] bg-[#1c2e4a] text-slate-400">{e.categoria}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap break-words">{e.conteudo}</p>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Cursos do SINERGIA */}
      <Card className="border-[#1c2e4a] bg-[#14233c]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-[#3B64CF]" />
            Meus cursos (SINERGIA)
            <Badge className="h-4 text-[9px] bg-[#3B64CF]">{cursos.length}</Badge>
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Abrem na plataforma de cursos com sua conta já cadastrada lá.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {carregando ? (
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Carregando...
            </div>
          ) : cursos.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">Nenhum curso disponível para você no momento.</p>
          ) : (
            cursos.map((c) => (
              <a
                key={c.id}
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-[#1c2e4a] bg-[#0f1b30] p-3 flex items-center justify-between gap-3 hover:border-[#3B64CF] transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-white">{c.nome}</span>
                  {c.descricao && <p className="text-[11px] text-slate-500 mt-0.5">{c.descricao}</p>}
                </div>
                <span className="text-[10px] text-[#7ea2ff] shrink-0">Abrir curso ↗</span>
              </a>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
