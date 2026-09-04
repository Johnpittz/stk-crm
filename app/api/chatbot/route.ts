/**
 * API Principal do Chatbot
 * 
 * POST /api/chatbot
 * 
 * Processa mensagens recebidas via WhatsApp e gerencia
 * o fluxo de qualificação de leads.
 * 
 * Body: {
 *   telefone: string,
 *   mensagem: string,
 *   instancia: string,
 *   nome?: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { processarMensagemChatbot, mensagemFallback } from "@/lib/chatbot/engine";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telefone, mensagem, instancia, nome } = body;

    if (!telefone || !mensagem || !instancia) {
      return NextResponse.json(
        { error: "telefone, mensagem e instancia são obrigatórios" },
        { status: 400 }
      );
    }

    console.log(`[Chatbot] Mensagem recebida: ${telefone} - "${mensagem.substring(0, 50)}..."`);

    // Processar mensagem
    const resultado = await processarMensagemChatbot(
      telefone,
      mensagem,
      instancia,
      nome
    );

    console.log(`[Chatbot] Resultado: ${resultado.action}`);

    // Se precisa encaminhar vendedor
    if (resultado.action === 'encaminhar_vendedor') {
      const supabase = getSupabase();

      // Criar lead no marketing
      const respostas = resultado.respostas || {};
      const { error: leadError } = await supabase
        .from('leads_marketing')
        .insert({
          nome: respostas.nome || resultado.session?.nome_lead || 'Lead Chatbot',
          telefone: telefone,
          email: respostas.email || null,
          origem: 'chatbot',
          status: resultado.classificacao === 'A' ? 'quente' :
                  resultado.classificacao === 'B' ? 'qualificado' :
                  resultado.classificacao === 'C' ? 'nutricao' : 'frio',
          notas: JSON.stringify({
            fluxo: 'chatbot',
            classificacao: resultado.classificacao,
            respostas,
          }),
          instancia,
        });

      if (leadError) {
        console.error('[Chatbot] Erro ao criar lead:', leadError);
      }

      // Criar notificação para vendedor
      await supabase.from('notificacoes').insert({
        titulo: `Novo lead qualificado (Classificação ${resultado.classificacao})`,
        mensagem: `Lead: ${respostas.nome || 'Desconhecido'} - ${telefone}\nClassificação: ${resultado.classificacao}\nRespostas: ${JSON.stringify(respostas).substring(0, 200)}`,
        tipo: 'chatbot',
        lida: false,
      });
    }

    return NextResponse.json({
      success: true,
      action: resultado.action,
      mensagem: resultado.mensagem,
      classificacao: resultado.classificacao,
    });

  } catch (error: any) {
    console.error('[Chatbot] Erro geral:', error);
    return NextResponse.json(
      { error: "Erro ao processar chatbot", details: error.message },
      { status: 500 }
    );
  }
}

// GET - Status do chatbot
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();

    // Contar sessões ativas
    const { count: ativas } = await supabase
      .from('chatbot_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'ativa');

    // Contar sessões hoje
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const { count: hojeCount } = await supabase
      .from('chatbot_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', hoje.toISOString());

    // Contar leads por classificação
    const { data: classificacoes } = await supabase
      .from('chatbot_sessions')
      .select('classificacao')
      .not('classificacao', 'is', null);

    const stats = {
      ativas: ativas || 0,
      hoje: hojeCount || 0,
      classificacoes: {
        A: classificacoes?.filter(c => c.classificacao === 'A').length || 0,
        B: classificacoes?.filter(c => c.classificacao === 'B').length || 0,
        C: classificacoes?.filter(c => c.classificacao === 'C').length || 0,
        D: classificacoes?.filter(c => c.classificacao === 'D').length || 0,
      },
    };

    return NextResponse.json({ stats });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
