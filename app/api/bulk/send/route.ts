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
  const numbers = campaign.numbers || [];
  let sent = 0;
  let failed = 0;

  console.log(`[Bulk Send] Iniciando campanha "${campaign.name}" - ${numbers.length} números`);

  for (const number of numbers) {
    try {
      // Formatar número (adicionar 55 se não tiver)
      let formattedNumber = number.replace(/\D/g, "");
      if (!formattedNumber.startsWith("55")) {
        formattedNumber = "55" + formattedNumber;
      }

      // Enviar mensagem
      const result = await enviarMensagemWhatsApp({
        telefone: formattedNumber,
        mensagem: campaign.message,
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

      // Cadência: 3-8 segundos entre envios
      const delay = 3000 + Math.random() * 5000;
      await new Promise((resolve) => setTimeout(resolve, delay));
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
