/**
 * 06/10 — GET /api/clientes/log: LOG DE CRIAÇÃO/EDIÇÃO de clientes
 * (recurso novo, pedido do João). Só admin lê: 401 sem sessão e 403 para
 * qualquer cargo que não seja "admin".
 *
 * A rota estática `log` tem precedência sobre [clienteId] no Next.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { usuarioAtual } from "@/lib/auth/usuario-atual";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const usuario = await usuarioAtual();
  if (!usuario) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (usuario.cargo !== "admin") {
    return NextResponse.json({ error: "Acesso restrito a admin" }, { status: 403 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("cliente_auditoria")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    return NextResponse.json({ logs: data ?? [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno" },
      { status: 500 }
    );
  }
}
