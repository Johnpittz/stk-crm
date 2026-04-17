"use client";

import { useState, useEffect } from "react";
import { 
  ShoppingCart, 
  Search, 
  Filter,
  Calendar,
  TrendingUp,
  DollarSign,
  Package,
  ChevronDown,
  Download,
  Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { ModalNovaVenda } from "@/components/features/vendas/modal-nova-venda";

interface Venda {
  id: string;
  numero_pedido: string;
  cliente_id: string;
  data_venda: string;
  valor_final: number;
  status: string;
  clientes: { nome_razao_social: string } | null;
}

interface Stats {
  total_vendas: number;
  total_faturado: number;
  ticket_medio: number;
}

export default function VendasPage() {
  const [periodo, setPeriodo] = useState("mes");
  const [busca, setBusca] = useState("");
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [stats, setStats] = useState<Stats>({ total_vendas: 0, total_faturado: 0, ticket_medio: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchVendas = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Sessão expirada");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (busca) params.append("q", busca);
      params.append("periodo", periodo);

      const res = await fetch(`/api/vendas?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao carregar vendas");
        setLoading(false);
        return;
      }

      setVendas(data.vendas || []);
      setStats(data.stats || { total_vendas: 0, total_faturado: 0, ticket_medio: 0 });
    } catch (err: any) {
      setError(err.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendas();
  }, [periodo, busca]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const statusBadge = (status: string) => {
    switch (status) {
      case "confirmada":
        return "bg-blue-100 text-blue-700";
      case "faturada":
        return "bg-emerald-100 text-emerald-700";
      case "cancelada":
        return "bg-red-100 text-red-700";
      case "orcamento":
        return "bg-amber-100 text-amber-700";
      case "devolvida":
        return "bg-purple-100 text-purple-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "confirmada":
        return "Confirmada";
      case "faturada":
        return "Faturada";
      case "cancelada":
        return "Cancelada";
      case "orcamento":
        return "Orçamento";
      case "devolvida":
        return "Devolvida";
      default:
        return status;
    }
  };

  // Dados para o gráfico (agrupa por data)
  const vendasPorDia = vendas.reduce((acc: any[], venda) => {
    const data = new Date(venda.data_venda).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const existente = acc.find((item) => item.dia === data);
    if (existente) {
      existente.valor += venda.valor_final;
    } else {
      acc.push({ dia: data, valor: venda.valor_final });
    }
    return acc;
  }, []).reverse();

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total de Vendas</p>
                <p className="text-2xl font-bold">{stats.total_vendas}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Faturado</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(stats.total_faturado)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Ticket Médio</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.ticket_medio)}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">% da Meta</p>
                <p className="text-2xl font-bold text-blue-600">85%</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
          Erro: {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Vendas */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Vendas por Período</CardTitle>
                <CardDescription>Evolução das vendas</CardDescription>
              </div>
              <Tabs value={periodo} onValueChange={setPeriodo}>
                <TabsList>
                  <TabsTrigger value="semana">Semana</TabsTrigger>
                  <TabsTrigger value="mes">Mês</TabsTrigger>
                  <TabsTrigger value="ano">Ano</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : vendasPorDia.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center text-slate-500">
                Nenhuma venda no período
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendasPorDia}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dia" />
                    <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="valor" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de Vendas Recentes */}
        <Card>
          <CardHeader>
            <CardTitle>Vendas Recentes</CardTitle>
            <CardDescription>Últimas vendas realizadas</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : vendas.length === 0 ? (
                <div className="text-center text-slate-500 py-8">
                  Nenhuma venda recente
                </div>
              ) : (
                <div className="space-y-3">
                  {vendas.slice(0, 5).map((venda) => (
                    <div
                      key={venda.id}
                      className="p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">{venda.numero_pedido}</span>
                        <Badge className={statusBadge(venda.status)}>
                          {statusLabel(venda.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        {venda.clientes?.nome_razao_social || "Cliente não encontrado"}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-slate-400">
                          {new Date(venda.data_venda).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(venda.valor_final)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Histórico Completo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Histórico de Vendas</CardTitle>
              <CardDescription>Todas as vendas do período</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <ModalNovaVenda onSuccess={fetchVendas} />
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Buscar venda..." 
                className="pl-10"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              Período
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Pedido</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Cliente</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Data</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Valor</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                    </td>
                  </tr>
                ) : vendas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      Nenhuma venda encontrada no período
                    </td>
                  </tr>
                ) : (
                  vendas.map((venda) => (
                    <tr key={venda.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium">{venda.numero_pedido}</td>
                      <td className="py-3 px-4">{venda.clientes?.nome_razao_social || "—"}</td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(venda.data_venda).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={statusBadge(venda.status)}>
                          {statusLabel(venda.status)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {formatCurrency(venda.valor_final)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
