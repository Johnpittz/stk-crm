/**
 * PARTE 11 (PPTX 17/10) — POST /api/clientes/[clienteId]/analise-conta
 * "Análise da conta": a IA lê a foto/PDF da fatura e extrai os dados.
 * Salva na pasta do cliente o que casar com colunas (concessionária,
 * UC/instalação, vencimento) e devolve o resumo pra tela.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analisarFatura, analisarFaturaTexto, diagFatura } from "@/lib/ia/analisar-fatura";
import { competenciaAtual, marcarComoAnalisada, paraNumero, cardsFunilFaltando, montarCadastroUnificado } from "@/lib/clientes/fatura-conta";
import { diaDeHoje, linhaDoDiaParaRegravar } from "@/lib/clientes/analise-conta";
import { baixarArquivoFatura } from "@/lib/clientes/arquivo-fatura";
import {
  deveCriarLinhaIA,
  linhaDaOportunidade,
  montarDadosLinhaIA,
} from "@/lib/clientes/ponte-ia";
import { aplicarRegras, calcularMediaFinanceira } from "@/lib/ia/regras-produtos";
import { numeroBR } from "@/lib/ia/analisar-fatura";

export const runtime = "nodejs";
export const maxDuration = 60;

function usuarioLogado(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
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
  let arquivo = fd?.get("arquivo") as File | null;
  const linhaId = (fd?.get("linha_id") as string | null) || null;

  // admin cedo: o REANALISAR busca a conta já inserida (linha_id) e o
  // arquivo que ficou guardado no passo 1 — sem pedir de novo
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 19/10 — a listagem vem da view unificada: muitos clientes SÓ existem
  // lá. Sem linha em `clientes`, o banco recusa o card do funil (FK) — o
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

  let linhaAlvo: { id: string; dados?: Record<string, unknown> | null } | null = null;
  if (!arquivo && linhaId) {
    // 19/10 — reanalisar a conta JÁ INSERIDA: reler o arquivo guardado
    const { data: linha } = await admin
      .from("cliente_pasta_linhas")
      .select("id, cliente_id, dados")
      .eq("id", linhaId)
      .single();
    if (!linha || linha.cliente_id !== clienteId) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }
    linhaAlvo = linha as { id: string; dados?: Record<string, unknown> | null };
    const caminho = (linha.dados as { arquivo?: unknown } | null)?.arquivo;
    if (typeof caminho !== "string" || !caminho) {
      return NextResponse.json(
        {
          error: "Esta conta não tem o arquivo guardado — escolha o PDF/foto de novo.",
          detalhe: "sem_arquivo_guardado",
        },
        { status: 422 }
      );
    }
    const baixado = await baixarArquivoFatura(admin, caminho);
    if (!baixado) {
      return NextResponse.json(
        {
          error: "Não consegui abrir o arquivo guardado — escolha o PDF/foto de novo.",
          detalhe: "sem_arquivo_guardado",
        },
        { status: 422 }
      );
    }
    const mimeGuardado =
      ((linha.dados as { arquivo_mime?: unknown } | null)?.arquivo_mime as string) || "";
    arquivo = new File([new Uint8Array(baixado.bytes)], baixado.nome, {
      type: mimeGuardado,
    });
  }
  if (!arquivo) {
    return NextResponse.json(
      { error: "Envie o arquivo (arquivo) ou informe a conta já inserida (linha_id)" },
      { status: 400 }
    );
  }

  const mime = arquivo.type || "";
  const ehPdf = mime === "application/pdf" || arquivo.name.toLowerCase().endsWith(".pdf");
  const buffer = Buffer.from(await arquivo.arrayBuffer());

  let resumo;
  let detalhe: string | null = null;
  if (mime.startsWith("image/")) {
    resumo = await analisarFatura({ mimeTipo: mime, base64: buffer.toString("base64") });
  } else if (ehPdf) {
    try {
      const { extrairTextoPdf } = await import("@/lib/ia/pdf-texto");
      const texto = (await extrairTextoPdf(buffer)) || "";
      if (!texto.trim()) {
        return NextResponse.json(
          {
            error: "Este PDF não tem texto legível. Envie uma foto/print da conta.",
            detalhe: "pdf_sem_texto",
          },
          { status: 422 }
        );
      } else {
        resumo = await analisarFaturaTexto(texto);
        // sem setar detalhe aqui: o diagFatura.erro da própria IA explica
        // o 422 (resposta sem JSON ou mensagem do provedor).
      }
    } catch (erro) {
      console.error("[analise-conta] PDF:", (erro as Error)?.message ?? erro);
      detalhe = "pdf_ilegivel";
    }
  } else {
    return NextResponse.json(
      { error: "Envie uma imagem (jpg/png/heic) ou PDF da conta" },
      { status: 415 }
    );
  }

  if (!resumo || (!resumo.concessionaria && !resumo.uc && !resumo.valor)) {
    return NextResponse.json(
      {
        // PDF não tem "nitidez": a foto é só um dos caminhos possíveis
        error: ehPdf
          ? "Não consegui ler os dados deste PDF. Reenvie o arquivo ou envie uma foto/print da conta."
          : "Não consegui ler os dados da conta. Tente uma foto mais nítida.",
        detalhe: detalhe ?? (diagFatura.erro ? `ia: ${diagFatura.erro}` : "ia_vazia"),
      },
      { status: 422 }
    );
  }

  // Salva o que casar com colunas reais (só preenche o que a IA achou)
  const update: Record<string, string> = {};
  if (resumo.concessionaria) update.concessionaria = resumo.concessionaria;
  if (resumo.uc) update.instalacao = resumo.uc;
  if (resumo.vencimento) update.vencimento_fatura = resumo.vencimento;

  let salvo = false;
  if (Object.keys(update).length) {
    const { error } = await admin.from("clientes").update(update).eq("id", clienteId);
    salvo = !error;
  }

  // 18/10 — FLUXO ÚNICO (pedido do João): o kanban de faturas mostra a
  // conta como RECEBIDA quando o vendedor escolhe o arquivo e vira
  // ANALISADA aqui, quando a IA termina de ler. A linha da Gestão de
  // Fatura é a MESMA do kanban (uma linha só, dois status).
  let faturaCompletada = false;
  const hoje = diaDeHoje();
  {
    const { data: linhas } = await admin
      .from("cliente_pasta_linhas")
      .select("id, dados")
      .eq("cliente_id", clienteId)
      .eq("linha", "gestao_fatura")
      .order("created_at", { ascending: false });
    // 18/10 — a linha que interessa é a DO DIA. Selecionar por
    // competência do mês pegava a conta do dia 3 no dia 18: o card
    // antigo virava "Analisada" e a conta de hoje ficava presa em
    // "Recebida". Linha antiga fica no histórico, intocada.
    // linhaId (reanalisar pelo card) manda na linha clicada; sem ele,
    // vale a linha do dia
    const alvo =
      linhaAlvo ??
      (linhaDoDiaParaRegravar(
        ((linhas ?? []) as { id: string; dados?: Record<string, unknown> | null }[]),
        hoje
      ) ?? null);
    if (alvo) {
      const dados = marcarComoAnalisada(alvo.dados ?? {}, resumo);
      const { error: errLin } = await admin
        .from("cliente_pasta_linhas")
        .update({ dados })
        .eq("id", alvo.id);
      faturaCompletada = !errLin;
    } else {
      // nada no kanban ainda (análise direta, sem passar pelo "recebido")
      // — cria a linha já marcada como analisada.
      const dados = marcarComoAnalisada(
        {
          competencia: competenciaAtual(),
          dia: hoje,
          valor: null,
          consumo_kwh: null,
          situacao: "Pendente",
        },
        resumo
      );
      const { error: errNova } = await admin
        .from("cliente_pasta_linhas")
        .insert({ cliente_id: clienteId, linha: "gestao_fatura", dados });
      faturaCompletada = !errNova;
    }
  }

  // FASE A (17/10) — regras comerciais do protocolo: a análise vira
  // TELA DE OPORTUNIDADES. Média do RECIEE sai das faturas já
  // cadastradas (menos de 3 = null → preliminar, nunca descarte).
  let oportunidades: ReturnType<typeof aplicarRegras> = [];
  try {
    const { data: linhasFatura } = await admin
      .from("cliente_pasta_linhas")
      .select("linha, dados")
      .eq("cliente_id", clienteId)
      .eq("linha", "gestao_fatura");
    const valores = (linhasFatura ?? []).map(
      (l: { dados: Record<string, unknown> | null }) => {
        const v = Number(l.dados?.valor);
        return Number.isFinite(v) && v > 0 ? v : null;
      }
    );
    oportunidades = aplicarRegras({
      grupo: resumo.grupo,
      contratacao_livre: resumo.contratacao_livre,
      valor_medio_mensal: calcularMediaFinanceira(valores),
      // 19/10 — protocolo: Grupo B não tem medição de ponta; o total do
      // mês NUNCA aciona o BESS (só Grupo A mede ponta).
      consumo_ponta: resumo.grupo === "A" ? resumo.consumo_ponta : null,
      consumo_total: numeroBR(resumo.consumo),
      cnae_principal: resumo.cnae_principal,
      energia_injetada: resumo.energia_injetada,
      uc_geradora: resumo.uc_geradora,
      uc_consumidora: resumo.uc_consumidora,
    });
  } catch {
    oportunidades = [];
  }

  // FASE C (17/10) — ponte: produtos identificados viram linha na aba
  // do cliente com origem "IA". Nunca duplica (se já existe linha do
  // produto, manual ou IA, não cria outra) e só passa Identificada/
  // Preliminar — nunca cria linha automática dos outros status.
  const abasCriadas: string[] = [];
  try {
    const { data: linhasAtuais } = await admin
      .from("cliente_pasta_linhas")
      .select("linha, dados")
      .eq("cliente_id", clienteId);
    const existentes = (linhasAtuais ?? []).map((l: { linha: string; dados: any }) => ({
      linha: String(l.linha),
      dados: (l.dados ?? {}) as Record<string, unknown>,
    }));
    for (const o of oportunidades) {
      if (!deveCriarLinhaIA(o, existentes)) continue;
      const linha = linhaDaOportunidade(o);
      if (!linha) continue;
      const { error } = await admin.from("cliente_pasta_linhas").insert({
        cliente_id: clienteId,
        linha,
        dados: montarDadosLinhaIA(o),
      });
      if (!error) {
        abasCriadas.push(linha);
        existentes.push({ linha, dados: {} });
      }
    }
  } catch {
    /* conforto: a oportunidade já aparece na tela mesmo sem a linha */
  }

  // 19/10 (pedido do João) — DOIS cards no funil: a conta que CHEGOU
  // (recebeu_conta — garantido aqui mesmo que o passo 1 tenha falhado
  // em silêncio) e a conta que a IA ANALISOU (proposta_feita).
  // Idempotente: card que já existe não duplica; falha volta visível
  // em cardsFunil pra nunca mais sumir sem sinal.
  const cardsFunil: Record<string, string> = {};
  if (faturaCompletada) {
    try {
      const { data: cardsFunilBanco } = await admin
        .from("oportunidades")
        .select("id, etapa")
        .eq("cliente_id", clienteId);
      const faltando = cardsFunilFaltando(
        (cardsFunilBanco ?? []) as { etapa?: string | null }[]
      );
      if (faltando.length) {
        const { data: cliFunil } = await admin
          .from("clientes")
          .select("nome_razao_social, vendedor_responsavel_id")
          .eq("id", clienteId)
          .single();
        const nomeFunil =
          String(cliFunil?.nome_razao_social ?? "").trim() || "Cliente sem nome";
        const compFunil = competenciaAtual();
        const valorFunil = numeroBR(resumo.valor);
        const descricoes: Record<string, string> = {
          recebeu_conta: `${nomeFunil} — conta recebida, competência ${compFunil}.`,
          proposta_feita:
            `${nomeFunil} — analisada pela IA, competência ${compFunil}.` +
            (valorFunil ? ` Valor R$ ${valorFunil}.` : ""),
        };
        // 19/10 (pedido do João): cards como NOVA TAREFA automática —
        // um rótulo "Fatura Recebida" e outro "Fatura Analisada".
        const titulos: Record<string, string> = {
          recebeu_conta: "Fatura Recebida",
          proposta_feita: "Fatura Analisada",
        };
        // 19/10 — FK exige vendedor que exista em `profiles`: usuário sem
        // cadastro lá cai no vendedor responsável do cliente.
        const candidatos = [user.id, cliFunil?.vendedor_responsavel_id].filter(
          (v): v is string => !!v
        );
        for (const etapa of faltando) {
          let erroCard: string | null = "sem vendedor cadastrado";
          for (const vendedor of candidatos) {
            const { error } = await admin.from("oportunidades").insert({
              cliente_id: clienteId,
              cliente_nome: nomeFunil,
              titulo: titulos[etapa],
              descricao: descricoes[etapa],
              etapa,
              vendedor_id: vendedor,
            });
            if (!error) {
              erroCard = null;
              break;
            }
            erroCard = error.message;
          }
          cardsFunil[etapa] = erroCard ? `falhou: ${erroCard}` : "criado";
        }
      } else {
        cardsFunil.recebeu_conta = "ja_existia";
        cardsFunil.proposta_feita = "ja_existia";
      }
    } catch (e) {
      cardsFunil.erro = String((e as Error)?.message ?? e).slice(0, 120);
    }
  }

  return NextResponse.json({
    resumo,
    salvo,
    camposSalvos: Object.keys(update),
    faturaCompletada,
    oportunidades,
    abasCriadas,
    cardsFunil,
  });
}
