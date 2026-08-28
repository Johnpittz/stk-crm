import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ModalNovoVendedor } from "@/components/features/configuracoes/modal-novo-vendedor";

export const dynamic = "force-dynamic";

export default async function VendedoresPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verifica se é gerência
  let profile: { cargo?: string } | null = null;
  try {
    const result = await supabase
      .from("profiles")
      .select("cargo")
      .eq("id", user.id)
      .single();
    profile = result.data;
  } catch {
    // coluna cargo pode não existir ainda
  }

  const cargosGerencia = ["diretor", "gerente_comercial", "admin"];
  const isGerencia = profile?.cargo ? cargosGerencia.includes(profile.cargo) : false;

  // Busca todos os vendedores (sem telefone para evitar 406 se coluna não existir)
  let vendedores: any[] | null = null;
  let error: any = null;
  try {
    const result = await supabase
      .from("profiles")
      .select("id, nome_completo, email, cargo")
      .order("nome_completo", { ascending: true });
    vendedores = result.data;
    error = result.error;
  } catch {
    // tabela profiles pode não existir ainda
  }

  const cargoBadge = (cargo: string) => {
    switch (cargo) {
      case "diretor":
        return "bg-purple-100 text-purple-700";
      case "gerente_comercial":
        return "bg-blue-100 text-blue-700";
      case "admin":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const cargoLabel = (cargo: string) => {
    switch (cargo) {
      case "diretor":
        return "Diretor";
      case "gerente_comercial":
        return "Gerente Comercial";
      case "admin":
        return "Administrador";
      default:
        return "Vendedor";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vendedores</h1>
          <p className="text-sm text-slate-500">
            Gerencie a equipe de vendas e permissões
          </p>
        </div>
        {isGerencia && <ModalNovoVendedor />}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          Erro ao carregar vendedores: {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vendedores?.map((v) => (
          <Card key={v.id}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-[#14919B] text-white font-semibold">
                    {v.nome_completo?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">
                    {v.nome_completo || v.email}
                  </h3>
                  <p className="text-sm text-slate-500 truncate">{v.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className={cargoBadge(v.cargo)}>
                      {cargoLabel(v.cargo)}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="bg-emerald-100 text-emerald-700"
                    >
                      Ativo
                    </Badge>
                  </div>
                  {v.telefone && (
                    <p className="text-sm text-slate-400 mt-1">{v.telefone}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!vendedores?.length && !error && (
        <Card>
          <CardContent className="p-12 text-center text-slate-500">
            <p className="text-lg font-medium">Nenhum vendedor encontrado</p>
            <p className="text-sm">
              {isGerencia
                ? "Cadastre o primeiro vendedor clicando no botão acima."
                : "Entre em contato com a gerência para mais informações."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
