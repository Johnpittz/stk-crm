/**
 * Fase 1+2 — GET /api/dashboard/tempo-resposta: card "Tempo de Resposta"
 * + rankings por VENDEDOR e por TIME do Dashboard.
 *
 * Regra (João, 06/10): 1ª resposta do vendedor ao cliente, contada só em
 * horário comercial (seg–sex 08:00–18:00, Brasília) — ver
 * lib/dashboard/tempo-resposta.ts. Times de teste: STK-1=Lobo,
 * STK-3=Águia (lib/dashboard/equipes). Query: ?dias=7|30|90 (padrão 30).
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  primeiraResposta,
  resumoTempoResposta,
  type MensagemRef,
} from "@/lib/dashboard/tempo-resposta";
import {
  rankingVendedores,
  resumoPorTime,
  type RespostaMedida,
} from "@/lib/dashboard/rankings";

export const dynamic = "force-dynamic";

const PADRAO_DIAS = 30;
const LIMITE_ATENDIMENTOS = 500;
const LIMITE_MENSAGENS = 20000;

function lerDias(url: string): number {
  const bruto = Number(new URL(url).searchParams.get("dias"));
  if (!Number.isFinite(bruto) || bruto <= 0) return PADRAO_DIAS;
  return Math.min(Math.round(bruto), 365);
}

export async function GET(request: NextRequest) {
  try {
    const dias = lerDias(request.url);
    const supabase = createAdminClient();
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

    const { data: atendimentos, error: erroAt } = await supabase
      .from("atendimentos")
      .select("id, created_at, instancia")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(LIMITE_ATENDIMENTOS);
    if (erroAt) throw erroAt;

    const ids = (atendimentos ?? []).map((a) => a.id);
    const instanciaPorAtendimento = new Map<string, string | null>();
    for (const a of atendimentos ?? []) {
      instanciaPorAtendimento.set(a.id, a.instancia ?? null);
    }

    let mensagens: (MensagemRef & { atendimento_id: string })[] = [];
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

    const respostas: RespostaMedida[] = [];
    porAtendimento.forEach((lista, atendimentoId) => {
      const r = primeiraResposta(lista);
      if (r) {
        respostas.push({ ...r, instancia: instanciaPorAtendimento.get(atendimentoId) ?? null });
      }
    });

    // nomes de quem respondeu (ranking por vendedor)
    const { data: profiles, error: erroProfiles } = await supabase
      .from("profiles")
      .select("id, nome_completo")
      .limit(500);
    if (erroProfiles) throw erroProfiles;
    const nomes: Record<string, string> = {};
    for (const p of profiles ?? []) nomes[p.id] = p.nome_completo || p.id;

    const resumo = resumoTempoResposta(respostas, new Date().toISOString());
    return NextResponse.json({
      ...resumo,
      porVendedor: rankingVendedores(respostas, nomes),
      porTime: resumoPorTime(respostas),
      janela: "seg–sex, 08:00–18:00 (Brasília)",
      periodo_dias: dias,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 },
    );
  }
}
