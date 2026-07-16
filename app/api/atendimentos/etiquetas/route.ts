import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function ehTabelaNaoExiste(error: any): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" ||
    (error.message && error.message.includes("does not exist")) ||
    (error.message && error.message.includes("relation") && error.message.includes("does not exist"))
  );
}

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/atendimentos/etiquetas
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const atendimentoId = searchParams.get("atendimento_id");
    const buscarTodas = searchParams.get("todas") === "true";
    const buscarTodasPorAtendimento = searchParams.get("todos") === "true";

    const serviceClient = getServiceClient();

    // Buscar todas as etiquetas agrupadas por atendimento
    if (buscarTodasPorAtendimento) {
      const { data, error } = await serviceClient
        .from("atendimento_etiquetas")
        .select("atendimento_id, etiqueta");

      if (error) {
        if (ehTabelaNaoExiste(error)) {
          return NextResponse.json({ mapa: {}, warning: "Tabela não existe. Execute a migration no Supabase." });
        }
        console.error("[API etiquetas GET/todos] error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const mapa: Record<string, string[]> = {};
      (data || []).forEach((e: any) => {
        if (!mapa[e.atendimento_id]) mapa[e.atendimento_id] = [];
        mapa[e.atendimento_id].push(e.etiqueta);
      });
      return NextResponse.json({ mapa });
    }

    // Buscar todas as etiquetas únicas
    if (buscarTodas) {
      const { data, error } = await serviceClient
        .from("atendimento_etiquetas")
        .select("etiqueta")
        .order("etiqueta", { ascending: true });

      if (error) {
        if (ehTabelaNaoExiste(error)) {
          return NextResponse.json({ etiquetas: [], warning: "Tabela não existe" });
        }
        console.error("[API etiquetas GET/todas] error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const todas = (data || []).map((e: any) => e.etiqueta);
      const unicas = Array.from(new Set(todas));
      return NextResponse.json({ etiquetas: unicas });
    }

    if (!atendimentoId) {
      return NextResponse.json({ error: "atendimento_id obrigatório" }, { status: 400 });
    }

    const { data: etiquetas, error } = await serviceClient
      .from("atendimento_etiquetas")
      .select("*")
      .eq("atendimento_id", atendimentoId)
      .order("created_at", { ascending: true });

    if (error) {
      if (ehTabelaNaoExiste(error)) {
        return NextResponse.json({ etiquetas: [], warning: "Tabela não existe" });
      }
      console.error("[API etiquetas GET] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ etiquetas: etiquetas || [] });
  } catch (err: any) {
    console.error("[API etiquetas GET] Error:", err?.message);
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 });
  }
}

// POST /api/atendimentos/etiquetas
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const { atendimento_id, etiqueta } = body;

    if (!atendimento_id || !etiqueta) {
      return NextResponse.json({ error: "atendimento_id e etiqueta obrigatórios", recebido: body }, { status: 400 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(atendimento_id)) {
      return NextResponse.json({ error: "atendimento_id não é UUID válido", valor: atendimento_id }, { status: 400 });
    }

    const serviceClient = getServiceClient();

    const { data, error } = await serviceClient
      .from("atendimento_etiquetas")
      .insert({ atendimento_id, etiqueta: etiqueta.trim() })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ message: "Etiqueta já vinculada" });
      }
      if (ehTabelaNaoExiste(error)) {
        return NextResponse.json({
          error: "Tabela atendimento_etiquetas não existe. Execute a migration no Supabase Dashboard → SQL Editor.",
          sql: "CREATE TABLE IF NOT EXISTS atendimento_etiquetas (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, atendimento_id UUID NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE, etiqueta TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(atendimento_id, etiqueta)); ALTER TABLE atendimento_etiquetas DISABLE ROW LEVEL SECURITY;"
        }, { status: 503 });
      }
      console.error("[API etiquetas POST] error:", JSON.stringify(error));
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json({ etiqueta: data });
  } catch (err: any) {
    console.error("[API etiquetas POST] Error:", err?.message);
    return NextResponse.json({ error: err?.message || "Erro interno" }, { status: 500 });
  }
}

// DELETE /api/atendimentos/etiquetas
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const atendimentoId = searchParams.get("atendimento_id");
    const etiqueta = searchParams.get("etiqueta");

    if (!atendimentoId || !etiqueta) {
      return NextResponse.json({ error: "atendimento_id e etiqueta obrigatórios" }, { status: 400 });
    }

    const serviceClient = getServiceClient();

    const { error } = await serviceClient
      .from("atendimento_etiquetas")
      .delete()
      .eq("atendimento_id", atendimentoId)
      .eq("etiqueta", etiqueta);

    if (error) {
      if (ehTabelaNaoExiste(error)) {
        return NextResponse.json({ message: "Tabela não existe ainda" });
      }
      console.error("[API etiquetas DELETE] error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Etiqueta removida" });
  } catch (err) {
    console.error("[API etiquetas DELETE] Error:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}