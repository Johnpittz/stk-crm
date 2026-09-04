/**
 * API de Fluxos do Chatbot
 * 
 * GET /api/chatbot/flows - Lista todos os fluxos
 * POST /api/chatbot/flows - Cria novo fluxo
 * PUT /api/chatbot/flows - Atualiza fluxo
 * DELETE /api/chatbot/flows?id=xxx - Deleta fluxo
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

// GET - Listar fluxos
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();

    const { data: fluxos, error } = await supabase
      .from('chatbot_flows')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Buscar contagem de sessões por fluxo
    const { data: sessoes } = await supabase
      .from('chatbot_sessions')
      .select('flow_id, status');

    const stats = (sessoes || []).reduce((acc: any, s) => {
      if (!acc[s.flow_id]) acc[s.flow_id] = { total: 0, ativas: 0 };
      acc[s.flow_id].total++;
      if (s.status === 'ativa') acc[s.flow_id].ativas++;
      return acc;
    }, {});

    const fluxosComStats = (fluxos || []).map(f => ({
      ...f,
      stats: stats[f.id] || { total: 0, ativas: 0 },
    }));

    return NextResponse.json({ fluxos: fluxosComStats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Criar fluxo
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const { nome, descricao, instancia, mensagem_inicial, horario_comercial, steps } = body;

    if (!nome || !mensagem_inicial) {
      return NextResponse.json(
        { error: "nome e mensagem_inicial são obrigatórios" },
        { status: 400 }
      );
    }

    // Criar fluxo
    const { data: fluxo, error: fluxoError } = await supabase
      .from('chatbot_flows')
      .insert({
        nome,
        descricao,
        instancia,
        mensagem_inicial,
        horario_comercial: horario_comercial || {
          seg_sexta: "08:00-18:00",
          sabado: "08:00-12:00",
        },
      })
      .select()
      .single();

    if (fluxoError) throw fluxoError;

    // Criar steps se fornecidos
    if (steps && steps.length > 0) {
      const stepsComFlowId = steps.map((step: any, index: number) => ({
        ...step,
        flow_id: fluxo.id,
        ordem: step.ordem || index + 1,
      }));

      const { error: stepsError } = await supabase
        .from('chatbot_flow_steps')
        .insert(stepsComFlowId);

      if (stepsError) throw stepsError;
    }

    return NextResponse.json({ fluxo });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Atualizar fluxo
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const { id, nome, descricao, instancia, mensagem_inicial, ativo, horario_comercial, steps } = body;

    if (!id) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    }

    // Atualizar fluxo
    const updates: any = {};
    if (nome !== undefined) updates.nome = nome;
    if (descricao !== undefined) updates.descricao = descricao;
    if (instancia !== undefined) updates.instancia = instancia;
    if (mensagem_inicial !== undefined) updates.mensagem_inicial = mensagem_inicial;
    if (ativo !== undefined) updates.ativo = ativo;
    if (horario_comercial !== undefined) updates.horario_comercial = horario_comercial;
    updates.updated_at = new Date().toISOString();

    const { error: fluxoError } = await supabase
      .from('chatbot_flows')
      .update(updates)
      .eq('id', id);

    if (fluxoError) throw fluxoError;

    // Atualizar steps se fornecidos
    if (steps) {
      // Deletar steps antigos
      await supabase
        .from('chatbot_flow_steps')
        .delete()
        .eq('flow_id', id);

      // Inserir novos steps
      const stepsComFlowId = steps.map((step: any, index: number) => ({
        ...step,
        flow_id: id,
        ordem: step.ordem || index + 1,
      }));

      const { error: stepsError } = await supabase
        .from('chatbot_flow_steps')
        .insert(stepsComFlowId);

      if (stepsError) throw stepsError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Deletar fluxo
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    }

    // Deletar steps primeiro (cascade)
    await supabase
      .from('chatbot_flow_steps')
      .delete()
      .eq('flow_id', id);

    // Deletar fluxo
    const { error } = await supabase
      .from('chatbot_flows')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
