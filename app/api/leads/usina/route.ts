import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { montarLeadUsina } from "@/lib/usina/lead-usina";

export const dynamic = "force-dynamic";

/**
 *25/11/2026 — Fase2-A: lead da LANDING pública "quanto posso economizar".
 *
 * Rota PÚBLICA (sem login — o visitante é cliente final): rate-limit por IP,
 * validação/estimativa na lib pura e insert via service role em
 * `leads_marketing` (origem "site", score calculado). O RLS da tabela não
 * dá acesso a anônimo, por isso o client admin aqui.
 */
export async function POST(request: NextRequest) {
  const limit = rateLimit(request, { max: 5, windowMs: 60_000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um minuto e tente de novo." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const lead = montarLeadUsina(body ?? {});
  if (lead.erros.length > 0) {
    return NextResponse.json(
      { error: "Confira os campos destacados", campos: lead.erros },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("leads_marketing")
      .insert(lead.payload)
      .select("id, score")
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, id: data.id, score: data.score });
  } catch (err: any) {
    console.error("[Leads Usina] erro ao gravar:", err?.message || err);
    return NextResponse.json(
      { error: "Não foi possível registrar agora. Tente novamente." },
      { status: 500 }
    );
  }
}
