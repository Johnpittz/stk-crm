import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/atendimentos/mensagens?atendimento_id=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const atendimentoId = searchParams.get("atendimento_id");

  if (!atendimentoId) {
    return NextResponse.json({ error: "atendimento_id é obrigatório" }, { status: 400 });
  }

  const { data: mensagens, error } = await supabase
    .from("atendimento_mensagens")
    .select("*")
    .eq("atendimento_id", atendimentoId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mensagens: mensagens || [] });
}

// POST /api/atendimentos/mensagens
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { atendimento_id, conteudo, remetente = "vendedor" } = body;

  if (!atendimento_id || !conteudo) {
    return NextResponse.json({ error: "atendimento_id e conteudo são obrigatórios" }, { status: 400 });
  }

  const { data: mensagem, error } = await supabase
    .from("atendimento_mensagens")
    .insert({
      atendimento_id,
      remetente,
      conteudo,
      enviada_por: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, mensagem });
}
