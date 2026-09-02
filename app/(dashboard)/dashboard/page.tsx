"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp, DollarSign, ShoppingCart, Target,
  ArrowRight, Clock, CheckCircle, FileText, Award,
  Calendar
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ─── Colunas do Funil ───
const colunasFunil = [
  { id: "recebeu_conta", titulo: "Recebeu a Conta", cor: "#5b9bd5", icone: "📥" },
  { id: "proposta_feita", titulo: "Proposta a Ser Feita", cor: "#6ba3d6", icone: "📝" },
  { id: "proposta_apresentada", titulo: "Proposta Apresentada", cor: "#7fb8e8", icone: "📋" },
  { id: "apresentacao_realizada", titulo: "Apresentação Realizada", cor: "#8cc5f0", icone: "🎤" },
  { id: "contrato_enviado", titulo: "Contrato Enviado", cor: "#a3d4ff", icone: "📤" },
  { id: "contrato_assinado", titulo: "Contrato Assinado", cor: "#34d399", icone: "✅" },
  { id: "comissao_paga", titulo: "Comissão Paga", cor: "#4ade80", icone: "💰" },
];

interface Tarefa {
  id: string;
  titulo: string;
  coluna_kanban: string;
  valor_venda: number | null;
  created_at: string;
  clientes: { nome_razao_social: string } | null;
}

