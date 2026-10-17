/**
 * PARTE 11 (PPTX 17/10) — POST /api/clientes/[clienteId]/analise-conta
 * "Análise da conta": a IA lê a foto/PDF da fatura e extrai os dados.
 * Salva na pasta do cliente o que casar com colunas (concessionária,
 * UC/instalação, vencimento) e devolve o resumo pra tela.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analisarFatura, analisarFaturaTexto } from "@/lib/ia/analisar-fatura";
import { paraNumero } from "@/lib/clientes/fatura-conta";

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
  const arquivo = fd?.get("arquivo") as File | null;
  if (!arquivo) {
    return NextResponse.json({ error: "Arquivo (arquivo) é obrigatório" }, { status: 400 });
  }

  const mime = arquivo.type || "";
  const buffer = Buffer.from(await arquivo.arrayBuffer());

  let resumo;
  if (mime.startsWith("image/")) {
    resumo = await analisarFatura({ mimeTipo: mime, base64: buffer.toString("base64") });
  } else if (mime === "application/pdf" || arquivo.name.toLowerCase().endsWith(".pdf")) {
    const { extrairTextoPdf } = await import("@/lib/ia/pdf-texto");
    const texto = (await extrairTextoPdf(buffer)) || "";
    resumo = await analisarFaturaTexto(texto);
  } else {
    return NextResponse.json(
      { error: "Envie uma imagem (jpg/png/heic) ou PDF da conta" },
      { status: 415 }
    );
  }

  if (!resumo.concessionaria && !resumo.uc && !resumo.valor) {
    return NextResponse.json(
      { error: "Não consegui ler os dados da conta. Tente uma foto mais nítida." },
      { status: 422 }
    );
  }

  // Salva o que casar com colunas reais (só preenche o que a IA achou)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const update: Record<string, string> = {};
  if (resumo.concessionaria) update.concessionaria = resumo.concessionaria;
  if (resumo.uc) update.instalacao = resumo.uc;
  if (resumo.vencimento) update.vencimento_fatura = resumo.vencimento;

  let salvo = false;
  if (Object.keys(update).length) {
    const { error } = await admin.from("clientes").update(update).eq("id", clienteId);
    salvo = !error;
  }

  // PARTE 11 — completa a linha da Gestão de Fatura do mês (se faltar)
  let faturaCompletada = false;
  if (resumo.valor || resumo.consumo) {
    const mes = new Date().toISOString().slice(0, 7);
    const { data: linhas } = await admin
      .from("cliente_pasta_linhas")
      .select("id, dados")
      .eq("cliente_id", clienteId)
      .eq("linha", "gestao_fatura")
      .order("created_at", { ascending: false });
    const alvo = (linhas || []).find(
      (l: any) => l.dados && l.dados.competencia === mes
    );
    if (alvo) {
      const dados = { ...alvo.dados };
      if (!dados.valor && resumo.valor) dados.valor = paraNumero(resumo.valor);
      if (!dados.consumo_kwh && resumo.consumo)
        dados.consumo_kwh = paraNumero(resumo.consumo);
      const { error: errLin } = await admin
        .from("cliente_pasta_linhas")
        .update({ dados })
        .eq("id", alvo.id);
      faturaCompletada = !errLin;
    }
  }

  return NextResponse.json({
    resumo,
    salvo,
    camposSalvos: Object.keys(update),
    faturaCompletada,
  });
}
