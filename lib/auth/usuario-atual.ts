/**
 * 06/10 — usuário da sessão (cookie) + cargo do perfil.
 * Usado pelas rotas de clientes para saber QUEM criou/editou (log) e para
 * o log ser exclusivo de admin (carga == "admin").
 */
import { createClient } from "@/lib/supabase/server";

export interface UsuarioAtual {
  id: string;
  email: string;
  cargo: string;
}

export async function usuarioAtual(): Promise<UsuarioAtual | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    const user = data?.user;
    if (error || !user) return null;

    const { data: perfil } = await supabase
      .from("profiles")
      .select("cargo, email")
      .eq("id", user.id)
      .maybeSingle();

    return {
      id: user.id,
      email: perfil?.email ?? user.email ?? "",
      cargo: (perfil?.cargo ?? "").toLowerCase(),
    };
  } catch {
    return null;
  }
}
