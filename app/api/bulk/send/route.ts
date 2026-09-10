/**
 * API para enviar campanha de disparo em massa
 * 
 * POST /api/bulk/send
 * Body: { campaignId: string }
 * 
 * Envia mensagens com cadência controlada (3-8s entre envios)
 * Limite: 60/hora, 500/dia
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enviarMensagemWhatsApp } from "@/lib/evolution-api";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { campaignId } = body;

    if (!campaignId) {
      return NextResponse.json({ error: "campaignId é obrigatório" }, { status: 400 });
    }

    // Buscar campanha
    const { data: campaign, error: fetchError } = await supabase
      .from("bulk_campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    }

    if (campaign.status === "running") {
      return NextResponse.json({ error: "Campanha já está em execução" }, { status: 400 });
    }

    // Atualizar status para running
    await supabase
      .from("bulk_campaigns")
      .update({ status: "running" })
      .eq("id", campaignId);

    // Enviar em background (não bloqueia a resposta)
    enviarCampanha(supabase, campaign).catch((err) => {
      console.error("[Bulk Send] Erro:", err);
    });

    return NextResponse.json({ success: true, message: "Campanha iniciada" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function enviarCampanha(supabase: any, campaign: any) {
  const rawNumbers = campaign.numbers || [];
  // Se o primeiro elemento não for numérico, é a instância
  let instanceName = "ROMA_2";
  let numbers = rawNumbers;
  if (rawNumbers.length > 0 && !/^\d/.test(String(rawNumbers[0]))) {
    instanceName = rawNumbers[0];
    numbers = rawNumbers.slice(1);
  }
  const intervalo = (campaign.intervalo || campaign.delay_min || 5) * 1000;
  let sent = 0;
  let failed = 0;

  console.log(`[Bulk Send] Iniciando campanha "${campaign.name}" - ${numbers.length} números - instância: ${instanceName} - intervalo: ${intervalo/1000}s`);

  // Salvar números no gatilho do chatbot (se houver fluxo ativo)
  try {
    const { data: fluxoAtivo } = await supabase
      .from('chatbot_flows')
      .select('id')
      .eq('gatilho', 'disparo')
      .eq('ativo', true)
      .limit(1)
      .maybeSingle();

    if (fluxoAtivo) {
      const gatilhoRecords = numbers.map((n: string) => {
        const num = n.replace(/\D/g, "");
        return { flow_id: fluxoAtivo.id, telefone: num.startsWith("55") ? num : "55" + num };
      });
      await supabase.from('chatbot_gatilho_numeros').upsert(gatilhoRecords, { onConflict: 'flow_id,telefone' });
      console.log(`[Bulk Send] ${gatilhoRecords.length} números salvos no gatilho do chatbot`);
    }
  } catch (err: any) {
    console.error('[Bulk Send] Erro ao salvar gatilho:', err.message);
  }

  if (numbers.length === 0) {
    console.error(`[Bulk Send] Nenhum número encontrado! numbers原始:`, rawNumbers);
    await supabase.from("bulk_campaigns").update({ status: "completed", failed: 0 }).eq("id", campaign.id);
    return;
  }

  for (const number of numbers) {
    try {
      // Formatar número (adicionar 55 se não tiver)
      let formattedNumber = number.replace(/\D/g, "");
      if (!formattedNumber.startsWith("55")) {
        formattedNumber = "55" + formattedNumber;
      }

      // Enviar mensagem via instância correta
      const result = await enviarMensagemWhatsApp({
        telefone: formattedNumber,
        mensagem: campaign.message,
        instance: instanceName,
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
        console.error(`[Bulk Send] Falha para ${formattedNumber}:`, result.error);
      }

      // Atualizar contadores
      await supabase
        .from("bulk_campaigns")
        .update({ sent, failed })
        .eq("id", campaign.id);

      // Intervalo fixo entre envios
      await new Promise((resolve) => setTimeout(resolve, intervalo));
    } catch (err: any) {
      failed++;
      console.error(`[Bulk Send] Erro para ${number}:`, err.message);
    }
  }

  // Finalizar campanha
  await supabase
    .from("bulk_campaigns")
    .update({ status: "completed" })
    .eq("id", campaign.id);

  console.log(`[Bulk Send] Campanha "${campaign.name}" concluída - ${sent} enviados, ${failed} falharam`);
}
