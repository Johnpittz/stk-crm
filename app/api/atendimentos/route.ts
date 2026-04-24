import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/atendimentos - lista atendimentos (tickets) do vendedor
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "aberto";

  const { data: atendimentos, error } = await supabase
    .from("atendimentos")
    .select("*, clientes(id, nome_razao_social)")
    .eq("vendedor_id", user.id)
    .eq("status", status)
    .order("ultima_mensagem_data", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ atendimentos: atendimentos || [] });
}

// POST /api/atendimentos - recebe webhook do WhatsApp (ou cria manual)
export async function POST(request: NextRequest) {
  const body = await request.json();

  // Se tem authorization, é criação manual pelo usuário logado
  const authHeader = request.headers.get("authorization") || "";
  const isWebhook = !authHeader.startsWith("Bearer");

  if (isWebhook) {
    // Webhook do WhatsApp - precisa de token de verificação
    const webhookToken = request.headers.get("x-webhook-token") || "";
    const expectedToken = process.env.WEBHOOK_SECRET || "";

    if (webhookToken !== expectedToken && expectedToken !== "") {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const {
      telefone_cliente,
      nome_cliente,
      mensagem,
      canal = "whatsapp",
    } = body;

    if (!telefone_cliente) {
      return NextResponse.json({ error: "Telefone é obrigatório" }, { status: 400 });
    }

    // Usa service_role para bypassar RLS no webhook
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Busca cliente pelo telefone
    const { data: cliente } = await supabaseAdmin
      .from("clientes")
      .select("id, vendedor_responsavel_id, nome_razao_social")
      .or(`telefone.eq.${telefone_cliente},celular.eq.${telefone_cliente}`)
      .limit(1)
      .single();

    const clienteId = cliente?.id || null;
    const vendedorId = cliente?.vendedor_responsavel_id || null;
    const nomeCliente = nome_cliente || cliente?.nome_razao_social || "Cliente";

    // Verifica se já existe atendimento aberto para esse cliente/vendedor
    const { data: existente } = await supabaseAdmin
      .from("atendimentos")
      .select("id")
      .eq("telefone_cliente", telefone_cliente)
      .eq("status", "aberto")
      .limit(1)
      .single();

    if (existente) {
      // Atualiza o existente
      await supabaseAdmin
        .from("atendimentos")
        .update({
          ultima_mensagem: mensagem,
          ultima_mensagem_data: new Date().toISOString(),
          vendedor_id: vendedorId,
        })
        .eq("id", existente.id);

      return NextResponse.json({ success: true, atendimento_id: existente.id, updated: true });
    }

    // Cria novo atendimento
    const { data: atendimento, error } = await supabaseAdmin
      .from("atendimentos")
      .insert({
        cliente_id: clienteId,
        vendedor_id: vendedorId,
        canal,
        telefone_cliente: telefone_cliente,
        nome_cliente: nomeCliente,
        status: "aberto",
        assunto: mensagem?.substring(0, 100) || "Nova mensagem",
        ultima_mensagem: mensagem,
        ultima_mensagem_data: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Se tem vendedor, cria tarefa urgente no kanban dele
    if (vendedorId) {
      await supabaseAdmin.from("tarefas").insert({
        vendedor_id: vendedorId,
        cliente_id: clienteId,
        titulo: `WhatsApp: ${nomeCliente}`,
        descricao: mensagem?.substring(0, 200),
        tipo: "whatsapp",
        prioridade: "alta",
        status: "pendente",
        coluna_kanban: "a_fazer",
        data_inicio: new Date().toISOString().split("T")[0],
      });
    }

    return NextResponse.json({ success: true, atendimento_id: atendimento.id });
  }

  // Criação manual (usuário logado)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { cliente_id, assunto, telefone_cliente, nome_cliente } = body;

  const { data: atendimento, error } = await supabase
    .from("atendimentos")
    .insert({
      cliente_id: cliente_id || null,
      vendedor_id: user.id,
      telefone_cliente: telefone_cliente || null,
      nome_cliente: nome_cliente || null,
      assunto: assunto || "Atendimento manual",
      status: "aberto",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, atendimento });
}

// PATCH /api/atendimentos - fecha ou transfere atendimento
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { id, status, vendedor_id } = body;

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
  }

  const updateData: any = {};
  if (status) updateData.status = status;
  if (status === "fechado") updateData.data_fechamento = new Date().toISOString();
  if (vendedor_id) {
    updateData.vendedor_id = vendedor_id;
    updateData.transbordado = true;
    updateData.data_transbordo = new Date().toISOString();
  }

  const { data: atendimento, error } = await supabase
    .from("atendimentos")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, atendimento });
}
