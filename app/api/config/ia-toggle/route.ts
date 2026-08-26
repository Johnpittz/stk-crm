import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/config/ia-toggle — Retorna estado atual do toggle
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("configuracoes_sistema")
    .select("valor")
    .eq("chave", "ia_atendimento")
    .single();

  if (error || !data) {
    // Se não existir, retorna false (desligado)
    return NextResponse.json({ ligado: false });
  }

  return NextResponse.json({ ligado: data.valor === true || data.valor === "true" });
}

// PUT /api/config/ia-toggle — Atualiza estado do toggle
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { ligado } = await request.json();

  const { error } = await supabase
    .from("configuracoes_sistema")
    .upsert(
      { chave: "ia_atendimento", valor: ligado, atualizado_em: new Date().toISOString() },
      { onConflict: "chave" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, ligado });
}
