"use client";

import { useState, useEffect } from "react";
import {
  Users,
  UserCheck,
  ShoppingCart,
  DollarSign,
  Loader2,
  TrendingUp,
  Briefcase,
  ChevronRight,
  Mail,
  Calendar
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";

interface Vendedor {
  id: string;
  nome_completo: string;
  email: string;
  cargo: string;
  ativo: boolean;
  created_at: string;
  stats: {
    total_clientes: number;
    clientes_ativos: number;
    total_vendas: number;
    faturamento: number;
  };
}

interface EquipeData {
  gestor: {
    id: string;
    nome: string;
    cargo: string;
    is_diretoria: boolean;
  };
  vendedores: Vendedor[];
  stats: {
    total_vendedores: number;
    total_clientes: number;
    clientes_ativos: number;
    total_vendas: number;
    faturamento_total: number;
  };
}

export default function EquipesPage() {
  const [data, setData] = useState<EquipeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchEquipe = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Sessão expirada");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/equipes", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Erro ao carregar equipe");
        setLoading(false);
        return;
      }

      setData(result);
    } catch (err: any) {
      setError(err.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipe();
  }, []);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-red-600">
        <p className="font-medium">Erro ao carregar equipe</p>
        <p className="text-sm">{error}</p>
        <Button variant="outline" className="mt-3" onClick={fetchEquipe}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { gestor, vendedores, stats } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Briefcase className="h-6 w-6 text-[#0D3B33]" />
          Minha Equipe
        </h1>
        <p className="text-slate-500">
          {gestor.is_diretoria 
            ? "Visão geral de todas as equipes" 
            : `Gestor: ${gestor.nome}`}
        </p>
      </div>

      {/* Stats da Equipe */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Vendedores</p>
                <p className="text-2xl font-bold">{stats.total_vendedores}</p>
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
                <p className="text-sm text-slate-500">Clientes na Carteira</p>
                <p className="text-2xl font-bold">{stats.total_clientes}</p>
                <p className="text-xs text-emerald-600">
                  {stats.clientes_ativos} ativos
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total de Vendas</p>
                <p className="text-2xl font-bold">{stats.total_vendas}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Faturamento Total</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(stats.faturamento_total)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Vendedores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Vendedores da Equipe
          </CardTitle>
          <CardDescription>
            {vendedores.length} vendedor{vendedores.length !== 1 ? 'es' : ''} na equipe
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vendedores.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">Nenhum vendedor na equipe</p>
              <p className="text-sm mt-1">
                Os vendedores aparecerão aqui quando forem vinculados ao gestor.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vendedores.map((v) => (
                <Card key={v.id} className="border hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-[#0D3B33] flex items-center justify-center text-white font-semibold">
                          {v.nome_completo.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold">{v.nome_completo}</p>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Mail className="h-3 w-3" />
                            {v.email}
                          </div>
                        </div>
                      </div>
                      {v.ativo ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500">Clientes</p>
                        <p className="text-lg font-bold">{v.stats.total_clientes}</p>
                        <p className="text-xs text-emerald-600">
                          {v.stats.clientes_ativos} ativos
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500">Vendas</p>
                        <p className="text-lg font-bold">{v.stats.total_vendas}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 col-span-2">
                        <p className="text-xs text-slate-500">Faturamento</p>
                        <p className="text-lg font-bold text-emerald-600">
                          {formatCurrency(v.stats.faturamento)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-3">
                      <Calendar className="h-3 w-3" />
                      Desde {formatDate(v.created_at)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
