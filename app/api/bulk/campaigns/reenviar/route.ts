/**
 * POST /api/bulk/campaigns/reenviar — reenfileira SÓ os contatos com falha.
 *
 * 05/10 — pedido do João: "botão de REENVIAR ... sem precisar inserir os
 * números novamente, as mensagens e as imagens".
 *
 * Como funciona: lê `disparo_logs` do disparo original, monta a lista só
 * com quem falhou (`err`) e NUNCA recebeu nada (`ok`) — parciais ficam de
 * fora para não duplicar mensagem —, copia integralmente o registro (fluxo,
 * mensagens, imagem, instância, intervalos) e insere um novo com
 * `status=running` e contadores zerados. O robô (worker) pega o novo
 * registro como qualquer outro disparo — nenhuma mudança nele.
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

const digitos = (v: string) => (v || "").replace(/\D/g, "");

/** Colunas que NÃO se copiam do original (identidade/status/contadores). */
const SEM_CPIA = new Set([
  "id", "created_at", "updated_at", "status",
  "sent", "failed", "delivered", "read_count", "error_log",
]);

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }
    const id = body?.id;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    }

    const { data: orig, error } = await supabase
      .from("bulk_campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!orig) {
      return NextResponse.json({ error: "Disparo não encontrado" }, { status: 404 });
    }
    if (orig.status === "running" || orig.status === "processing") {
      return NextResponse.json(
        { error: "Disparo em andamento — pare antes de reenviar" },
        { status: 409 }
      );
    }

    const [errs, oks] = await Promise.all([
      supabase.from("disparo_logs")
        .select("contact_phone, contact_name")
        .eq("campaign_id", id).eq("status", "err"),
      supabase.from("disparo_logs")
        .select("contact_phone")
        .eq("campaign_id", id).eq("status", "ok"),
    ]);
    if (errs.error || oks.error) {
      return NextResponse.json(
        { error: errs.error?.message || oks.error?.message },
        { status: 500 }
      );
    }

    const recebeu = new Set(
      (oks.data ?? []).map((r: any) => digitos(r.contact_phone))
    );
    const vistos = new Set<string>();
    const falhas: Array<{ nome: string; telefone: string }> = [];
    for (const r of errs.data ?? []) {
      const d = digitos(r.contact_phone);
      if (!d || recebeu.has(d) || vistos.has(d)) continue;
      vistos.add(d);
      falhas.push({ nome: r.contact_name || "", telefone: r.contact_phone });
    }
    if (!falhas.length) {
      return NextResponse.json(
        { error: "Nenhuma falha para reenviar neste disparo" },
        { status: 409 }
      );
    }

    const copia: Record<string, any> = {};
    for (const [k, v] of Object.entries(orig)) {
      if (!SEM_CPIA.has(k)) copia[k] = v;
    }
    const rotulo = (`${(orig.name || orig.nome || "Disparo").trim()}` || "Disparo");
    const novo = {
      ...copia,
      name: `${rotulo} (reenvio)`,
      nome: `${rotulo} (reenvio)`,
      numbers: falhas,
      status: "running",
      sent: 0,
      failed: 0,
      delivered: 0,
      read_count: 0,
      error_log: null,
    };

    const { data: criado, error: insErr } = await supabase
      .from("bulk_campaigns")
      .insert(novo)
      .select("id")
      .single();
    if (insErr || !criado) {
      return NextResponse.json(
        { error: insErr?.message || "Não foi possível reenfileirar" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { disparo: criado, reenviando: falhas.length },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
