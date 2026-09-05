import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PUT(
  request: NextRequest,
  { params }: { params: { clienteId: string } }
) {
  try {
    const clienteId = params.clienteId;
    const body = await request.json();

    const { data: cliente, error } = await supabase
      .from("clientes_reciee")
      .update({
        nome: body.nome,
        cpf_cnpj: body.cpf_cnpj,
        uc: body.uc,
        estado: body.estado,
        distribuidora: body.distribuidora,
        subgrupo: body.subgrupo,
        modalidade: body.modalidade,
        classe: body.classe,
        tensao: body.tensao,
        regime_tributario: body.regime_tributario,
        gd: body.gd,
        grupo: body.grupo,
      })
      .eq("id", clienteId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ cliente });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { clienteId: string } }
) {
  try {
    const clienteId = params.clienteId;

    // Deletar análises do cliente
    await supabase.from("analises_reciee").delete().eq("cliente_id", clienteId);

    // Deletar faturas do cliente
    await supabase.from("faturas_reciee").delete().eq("cliente_id", clienteId);

    // Deletar cliente
    const { error } = await supabase
      .from("clientes_reciee")
      .delete()
      .eq("id", clienteId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
