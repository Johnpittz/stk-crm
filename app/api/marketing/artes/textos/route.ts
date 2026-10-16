/**
 * ITEM 3 (16/10) — /api/marketing/artes/textos: o CADASTRO de números e
 * opções de texto que o vendedor usa ao gerar artes.
 *
 *   GET    → lista (número primeiro, depois opções)
 *   POST   → cria { tipo: 'numero' | 'opcao', texto } — salvar número
 *            substitui o anterior (sempre um por vez)
 *   DELETE → apaga pelo id
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function usuarioLogado() {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function GET() {
  try {
    const user = await usuarioLogado();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { data, error } = await createAdminClient()
      .from("artes_textos")
      .select("*")
      .eq("ativo", true)
      .order("tipo", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ textos: data ?? [] });
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

    const tipo = String(body?.tipo ?? "");
    const texto = String(body?.texto ?? "").trim();
    if (tipo !== "numero" && tipo !== "opcao") {
      return NextResponse.json({ error: "Tipo inválido (numero ou opcao)" }, { status: 400 });
    }
    if (!texto) {
      return NextResponse.json({ error: "Texto é obrigatório" }, { status: 400 });
    }

    const admin = createAdminClient();
    // número é único: salvar um novo substitui o anterior
    if (tipo === "numero") {
      await admin.from("artes_textos").delete().eq("tipo", "numero");
    }

    const { data, error } = await admin
      .from("artes_textos")
      .insert({ tipo, texto, created_by: user.id })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ texto: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await usuarioLogado();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });

    const { error } = await createAdminClient().from("artes_textos").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}
