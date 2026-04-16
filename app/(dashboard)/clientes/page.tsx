"use client";

import { useState } from "react";
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
  AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils/cn";

// Mock de clientes
const clientes = [
  {
    id: "c1",
    nome: "Rede ABC Ltda",
    tipo: "pj",
    cnpj: "12.345.678/0001-90",
    telefone: "(11) 3333-4444",
    email: "compras@redeabc.com.br",
    cidade: "São Paulo",
    estado: "SP",
    status: "ativo",
    ultimaCompra: "2026-02-15",
    ticketMedio: 54545454545,
    grupoEconomico: true,
    lojas: 12,
  },
  {
    id: "c2",
    nome: "Carlos Veículos",
    tipo: "pj",
    cnpj: "23.456.789/0001-01",
    telefone: "(11) 98765-4321",
    email: "carlos@carlosveiculos.com.br",
    cidade: "Guarulhos",
    estado: "SP",
    status: "ativo",
    ultimaCompra: "2026-01-20",
    ticketMedio: 3800,
    grupoEconomico: false,
  },
  {
    id: "c3",
    nome: "Atacado XYZ",
    tipo: "pj",
    cnpj: "34.567.890/0001-12",
    telefone: "(11) 3222-1111",
    email: "contato@atacadoxyz.com.br",
    cidade: "Osasco",
    estado: "SP",
    status: "churn",
    ultimaCompra: "2026-01-15",
    ticketMedio: 4500,
    grupoEconomico: false,
    diasSemCompra: 47,
  },
  {
    id: "c4",
    nome: "Supermercados Silva",
    tipo: "pj",
    cnpj: "45.678.901/0001-23",
    telefone: "(11) 3444-5555",
    email: "pedidos@silvasuper.com.br",
    cidade: "São Paulo",
    estado: "SP",
    status: "ativo",
    ultimaCompra: "2026-03-01",
    ticketMedio: 8200,
    grupoEconomico: true,
    lojas: 5,
  },
  {
    id: "c5",
    nome: "Posto Ipiranga",
    tipo: "pj",
    cnpj: "56.789.012/0001-34",
    telefone: "(11) 3666-7777",
    email: "admin@postoipiranga.com.br",
    cidade: "Santo André",
    estado: "SP",
    status: "ativo",
    ultimaCompra: "2026-02-28",
    ticketMedio: 5600,
    grupoEconomico: false,
  },
  {
    id: "c6",
    nome: "Lojas Centro Oeste",
    tipo: "pj",
    cnpj: "67.890.123/0001-45",
    telefone: "(11) 3888-9999",
    email: "compras@centrooeste.com.br",
    cidade: "Barueri",
    estado: "SP",
    status: "prospect",
    ultimaCompra: null,
    ticketMedio: 0,
    grupoEconomico: true,
    lojas: 8,
  },
];

const stats = {
  total: 142,
  ativos: 98,
  churn: 12,
  prospects: 32,
};

export default function ClientesPage() {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const clientesFiltrados = clientes.filter((cliente) => {
    const matchBusca = cliente.nome.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === "todos" || cliente.status === filtroStatus;
    return matchBusca && matchStatus;
  });

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
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar cliente..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={filtroStatus} onValueChange={setFiltroStatus}>
              <TabsList>
                <TabsTrigger value="todos">Todos</TabsTrigger>
                <TabsTrigger value="ativo">Ativos</TabsTrigger>
                <TabsTrigger value="churn">Churn</TabsTrigger>
                <TabsTrigger value="prospect">Prospects</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {/* Tabela */}
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {clientesFiltrados.map((cliente) => (
                <div
                  key={cliente.id}
                  className="flex items-center gap-4 p-4 rounded-lg border hover:bg-slate-50 transition-colors"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${cliente.nome}`} />
                    <AvatarFallback className="bg-slate-200 text-slate-700">
                      {cliente.nome.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 truncate">
                        {cliente.nome}
                      </h3>
                      {cliente.grupoEconomico && (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                          <Building2 className="h-3 w-3 mr-1" />
                          {cliente.lojas} lojas
                        </Badge>
                      )}
                      {cliente.status === "churn" && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {cliente.diasSemCompra} dias
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {cliente.telefone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {cliente.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {cliente.cidade}/{cliente.estado}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <Badge
                      className={cn(
                        cliente.status === "ativo" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
                        cliente.status === "churn" && "bg-red-100 text-red-700 hover:bg-red-100",
                        cliente.status === "prospect" && "bg-amber-100 text-amber-700 hover:bg-amber-100"
                      )}
                    >
                      {cliente.status === "ativo" && "Ativo"}
                      {cliente.status === "churn" && "Churn"}
                      {cliente.status === "prospect" && "Prospect"}
                    </Badge>
                    {cliente.ticketMedio > 0 && (
                      <p className="text-sm font-medium text-slate-900 mt-1">
                        Ticket: {formatCurrency(cliente.ticketMedio)}
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
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
