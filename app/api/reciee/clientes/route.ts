import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: clientes, error } = await supabase
      .from("clientes_reciee")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar clientes:", error);
      return NextResponse.json({ clientes: [], error: error.message });
    }

    return NextResponse.json({ clientes });
  } catch (error) {
    console.error("Erro interno:", error);
    return NextResponse.json({ clientes: [], error: "Erro interno" });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      nome, 
      cpf_cnpj, 
      uc, 
      estado, 
      distribuidora, 
      subgrupo, 
      modalidade, 
      classe, 
      tensao, 
      regime_tributario, 
      gd, 
      grupo 
    } = body;

    const { data: cliente, error } = await supabase
      .from("clientes_reciee")
      .insert({
        nome,
        cpf_cnpj,
        uc,
        estado,
        distribuidora,
        subgrupo,
        modalidade,
        classe,
        tensao,
        regime_tributario,
        gd: gd || false,
        grupo: grupo || "B",
      })
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar cliente:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ cliente });
  } catch (error) {
    console.error("Erro interno:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
