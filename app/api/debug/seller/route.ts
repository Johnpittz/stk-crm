import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    // 1. Busca perfil completo
    const { data: perfil, error: perfilErr } = await supabase
      .from("profiles")
      .select("id, email, nome_completo, cargo, whatsapp_instance")
      .eq("id", user.id)
      .single();

    // 2. Busca atendimentos da instância do vendedor
    let atendimentos: any[] = [];
    if (perfil?.whatsapp_instance) {
      const { data, error } = await supabase
        .from("atendimentos")
        .select("id, telefone_cliente, nome_cliente, instancia, vendedor_id, status")
        .eq("instancia", perfil.whatsapp_instance)
        .limit(10);
      atendimentos = data || [];
    }

    // 3. Conta todos os atendimentos da instância
    const { count: totalCount } = await supabase
      .from("atendimentos")
      .select("*", { count: "exact", head: true })
      .eq("instancia", perfil?.whatsapp_instance || "");

    // 4. Todos os atendimentos distinct instances
    const { data: allInst } = await supabase
      .from("atendimentos")
      .select("instancia")
      .limit(500);
    
    const instCounts: Record<string, number> = {};
    (allInst || []).forEach((a: any) => {
      const inst = a.instancia || "NULL";
      instCounts[inst] = (instCounts[inst] || 0) + 1;
    });

    return NextResponse.json({
      user_id: user.id,
      perfil: perfil || "NOT FOUND",
      perfil_error: perfilErr?.message || null,
      whatsapp_instance_raw: perfil?.whatsapp_instance,
      whatsapp_instance_json: JSON.stringify(perfil?.whatsapp_instance),
      atendimentos_da_instancia: atendimentos,
      total_atendimentos_instancia: totalCount,
      todas_instancias: instCounts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
