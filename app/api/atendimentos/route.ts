import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/atendimentos?status=aberto - lista atendimentos do vendedor logado
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "aberto";

  // Busca perfil do usuário para verificar se é gestor/admin
  const { data: meuPerfil } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .single();

  const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");

  let query = supabase
    .from("atendimentos")
    .select("*, clientes(id, nome_razao_social), ultima_mensagem_remetente, nao_lido")
    .eq("status", status)
    .order("ultima_mensagem_data", { ascending: false })
    .limit(200);

  if (isGestor) {
    // Gestor vê todos os atendimentos
  } else {
    // Vendedor vê seus atendimentos + atendimentos não atribuídos (fila geral)
    query = query.or(`vendedor_id.eq.${user.id},vendedor_id.is.null`);
  }

  const { data: atendimentos, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ atendimentos: atendimentos || [] });
}

// POST /api/atendimentos - cria atendimento (simulacao ou webhook)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();

  const {
    telefone_cliente,
    nome_cliente,
    mensagem,
    canal = "whatsapp",
  } = body;

  if (!telefone_cliente) {
    return NextResponse.json({ error: "Telefone é obrigatório" }, { status: 400 });
  }

  // Sempre usa service_role para bypassar RLS na API server-side
  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Busca cliente pelo telefone (limpa non-digits)
  const telefoneLimpo = telefone_cliente.replace(/\D/g, "");
  
  // Busca ampla: telefone ou celular contendo parte do número (para lidar com formatos como (055) 623578-2650)
  const { data: clientesCandidatos } = await supabaseAdmin
    .from("clientes")
    .select("id, vendedor_responsavel_id, nome_razao_social, telefone, celular")
    .or(`telefone.ilike.%${telefoneLimpo.substring(0, 6)}%,celular.ilike.%${telefoneLimpo.substring(0, 6)}%`)
    .limit(50);

  // Filtra no JS comparando apenas os dígitos
  const cliente = clientesCandidatos?.find((c) => {
    const telLimpo = (c.telefone || "").replace(/\D/g, "");
    const celLimpo = (c.celular || "").replace(/\D/g, "");
    return telLimpo === telefoneLimpo || celLimpo === telefoneLimpo ||
           telLimpo.endsWith(telefoneLimpo) || celLimpo.endsWith(telefoneLimpo) ||
           telefoneLimpo.endsWith(telLimpo) || telefoneLimpo.endsWith(celLimpo);
  });

  const clienteId = cliente?.id || null;
  const vendedorId = cliente?.vendedor_responsavel_id || null;
  const nomeCliente = nome_cliente || cliente?.nome_razao_social || "Cliente";

  // Verifica se já existe atendimento aberto para esse telefone
  const { data: existente } = await supabaseAdmin
    .from("atendimentos")
    .select("id")
    .eq("telefone_cliente", telefoneLimpo)
    .eq("status", "aberto")
    .limit(1)
    .single();

  if (existente) {
    await supabaseAdmin
      .from("atendimentos")
      .update({
        ultima_mensagem: mensagem,
        ultima_mensagem_data: new Date().toISOString(),
        vendedor_id: vendedorId,
        nome_cliente: nomeCliente,
        cliente_id: clienteId,
      })
      .eq("id", existente.id);

    // Adiciona mensagem no histórico
    await supabaseAdmin.from("atendimento_mensagens").insert({
      atendimento_id: existente.id,
      remetente: "cliente",
      conteudo: mensagem,
    });

    return NextResponse.json({ success: true, atendimento_id: existente.id, updated: true });
  }

  // Cria novo atendimento
  const { data: atendimento, error } = await supabaseAdmin
    .from("atendimentos")
    .insert({
      cliente_id: clienteId,
      vendedor_id: vendedorId,
      canal,
      telefone_cliente: telefoneLimpo,
      nome_cliente: nomeCliente,
      status: "aberto",
      prioridade: clienteId ? "normal" : "alta",
      assunto: mensagem?.substring(0, 100) || "Nova mensagem",
      ultima_mensagem: mensagem,
      ultima_mensagem_data: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Adiciona mensagem inicial no histórico
  await supabaseAdmin.from("atendimento_mensagens").insert({
    atendimento_id: atendimento.id,
    remetente: "cliente",
    conteudo: mensagem,
  });

  return NextResponse.json({ success: true, atendimento_id: atendimento.id, cliente_encontrado: !!clienteId });
}

// PATCH /api/atendimentos - fecha, transfere ou assume atendimento
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { id, status, vendedor_id, assumir } = body;

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
  }

  // Verifica se usuário é gestor
  const { data: meuPerfil } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .single();
  const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");

  // Se não é gestor e não está assumindo, verifica se o atendimento é dele
  if (!isGestor && !assumir) {
    const { data: atendimentoAtual } = await supabase
      .from("atendimentos")
      .select("vendedor_id")
      .eq("id", id)
      .single();
    if (atendimentoAtual?.vendedor_id !== user.id) {
      return NextResponse.json({ error: "Sem permissão para alterar este atendimento" }, { status: 403 });
    }
  }

  const updateData: any = {};
  if (status) updateData.status = status;
  if (status === "fechado") updateData.data_fechamento = new Date().toISOString();
  if (vendedor_id) {
    updateData.vendedor_id = vendedor_id;
    updateData.transbordado = true;
    updateData.data_transbordo = new Date().toISOString();
  }
  if (assumir) {
    // Vendedor assume atendimento não atribuído
    updateData.vendedor_id = user.id;
  }

  // Usa service_role para bypassar RLS (vendedor pode transferir para outro)
  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: atendimento, error } = await supabaseAdmin
    .from("atendimentos")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error || !atendimento) {
    return NextResponse.json({ error: error?.message || "Atendimento não encontrado" }, { status: 500 });
  }

  return NextResponse.json({ success: true, atendimento });
}
