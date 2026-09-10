/**
 * API para gerenciamento de campanhas de disparo em massa
 * 
 * GET /api/bulk/campaigns - Lista campanhas
 * POST /api/bulk/campaigns - Cria campanha
 * DELETE /api/bulk/campaigns?id=xxx - Deleta campanha
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

// GET - Listar campanhas
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from("bulk_campaigns")
      .select(`
        *,
        campanha:campanhas(id, nome, status),
        promocao:promocoes_marketing(id, nome, tipo, valor)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ campaigns: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Criar campanha
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const body = await request.json();
    const { name, message, numbers, instancia, intervalo, campanha_id, promocao_id } = body;

    if (!name || !message || !numbers || numbers.length === 0) {
      return NextResponse.json(
        { error: "name, message e numbers são obrigatórios" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("bulk_campaigns")
      .insert({
        name,
        message,
        numbers,
        status: "pending",
        sent: 0,
        failed: 0,
        instancia: instancia || "ROMA_2",
        intervalo: intervalo || 5,
        campanha_id: campanha_id || null,
        promocao_id: promocao_id || null,
      })
      .select(`
        *,
        campanha:campanhas(id, nome, status),
        promocao:promocoes_marketing(id, nome, tipo, valor)
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Se vinculou a uma campanha, incrementar contador de disparos
    if (campanha_id) {
      // Buscar quantos disparos já existem para essa campanha
      const { data: existingCampaigns } = await supabase
        .from("bulk_campaigns")
        .select("id")
        .eq("campanha_id", campanha_id);
      
      // Atualizar conversões da campanha (novo disparo = potenciais conversões)
      // Não incrementamos aqui, pois a conversão é contada quando o lead é criado
    }

    return NextResponse.json({ campaign: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Deletar campanha
export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });
    }

    const { error } = await supabase
      .from("bulk_campaigns")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}