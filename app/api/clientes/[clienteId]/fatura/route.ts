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
  montarCadastroUnificado,
  resumoCardFatura,
} from "@/lib/clientes/fatura-conta";
import { diaDeHoje, linhaDoDiaParaRegravar } from "@/lib/clientes/analise-conta";
import { guardarArquivoFatura } from "@/lib/clientes/arquivo-fatura";
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

  // 19/10 — a listagem vem da view unificada: muitos clientes SÓ existem
  // lá. Sem linha em `clientes`, o banco recusa o card do funil (FK) e o
  // quadro ficava zerado. Mesmo padrão do PUT da edição: cria a linha com
  // o MESMO id antes de seguir.
  {
    const { data: cadastro } = await admin
      .from("clientes")
      .select("id")
      .eq("id", clienteId)
      .maybeSingle();
    if (!cadastro) {
      const { data: view } = await admin
        .from("v_unified_clientes")
        .select("nome")
        .eq("id", clienteId)
        .maybeSingle();
      const payload = montarCadastroUnificado(
        clienteId,
        (view ?? null) as { nome?: string | null } | null
      );
      if (payload) await admin.from("clientes").insert(payload);
    }
  }

  // 19/10 — guarda o ARQUIVO enviado (o PDF em si, não só os números): é
  // o que permite "Reanalisar" reler a conta já inserida sem pedir de novo
  const guardado = await guardarArquivoFatura(admin, clienteId, arquivo);
  const dadosLinha: Record<string, unknown> = {
    ...linha.dados,
    ...(guardado
      ? {
          arquivo: guardado,
          arquivo_nome: arquivo.name,
          arquivo_mime: arquivo.type || "",
        }
      : {}),
  };

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
      .update({ dados: { ...dadosLinha, dia: hoje } })
      .eq("id", doDia.id)
      .select("id")
      .single();
    data = atualizada ?? null;
    error = errUpd ?? null;
    regravada = !errUpd;
  } else {
    const { data: criada, error: errIns } = await admin
      .from("cliente_pasta_linhas")
      .insert({ cliente_id: clienteId, linha: linha.linha, dados: dadosLinha })
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
  let cardErro: string | null = null;
  try {
    const { data: cards } = await admin
      .from("oportunidades")
      .select("id, etapa, titulo")
      .eq("cliente_id", clienteId);
    if (deveCriarCardFatura((cards ?? []) as { etapa?: string | null }[])) {
      const { data: cli } = await admin
        .from("clientes")
        .select("nome_razao_social, vendedor_responsavel_id")
        .eq("id", clienteId)
        .single();
      const nomeCli =
        String(cli?.nome_razao_social ?? "").trim() || "Cliente sem nome";
      // 19/10 — o banco exige um vendedor que EXISTA em `profiles` (FK).
      // Um vendedor sem cadastro lá derrubava o card em silêncio: tenta o
      // usuário logado e, se recusar, o vendedor responsável do cliente.
      const candidatos = [user.id, cli?.vendedor_responsavel_id].filter(
        (v): v is string => !!v
      );
      for (const vendedor of candidatos) {
        const { data: novo, error: errCard } = await admin
          .from("oportunidades")
          .insert({
            cliente_id: clienteId,
            cliente_nome: nomeCli,
            // 19/10 (pedido do João): card como NOVA TAREFA automática —
            // rótulo do estado + o que o PDF já deu na descrição.
            titulo: "Fatura Recebida",
            descricao: resumoCardFatura({
              competencia: (linha.dados.competencia ?? null) as string | null,
              situacao: (linha.dados.situacao ?? null) as string | null,
              valor: (linha.dados.valor ?? null) as number | null,
              consumo: (linha.dados.consumo_kwh ?? null) as number | null,
            }),
            consumo_kwh: (linha.dados.consumo_kwh ?? null) as number | null,
            valor_venda: (linha.dados.valor ?? null) as number | null,
            etapa: "recebeu_conta",
            vendedor_id: vendedor,
          })
          .select("id")
          .single();
        if (!errCard && novo) {
          cardCriado = true;
          cardId = novo.id;
          cardErro = null;
          break;
        }
        // 19/10 — o card faltou em silêncio num teste real: registrar
        cardErro = errCard?.message ?? "erro desconhecido";
      }
    }
  } catch (e) {
    cardErro = String((e as Error)?.message ?? e).slice(0, 120);
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
    card_erro: cardErro,
    aviso: valor == null
      ? "Fatura recebida — a IA completa na análise."
      : null,
  });
}
