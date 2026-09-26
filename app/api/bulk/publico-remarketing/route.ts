/**
 * GET /api/bulk/publico-remarketing
 *
 * Fase 2 / M1.2 — PREVIEW do público de remarketing antes de criar o disparo.
 * Usa a MESMA regra que o worker vai rodar (lib/marketing/remarketing.ts);
 * nada de lógica duplicada: se a régua mudar, muda aqui e lá ao mesmo tempo.
 *
 * Regra (D1): status aberto/em_andamento, NÓS falamos por último e o cliente
 * não respondeu há 24h. Depois tiramos quem está em opt-out e quem já recebeu
 * remarketing nos últimos `nao_rematar_dias` (7) — igualzinho ao robô.
 *
 * Query: ?limite=200 (máx. 500) — corte de segurança contra número banido.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aplicarFiltroPublicoRemarketing, normalizarTelefone } from "@/lib/marketing/remarketing";

export const dynamic = "force-dynamic";

const LIMITE_PADRAO = 200;
const LIMITE_MAXIMO = 500;
const NAO_REMATAR_DIAS = 7;

/** Sem 55 inicial: '(62) 91111-1111' e '5562911111111' são o mesmo número. */
function canonico(telefone: unknown): string {
  const d = normalizarTelefone(telefone);
  return d.length > 12 && d.startsWith("55") ? d.slice(2) : d;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const limite = Math.min(
      Math.max(parseInt(request.nextUrl.searchParams.get("limite") || "", 10) || LIMITE_PADRAO, 1),
      LIMITE_MAXIMO
    );
    const agora = new Date();
    const corteRecencia = new Date(agora.getTime() - NAO_REMATAR_DIAS * 86_400_000);

    // 1) público — regra única, encadeada no builder compartilhado
    let query = supabase
      .from("atendimentos")
      .select("telefone_cliente, nome_cliente, ultima_mensagem_data, instancia")
      .order("ultima_mensagem_data", { ascending: true })
      .limit(limite * 3); // peneira extra: alguns caem em opt-out/recência
    query = aplicarFiltroPublicoRemarketing(query, agora);
    const { data: publico, error: erroPublico } = await query;
    if (erroPublico) {
      return NextResponse.json({ error: erroPublico.message }, { status: 500 });
    }

    // 2) opt-out (inegociável)
    const { data: optOuts } = await supabase.from("remarketing_opt_out").select("telefone");
    const bloqueados = new Set((optOuts ?? []).map((o) => canonico(o.telefone)));

    // 3) quem já recebeu remarketing na janela de recência
    const { data: recentes } = await supabase
      .from("bulk_campaigns")
      .select("numbers")
      .eq("tipo", "remarketing")
      .gte("created_at", corteRecencia.toISOString())
      .limit(100);
    const jaRecebidos = new Set<string>();
    for (const campanha of recentes ?? []) {
      for (const n of (campanha.numbers ?? []) as any[]) {
        const tel = canonico(typeof n === "string" ? n : n?.telefone);
        if (tel) jaRecebidos.add(tel);
      }
    }

    // 4) peneira final (dedup por telefone incluído)
    const vistos = new Set<string>();
    const contatos: { nome: string; telefone: string; ultima_mensagem_data: string | null }[] = [];
    let cortesOptOut = 0;
    let cortesRecencia = 0;

    for (const a of publico ?? []) {
      const tel = canonico(a.telefone_cliente);
      if (!tel || vistos.has(tel)) continue;
      if (bloqueados.has(tel)) {
        cortesOptOut++;
        continue;
      }
      if (jaRecebidos.has(tel)) {
        cortesRecencia++;
        continue;
      }
      vistos.add(tel);
      contatos.push({
        nome: a.nome_cliente || "",
        telefone: a.telefone_cliente,
        ultima_mensagem_data: a.ultima_mensagem_data,
      });
    }

    const total = contatos.length;
    const recortados = contatos.slice(0, limite);

    return NextResponse.json({
      total,
      contatos: recortados,
      limitado: total > recortados.length,
      limite,
      cortes: { opt_out: cortesOptOut, recencia: cortesRecencia },
      janela_horas: 24,
      nao_rematar_dias: NAO_REMATAR_DIAS,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
