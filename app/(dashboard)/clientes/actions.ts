"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function criarCliente(formData: FormData) {
  const supabase = createClient();

  const nome = formData.get("nome") as string;
  const documento = formData.get("documento") as string;
  const telefone = formData.get("telefone") as string;
  const email = formData.get("email") as string;
  const cidade = formData.get("cidade") as string;
  const estado = formData.get("estado") as string;
  const status = formData.get("status") as string;
  const tipo = formData.get("tipo") as string;

  if (!nome || !status || !tipo) {
    return { error: "Nome, tipo e status são obrigatórios." };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { error: "Usuário não autenticado." };
  }

  const { error } = await supabase.from("clientes").insert({
    nome,
    documento: documento || null,
    telefone: telefone || null,
    email: email || null,
    cidade: cidade || null,
    estado: estado || null,
    status,
    tipo,
    vendedor_responsavel_id: userData.user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/clientes");
  return { success: true };
}
