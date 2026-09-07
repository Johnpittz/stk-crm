/**
 * API de Interações do Cliente
 * 
 * GET    /api/clientes/[clienteId]/interactions - Lista interações
 * POST   /api/clientes/[clienteId]/interactions - Cria interação
 * DELETE /api/clientes/[clienteId]/interactions?id=xxx - Deleta interação
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key);
}

// GET - Listar interações
export async function GET(
  request: NextRequest,
  { params }: { params: { clienteId: string } }
) {
  try {
    const supabase = getSupabase();
    const { clienteId } = params;

    const { data, error } = await supabase
      .from("client_interactions")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ interacoes: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Criar interação
export async function POST(
  request: NextRequest,
  { params }: { params: { clienteId: string } }
) {
  try {
    const supabase = getSupabase();
    const { clienteId } = params;
    const body = await request.json();
    const { tipo, titulo, descricao, dados, status } = body;

    if (!tipo || !titulo) {
      return NextResponse.json(
        { error: "tipo e titulo são obrigatórios" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("client_interactions")
      .insert({
        cliente_id: clienteId,
        tipo,
        titulo,
        descricao,
        dados: dados || {},
        status: status || "ativo",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ interacao: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Deletar interação
export async function DELETE(
  request: NextRequest,
  { params }: { params: { clienteId: string } }
) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    }

    const { error } = await supabase
      .from("client_interactions")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
