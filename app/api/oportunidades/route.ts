import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/oportunidades?status=aberta&gerar_auto=true
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const gerarAuto = searchParams.get("gerar_auto") === "true";

  // Se pediu para gerar automáticas, executa a função
  if (gerarAuto) {
    try {
      await supabase.rpc("gerar_oportunidades_churn");
    } catch (e) {
      // ignora erro de RPC se não existir ainda
    }
  }

  let query = supabase
    .from("oportunidades")
    .select("*, clientes(id, nome_razao_social, telefone, celular)")
    .eq("vendedor_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) {
    query = query.eq("status", status);
  } else {
    query = query.eq("status", "aberta");
  }

  const { data: oportunidades, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ oportunidades: oportunidades || [] });
}

// POST /api/oportunidades - cria oportunidade manual
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const {
    cliente_id,
    motivo_geracao,
    valor_estimado,
    probabilidade = 50,
    data_previsao_fechamento,
    contexto,
  } = body;

  if (!cliente_id || !motivo_geracao) {
    return NextResponse.json({ error: "Cliente e motivo são obrigatórios" }, { status: 400 });
  }

  const { data: oportunidade, error } = await supabase
    .from("oportunidades")
    .insert({
      vendedor_id: user.id,
      cliente_id,
      tipo_origem: "manual",
      motivo_geracao,
      valor_estimado: valor_estimado || null,
      probabilidade,
      data_previsao_fechamento: data_previsao_fechamento || null,
      contexto: contexto || null,
      estagio: "prospeccao",
      status: "aberta",
    })
    .select("*, clientes(id, nome_razao_social)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, oportunidade });
}

// PATCH /api/oportunidades - converte para ganha/perdida/arquivada
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { id, status, motivo_perda, venda_id } = body;

  if (!id || !status) {
    return NextResponse.json({ error: "ID e status são obrigatórios" }, { status: 400 });
  }

  const updateData: any = { status };
  if (status === "ganha") {
    updateData.data_conversao = new Date().toISOString().split("T")[0];
    if (venda_id) updateData.venda_id = venda_id;
  }
  if (status === "perdida" && motivo_perda) {
    updateData.motivo_perda = motivo_perda;
  }

  const { data: oportunidade, error } = await supabase
    .from("oportunidades")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, oportunidade });
}
