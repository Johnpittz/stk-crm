import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const authHeader = request.headers.get("authorization");

    console.log("[API /clientes] Requisição recebida");
    console.log("[API /clientes] Auth header presente:", !!authHeader);
    console.log("[API /clientes] SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "OK" : "FALTANDO");
    console.log("[API /clientes] SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK (comprimento: " + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ")" : "FALTANDO");

    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[API /clientes] Erro: header Bearer não encontrado");
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    console.log("[API /clientes] Token length:", token.length);

    // Verifica token com anon key
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    console.log("[API /clientes] Verificando token...");
    const { data: userData, error: authError } = await authClient.auth.getUser(token);

    if (authError) {
      console.log("[API /clientes] Erro auth:", authError.message);
      return NextResponse.json({ error: "Token inválido: " + authError.message }, { status: 401 });
    }

    if (!userData.user) {
      console.log("[API /clientes] Erro: userData.user é null");
      return NextResponse.json({ error: "Token inválido" }, { status: 401 });
    }

    console.log("[API /clientes] Usuário autenticado:", userData.user.id);

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    console.log("[API /clientes] Tentando inserir cliente...");
    const insertData = {
      nome_razao_social: body.nome_razao_social,
      cpf_cnpj: body.cpf_cnpj || null,
      telefone: body.telefone || null,
      email: body.email || null,
      cidade: body.cidade || null,
      estado: body.estado || null,
      status: body.status,
      tipo: body.tipo,
      vendedor_responsavel_id: userData.user.id,
    };
    console.log("[API /clientes] Dados:", JSON.stringify(insertData, null, 2));

    const { error } = await adminClient.from("clientes").insert(insertData);

    if (error) {
      console.log("[API /clientes] Erro Supabase INSERT:", error.message, error.code, error.details);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[API /clientes] Cliente inserido com sucesso!");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.log("[API /clientes] Erro geral:", err.message, err.stack);
    return NextResponse.json({ error: err.message || "Erro interno" }, { status: 500 });
  }
}
