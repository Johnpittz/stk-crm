/**
 * Endpoint de sincronização de mensagens WhatsApp
 * 
 * GET /api/atendimentos/sync?atendimento_id=xxx
 * 
 * Busca mensagens na API do BotConversa e insere as que faltam no banco.
 * Sincroniza mensagens enviadas pelo celular do vendedor que não passaram pelo CRM.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buscarMensagensSubscriber } from "@/lib/evolution-api";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const atendimentoId = searchParams.get("atendimento_id");

    if (!atendimentoId) {
      return NextResponse.json({ error: "atendimento_id obrigatório" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Busca o atendimento para pegar o telefone
    const { data: atendimento } = await supabase
      .from("atendimentos")
      .select("id, telefone_cliente")
      .eq("id", atendimentoId)
      .single();

    if (!atendimento) {
      return NextResponse.json({ error: "Atendimento não encontrado" }, { status: 404 });
    }

    // Busca mensagens do BotConversa
    console.log(`[Sync] Buscando mensagens para telefone: ${atendimento.telefone_cliente}`);
    const mensagensBC = await buscarMensagensSubscriber(atendimento.telefone_cliente);
    console.log(`[Sync] Mensagens encontradas na BotConversa: ${mensagensBC.length}`);
    
    if (mensagensBC.length === 0) {
      return NextResponse.json({ syncadas: 0, mensagem: "Nenhuma mensagem encontrada na BotConversa", debug: { telefone: atendimento.telefone_cliente } });
    }

    // Busca mensagens que já existem no banco
    const { data: mensagensExistentes } = await supabase
      .from("atendimento_mensagens")
      .select("conteudo, created_at")
      .eq("atendimento_id", atendimentoId);

    // Cria um Set de conteúdo existente para deduplicação
    const conteudosExistentes = new Set(
      (mensagensExistentes || []).map((m) => m.conteudo?.trim().toLowerCase())
    );

    let syncadas = 0;

    for (const msg of mensagensBC) {
      const conteudoTrimmed = msg.text?.trim();
      if (!conteudoTrimmed) continue;

      // Pula se já existe mensagem com mesmo conteúdo
      if (conteudosExistentes.has(conteudoTrimmed.toLowerCase())) continue;

      // direction: incoming = cliente, outgoing = vendedor/agente
      const remetente = msg.direction === "outgoing" ? "vendedor" : "cliente";

      // Insere a mensagem
      const { error: insertError } = await supabase
        .from("atendimento_mensagens")
        .insert({
          atendimento_id: atendimentoId,
          remetente,
          conteudo: conteudoTrimmed,
          enviada_por: null,
        });

      if (!insertError) {
        syncadas++;
        // Adiciona ao Set para evitar duplicatas no mesmo lote
        conteudosExistentes.add(conteudoTrimmed.toLowerCase());
      }
    }

    // Se sincronizou alguma mensagem, atualiza o atendimento
    if (syncadas > 0) {
      // Pega a última mensagem sincronizada para atualizar o atendimento
      const ultimaMsg = mensagensBC[mensagensBC.length - 1];
      const remetenteUltima = ultimaMsg.direction === "outgoing" ? "vendedor" : "cliente";

      await supabase
        .from("atendimentos")
        .update({
          ultima_mensagem: ultimaMsg.text,
          ultima_mensagem_data: new Date().toISOString(),
          ultima_mensagem_remetente: remetenteUltima,
        })
        .eq("id", atendimentoId);
    }

    return NextResponse.json({ syncadas });
  } catch (error: any) {
    console.error("[Sync] Erro:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}