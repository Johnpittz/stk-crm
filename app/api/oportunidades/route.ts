import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET    /api/oportunidades          - Lista oportunidades do vendedor
 * POST   /api/oportunidades          - Cria nova oportunidade
 * PATCH  /api/oportunidades          - Atualiza oportunidade
 * DELETE /api/oportunidades?id=xxx   - Deleta oportunidade
 */

// GET - Lista oportunidades
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const etapa = searchParams.get("etapa");

  // Verificar se é gestor
  const { data: meuPerfil } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .single();
  const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");

  let query = supabase
    .from("oportunidades")
    .select("*, clientes(id, nome_razao_social, telefone, celular)")
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  // Se não é gestor, vê só as suas
  if (!isGestor) {
    query = query.eq("vendedor_id", user.id);
  }

  if (etapa) {
    query = query.eq("etapa", etapa);
  }

  let oportunidades: any[] = [];
  try {
    const { data, error } = await query;
    if (error) {
      console.warn("[API oportunidades] Query falhou:", error.message);
    } else {
      oportunidades = data || [];
    }
  } catch (queryErr: any) {
    console.warn("[API oportunidades] Exceção:", queryErr?.message);
  }

  return NextResponse.json({ oportunidades });
}

// POST - Criar oportunidade
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const {
    cliente_id,
    atendimento_id,
    cliente_nome,
    titulo,
    descricao,
    tipo = "gd",
    prioridade = "media",
    uc,
    consumo_kwh,
    concessionaria,
    valor_proposta,
    data_inicio,
    hora_inicio,
  } = body;

  if (!titulo) {
    return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });
  }

  // Pega a maior ordem do vendedor
  let ultimaOrdem: { ordem?: number } | null = null;
  try {
    const result = await supabase
      .from("oportunidades")
      .select("ordem")
      .eq("vendedor_id", user.id)
      .eq("etapa", "recebeu_conta")
      .order("ordem", { ascending: false })
      .limit(1)
      .single();
    ultimaOrdem = result.data;
  } catch {
    // tabela pode não existir ainda
  }

  const novaOrdem = (ultimaOrdem?.ordem || 0) + 1;

  const { data: oportunidade, error } = await supabase
    .from("oportunidades")
    .insert({
      vendedor_id: user.id,
      cliente_id: cliente_id || null,
      atendimento_id: atendimento_id || null,
      cliente_nome: cliente_nome || null,
      titulo,
      descricao: descricao || null,
      tipo,
      prioridade,
      etapa: "recebeu_conta",
      ordem: novaOrdem,
      uc: uc || null,
      consumo_kwh: consumo_kwh || null,
      concessionaria: concessionaria || null,
      valor_proposta: valor_proposta || null,
      data_inicio: data_inicio || null,
      hora_inicio: hora_inicio || null,
    })
    .select("*, clientes(id, nome_razao_social)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Registrar no histórico
  await supabase.from("oportunidade_historico").insert({
    oportunidade_id: oportunidade.id,
    etapa_anterior: null,
    etapa_nova: "recebeu_conta",
    observacao: "Oportunidade criada",
    created_by: user.id,
  });

  return NextResponse.json({ success: true, oportunidade });
}

// PATCH - Atualizar oportunidade
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const {
    id,
    titulo,
    descricao,
    prioridade,
    etapa,
    ordem,
    status,
    resultado,
    observacao_resultado,
    valor_venda,
    valor_proposta,
    cliente_nome,
    uc,
    consumo_kwh,
    concessionaria,
  } = body;

  if (!id) {
    return NextResponse.json({ error: "ID da oportunidade é obrigatório" }, { status: 400 });
  }

  // Verificar permissão (só as suas, a menos que seja gestor)
  const { data: oportunidadeAtual } = await supabase
    .from("oportunidades")
    .select("vendedor_id")
    .eq("id", id)
    .single();

  const { data: meuPerfil } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .single();
  const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");

  if (!isGestor && oportunidadeAtual?.vendedor_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const updateData: any = {};
  if (cliente_nome !== undefined) updateData.cliente_nome = cliente_nome;
  if (titulo !== undefined) updateData.titulo = titulo;
  if (descricao !== undefined) updateData.descricao = descricao;
  if (prioridade !== undefined) updateData.prioridade = prioridade;
  if (ordem !== undefined) updateData.ordem = ordem;
  if (resultado !== undefined) updateData.resultado = resultado;
  if (observacao_resultado !== undefined) updateData.observacao_resultado = observacao_resultado;
  if (valor_venda !== undefined) updateData.valor_venda = valor_venda;
  if (valor_proposta !== undefined) updateData.valor_proposta = valor_proposta;
  if (uc !== undefined) updateData.uc = uc;
  if (consumo_kwh !== undefined) updateData.consumo_kwh = consumo_kwh;
  if (concessionaria !== undefined) updateData.concessionaria = concessionaria;

  // Se mudou de etapa, registrar no histórico
  if (etapa !== undefined && etapa !== oportunidadeAtual?.etapa) {
    updateData.etapa = etapa;

    await supabase.from("oportunidade_historico").insert({
      oportunidade_id: id,
      etapa_anterior: oportunidadeAtual?.etapa,
      etapa_nova: etapa,
      observacao: observacao_resultado || null,
      created_by: user.id,
    });

    // Se moveu para comissao_paga, marcar data_fechamento
    if (etapa === "comissao_paga") {
      updateData.data_fechamento = new Date().toISOString().split("T")[0];
      updateData.resultado = "sucesso";
    }
  }

  const { data: oportunidade, error } = await supabase
    .from("oportunidades")
    .update(updateData)
    .eq("id", id)
    .select("*, clientes(id, nome_razao_social)")
    .single();

  if (error || !oportunidade) {
    console.error("[API PATCH oportunidades] Error:", error);
    return NextResponse.json({ error: "Oportunidade não encontrada ou sem permissão", details: error?.message }, { status: 404 });
  }

  return NextResponse.json({ success: true, oportunidade });
}

// DELETE - Deletar oportunidade
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID da oportunidade é obrigatório" }, { status: 400 });
  }

  // Verificar permissão
  const { data: oportunidadeAtual } = await supabase
    .from("oportunidades")
    .select("vendedor_id")
    .eq("id", id)
    .single();

  const { data: meuPerfil } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .single();
  const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");

  if (!isGestor && oportunidadeAtual?.vendedor_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { error } = await supabase.from("oportunidades").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
