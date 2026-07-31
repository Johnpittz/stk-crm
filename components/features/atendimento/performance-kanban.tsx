"use client";

import { useState, useEffect, useCallback } from "react";
import { Target, TrendingUp, DollarSign, ShoppingCart, BarChart3 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

interface PerformanceKanbanProps {
  refreshTrigger?: number;
}

interface ResumoData {
  periodo: string;
  total_vendas: number;
  quantidade_vendas: number;
  ticket_medio: number;
  total_tarefas: number;
  tarefas_por_resultado: Record<string, number>;
  vendas_por_periodo: { label: string; valor: number; quantidade: number }[];
  meta: number;
  percentual_meta: number;
}

const coresResultado: Record<string, string> = {
  sucesso: "#10b981",
  insucesso: "#ef4444",
  remarcado: "#3b82f6",
  sem_contato: "#f59e0b",
  follow_up_necessario: "#8b5cf6",
  pendente: "#94a3b8",
};

const labelsResultado: Record<string, string> = {
  sucesso: "Sucesso",
  insucesso: "Insucesso",
  remarcado: "Remarcado",
  sem_contato: "Sem contato",
  follow_up_necessario: "Follow-up",
  pendente: "Pendente",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

export function PerformanceKanban({ refreshTrigger }: PerformanceKanbanProps) {
  const [resumo, setResumo] = useState<ResumoData | null>(null);
  const [periodo, setPeriodo] = useState<"dia" | "mes" | "ano">("dia");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchResumo = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const hoje = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/tarefas/resumo?periodo=${periodo}&data=${hoje}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setResumo(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, periodo]);

  useEffect(() => {
    fetchResumo();
  }, [fetchResumo, refreshTrigger]);

  // Dados para gráfico de pizza
  const dadosPizza = resumo
    ? Object.entries(resumo.tarefas_por_resultado)
        .filter(([, qtd]) => qtd > 0)
        .map(([key, value]) => ({
          name: labelsResultado[key] || key,
          value,
          cor: coresResultado[key] || "#94a3b8",
        }))
    : [];

  if (loading && !resumo) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-400 text-sm">
        Carregando métricas...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header com filtros de período */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-slate-700">Performance Geral</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {(["dia", "mes", "ano"] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={periodo === p ? "default" : "ghost"}
              className={cn(
                "h-7 text-xs px-3",
                periodo === p
                  ? "bg-white shadow-sm text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              )}
              onClick={() => setPeriodo(p)}
            >
              {p === "dia" ? "Dia" : p === "mes" ? "Mês" : "Ano"}
            </Button>
          ))}
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Vendido */}
        <Card className="border border-emerald-200 bg-emerald-50/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-emerald-700 font-medium">Total Vendido</span>
            </div>
            <p className="text-lg font-bold text-emerald-800">
              {formatCurrency(resumo?.total_vendas || 0)}
            </p>
          </CardContent>
        </Card>

        {/* Vendas Realizadas */}
        <Card className="border border-blue-200 bg-blue-50/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-blue-700 font-medium">Vendas</span>
            </div>
            <p className="text-lg font-bold text-blue-800">
              {resumo?.quantidade_vendas || 0}
            </p>
          </CardContent>
        </Card>

        {/* Ticket Médio */}
        <Card className="border border-purple-200 bg-purple-50/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-purple-700 font-medium">Ticket Médio</span>
            </div>
            <p className="text-lg font-bold text-purple-800">
              {formatCurrency(resumo?.ticket_medio || 0)}
            </p>
          </CardContent>
        </Card>

        {/* Tarefas Totais */}
        <Card className="border border-slate-200 bg-slate-50/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-slate-600" />
              <span className="text-xs text-slate-700 font-medium">Total Tarefas</span>
            </div>
            <p className="text-lg font-bold text-slate-800">
              {resumo?.total_tarefas || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Meta do período */}
      {resumo && resumo.meta > 0 && (
        <Card className="border border-slate-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <Target className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="text-xs text-slate-500 whitespace-nowrap">
                Meta: {formatCurrency(resumo.meta)}
              </span>
              <div className="flex-1">
                <Progress value={Math.min(resumo.percentual_meta, 100)} className="h-2" />
              </div>
              <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                {formatCurrency(resumo.total_vendas)}
              </span>
              <Badge
                variant={resumo.percentual_meta >= 100 ? "default" : "secondary"}
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  resumo.percentual_meta >= 100 && "bg-emerald-600 hover:bg-emerald-600"
                )}
              >
                {resumo.percentual_meta}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Gráfico de barras — vendas por período */}
        <Card className="lg:col-span-2 border border-slate-200">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold text-slate-600">
              Vendas por {periodo === "dia" ? "hora" : periodo === "mes" ? "dia" : "mês"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            {resumo && resumo.vendas_por_periodo.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={resumo.vendas_por_periodo} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    interval={periodo === "ano" ? 0 : "preserveStartEnd"}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Valor"]}
                    labelFormatter={(label) => `${periodo === "dia" ? "Hora" : periodo === "mes" ? "Dia" : "Mês"}: ${label}`}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="valor" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[180px] text-slate-400 text-xs">
                Nenhuma venda registrada neste período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de pizza — resultados */}
        <Card className="border border-slate-200">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-semibold text-slate-600">
              Resultados
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0">
            {dadosPizza.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={dadosPizza}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={65}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {dadosPizza.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value} tarefa(s)`]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconSize={8}
                    formatter={(value: string) => (
                      <span className="text-[10px] text-slate-600">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[180px] text-slate-400 text-xs">
                Sem dados de resultado
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}