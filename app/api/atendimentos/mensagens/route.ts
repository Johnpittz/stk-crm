import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { enviarMensagemWhatsApp, formatarTelefone } from "@/lib/botconversa";

export const dynamic = "force-dynamic";

// GET /api/atendimentos/mensagens?atendimento_id=xxx
// Usa service_role para bypassar RLS (padrão do projeto para leitura de mensagens)
export async function GET(request: NextRequest) {
  const supabaseUser = await createClient();
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const atendimentoId = searchParams.get("atendimento_id");

  if (!atendimentoId) {
    return NextResponse.json({ error: "atendimento_id é obrigatório" }, { status: 400 });
  }

  // Usa service_role para bypassar RLS (garante que vendedor veja mensagens de qualquer atendimento)
  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: mensagens, error } = await supabaseAdmin
    .from("atendimento_mensagens")
    .select("*")
    .eq("atendimento_id", atendimentoId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mensagens: mensagens || [] });
}

// POST /api/atendimentos/mensagens
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const { atendimento_id, conteudo, remetente = "vendedor" } = body;

  if (!atendimento_id || !conteudo) {
    return NextResponse.json({ error: "atendimento_id e conteudo são obrigatórios" }, { status: 400 });
  }

  const { data: mensagem, error } = await supabase
    .from("atendimento_mensagens")
    .insert({
      atendimento_id,
      remetente,
      conteudo,
      enviada_por: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Atualiza o atendimento com a última mensagem (para refletir na lista e no kanban)
  const updateData: any = {
    ultima_mensagem: conteudo,
    ultima_mensagem_data: new Date().toISOString(),
    ultima_mensagem_remetente: remetente,
  };
  if (remetente === "vendedor") {
    updateData.vendedor_interagiu = true;
  }

  await supabase
    .from("atendimentos")
    .update(updateData)
    .eq("id", atendimento_id);

  // Se é vendedor enviando, envia via BotConversa para o WhatsApp do cliente
  if (remetente === "vendedor" && process.env.BOTCONVERSA_API_KEY) {
    try {
      // Busca telefone do cliente no atendimento
      const { data: atendimento } = await supabase
        .from("atendimentos")
        .select("telefone_cliente")
        .eq("id", atendimento_id)
        .single();

      if (atendimento?.telefone_cliente) {
        const resultado = await enviarMensagemWhatsApp({
          telefone: atendimento.telefone_cliente,
          mensagem: conteudo,
        });

        if (resultado.success) {
          // Atualiza mensagem com whatsapp_message_id para rastreamento
          await supabase
            .from("atendimento_mensagens")
            .update({ whatsapp_message_id: resultado.message_id || null })
            .eq("id", mensagem.id);
        } else {
          console.error("[Mensagens] Erro ao enviar via WhatsApp:", resultado.error);
        }
      }
    } catch (err) {
      // Não falha a mensagem se o envio WhatsApp der erro
      console.error("[Mensagens] Erro ao enviar via BotConversa:", err);
    }
  }

  return NextResponse.json({ success: true, mensagem });
}
