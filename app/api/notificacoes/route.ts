import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/notificacoes - lista notificações do usuário logado
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const apenasNaoLidas = searchParams.get("nao_lidas") === "true";

  let query = supabase
    .from("notificacoes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (apenasNaoLidas) {
    query = query.eq("lida", false);
  }

  const { data: notificacoes, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await supabase
    .from("notificacoes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("lida", false);

  return NextResponse.json({
    notificacoes: notificacoes || [],
    naoLidas: count || 0,
  });
}

// PATCH /api/notificacoes - marca notificação(ões) como lida(s)
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { id, todas } = body;

  if (todas) {
    const { error } = await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("user_id", user.id)
      .eq("lida", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, todas: true });
  }

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
  }

  const { data: notificacao, error } = await supabase
    .from("notificacoes")
    .update({ lida: true })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, notificacao });
}

// DELETE /api/notificacoes?id=xxx ou ?todas=true
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const todas = searchParams.get("todas") === "true";

  if (todas) {
    const { error } = await supabase
      .from("notificacoes")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, todas: true });
  }

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
  }

  const { error } = await supabase
    .from("notificacoes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
