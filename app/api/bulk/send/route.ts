/**
 * API para enviar campanha de disparo em massa
 * 
 * POST /api/bulk/send
 * Body: { campaignId: string }
 * 
 * Apenas marca a campanha como "running".
 * O worker do VPS (/root/disparo_worker.py) processa o envio.
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

    // Marcar como "running" — o worker do VPS vai processar
    await supabase
      .from("bulk_campaigns")
      .update({ status: "running" })
      .eq("id", campaignId);

    console.log(`[Bulk Send] Campanha "${campaign.name}" marcada como running — worker do VPS vai processar`);

    return NextResponse.json({ success: true, message: "Campanha iniciada (processamento via VPS)" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
