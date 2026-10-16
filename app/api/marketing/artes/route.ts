/**
 * PEDIDO 3 (11/10) — /api/marketing/artes: galeria + geração de artes.
 *
 *   GET    → lista as artes (mais nova primeiro)
 *   POST   → monta o "grande prompt" (lib/marketing/gerar-prompt),
 *            gera a imagem no Gemini/Nano Banana (lib/marketing/
 *            gemini-imagem — receita do AUTOIMAGEM), sobe no bucket
 *            "media" e grava a linha em `artes`;
 *   DELETE → apaga a própria arte (admin apaga qualquer uma).
 *
 * A GEMINI_API_KEY vive só no ambiente da Vercel (nunca no repo).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  montarPromptArte,
  montarPartesImagem,
  FORMATOS_ARTE,
  type ReferenciaImagem,
} from "@/lib/marketing/gerar-prompt";
import { gerarImagemGemini } from "@/lib/marketing/gemini-imagem";
import { montarTextoImagem } from "@/lib/marketing/textos-imagem";
import { uploadMediaToStorage } from "@/lib/media-storage";

export const dynamic = "force-dynamic";

type LinhaRef = { marker: string; imagem_url: string };

/**
 * MELHORIA 12/10 — baixa as referências (bucket público) em base64.
 * Falha em uma delas não derruba a geração: ela é simplesmente pulada.
 */
async function baixarReferencias(linhas: LinhaRef[]): Promise<ReferenciaImagem[]> {
  const saida: ReferenciaImagem[] = [];
  for (const linha of linhas) {
    try {
      if (!linha?.imagem_url || !linha.marker) continue;
      const resp = await fetch(linha.imagem_url, { signal: AbortSignal.timeout(8_000) });
      if (!resp.ok) continue;
      const buffer = Buffer.from(await resp.arrayBuffer());
      if (buffer.length === 0 || buffer.length > 3_000_000) continue;
      saida.push({
        marker: linha.marker,
        data: buffer.toString("base64"),
        mimeType: (resp.headers.get("content-type") || "image/png").split(";")[0],
      });
    } catch (err: any) {
      console.warn("[Artes] referência não baixada:", linha.marker, err?.message);
    }
  }
  return saida;
}
/** Geração de imagem costuma levar 10–30s — teto da função na Vercel. */
export const maxDuration = 60;

async function usuarioLogado() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function GET(_request: NextRequest) {
  try {
    const user = await usuarioLogado();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data, error } = await createAdminClient()
      .from("artes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    return NextResponse.json({ artes: data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await usuarioLogado();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
    }

    const formato = String(body?.formato ?? "");
    const assunto = String(body?.assunto ?? "").trim();
    const texto = String(body?.texto ?? "").trim();
    if (!FORMATOS_ARTE[formato]) {
      return NextResponse.json({ error: "Formato fora do catálogo" }, { status: 400 });
    }
    if (!assunto || !texto) {
      return NextResponse.json({ error: "Assunto e texto são obrigatórios" }, { status: 400 });
    }

    const apiKey = (process.env.GEMINI_API_KEY ?? "").trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY ausente — cadastre a chave no ambiente da Vercel." },
        { status: 503 },
      );
    }

    // ITEM 3 — textos extras (número/opções do cadastro) + posição
    const numeroExtra = typeof body?.numero === "string" ? body.numero.trim() : "";
    const opcoesExtra = Array.isArray(body?.opcoes)
      ? body.opcoes.map((o: unknown) => String(o ?? "").trim()).filter(Boolean).slice(0, 8)
      : [];
    const posicaoExtra = String(body?.posicao ?? "");
    const textoImagem = montarTextoImagem(numeroExtra, opcoesExtra, posicaoExtra);

    const prompt = montarPromptArte({
      formato,
      assunto,
      texto,
      estilo: body?.estilo ?? null,
      observacoes: body?.observacoes ?? null,
      textoImagem,
    });

    // 0) MELHORIA 12/10 — referências ativas (logo/foto) entram no
    // Gemini posicionadas pelo marker {{nome}} ou na frente do texto.
    const { data: refs } = await createAdminClient()
      .from("artes_referencias")
      .select("marker, imagem_url")
      .eq("ativo", true)
      .limit(8);
    const referencias = await baixarReferencias((refs ?? []) as LinhaRef[]);
    const partes = montarPartesImagem(prompt, referencias);

    // 1) Gemini gera a imagem (Nano Banana)
    let imagem;
    try {
      imagem = await gerarImagemGemini({
        apiKey,
        prompt,
        partes,
        aspectRatio: FORMATOS_ARTE[formato]?.aspectRatio,
        model: process.env.GEMINI_IMAGE_MODEL,
      });
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || "Falha ao gerar a imagem" }, { status: 502 });
    }

    // 2) sobe para o bucket "media" (mesmo das mídias do atendimento)
    const imagemUrl = await uploadMediaToStorage(imagem.data, imagem.mimeType, "artes", "arte.png");
    if (!imagemUrl) {
      return NextResponse.json({ error: "Falha ao salvar a imagem no storage" }, { status: 502 });
    }

    // 3) grava na galeria
    const { data: arte, error } = await createAdminClient()
      .from("artes")
      .insert({
        titulo: assunto,
        prompt,
        formato,
        status: "pronta",
        imagem_url: imagemUrl,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ arte }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await usuarioLogado();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

    const client = createAdminClient();
    const { data: meuPerfil } = await client
      .from("profiles")
      .select("cargo")
      .eq("id", user.id)
      .maybeSingle();
    const ehAdmin = ["admin", "diretor"].includes(meuPerfil?.cargo || "");

    // confere que a arte é dele (ou que ele é admin) antes de apagar
    let existe = client.from("artes").select("id").eq("id", id);
    if (!ehAdmin) existe = existe.eq("created_by", user.id);
    const { data: alvo } = await existe.maybeSingle();
    if (!alvo) return NextResponse.json({ error: "Arte não encontrada" }, { status: 404 });

    const { error } = await client.from("artes").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}
