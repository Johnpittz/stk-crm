import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  Phone,
  Mail,
  MapPin,
  Building2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/server";

interface ClientesPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function ClientesPage({ searchParams }: ClientesPageProps) {
  const supabase = createClient();
  const busca = typeof searchParams.q === "string" ? searchParams.q : "";
  const filtroStatus = typeof searchParams.status === "string" ? searchParams.status : "todos";

  // Busca clientes do banco
  let query = supabase.from("clientes").select(
    "*, grupos_economicos!clientes_grupo_economico_id_fkey(nome)",
    { count: "exact" }
  );

  if (busca) {
    query = query.ilike("nome", `%${busca}%`);
  }

  if (filtroStatus !== "todos") {
    query = query.eq("status", filtroStatus);
  }

  const { data: clientes, error, count } = await query.order("nome", { ascending: true });

  // Estatísticas
  const { data: statsData, error: statsError } = await supabase
    .from("clientes")
    .select("status", { count: "exact" });

  const stats = {
    total: statsData?.length ?? 0,
    ativos: statsData?.filter((c) => c.status === "ativo").length ?? 0,
    churn: statsData?.filter((c) => c.status === "churn").length ?? 0,
    prospects: statsData?.filter((c) => c.status === "prospect").length ?? 0,
  };

  const formatCurrency = (value: number | null) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value ?? 0);

  const statusBadge = (status: string) => {
    switch (status) {
      case "ativo":
        return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
      case "churn":
        return "bg-red-100 text-red-700 hover:bg-red-100";
      case "prospect":
        return "bg-amber-100 text-amber-700 hover:bg-amber-100";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "ativo":
        return "Ativo";
      case "churn":
        return "Churn";
      case "prospect":
        return "Prospect";
      default:
        return status;
    }
  };

  const diasSemCompra = (dataUltimaCompra: string | null) => {
    if (!dataUltimaCompra) return null;
    const diff = Math.floor(
      (new Date().getTime() - new Date(dataUltimaCompra).getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff > 0 ? diff : 0;
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total de Clientes</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Clientes Ativos</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.ativos}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Em Churn</p>
                <p className="text-2xl font-bold text-red-600">{stats.churn}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Prospects</p>
                <p className="text-2xl font-bold text-amber-600">{stats.prospects}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Clientes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Clientes</CardTitle>
              <CardDescription>Gerencie seus clientes e prospects</CardDescription>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Cliente
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <form className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                name="q"
                defaultValue={busca}
                placeholder="Buscar cliente..."
                className="pl-10"
              />
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {["todos", "ativo", "churn", "prospect"].map((s) => (
                <Link
                  key={s}
                  href={`/clientes?status=${s}${busca ? `&q=${busca}` : ""}`}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize",
                    filtroStatus === s
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {s === "todos" ? "Todos" : s === "ativo" ? "Ativos" : s === "churn" ? "Churn" : "Prospects"}
                </Link>
              ))}
            </div>
            <Button variant="outline" size="icon" type="submit">
              <Filter className="h-4 w-4" />
            </Button>
          </form>

          {/* Tabela */}
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {clientes && clientes.length > 0 ? (
                clientes.map((cliente: any) => {
                  const semCompra = diasSemCompra(cliente.data_ultima_compra);
                  const isGrupo = !!cliente.grupo_economico_id;

                  return (
                    <div
                      key={cliente.id}
                      className="flex items-center gap-4 p-4 rounded-lg border hover:bg-slate-50 transition-colors"
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage
                          src={`https://api.dicebear.com/7.x/initials/svg?seed=${cliente.nome}`}
                        />
                        <AvatarFallback className="bg-slate-200 text-slate-700">
                          {cliente.nome?.charAt(0) ?? "?"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 truncate">
                            {cliente.nome}
                          </h3>
                          {isGrupo && (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                              <Building2 className="h-3 w-3 mr-1" />
                              Grupo
                            </Badge>
                          )}
                          {cliente.status === "churn" && semCompra != null && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {semCompra} dias
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {cliente.telefone ?? "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {cliente.email ?? "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {cliente.cidade && cliente.estado
                              ? `${cliente.cidade}/${cliente.estado}`
                              : "—"}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <Badge className={cn(statusBadge(cliente.status))}>
                          {statusLabel(cliente.status)}
                        </Badge>
                        {cliente.ticket_medio > 0 && (
                          <p className="text-sm font-medium text-slate-900 mt-1">
                            Ticket: {formatCurrency(cliente.ticket_medio)}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          Ver
                        </Button>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium">Nenhum cliente encontrado</p>
                  <p className="text-sm">Cadastre seu primeiro cliente ou ajuste os filtros.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
