"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Trophy,
  Activity,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ─── Funil (mesmas colunas do Kanban) ───
const colunas = [
  { id: "recebeu_conta", titulo: "Recebeu a Conta", cor: "#5b9bd5", corDark: "#1e3a5f", icone: "📥" },
  { id: "proposta_feita", titulo: "Proposta a Ser Feita", cor: "#6ba3d6", corDark: "#1e4d7a", icone: "📝" },
  { id: "proposta_apresentada", titulo: "Proposta Apresentada", cor: "#7fb8e8", corDark: "#15317B", icone: "📋" },
  { id: "apresentacao_realizada", titulo: "Apresentação Realizada", cor: "#8cc5f0", corDark: "#2556B3", icone: "🎤" },
  { id: "contrato_enviado", titulo: "Contrato Enviado", cor: "#a3d4ff", corDark: "#3B64CF", icone: "📤" },
  { id: "contrato_assinado", titulo: "Contrato Assinado", cor: "#34d399", corDark: "#065f46", icone: "✅" },
  { id: "comissao_paga", titulo: "Comissão Paga", cor: "#4ade80", corDark: "#166534", icone: "💰" },
];

const meses = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

interface Tarefa {
  id: string;
  titulo: string;
  status: string;
  coluna_kanban: string;
  valor_venda: number | null;
  origem_lead: string | null;
  created_at: string;
}

interface DashboardStatsProps {
  refreshTrigger?: number;
}

