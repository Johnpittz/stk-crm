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
  extrairDadosConta,
  montarLinhaGestaoFatura,
} from "@/lib/clientes/fatura-conta";
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

  const { data, error } = await admin
    .from("cliente_pasta_linhas")
    .insert({ cliente_id: clienteId, linha: linha.linha, dados: linha.dados })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Falha ao gravar a fatura: ${error?.message || "erro desconhecido"}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    linha_id: data.id,
    competencia: linha.dados.competencia,
    valor,
    consumo,
    aviso: valor == null
      ? "Fatura registrada sem valor — clique em 'Análise da conta' para a IA completar."
      : null,
  });
}
