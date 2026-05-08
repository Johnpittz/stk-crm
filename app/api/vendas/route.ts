import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const busca = searchParams.get("q") || "";
  const status = searchParams.get("status") || "todos";
  const periodo = searchParams.get("periodo") || "mes";

  // Filtro de período
  const hoje = new Date();
  let dataInicio: Date;

  switch (periodo) {
    case "semana":
      dataInicio = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "ano":
      dataInicio = new Date(hoje.getFullYear(), 0, 1);
      break;
    case "mes":
    default:
      dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      break;
  }
  const dataInicioStr = dataInicio.toISOString().split("T")[0];

  // Query principal com LIMIT (evita retornar milhares de registros)
  const limite = Math.min(parseInt(searchParams.get("limite") || "100", 10), 500);

  let query = supabase
    .from("vendas")
    .select("*, clientes(nome_razao_social)", { count: "exact" })
    .gte("data_venda", dataInicioStr);

  if (busca) {
    query = query.ilike("clientes.nome_razao_social", `%${busca}%`);
  }

  if (status !== "todos") {
    query = query.eq("status", status);
  }

  const { data: vendas, error, count } = await query
    .order("data_venda", { ascending: false })
    .limit(limite);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Stats — query agregada leve (só sum/count, sem dados)
  const { data: aggData, error: aggError } = await supabase
    .from("vendas")
    .select("valor_final.sum(), count()")
    .gte("data_venda", dataInicioStr)
    .single();

  const stats = {
    total_vendas: count || 0,
    total_faturado: aggData?.sum || 0,
    ticket_medio: aggData?.count ? (aggData.sum / aggData.count) : 0,
  };

  return NextResponse.json({ vendas: vendas || [], stats, count });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const body = await request.json();
  const {
    cliente_id,
    canal_id,
    data_venda,
    valor_total,
    valor_desconto = 0,
    valor_frete = 0,
    valor_final,
    status = "confirmada",
    forma_pagamento,
    prazo_pagamento,
    itens,
  } = body;

  if (!cliente_id || !data_venda || !valor_total || !valor_final) {
    return NextResponse.json({ error: "Cliente, data e valores são obrigatórios" }, { status: 400 });
  }

  // Gera número do pedido
  const { data: lastVenda } = await supabase
    .from("vendas")
    .select("numero_pedido")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  let numeroPedido = "V001";
  if (lastVenda?.numero_pedido) {
    const num = parseInt(lastVenda.numero_pedido.replace("V", "")) + 1;
    numeroPedido = `V${num.toString().padStart(3, "0")}`;
  }

  const { data: venda, error: vendaError } = await supabase
    .from("vendas")
    .insert({
      cliente_id,
      vendedor_id: user.id,
      canal_id,
      numero_pedido: numeroPedido,
      data_venda,
      valor_total,
      valor_desconto,
      valor_frete,
      valor_final,
      status,
      forma_pagamento,
      prazo_pagamento,
    })
    .select()
    .single();

  if (vendaError) {
    return NextResponse.json({ error: vendaError.message }, { status: 500 });
  }

  // Insere itens se houver
  if (itens && itens.length > 0) {
    const itensComVendaId = itens.map((item: any) => ({
      venda_id: venda.id,
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      valor_total: item.valor_total,
      desconto_percentual: item.desconto_percentual || 0,
    }));

    const { error: itensError } = await supabase.from("venda_itens").insert(itensComVendaId);

    if (itensError) {
      return NextResponse.json({ error: itensError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, venda });
}
