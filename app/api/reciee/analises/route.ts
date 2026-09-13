import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get("cliente_id");

    const supabase = getSupabase();
    let query = supabase
      .from("analises_reciee")
      .select("*")
      .order("created_at", { ascending: false });

    if (clienteId) {
      query = query.eq("cliente_id", clienteId);
    }

    const { data: analises, error } = await query;

    if (error) {
      console.error("Erro ao buscar análises:", error);
      return NextResponse.json({ analises: [], error: error.message });
    }

    return NextResponse.json({ analises });
  } catch (error) {
    console.error("Erro interno:", error);
    return NextResponse.json({ analises: [], error: "Erro interno" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fatura_id,
      cliente_id,
      macro_indice,
      codigo,
      descricao,
      severidade,
      valor_estimado,
    } = body;

    const supabase = getSupabase();
    const { data: analise, error } = await supabase
      .from("analises_reciee")
      .insert({
        fatura_id,
        cliente_id,
        macro_indice,
        codigo,
        descricao,
        severidade,
        valor_estimado,
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar análise:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ analise });
  } catch (error) {
    console.error("Erro interno:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
