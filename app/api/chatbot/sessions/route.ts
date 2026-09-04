/**
 * API de Sessões do Chatbot
 * 
 * GET /api/chatbot/sessions - Lista sessões
 * GET /api/chatbot/sessions?id=xxx - Detalhes de uma sessão
 * GET /api/chatbot/sessions?phone=xxx - Sessão por telefone
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

// GET - Listar sessões
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);

    const id = searchParams.get('id');
    const telefone = searchParams.get('phone');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Buscar sessão específica por ID
    if (id) {
      const { data: sessao, error } = await supabase
        .from('chatbot_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Buscar mensagens da sessão
      const { data: mensagens } = await supabase
        .from('chatbot_messages')
        .select('*')
        .eq('session_id', id)
        .order('created_at', { ascending: true });

      return NextResponse.json({ sessao, mensagens: mensagens || [] });
    }

    // Buscar sessão por telefone
    if (telefone) {
      const { data: sessao, error } = await supabase
        .from('chatbot_sessions')
        .select('*')
        .eq('telefone', telefone)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (sessao) {
        const { data: mensagens } = await supabase
          .from('chatbot_messages')
          .select('*')
          .eq('session_id', sessao.id)
          .order('created_at', { ascending: true });

        return NextResponse.json({ sessao, mensagens: mensagens || [] });
      }

      return NextResponse.json({ sessao: null, mensagens: [] });
    }

    // Listar todas as sessões
    let query = supabase
      .from('chatbot_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: sessoes, error } = await query;

    if (error) throw error;

    return NextResponse.json({ sessoes: sessoes || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Atualizar sessão (ex: encerrar, mudar status)
export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const { id, status, classificacao } = body;

    if (!id) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (classificacao) updates.classificacao = classificacao;

    const { error } = await supabase
      .from('chatbot_sessions')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
