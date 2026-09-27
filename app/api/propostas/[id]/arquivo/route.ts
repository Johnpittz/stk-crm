/**
 * Fase 6 / C4 — download do PDF de proposta já gerado.
 *
 * GET /api/propostas/[id]/arquivo → devolve o PDF do Storage como anexo
 * (mesmo cabeçalho da proposta RECIEE). O Storage é privado: o servidor baixa
 * com a service role e só entrega para o dono da oportunidade ou um gestor.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET_PROPOSTAS } from "@/lib/propostas/gerar";

const CARGOS_GESTOR = ["diretor", "admin", "gerente_comercial"];

async function paraBytes(data: any): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (typeof data?.arrayBuffer === "function") {
    return new Uint8Array(await data.arrayBuffer());
  }
  return new Uint8Array(data);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: proposta } = await admin
    .from("propostas")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!proposta) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .maybeSingle();

  const gestor = CARGOS_GESTOR.includes(perfil?.cargo || "");
  if (proposta.vendedor_id !== user.id && !gestor) {
    return NextResponse.json(
      { error: "Você não tem permissão para baixar esta proposta" },
      { status: 403 }
    );
  }

  const { data, error } = await admin.storage
    .from(BUCKET_PROPOSTAS)
    .download(proposta.arquivo_path);

  if (error || !data) {
    console.error("[propostas] arquivo ausente no Storage:", error);
    return NextResponse.json(
      { error: "Arquivo da proposta não está mais no Storage — gere de novo." },
      { status: 404 }
    );
  }

  const bytes = await paraBytes(data);
  const nome = String(proposta.arquivo_nome || `${proposta.numero}.pdf`).replace(
    /["\\]/g,
    ""
  );

  return new NextResponse(bytes as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}
