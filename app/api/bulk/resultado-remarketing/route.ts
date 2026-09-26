/**
 * GET /api/bulk/resultado-remarketing — M1.6, taxa de resposta pós-remarketing.
 *
 * Pergunta de negócio: de quem a gente mandou mensagem de remarketing,
 * quantos CLIENTES voltaram a falar depois? (disparo_logs/campanha x
 * ultima_mensagem_remetente='cliente' com data >= criação da campanha)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calcularTaxaResposta } from "@/lib/marketing/remarketing";

export const dynamic = "force-dynamic";

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

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    }

    const { data: campanha, error: erroCampanha } = await supabase
      .from("bulk_campaigns")
      .select("id, name, tipo, numbers, created_at, sent, failed, status")
      .eq("id", id)
      .maybeSingle();
    if (erroCampanha) {
      return NextResponse.json({ error: erroCampanha.message }, { status: 500 });
    }
    if (!campanha) {
      return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
    }
    if (campanha.tipo !== "remarketing") {
      return NextResponse.json(
        { error: "Métrica disponível só para campanhas de remarketing" },
        { status: 400 }
      );
    }

    const telefones = ((campanha.numbers ?? []) as any[])
      .map((n) => (typeof n === "string" ? n : n?.telefone))
      .filter((t) => typeof t === "string" && t.length >= 8);

    let respostas = 0;
    if (telefones.length) {
      const { count, error: erroRespostas } = await supabase
        .from("atendimentos")
        .select("id", { count: "exact", head: true })
        .in("telefone_cliente", telefones)
        .eq("ultima_mensagem_remetente", "cliente")
        .gte("ultima_mensagem_data", campanha.created_at);
      if (erroRespostas) {
        return NextResponse.json({ error: erroRespostas.message }, { status: 500 });
      }
      respostas = count ?? 0;
    }

    const enviados = Number(campanha.sent) || 0;

    return NextResponse.json({
      campanha_id: campanha.id,
      name: campanha.name,
      enviados,
      falhas: Number(campanha.failed) || 0,
      respostas,
      taxa: calcularTaxaResposta(enviados, respostas),
      desde: campanha.created_at,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
