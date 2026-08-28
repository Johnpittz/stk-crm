import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/debug/all-profiles
 * Retorna todos os profiles com whatsapp_instance (usando service_role)
 */
export async function GET() {
  try {
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, nome_completo, email, cargo, whatsapp_instance")
      .order("nome_completo");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profiles: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Erro" }, { status: 500 });
  }
}