interface TarefasPorColuna {
  [key: string]: Tarefa[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

export default function DashboardPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("mes");
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

  // ─── Métricas ───
  const tarefasPorColuna: TarefasPorColuna = {};
  colunasFunil.forEach((c) => { tarefasPorColuna[c.id] = []; });
  tarefas.forEach((t) => {
    if (tarefasPorColuna[t.coluna_kanban]) {
      tarefasPorColuna[t.coluna_kanban].push(t);
    }
  });

  const totalTarefas = tarefas.length;
  const totalValor = tarefas.reduce((acc, t) => acc + (t.valor_venda || 0), 0);
  const ticketMedio = totalTarefas > 0 ? totalValor / totalTarefas : 0;

  // Conversão: quantas chegaram na última coluna vs primeira
  const recebidos = tarefasPorColuna["recebeu_conta"]?.length || 0;
  const comissaoPaga = tarefasPorColuna["comissao_paga"]?.length || 0;
  const taxaConversao = recebidos > 0 ? (comissaoPaga / recebidos) * 100 : 0;

  // Dados para o gráfico de barras
  const dadosFunil = colunasFunil.map((c) => ({
    nome: c.titulo.split(" ").slice(0, 2).join(" "),
    nomeCompleto: c.titulo,
    quantidade: tarefasPorColuna[c.id]?.length || 0,
    cor: c.cor,
    icone: c.icone,
  }));

  // Últimas 5 atividades (tarefas mais recentes)
  const ultimasAtividades = [...tarefas]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // Tarefas com mais valor
  const topTarefas = [...tarefas]
    .filter((t) => t.valor_venda && t.valor_venda > 0)
    .sort((a, b) => (b.valor_venda || 0) - (a.valor_venda || 0))
    .slice(0, 5);

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col gap-3 overflow-y-auto pr-1">

      {/* HEADER */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-bold text-white">Dashboard Comercial</h2>
          <p className="text-xs text-slate-400">Visão geral do funil de vendas</p>
        </div>
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-[140px] h-8 text-xs bg-[#14233c] border-[#1c2e4a] text-slate-300">
            <Calendar className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#14233c] border-[#1c2e4a]">
            <SelectItem value="semana">Esta Semana</SelectItem>
            <SelectItem value="mes">Este Mês</SelectItem>
            <SelectItem value="trimestre">Trimestre</SelectItem>
            <SelectItem value="ano">Este Ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* MÉTRICAS PRINCIPAIS */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        <Card className="border-[#1c2e4a] bg-[#0c1426]">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#15317B]/20 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-[#5b9bd5]" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total Vendido</p>
                <p className="text-lg font-bold text-white">{formatCurrency(totalValor)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#1c2e4a] bg-[#0c1426]">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#3B64CF]/20 flex items-center justify-center">
                <Target className="h-5 w-5 text-[#7fb8e8]" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Ticket Médio</p>
                <p className="text-lg font-bold text-white">{formatCurrency(ticketMedio)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#1c2e4a] bg-[#0c1426]">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#2556B3]/20 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-[#a3d4ff]" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Total de Vendas</p>
                <p className="text-lg font-bold text-white">{totalTarefas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#1c2e4a] bg-[#0c1426]">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Award className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Taxa de Conversão</p>
                <p className="text-lg font-bold text-white">{taxaConversao.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* GRÁFICO DO FUNIL + DETALHES */}
      <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">

        {/* GRÁFICO DE BARRAS HORIZONTAL - FUNIL */}
        <Card className="col-span-2 border-[#1c2e4a] bg-[#0c1426] flex flex-col min-h-0">
          <CardHeader className="py-2 px-4 shrink-0">
            <CardTitle className="flex items-center gap-2 text-xs text-slate-300">
              <TrendingUp className="h-3.5 w-3.5 text-[#5b9bd5]" />
              Funil de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 px-4 pb-3">
            {loading ? (
              <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                Carregando...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dadosFunil}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="nome"
                    width={100}
                    tick={{ fill: "#94a3b8", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => [
                      `${value} oportunidade${value !== 1 ? "s" : ""}`,
                      props.payload.nomeCompleto,
                    ]}
                    contentStyle={{
                      backgroundColor: "#14233c",
                      border: "1px solid #1c2e4a",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "#e2e8f0",
                    }}
                  />
                  <Bar dataKey="quantidade" radius={[0, 6, 6, 0]} barSize={24}>
                    {dadosFunil.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* DETALHAMENTO POR COLUNA */}
        <Card className="border-[#1c2e4a] bg-[#0c1426] flex flex-col min-h-0">
          <CardHeader className="py-2 px-4 shrink-0">
            <CardTitle className="flex items-center gap-2 text-xs text-slate-300">
              <FileText className="h-3.5 w-3.5 text-[#7fb8e8]" />
              Detalhamento por Etapa
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 px-4 pb-3">
            <ScrollArea className="h-full">
              <div className="space-y-2 pr-2">
                {colunasFunil.map((coluna) => {
                  const qtd = tarefasPorColuna[coluna.id]?.length || 0;
                  const percent = totalTarefas > 0 ? (qtd / totalTarefas) * 100 : 0;

                  return (
                    <div
                      key={coluna.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-[#14233c] border border-[#1c2e4a]"
                    >
                      <span className="text-sm">{coluna.icone}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-slate-300 truncate">
                          {coluna.titulo}
                        </p>
                        {/* Barra de progresso */}
                        <div className="h-1.5 bg-[#0c1426] rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${percent}%`,
                              backgroundColor: coluna.cor,
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-white">{qtd}</p>
                        <p className="text-[9px] text-slate-500">
                          {formatPercent(qtd, totalTarefas)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* ÚLTIMAS ATIVIDADES + TOP OPORTUNIDADES */}
      <div className="grid grid-cols-2 gap-3 shrink-0">

        {/* ÚLTIMAS ATIVIDADES */}
        <Card className="border-[#1c2e4a] bg-[#0c1426]">
          <CardHeader className="py-2 px-4 shrink-0">
            <CardTitle className="flex items-center gap-2 text-xs text-slate-300">
              <Clock className="h-3.5 w-3.5 text-[#a3d4ff]" />
              Últimas Atividades
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {ultimasAtividades.length === 0 ? (
              <div className="text-center py-4 text-slate-500 text-xs">
                Nenhuma atividade registrada
              </div>
            ) : (
              <div className="space-y-1.5">
                {ultimasAtividades.map((t) => {
                  const coluna = colunasFunil.find((c) => c.id === t.coluna_kanban);
                  return (
                    <div key={t.id} className="flex items-center gap-2 p-1.5 rounded bg-[#14233c]">
                      <span className="text-xs">{coluna?.icone || "📋"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-slate-300 truncate">{t.titulo}</p>
                        <p className="text-[9px] text-slate-500 truncate">
                          {t.clientes?.nome_razao_social || "Sem cliente"}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className="text-[8px] px-1 py-0 h-3 border-0"
                        style={{
                          backgroundColor: `${coluna?.cor}20`,
                          color: coluna?.cor,
                        }}
                      >
                        {coluna?.titulo.split(" ").slice(0, 2).join(" ")}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* TOP OPORTUNIDADES */}
        <Card className="border-[#1c2e4a] bg-[#0c1426]">
          <CardHeader className="py-2 px-4 shrink-0">
            <CardTitle className="flex items-center gap-2 text-xs text-slate-300">
              <Award className="h-3.5 w-3.5 text-emerald-400" />
              Top Oportunidades
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {topTarefas.length === 0 ? (
              <div className="text-center py-4 text-slate-500 text-xs">
                Nenhuma oportunidade com valor
              </div>
            ) : (
              <div className="space-y-1.5">
                {topTarefas.map((t, i) => {
                  const coluna = colunasFunil.find((c) => c.id === t.coluna_kanban);
                  return (
                    <div key={t.id} className="flex items-center gap-2 p-1.5 rounded bg-[#14233c]">
                      <div className={cn(
                        "h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                        i === 0 && "bg-amber-400/20 text-amber-400",
                        i === 1 && "bg-slate-400/20 text-slate-400",
                        i === 2 && "bg-orange-400/20 text-orange-400",
                        i > 2 && "bg-[#0c1426] text-slate-500"
                      )}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-slate-300 truncate">{t.titulo}</p>
                        <p className="text-[9px] text-slate-500 truncate">
                          {t.clientes?.nome_razao_social || "Sem cliente"}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-emerald-400 shrink-0">
                        {formatCurrency(t.valor_venda || 0)}
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
