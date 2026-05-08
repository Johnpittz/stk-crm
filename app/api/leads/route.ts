import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/leads?status=&origem=&busca=&vendedor_id=&limit=
// Lista leads (RLS já filtra por gestor/vendedor)
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const origem = searchParams.get("origem");
    const busca = searchParams.get("busca");
    const vendedorId = searchParams.get("vendedor_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 200);

    let query = supabase
      .from("leads")
      .select("*, vendedor:vendedor_id(id, nome_completo)", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    if (origem) {
      query = query.eq("origem", origem);
    }

    if (vendedorId) {
      query = query.eq("vendedor_id", vendedorId);
    }

    if (busca) {
      query = query.or(`razao_social.ilike.%${busca}%,cnpj.ilike.%${busca}%`);
    }

    const { data: leads, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ leads: leads || [], total: count || 0 });
  } catch (err: any) {
    console.error("[Leads GET] Erro:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao listar leads" },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH /api/leads
// Atualiza lead (atribuir vendedor, mudar status, observações)
// Body: { id, vendedor_id?, status?, observacoes? }
// ============================================================

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { id, vendedor_id, status, observacoes } = body;

    if (!id) {
      return NextResponse.json({ error: "ID do lead é obrigatório" }, { status: 400 });
    }

    // Verifica papel
    const { data: meuPerfil } = await supabase
      .from("profiles")
      .select("cargo")
      .eq("id", user.id)
      .single();

    const isDiretoria = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");

    const updateData: any = {};

    if (isDiretoria) {
      // Gestor pode tudo
      if (vendedor_id !== undefined) {
        updateData.vendedor_id = vendedor_id || null;
        if (vendedor_id) {
          updateData.data_atribuicao = new Date().toISOString();
        }
      }
      if (status !== undefined) updateData.status = status;
      if (observacoes !== undefined) updateData.observacoes = observacoes;
    } else {
      // Vendedor só pode editar status e observações dos seus leads
      if (vendedor_id !== undefined) {
        return NextResponse.json(
          { error: "Vendedores não podem reatribuir leads" },
          { status: 403 }
        );
      }
      if (status !== undefined) updateData.status = status;
      if (observacoes !== undefined) updateData.observacoes = observacoes;
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", id)
      .select("*, vendedor:vendedor_id(id, nome_completo)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, lead });
  } catch (err: any) {
    console.error("[Leads PATCH] Erro:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao atualizar lead" },
      { status: 500 }
    );
  }
}
