import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { buscarVendedorPadrao } from "@/lib/roteamento";

export const dynamic = "force-dynamic";

// GET /api/atendimentos?status=aberto - lista atendimentos do vendedor logado
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    // Usa service_role para garantir leitura do perfil (RLS pode bloquear o client da sessão)
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: meuPerfil } = await supabaseAdmin
      .from("profiles")
      .select("cargo, whatsapp_instance")
      .eq("id", user.id)
      .single();

    const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");
    const whatsappInstance = meuPerfil?.whatsapp_instance || null;

    console.log(`[API atendimentos] user=${user.id} cargo=${meuPerfil?.cargo} instance=${whatsappInstance} isGestor=${isGestor}`);

    // Query com service_role para bypassar RLS
    let query = supabaseAdmin
      .from("atendimentos")
      .select("*, clientes(id, nome_razao_social), ultima_mensagem_remetente, nao_lido")
      .order("ultima_mensagem_data", { ascending: false })
      .limit(200);

    if (status) {
      query = query.eq("status", status);
    }

    if (isGestor) {
      // Gestores veem todos
    } else if (whatsappInstance) {
      // Vendedor com instância atribuída: vê TODOS os atendimentos daquela instância
      console.log(`[API atendimentos] Filtrando por instancia=${whatsappInstance}`);
      query = query.eq("instancia", whatsappInstance);
    } else {
      const isDemo = (meuPerfil?.cargo || "") === "demonstracao";
      
      if (isDemo) {
        query = query.eq("vendedor_id", user.id);
      } else {
        query = query.or(`vendedor_id.eq.${user.id},vendedor_id.is.null`);
      }
    }

    const { data: atendimentos, error } = await query;

    if (error) {
      console.error("[API atendimentos GET] Supabase error:", error);
      return NextResponse.json({ error: error.message, code: error.code, hint: error.hint }, { status: 500 });
    }

    return NextResponse.json({ atendimentos: atendimentos || [] });
  } catch (err: any) {
    console.error("[API atendimentos GET] Catch error:", err);
    return NextResponse.json({ error: err?.message || "Erro interno", stack: err?.stack }, { status: 500 });
  }
}

// POST /api/atendimentos - cria atendimento (simulacao ou webhook)
export async function POST(request: NextRequest) {
  // Rate limit: 20 criações por minuto
  const limit = rateLimit(request, { max: 20, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Muitas requisições. Aguarde." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

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
  // Se cliente não tem vendedor no cadastro, usa vendedor padrão (roteamento)
  const vendedorPadrao = await buscarVendedorPadrao();
  let vendedorId = cliente?.vendedor_responsavel_id || vendedorPadrao || null;
  const nomeCliente = nome_cliente || cliente?.nome_razao_social || "Cliente";

  // Se o usuário é demonstração, sempre atribui o atendimento a ele
  const { data: meuPerfilCheck } = await supabaseAdmin
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .single();
  if ((meuPerfilCheck?.cargo || "") === "demonstracao") {
    vendedorId = user.id;
  }

  // Verifica se já existe atendimento aberto para esse telefone
  // Busca exata primeiro
  let { data: existente } = await supabaseAdmin
    .from("atendimentos")
    .select("id")
    .eq("telefone_cliente", telefoneLimpo)
    .eq("status", "aberto")
    .limit(1)
    .single();

  // Se não encontrou, busca tolerante (últimos 8 dígitos)
  if (!existente && telefoneLimpo.length >= 8) {
    const ultimos8 = telefoneLimpo.slice(-8);
    const { data: candidatos } = await supabaseAdmin
      .from("atendimentos")
      .select("id, telefone_cliente")
      .eq("status", "aberto")
      .order("ultima_mensagem_data", { ascending: false })
      .limit(50);

    existente = candidatos?.find((a: any) => {
      const telBanco = (a.telefone_cliente || "").replace(/\D/g, "");
      return telBanco.slice(-8) === ultimos8 && telBanco.length >= 8;
    }) || null;
  }

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
  console.log("[API PATCH atendimentos] Body recebido:", JSON.stringify(body));
  const { id, status, vendedor_id, assumir } = body;

  if (!id) {
    console.error("[API PATCH atendimentos] ID não fornecido");
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
  }

  // Verifica se usuário é gestor
  const { data: meuPerfil } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .single();
  const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");

  // Se não é gestor e não está assumindo, verifica permissão
  if (!isGestor && !assumir) {
    const { data: meuPerfilFull } = await supabase
      .from("profiles")
      .select("cargo, whatsapp_instance")
      .eq("id", user.id)
      .single();
    
    const { data: atendimentoAtual } = await supabase
      .from("atendimentos")
      .select("vendedor_id, instancia")
      .eq("id", id)
      .single();
    
    const isDono = atendimentoAtual?.vendedor_id === user.id;
    const isMesmaInstancia = meuPerfilFull?.whatsapp_instance && 
                             atendimentoAtual?.instancia === meuPerfilFull.whatsapp_instance;
    
    if (!isDono && !isMesmaInstancia) {
      return NextResponse.json({ error: "Sem permissão para alterar este atendimento" }, { status: 403 });
    }
  }

  const updateData: any = {};
  if (status) updateData.status = status;
  if (typeof body.nao_lido === "boolean") updateData.nao_lido = body.nao_lido;
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

  console.log("[API PATCH atendimentos] Update data:", JSON.stringify(updateData));

  const { data: atendimento, error } = await supabaseAdmin
    .from("atendimentos")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error || !atendimento) {
    console.error("[API PATCH atendimentos] Supabase error:", error);
    return NextResponse.json({ error: error?.message || "Atendimento não encontrado", details: error }, { status: 500 });
  }

  console.log("[API PATCH atendimentos] Sucesso:", atendimento?.id);

  return NextResponse.json({ success: true, atendimento });
}
