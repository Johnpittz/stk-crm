/**
 * MELHORIA 12/10 — imagens de REFERÊNCIA da tela de artes (logo da STK,
 * foto de produto, cenário): o admin sobe uma vez, cada imagem vira um
 * marker `{{nome_slug}}` citável no campo de observações e a geração
 * manda a imagem junto pro Gemini (receita do AUTOIMAGEM).
 *
 * GET    → lista (a tela mostra thumbs + botão "inserir marker")
 * POST   → sobe no bucket media/referencias e grava a linha
 * DELETE → apaga (a própria; admin/diretor apaga qualquer uma)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugificarMarker } from "@/lib/marketing/gerar-prompt";
import { uploadMediaToStorage } from "@/lib/media-storage";

export const dynamic = "force-dynamic";

const MIME_IMAGEM = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const LIMITE_BYTES = 2_500_000; // 2,5MB — referência é referência, não foto

async function usuarioLogado() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { supabase, user };
}

export async function GET(_request: NextRequest) {
  try {
    const sessao = await usuarioLogado();
    if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("artes_referencias")
      .select("*")
      .order("nome", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ referencias: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessao = await usuarioLogado();
    if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    let body: any = null;
    try {
      body = await request.json();
    } catch {
      /* corpo inválido cai no 400 abaixo */
    }
    const nome = String(body?.nome ?? "").trim();
    const mimetype = String(body?.mimetype ?? "").toLowerCase();
    const base64 = String(body?.base64 ?? "").trim();
    if (!nome || !base64) {
      return NextResponse.json({ error: "Nome e imagem são obrigatórios" }, { status: 400 });
    }
    if (!MIME_IMAGEM.has(mimetype)) {
      return NextResponse.json({ error: "Só aceitamos PNG, JPEG ou WEBP" }, { status: 400 });
    }
    if (Math.ceil(base64.length / 4) * 3 > LIMITE_BYTES) {
      return NextResponse.json({ error: "Imagem grande demais (máx. 2,5MB)" }, { status: 400 });
    }

    const imagemUrl = await uploadMediaToStorage(base64, mimetype, "referencias", slugificarMarker(nome));
    if (!imagemUrl) {
      return NextResponse.json({ error: "Falha ao salvar a imagem" }, { status: 502 });
    }

    const supabase = createAdminClient();
    const { data: criada, error } = await supabase
      .from("artes_referencias")
      .insert({
        nome,
        marker: slugificarMarker(nome),
        imagem_url: imagemUrl,
        ativo: true,
        created_by: sessao.user.id,
      })
      .select("id, nome, marker, imagem_url, ativo, created_by, created_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ referencia: criada }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessao = await usuarioLogado();
    if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

    const { supabase, user } = sessao;
    const { data: meuPerfil } = await supabase
      .from("profiles")
      .select("cargo")
      .eq("id", user.id)
      .single();
    const amplo = ["admin", "diretor"].includes(meuPerfil?.cargo || "");

    let consulta = createAdminClient().from("artes_referencias").select("id").eq("id", id);
    if (!amplo) consulta = consulta.eq("created_by", user.id);
    const { data: alvo } = await consulta.maybeSingle();
    if (!alvo) return NextResponse.json({ error: "Referência não encontrada" }, { status: 404 });

    const { error } = await createAdminClient().from("artes_referencias").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erro interno" }, { status: 500 });
  }
}
