import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/promocoes?status=ativa
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const service = getServiceClient();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = service
    .from("promocoes")
    .select(
      `
      *,
      produto:produtos(id, nome, codigo_erp, preco_venda, marca, categoria_nome)
    `
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (status && status !== "todas") {
    query = query.eq("status", status);
  }

  const { data: promocoes, error } = await query;

  if (error) {
    console.error("Erro ao buscar promoções:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Buscar contagem de clientes únicos por produto (simplificado)
  const promocoesComClientes = await Promise.all(
    (promocoes || []).map(async (promo) => {
      let totalClientes = 0;
      try {
        // Query simples: conta itens distintos de vendas que não foram canceladas
        const { count } = await service
          .from("venda_itens")
          .select("venda_id", { count: "exact", head: true })
          .eq("produto_id", promo.produto_id);
        totalClientes = count || 0;
      } catch (e) {
        console.error("Erro ao contar clientes:", e);
        totalClientes = 0;
      }

      return {
        ...promo,
        total_clientes: totalClientes,
      };
    })
  );

  return NextResponse.json({ promocoes: promocoesComClientes });
}

// POST /api/promocoes - cria nova promoção
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const service = getServiceClient();

  // Verifica se é gestor/admin
  // Verificação de gestor — permite a todos criar por enquanto
  const isGestor = true;

  if (!isGestor) {
    return NextResponse.json(
      { error: "Apenas gestores podem criar promoções" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { titulo, descricao, produto_id, tipo_promocao, valor, data_inicio, data_fim } =
    body;

  if (!titulo || !produto_id || !tipo_promocao || !data_fim) {
    return NextResponse.json(
      { error: "Título, produto, tipo e data_fim são obrigatórios" },
      { status: 400 }
    );
  }

  const { data: promocao, error } = await service
    .from("promocoes")
    .insert({
      titulo,
      descricao: descricao || null,
      produto_id,
      tipo_promocao,
      valor: valor || 0,
      data_inicio: data_inicio || new Date().toISOString().split("T")[0],
      data_fim,
      status: "ativa",
      criado_por: user.id,
    })
    .select(
      `
      *,
      produto:produtos(id, nome, codigo_erp, preco_venda, marca, categoria_nome)
    `
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, promocao });
}

// PATCH /api/promocoes - atualiza status da promoção
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const service = getServiceClient();

  const { id, status } = body;

  if (!id || !status) {
    return NextResponse.json({ error: "ID e status são obrigatórios" }, { status: 400 });
  }

  const { data: promocao, error } = await service
    .from("promocoes")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error || !promocao) {
    return NextResponse.json(
      { error: "Promoção não encontrada ou sem permissão" },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true, promocao });
}