"use client";

import { useState } from "react";
import { 
  ShoppingCart, 
  Search, 
  Filter,
  Calendar,
  TrendingUp,
  DollarSign,
  Package,
  ChevronDown,
  Download
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

// Mock de vendas
const vendas = [
  { id: "V001", cliente: "Rede ABC Ltda", data: "2026-03-02", valor: 12500, itens: 45, status: "confirmada" },
  { id: "V002", cliente: "Carlos Veículos", data: "2026-03-01", valor: 3800, itens: 12, status: "confirmada" },
  { id: "V003", cliente: "Supermercados Silva", data: "2026-02-28", valor: 8200, itens: 89, status: "faturada" },
  { id: "V004", cliente: "Posto Ipiranga", data: "2026-02-27", valor: 5600, itens: 34, status: "confirmada" },
  { id: "V005", cliente: "Lojas Centro Oeste", data: "2026-02-25", valor: 15000, itens: 67, status: "confirmada" },
  { id: "V006", cliente: "Atacado XYZ", data: "2026-01-15", valor: 4500, itens: 23, status: "confirmada" },
  { id: "V007", cliente: "Mercado do Bairro", data: "2026-01-10", valor: 1200, itens: 8, status: "cancelada" },
];

const vendasPorDia = [
  { dia: "24/02", valor: 8500 },
  { dia: "25/02", valor: 15000 },
  { dia: "26/02", valor: 4200 },
  { dia: "27/02", valor: 5600 },
  { dia: "28/02", valor: 8200 },
  { dia: "01/03", valor: 3800 },
  { dia: "02/03", valor: 12500 },
];

const stats = {
  totalVendas: 156,
  totalFaturado: 245000,
  ticketMedio: 1570,
  metaMensal: 85,
};

export default function VendasPage() {
  const [periodo, setPeriodo] = useState("mes");

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total de Vendas</p>
                <p className="text-2xl font-bold">{stats.totalVendas}</p>
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
                  {formatCurrency(stats.totalFaturado)}
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
                <p className="text-2xl font-bold">{formatCurrency(stats.ticketMedio)}</p>
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
                <p className="text-2xl font-bold text-blue-600">{stats.metaMensal}%</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de Vendas */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Vendas por Período</CardTitle>
                <CardDescription>Evolução das vendas nos últimos 7 dias</CardDescription>
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
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendasPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis tickFormatter={(v) => `R$${v / 1000}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="valor" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
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
              <div className="space-y-3">
                {vendas.slice(0, 5).map((venda) => (
                  <div
                    key={venda.id}
                    className="p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">{venda.id}</span>
                      <Badge
                        className={cn(
                          venda.status === "confirmada" && "bg-blue-100 text-blue-700",
                          venda.status === "faturada" && "bg-emerald-100 text-emerald-700",
                          venda.status === "cancelada" && "bg-red-100 text-red-700"
                        )}
                      >
                        {venda.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{venda.cliente}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-400">
                        {venda.itens} itens
                      </span>
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(venda.valor)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
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
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input placeholder="Buscar venda..." className="pl-10" />
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
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Itens</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-700">Status</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-700">Valor</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((venda) => (
                  <tr key={venda.id} className="border-b hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium">{venda.id}</td>
                    <td className="py-3 px-4">{venda.cliente}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(venda.data).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-3 px-4">{venda.itens}</td>
                    <td className="py-3 px-4">
                      <Badge
                        className={cn(
                          venda.status === "confirmada" && "bg-blue-100 text-blue-700",
                          venda.status === "faturada" && "bg-emerald-100 text-emerald-700",
                          venda.status === "cancelada" && "bg-red-100 text-red-700"
                        )}
                      >
                        {venda.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">
                      {formatCurrency(venda.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
