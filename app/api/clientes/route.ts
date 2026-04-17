import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "").trim();

    // Valida token do usuário
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!userRes.ok) {
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    const userData = await userRes.json();
    const userId = userData.id;

    // Log para debug
    console.log("[API] SERVICE_KEY presente:", SERVICE_KEY.length > 0);
    console.log("[API] SERVICE_KEY primeiros 20 chars:", SERVICE_KEY.substring(0, 20));
    console.log("[API] SERVICE_KEY últimos 10 chars:", SERVICE_KEY.substring(SERVICE_KEY.length - 10));

    // Tenta inserir com service_role
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/clientes`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        nome_razao_social: body.nome_razao_social,
        cpf_cnpj: body.cpf_cnpj || null,
        telefone: body.telefone || null,
        email: body.email || null,
        cidade: body.cidade || null,
        estado: body.estado || null,
        status: body.status,
        tipo: body.tipo,
        vendedor_responsavel_id: userId,
      }),
    });

    if (!insertRes.ok) {
      const errorText = await insertRes.text();
      console.log("[API] Erro insert:", errorText);
      return NextResponse.json({ error: errorText || "Erro ao inserir" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
