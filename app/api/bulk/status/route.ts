/**
 * API para pausar/retomar um disparo (bulk_campaigns).
 *
 * POST /api/bulk/status
 * Body: { campaignId: string, status: "paused" | "running" }
 *
 * O worker do VPS (/root/disparo_worker.py) respeita "paused" (para o envio)
 * e retoma sozinho quando volta para "running" — sem repetir números já
 * enviados. Mesmo padrão do /api/bulk/send (service role).
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

const STATUS_PERMITIDOS = ["paused", "running"];

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { campaignId, status } = body;

    if (!campaignId || !STATUS_PERMITIDOS.includes(status)) {
      return NextResponse.json(
        { error: "campaignId e status (paused|running) são obrigatórios" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("bulk_campaigns")
      .update({ status })
      .eq("id", campaignId)
      .select("id, name, status")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Campanha não encontrada" },
        { status: 404 }
      );
    }

    console.log(
      `[Bulk Status] "${data.name}" → ${status} (via painel)`
    );

    return NextResponse.json({ success: true, campaign: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
