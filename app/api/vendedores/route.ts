import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // 1) Verifica autenticação
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  // 2) Verifica se é gerência
  const { data: profile } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .single();

  const cargosGerencia = ["diretor", "gerente_comercial", "admin"];
  if (!profile || !cargosGerencia.includes(profile.cargo)) {
    return NextResponse.json(
      { error: "Apenas gerência pode cadastrar vendedores" },
      { status: 403 }
    );
  }

  // 3) Cria o novo usuário via Service Role
  const body = await request.json();
  const { nome_completo, email, senha, cargo = "vendedor", telefone } = body;

  if (!nome_completo || !email || !senha) {
    return NextResponse.json(
      { error: "Nome, email e senha são obrigatórios" },
      { status: 400 }
    );
  }

  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: {
      nome_completo,
      cargo,
    },
  });

  if (createError) {
    return NextResponse.json(
      { error: createError.message },
      { status: 500 }
    );
  }

  const newUserId = authData.user.id;

  // 4) Atualiza o profile (o trigger já criou, mas garantimos os dados)
  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      nome_completo,
      cargo,
      telefone: telefone || null,
    })
    .eq("id", newUserId);

  if (updateError) {
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      id: newUserId,
      email,
      nome_completo,
      cargo,
    },
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  // Verifica se usuário é gestor
  const { data: meuPerfil } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .single();
  const isGestor = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");
  if (!isGestor) {
    return NextResponse.json({ error: "Apenas gestores podem listar vendedores" }, { status: 403 });
  }

  // Usa service_role para bypassar RLS e listar todos os vendedores
  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: vendedores, error } = await supabaseAdmin
    .from("profiles")
    .select("id, nome_completo, email, cargo, telefone")
    .order("nome_completo", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ vendedores });
}
