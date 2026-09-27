/**
 * Fase 6 / C4 de docs/plano-acao-modulos.md — documento de proposta.
 *
 *   POST /api/propostas                  gera o PDF (pdf-lib), salva no
 *                                        Storage e grava o registro;
 *                                        upsert por oportunidade
 *   GET  /api/propostas?oportunidade_id= lista o que já foi gerado
 *   GET  /api/propostas/[id]/arquivo     baixa o PDF salvo (rota separada)
 *
 * A geração em si mora em `lib/propostas/gerar.ts` — é o mesmo código que o
 * gatilho automático do PATCH /api/oportunidades usa (decisão D8).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  gerarDocumentoProposta,
  cargoDo,
  ehGestor,
} from "@/lib/propostas/gerar";

async function usuarioLogado() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { supabase, usuario: null as any };
  return { supabase, usuario: user };
}

export async function POST(request: NextRequest) {
  const { supabase, usuario } = await usuarioLogado();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const corpo = await request.json().catch(() => null);
  const oportunidadeId = corpo?.oportunidade_id;
  if (!oportunidadeId || typeof oportunidadeId !== "string") {
    return NextResponse.json(
      { error: "Informe a oportunidade (oportunidade_id) da proposta" },
      { status: 400 }
    );
  }

  const resultado = await gerarDocumentoProposta({
    supabase,
    admin: createAdminClient(),
    usuario,
    oportunidadeId,
  });

  if (resultado.status === 201) {
    return NextResponse.json({ proposta: resultado.proposta }, { status: 201 });
  }

  return NextResponse.json(
    {
      ...(resultado.erros ? { erros: resultado.erros } : {}),
      ...(resultado.error ? { error: resultado.error } : {}),
    },
    { status: resultado.status }
  );
}

export async function GET(request: NextRequest) {
  const { supabase, usuario } = await usuarioLogado();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const oportunidadeId = searchParams.get("oportunidade_id");
  if (!oportunidadeId) {
    return NextResponse.json(
      { error: "Informe a oportunidade (oportunidade_id)" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: oportunidade } = await admin
    .from("oportunidades")
    .select("*")
    .eq("id", oportunidadeId)
    .maybeSingle();

  if (!oportunidade) {
    return NextResponse.json({ error: "Oportunidade não encontrada" }, { status: 404 });
  }

  const cargo = await cargoDo(supabase, usuario.id);
  if (oportunidade.vendedor_id !== usuario.id && !ehGestor(cargo)) {
    return NextResponse.json(
      { error: "Você não tem permissão para ver esta proposta" },
      { status: 403 }
    );
  }

  const { data: propostas } = await admin
    .from("propostas")
    .select("*")
    .eq("oportunidade_id", oportunidadeId)
    .order("created_at", { ascending: false });

  return NextResponse.json({ propostas: propostas ?? [] });
}
