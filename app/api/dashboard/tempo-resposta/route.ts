/**
 * Fase 1 — GET /api/dashboard/tempo-resposta: alimenta o card
 * "Tempo de Resposta" do Dashboard.
 *
 * Regra (João, 06/10): 1ª resposta do vendedor ao cliente, contada só em
 * horário comercial (seg–sex 08:00–18:00, Brasília) — ver
 * lib/dashboard/tempo-resposta.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  primeiraResposta,
  resumoTempoResposta,
  type MensagemRef,
  type Resposta,
} from "@/lib/dashboard/tempo-resposta";

export const dynamic = "force-dynamic";

const PERIODO_DIAS = 30;
const LIMITE_ATENDIMENTOS = 500;
const LIMITE_MENSAGENS = 20000;

export async function GET(_request: NextRequest) {
  try {
    const supabase = createAdminClient();
    const desde = new Date(Date.now() - PERIODO_DIAS * 24 * 60 * 60 * 1000).toISOString();

    const { data: atendimentos, error: erroAt } = await supabase
      .from("atendimentos")
      .select("id, created_at")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(LIMITE_ATENDIMENTOS);
    if (erroAt) throw erroAt;

    const ids = (atendimentos ?? []).map((a) => a.id);
    let mensagens: MensagemRef[] & { atendimento_id: string }[] = [];
    if (ids.length > 0) {
      const { data, error: erroMsg } = await supabase
        .from("atendimento_mensagens")
        .select("atendimento_id, remetente, created_at, enviada_por")
        .in("atendimento_id", ids)
        .order("created_at", { ascending: true })
        .limit(LIMITE_MENSAGENS);
      if (erroMsg) throw erroMsg;
      mensagens = (data ?? []) as any;
    }

    const porAtendimento = new Map<string, any[]>();
    for (const m of mensagens) {
      const lista = porAtendimento.get(m.atendimento_id);
      if (lista) lista.push(m);
      else porAtendimento.set(m.atendimento_id, [m]);
    }

    const respostas: Resposta[] = [];
    porAtendimento.forEach((lista) => {
      const r = primeiraResposta(lista);
      if (r) respostas.push(r);
    });

    const resumo = resumoTempoResposta(respostas, new Date().toISOString());
    return NextResponse.json({
      ...resumo,
      janela: "seg–sex, 08:00–18:00 (Brasília)",
      periodo_dias: PERIODO_DIAS,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 },
    );
  }
}
