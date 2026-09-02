import { PerfilAtivoProvider } from "@/lib/perfil-ativo-context";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { UserProfileProvider } from "@/lib/user-profile-context";

/**
 * Layout do Dashboard (Rotas Autenticadas)
 *
 * Este layout envolve todas as páginas que requerem autenticação.
 * Inclui a sidebar de navegação e o header com título da página.
 */

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user) {
    redirect("/login");
  }

  // Busca perfil do usuário logado (server-side)
  let profile: { nome_completo?: string; cargo?: string; whatsapp_instance?: string } | null = null;
  try {
    const result = await supabase
      .from("profiles")
      .select("nome_completo, cargo, whatsapp_instance")
      .eq("id", data.user.id)
      .single();
    profile = result.data;
  } catch {
    // Tabela profiles pode não existir ainda
  }

  // Tenta buscar avatar separadamente
  let avatarUrl: string | null = null;
  try {
    const { data: avData } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", data.user.id)
      .single();
    avatarUrl = avData?.avatar_url ?? null;
  } catch {
    // Coluna avatar_url não existe ainda
  }

  const user = {
    email: data.user.email ?? "",
    nome: profile?.nome_completo ?? data.user.email?.split("@")[0] ?? "Usuário",
    canal: profile?.cargo ?? "Comercial",
    cargo: profile?.cargo ?? "vendedor",
    avatar_url: avatarUrl,
    whatsapp_instance: profile?.whatsapp_instance ?? null,
  };

  return (
    <PerfilAtivoProvider cargo={user.cargo}>
      <UserProfileProvider user={user}>
        <div className="min-h-screen bg-[#0c1425]">
          <Sidebar user={user} />
          <main className="min-h-screen transition-all duration-300 ease-in-out ml-64">
            <Header />
            <div className="p-6">{children}</div>
          </main>
        </div>
      </UserProfileProvider>
    </PerfilAtivoProvider>
  );
}
