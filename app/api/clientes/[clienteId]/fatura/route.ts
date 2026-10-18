/**
 * PARTE 11 (PPTX 17/10) — POST /api/clientes/[clienteId]/fatura
 * A fatura anexada no cadastro/edição cai DIRETO em Gestão de Fatura
 * (linha em cliente_pasta_linhas). PDF: extrai valor/consumo do texto;
 * foto: entra como Pendente e a "Análise da conta" completa depois.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  competenciaAtual,
  deveCriarCardFatura,
  extrairDadosConta,
  montarLinhaGestaoFatura,
} from "@/lib/clientes/fatura-conta";
import { diaDeHoje, linhaDoDiaParaRegravar } from "@/lib/clientes/analise-conta";
import { extrairTextoPdf } from "@/lib/ia/pdf-texto";

export const runtime = "nodejs";
export const maxDuration = 30;

function usuarioLogado(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer", "").trim();
  if (!token) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: ["Bearer", token].join(" ") } } }
  );
  return supabase.auth.getUser(token).then(({ data }) => data.user || null);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { clienteId: string } }
) {
  const user = await usuarioLogado(request);
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { clienteId } = params;
  const fd = await request.formData().catch(() => null);
  const arquivo = fd?.get("arquivo") as File | null;
  if (!arquivo) {
    return NextResponse.json({ error: "Arquivo (arquivo) é obrigatório" }, { status: 400 });
  }

  const mime = arquivo.type || "";
  const nome = arquivo.name || "conta";
  const buffer = Buffer.from(await arquivo.arrayBuffer());

  let valor: number | null = null;
  let consumo: number | null = null;
  if (mime === "application/pdf" || nome.toLowerCase().endsWith(".pdf")) {
    const texto = (await extrairTextoPdf(buffer)) || "";
    const dados = extrairDadosConta(texto);
    valor = dados.valor;
    consumo = dados.consumo;
  }

  const linha = montarLinhaGestaoFatura({
    competencia: competenciaAtual(),
    valor,
    consumo,
  });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 18/10 — FLUXO ÚNICO: uma conta por dia. Subir o mesmo PDF de novo
  // atualiza a linha do dia em vez de criar um segundo card na coluna
  // "Fatura Recebida" (a coluna só esvazia quando a IA analisa).
  const hoje = diaDeHoje();
  const { data: linhasExistentes } = await admin
    .from("cliente_pasta_linhas")
    .select("id, dados")
    .eq("cliente_id", clienteId)
    .eq("linha", "gestao_fatura")
    .order("created_at", { ascending: true });
  const doDia = linhaDoDiaParaRegravar(
    (linhasExistentes ?? []) as { id: string; dados?: Record<string, unknown> | null }[],
    hoje
  );

  let data: { id: string } | null = null;
  let error: { message?: string } | null = null;
  let regravada = false;

  if (doDia) {
    const { data: atualizada, error: errUpd } = await admin
      .from("cliente_pasta_linhas")
      // completa o dia, mas não apaga o que a análise já leu
      .update({ dados: { ...linha.dados, dia: hoje } })
      .eq("id", doDia.id)
      .select("id")
      .single();
    data = atualizada ?? null;
    error = errUpd ?? null;
    regravada = !errUpd;
  } else {
    const { data: criada, error: errIns } = await admin
      .from("cliente_pasta_linhas")
      .insert({ cliente_id: clienteId, linha: linha.linha, dados: linha.dados })
      .select("id")
      .single();
    data = criada ?? null;
    error = errIns ?? null;
  }

  if (error || !data) {
    return NextResponse.json(
      { error: `Falha ao gravar a fatura: ${error?.message || "erro desconhecido"}` },
      { status: 500 }
    );
  }

  // 18/10 (pedido do João): fatura inserida → CARD AUTOMÁTICO no kanban
  // na coluna RECEBEU A CONTA. Idempotente: só cria se o cliente ainda
  // não tem card lá (não duplica ao subir faturas do mesmo mês).
  let cardCriado = false;
  let cardId: string | null = null;
  try {
    const { data: cards } = await admin
      .from("oportunidades")
      .select("id, etapa")
      .eq("cliente_id", clienteId);
    if (deveCriarCardFatura((cards ?? []) as { etapa?: string | null }[])) {
      const { data: cli } = await admin
        .from("clientes")
        .select("nome_razao_social")
        .eq("id", clienteId)
        .single();
      const nomeCli =
        String(cli?.nome_razao_social ?? "").trim() || "Cliente sem nome";
      const { data: novo, error: errCard } = await admin
        .from("oportunidades")
        .insert({
          cliente_id: clienteId,
          cliente_nome: nomeCli,
          titulo: nomeCli,
          descricao: `Fatura de energia recebida — competência ${linha.dados.competencia}.`,
          etapa: "recebeu_conta",
          vendedor_id: user.id,
        })
        .select("id")
        .single();
      if (!errCard && novo) {
        cardCriado = true;
        cardId = novo.id;
      }
    }
  } catch {
    /* card é conforto: a fatura já está gravada */
  }

  return NextResponse.json({
    linha_id: data.id,
    competencia: linha.dados.competencia,
    dia: hoje,
    regravada,
    valor,
    consumo,
    cardCriado,
    card_id: cardId,
    aviso: valor == null
      ? "Fatura recebida — a IA completa na análise."
      : null,
  });
}
