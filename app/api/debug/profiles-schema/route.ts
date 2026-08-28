import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/profiles-schema
 * Retorna a estrutura da tabela profiles (colunas que existem)
 */
export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    // Tenta buscar cada coluna individualmente
    const cols = ["id", "nome_completo", "email", "cargo", "telefone", "whatsapp", "avatar_url", "whatsapp_instance"];
    const result: Record<string, boolean> = {};

    for (const col of cols) {
      try {
        const { error } = await supabase
          .from("profiles")
          .select(col)
          .eq("id", user.id)
          .limit(1);
        result[col] = !error;
      } catch {
        result[col] = false;
      }
    }

    // Busca os dados do perfil com as colunas que existem
    const existingCols = cols.filter(c => result[c]);
    let profileData = null;
    if (existingCols.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select(existingCols.join(", "))
        .eq("id", user.id)
        .single();
      profileData = data;
    }

    return NextResponse.json({
      user_id: user.id,
      columns: result,
      existing: existingCols,
      missing: cols.filter(c => !result[c]),
      profile: profileData,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro" }, { status: 500 });
  }
}
