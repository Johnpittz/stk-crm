import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Exige que quem crie usuário seja admin, diretor ou gerente_comercial
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: meuPerfil } = await supabase
    .from("profiles")
    .select("cargo")
    .eq("id", user.id)
    .single();

  const isAdmin = ["diretor", "admin", "gerente_comercial"].includes(meuPerfil?.cargo || "");
  if (!isAdmin) {
    return NextResponse.json({ error: "Apenas administradores podem criar usuários" }, { status: 403 });
  }

  const body = await request.json();
  const { nome_completo, email, senha, telefone } = body;

  if (!nome_completo || !email || !senha) {
    return NextResponse.json(
      { error: "Nome, email e senha são obrigatórios" },
      { status: 400 }
    );
  }

  if (senha.length < 6) {
    return NextResponse.json(
      { error: "A senha deve ter no mínimo 6 caracteres" },
      { status: 400 }
    );
  }

  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Cria o usuário com email já confirmado (não precisa verificar email)
  const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: {
      nome_completo,
      cargo: "vendedor",
      telefone,
    },
  });

  if (createError) {
    return NextResponse.json(
      { error: createError.message },
      { status: 500 }
    );
  }

  const newUserId = authData.user.id;

  // Atualiza o profile (o trigger já criou, mas garantimos os dados)
  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      nome_completo,
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
    message: "Conta criada com sucesso! Você já pode fazer login.",
    user: {
      id: newUserId,
      email,
      nome_completo,
    },
  });
}