export function DashboardStats({ refreshTrigger = 0 }: DashboardStatsProps) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [periodo, setPeriodo] = useState<"dia" | "mes" | "ano">("mes");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchTarefas = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/tarefas", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const data = await res.json();
      if (res.ok) {
        setTarefas(data.tarefas || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTarefas();
  }, [fetchTarefas]);

  useEffect(() => {
    if (refreshTrigger) fetchTarefas();
  }, [refreshTrigger, fetchTarefas]);

  // ─── Filtragem por período ───
  const agora = new Date();
  const filtrarPeriodo = (t: Tarefa) => {
    const dt = new Date(t.created_at);
    if (periodo === "dia") {
      return dt.toDateString() === agora.toDateString();
    }
    if (periodo === "mes") {
      return (
        dt.getMonth() === agora.getMonth() &&
        dt.getFullYear() === agora.getFullYear()
      );
    }
    return dt.getFullYear() === agora.getFullYear();
  };

  const tarefasFiltradas = tarefas.filter(filtrarPeriodo);

  // ─── Métricas ───
  const totalVendido = tarefasFiltradas.reduce(
    (acc, t) => acc + (t.valor_venda || 0),
    0
  );
  const totalVendas = tarefasFiltradas.length;
  const ticketMedio = totalVendas > 0 ? totalVendido / totalVendas : 0;

  const comissaoPaga = tarefasFiltradas.filter(
    (t) => t.coluna_kanban === "comissao_paga"
  ).length;
  const taxaConversao =
    totalVendas > 0 ? ((comissaoPaga / totalVendas) * 100).toFixed(1) : "0.0";

  // ─── Contagem por coluna ───
  const contagemPorColuna = colunas.map((col) => ({
    ...col,
    total: tarefasFiltradas.filter((t) => t.coluna_kanban === col.id).length,
  }));

  const maximoColuna = Math.max(...contagemPorColuna.map((c) => c.total), 1);

  // ─── Últimas atividades ───
  const ultimasAtividades = [...tarefasFiltradas]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 5);

  // ─── Top oportunidades ───
  const topOportunidades = [...tarefasFiltradas]
    .filter((t) => t.valor_venda && t.valor_venda > 0)
    .sort((a, b) => (b.valor_venda || 0) - (a.valor_venda || 0))
    .slice(0, 5);

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatarData = (data: string) => {
    const dt = new Date(data);
    return `${dt.getDate().toString().padStart(2, "0")}/${(dt.getMonth() + 1).toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      {/* ─── Topo: Métricas ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Vendido */}
        <Card className="border-[#1c2e4a] bg-[#14233c]">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                <DollarSign className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                  Total Vendido
                </p>
                <p className="text-lg font-bold text-white">
                  {formatarMoeda(totalVendido)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ticket Médio */}
        <Card className="border-[#1c2e4a] bg-[#14233c]">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                  Ticket Médio
                </p>
                <p className="text-lg font-bold text-white">
                  {formatarMoeda(ticketMedio)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total de Vendas */}
        <Card className="border-[#1c2e4a] bg-[#14233c]">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                <ShoppingCart className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                  Total de Vendas
                </p>
                <p className="text-lg font-bold text-white">{totalVendas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Conversão */}
        <Card className="border-[#1c2e4a] bg-[#14233c]">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                <Trophy className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                  Taxa de Conversão
                </p>
                <p className="text-lg font-bold text-white">{taxaConversao}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Meio: Funil Visual + Detalhamento ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Funil Visual - 3 colunas */}
        <Card className="lg:col-span-3 border-[#1c2e4a] bg-[#14233c]">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              📊 Funil de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-2.5">
              {contagemPorColuna.map((col, index) => {
                const porcentagem = maximoColuna > 0 ? (col.total / maximoColuna) * 100 : 0;
                const podeVisualizar = porcentagem > 0;

                return (
                  <div key={col.id} className="group">
                    <div className="flex items-center gap-3">
                      {/* Ícone */}
                      <span className="text-base w-6 text-center shrink-0">
                        {col.icone}
                      </span>

                      {/* Nome */}
                      <span className="text-xs font-medium text-slate-300 w-[140px] shrink-0 truncate">
                        {col.titulo}
                      </span>

                      {/* Barra */}
                      <div className="flex-1 h-7 bg-[#0c1426] rounded-md overflow-hidden relative">
                        <div
                          className="h-full rounded-md transition-all duration-500 flex items-center justify-end pr-2"
                          style={{
                            width: `${Math.max(porcentagem, 4)}%`,
                            backgroundColor: col.cor,
                            opacity: 0.85,
                          }}
                        >
                          {podeVisualizar && (
                            <span className="text-[10px] font-bold text-white drop-shadow-md">
                              {col.total}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Valor à direita */}
                      <span className="text-xs font-bold text-slate-300 w-8 text-right shrink-0">
                        {col.total}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Indicador de conversão entre etapas */}
            {totalVendas > 0 && (
              <div className="mt-4 pt-3 border-t border-[#1c2e4a]">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Conversão do funil:</span>
                  <span className="font-semibold text-emerald-400">
                    {contagemPorColuna[0].total > 0
                      ? ((comissaoPaga / contagemPorColuna[0].total) * 100).toFixed(1)
                      : "0.0"}
                    % (topo → comissão paga)
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detalhamento por Etapa - 2 colunas */}
        <Card className="lg:col-span-2 border-[#1c2e4a] bg-[#14233c]">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              📋 Detalhamento por Etapa
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-3">
              {contagemPorColuna.map((col) => {
                const porcentagem =
                  totalVendas > 0
                    ? ((col.total / totalVendas) * 100).toFixed(1)
                    : "0.0";

                return (
                  <div
                    key={col.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-[#0c1426]/50 border border-[#1c2e4a] hover:border-[#3B64CF]/30 transition-colors"
                  >
                    {/* Ícone */}
                    <span className="text-lg w-7 text-center shrink-0">
                      {col.icone}
                    </span>

                    {/* Nome + Barra */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-300 truncate">
                          {col.titulo}
                        </span>
                        <span className="text-xs font-bold text-white ml-2">
                          {col.total}
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#1c2e4a] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(parseFloat(porcentagem), 2)}%`,
                            backgroundColor: col.cor,
                          }}
                        />
                      </div>
                    </div>

                    {/* Percentual */}
                    <span className="text-[10px] font-bold text-slate-400 w-10 text-right shrink-0">
                      {porcentagem}%
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Baixo: Atividades + Top Oportunidades ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Últimas Atividades */}
        <Card className="border-[#1c2e4a] bg-[#14233c]">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#3B64CF]" />
              Últimas Atividades
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {ultimasAtividades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <Activity className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Nenhuma atividade registrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ultimasAtividades.map((t) => {
                  const coluna = colunas.find(
                    (c) => c.id === t.coluna_kanban
                  );
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-[#0c1426]/50 border border-[#1c2e4a]"
                    >
                      <span className="text-base shrink-0">
                        {coluna?.icone || "📋"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">
                          {t.titulo}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {coluna?.titulo || t.coluna_kanban}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {formatarData(t.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Oportunidades */}
        <Card className="border-[#1c2e4a] bg-[#14233c]">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400" />
              Top Oportunidades
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {topOportunidades.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <Star className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">Nenhuma oportunidade com valor</p>
              </div>
            ) : (
              <div className="space-y-2">
                {topOportunidades.map((t, i) => {
                  const coluna = colunas.find(
                    (c) => c.id === t.coluna_kanban
                  );
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg bg-[#0c1426]/50 border border-[#1c2e4a]"
                    >
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{
                          backgroundColor: `${coluna?.cor || "#3B64CF"}20`,
                          color: coluna?.cor || "#3B64CF",
                        }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">
                          {t.titulo}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {coluna?.icone} {coluna?.titulo}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-emerald-400 shrink-0">
                        {formatarMoeda(t.valor_venda || 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
