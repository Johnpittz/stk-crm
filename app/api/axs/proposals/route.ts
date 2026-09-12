import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/axs/proposals?cliente_id=xxx
 *
 * Returns AXS proposals for a specific client from Supabase.
 * Falls back to reading from the clientes table if axs_propostas table doesn't exist.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cliente_id = searchParams.get("cliente_id");

  if (!cliente_id) {
    return NextResponse.json(
      { error: "cliente_id é obrigatório" },
      { status: 400 }
    );
  }

  // ─── Try to fetch from axs_propostas table ───
  let propostas: any[] = [];

  try {
    const { data, error } = await supabase
      .from("axs_propostas")
      .select("id, cliente_id, axs_card_id, axs_status, axs_mensalidade, axs_dados, created_at")
      .eq("cliente_id", cliente_id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      propostas = data;
    } else {
      // Table might not exist yet — try fallback
      console.warn(
        "[AXS Proposals] Query axs_propostas falhou, tentando fallback:",
        error?.message
      );
    }
  } catch {
    // Table doesn't exist, try fallback
  }

  // ─── Fallback: read from clientes table ───
  if (propostas.length === 0) {
    try {
      const { data: cliente, error: clienteError } = await supabase
        .from("clientes")
        .select("id, axs_card_id, axs_status, axs_mensalidade")
        .eq("id", cliente_id)
        .single();

      if (!clienteError && cliente?.axs_card_id) {
        propostas = [
          {
            id: `fallback-${cliente.id}`,
            cliente_id: cliente.id,
            axs_card_id: cliente.axs_card_id,
            axs_status: cliente.axs_status,
            axs_mensalidade: cliente.axs_mensalidade,
            axs_dados: null,
            created_at: new Date().toISOString(),
          },
        ];
      }
    } catch {
      // Ignore fallback errors
    }
  }

  return NextResponse.json({ propostas });
}
