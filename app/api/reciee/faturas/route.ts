import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get("cliente_id");

    const supabase = getSupabase();
    let query = supabase
      .from("faturas_reciee")
      .select("*")
      .order("competencia", { ascending: false });

    if (clienteId) {
      query = query.eq("cliente_id", clienteId);
    }

    const { data: faturas, error } = await query;

    if (error) {
      console.error("Erro ao buscar faturas:", error);
      return NextResponse.json({ faturas: [], error: error.message });
    }

    return NextResponse.json({ faturas });
  } catch (error) {
    console.error("Erro interno:", error);
    return NextResponse.json({ faturas: [], error: "Erro interno" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      cliente_id,
      competencia,
      consumo_kwh,
      tarifa_aplicada,
      valor_consumo,
      icms_valor,
      icms_aliquota,
      pis_valor,
      cofins_valor,
      bandeira,
      cip,
      valor_total,
    } = body;

    const supabase = getSupabase();
    const { data: fatura, error } = await supabase
      .from("faturas_reciee")
      .insert({
        cliente_id,
        competencia,
        consumo_kwh,
        tarifa_aplicada,
        valor_consumo,
        icms_valor,
        icms_aliquota,
        pis_valor,
        cofins_valor,
        bandeira,
        cip,
        valor_total,
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar fatura:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ fatura });
  } catch (error) {
    console.error("Erro interno:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
