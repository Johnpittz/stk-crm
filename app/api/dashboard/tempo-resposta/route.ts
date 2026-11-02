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
import { createClient } from "@/lib/supabase/server";
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
import { dimensaoProdutos } from "@/lib/dashboard/produtos-dim";

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
    // Fase 4 — o filtro de perfil acontece AQUI, no servidor:
    // admin/diretor/gerente = visão completa; vendedor = só o dele.
    // (Equipes reais ainda não existem — quando existirem, o gerente
    // filtra pelo(s) seu(s) time(s); ver docs/plano-dashboard-fases.md.)
    const usuarioClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await usuarioClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    // (cargo/visaoAmpla vêm do Promise.all abaixo — 02/11 otimização)

    const dias = lerDias(request.url);
    const supabase = createAdminClient();
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

    // 02/11 (varredura de lentidão): a rota fazia7 chamadas de rede
    // SEQUENCIAIS (~200ms cada = o F5 de ~1,8s). As independentes sobem
    // para UMA roundtrip via Promise.all — regra de negócio intocada.
    const [perfilR, nomesR, produtosR] = await Promise.all([
      usuarioClient
        .from("profiles")
        .select("cargo")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("profiles").select("id, nome_completo, email").limit(500),
      supabase.from("produtos").select("id, nome").limit(200),
    ]);
    const cargo = perfilR.data?.cargo || "";
    const visaoAmpla = ["admin", "diretor", "gerente_comercial"].includes(cargo);
    if (nomesR.error) throw nomesR.error;
    if (produtosR.error) throw produtosR.error;

    let queryAtendimentos = supabase
      .from("atendimentos")
      .select("id, created_at, instancia, vendedor_id")
      .gte("created_at", desde);
    if (!visaoAmpla) queryAtendimentos = queryAtendimentos.eq("vendedor_id", user.id);

    // Fase 3 — dimensão PRODUTO (independente das mensagens: mesmo passo)
    let queryOpps = supabase
      .from("oportunidades")
      .select("atendimento_id, produto_id, resultado, valor_venda, vendedor_id");
    if (!visaoAmpla) queryOpps = queryOpps.eq("vendedor_id", user.id);

    const [{ data: atendimentos, error: erroAt }, { data: oportunidades, error: erroOpps }] =
      await Promise.all([
        queryAtendimentos.order("created_at", { ascending: false }).limit(LIMITE_ATENDIMENTOS),
        queryOpps.limit(300),
      ]);
    if (erroAt) throw erroAt;
    if (erroOpps) throw erroOpps;

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

    const respostas: (RespostaMedida & { atendimento_id: string })[] = [];
    porAtendimento.forEach((lista, atendimentoId) => {
      const r = primeiraResposta(lista);
      if (r) {
        respostas.push({
          ...r,
          atendimento_id: atendimentoId,
          instancia: instanciaPorAtendimento.get(atendimentoId) ?? null,
        });
      }
    });

    // nomes de quem respondeu (ranking por vendedor) — já vieram em nomesR
    const nomes: Record<string, string> = {};
    for (const p of nomesR.data ?? []) {
      nomes[p.id] =
        p.nome_completo || (p.email ? String(p.email).split("@")[0] : "") || "Conta sem cadastro";
    }
    const produtos = produtosR.data;

    const resumo = resumoTempoResposta(respostas, new Date().toISOString());
    return NextResponse.json({
      ...resumo,
      perfil: cargo || "vendedor",
      porVendedor: rankingVendedores(respostas, nomes),
      porTime: resumoPorTime(respostas),
      porProduto: dimensaoProdutos({
        respostas,
        oportunidades: oportunidades ?? [],
        produtos: produtos ?? [],
      }),
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
