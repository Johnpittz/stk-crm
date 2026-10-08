"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Trophy,
  Activity,
  Star,
  Users,
  ArrowDown,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarDuracao } from "@/lib/dashboard/formatar";
import { createClient } from "@/lib/supabase/client";

// ─── Colunas do Funil ───
const colunas = [
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
}

type LinhaRanking = { id: string; nome: string; media: number; n: number; pior: number };

type LinhaProduto = {
  nome: string;
  media: number;
  n: number;
  oportunidades: number;
  vendas: number;
  valor_venda: number;
};

type TempoResposta = {
  geral: { media: number; n: number };
  hoje: { media: number; n: number };
  porVendedor: LinhaRanking[];
  porTime: LinhaRanking[];
  porProduto: LinhaProduto[];
  janela: string;
  periodo_dias: number;
};

export default function DashboardPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [tempoResposta, setTempoResposta] = useState<TempoResposta | null>(null);
  const [dias, setDias] = useState(30);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchTarefas = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/tarefas", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (res.ok) setTarefas(data.tarefas || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTarefas();
  }, [fetchTarefas]);

  // Fase 1+2: tempo de 1ª resposta + rankings (filtro de período)
  const fetchTempo = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/tempo-resposta?dias=${dias}`);
      if (res.ok) setTempoResposta(await res.json());
    } catch (err) {
      console.error(err);
    }
  }, [dias]);

  useEffect(() => {
    fetchTempo();
  }, [fetchTempo]);

  // ─── Métricas ───
  const totalVendas = tarefas.filter((t) => t.coluna_kanban === "comissao_paga").length;
  const valorTotal = tarefas
    .filter((t) => t.coluna_kanban === "comissao_paga")
    .reduce((s, t) => s + (t.valor_venda || 0), 0);
  const ticketMedio = totalVendas > 0 ? valorTotal / totalVendas : 0;
  const totalOportunidades = tarefas.length;
  const taxaConversao =
    totalOportunidades > 0
      ? ((totalVendas / totalOportunidades) * 100).toFixed(1)
      : "0.0";

  // ─── Contagem por coluna ───
  const contagemPorColuna = colunas.map((c) => ({
    ...c,
    total: tarefas.filter((t) => t.coluna_kanban === c.id).length,
  }));

  // ─── Valor por coluna (Pipeline) ───
  const valorPorColuna = colunas.map((c) => ({
    ...c,
    valor: tarefas
      .filter((t) => t.coluna_kanban === c.id)
      .reduce((s, t) => s + (t.valor_venda || 0), 0),
    total: tarefas.filter((t) => t.coluna_kanban === c.id).length,
  }));

  const maxValorPipeline = Math.max(...valorPorColuna.map((c) => c.valor), 1);

  // ─── Conversão geral ───
  const totalTopo = tarefas.filter(
    (t) => t.coluna_kanban === "recebeu_conta"
  ).length;
  const totalFundo = tarefas.filter(
    (t) => t.coluna_kanban === "comissao_paga"
  ).length;
  const conversaoGeral =
    totalTopo > 0 ? ((totalFundo / totalTopo) * 100).toFixed(1) : "0.0";

  // ─── Últimas atividades ───
  const ultimasAtividades = [...tarefas]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // ─── Top oportunidades ───
  const topOportunidades = [...tarefas]
    .filter((t) => t.valor_venda && t.valor_venda > 0)
    .sort((a, b) => (b.valor_venda || 0) - (a.valor_venda || 0))
    .slice(0, 5);

  // ─── Formatadores ───
  const formatarMoeda = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatarData = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  };

  // ─── Larguras do funil (baseado na contagem) ───
  const funnelWidths = contagemPorColuna.map(
    (_, i) => 100 - i * 5
  );

  // ─── Conversão entre etapas ───
  const conversaoEtapas = colunas.slice(0, -1).map((c, i) => {
    const deTotal = contagemPorColuna[i].total;
    const paraTotal = contagemPorColuna[i + 1].total;
    const taxa =
      deTotal > 0 ? ((paraTotal / deTotal) * 100).toFixed(0) : null;
    return { de: c, para: colunas[i + 1], deTotal, paraTotal, taxa };
  });

  // ─── Valor total no pipeline ───
  const valorPipelineTotal = tarefas.reduce(
    (s, t) => s + (t.valor_venda || 0),
    0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Carregando dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      {/* ─── Topo: 4 Métricas ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Vendido */}
        <Card className="border-[#1c2e4a] bg-[#14233c]">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#15317B]/20 flex items-center justify-center shrink-0">
                <DollarSign className="h-5 w-5 text-[#3B64CF]" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                  Total Vendido
                </p>
                <p className="text-lg font-bold text-white">{formatarMoeda(valorTotal)}</p>
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
                <p className="text-lg font-bold text-white">{formatarMoeda(ticketMedio)}</p>
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

      {/* ─── Tempo de Resposta (Fase 1 — ver docs/plano-dashboard-fases.md) ─── */}
      <Card className="border-[#1c2e4a] bg-[#14233c]">
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-cyan-500/15 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                  Tempo médio para responder
                </p>
                <p className="text-lg font-bold text-white">
                  {tempoResposta ? formatarDuracao(tempoResposta.geral.media) : "…"}
                  <span className="text-sm font-medium text-slate-400">
                    {" "}
                    · média de {tempoResposta ? tempoResposta.geral.n : 0}{" "}
                    {tempoResposta && tempoResposta.geral.n === 1
                      ? "resposta"
                      : "respostas"}{" "}
                    nos últimos {tempoResposta ? tempoResposta.periodo_dias : 30} dias
                  </span>
                </p>
                <p className="text-[11px] text-slate-500">
                  {tempoResposta
                    ? `Da mensagem do cliente até a 1ª resposta · ${tempoResposta.janela} · hoje: ${
                        tempoResposta.hoje.n > 0
                          ? formatarDuracao(tempoResposta.hoje.media)
                          : "sem respostas"
                      }`
                    : "carregando…"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-slate-500">Período:</span>
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDias(d)}
                  className={cn(
                    "px-2 py-1 text-[11px] rounded-md border",
                    dias === d
                      ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                      : "bg-[#0c1426] border-[#1c2e4a] text-slate-400 hover:text-slate-200",
                  )}
                >
                  {d} dias
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Fase 2: dimensões VENDEDOR e TIME ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-[#1c2e4a] bg-[#14233c]">
          <CardContent className="p-3">
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-2">
              Quem demora mais para responder — vendedor
            </p>
            <p className="text-[11px] text-slate-500 mb-2">
              Média da 1ª resposta no período (horário comercial).{" "}
              <span className="text-slate-600">Do mais lento ao mais rápido.</span>
            </p>
            {tempoResposta && tempoResposta.porVendedor.length > 0 ? (
              <ul className="space-y-1">
                {tempoResposta.porVendedor.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between text-sm border-b border-[#1c2e4a] pb-1 last:border-0"
                  >
                    <span className="text-slate-200">{v.nome}</span>
                    <span className="text-slate-400">
                      <b className="text-white">{formatarDuracao(v.media)}</b> ·{" "}
                      {v.n} {v.n === 1 ? "resposta" : "respostas"} · pior caso{" "}
                      {formatarDuracao(v.pior)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                {tempoResposta ? "Sem respostas no período." : "carregando…"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#1c2e4a] bg-[#14233c]">
          <CardContent className="p-3">
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-2">
              Quem demora mais para responder — time
            </p>
            <p className="text-[11px] text-slate-500 mb-2">
              Média da 1ª resposta no período (horário comercial).{" "}
              <span className="text-slate-600">Do mais lento ao mais rápido.</span>
            </p>
            {tempoResposta && tempoResposta.porTime.length > 0 ? (
              <ul className="space-y-1">
                {tempoResposta.porTime.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between text-sm border-b border-[#1c2e4a] pb-1 last:border-0"
                  >
                    <span className="text-slate-200">{t.nome}</span>
                    <span className="text-slate-400">
                      <b className="text-white">{formatarDuracao(t.media)}</b> ·{" "}
                      {t.n} {t.n === 1 ? "resposta" : "respostas"} · pior caso{" "}
                      {formatarDuracao(t.pior)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                {tempoResposta ? "Sem respostas no período." : "carregando…"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Fase 3: dimensão PRODUTO ─── */}
      <Card className="border-[#1c2e4a] bg-[#14233c]">
        <CardContent className="p-3">
          <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider mb-2">
            Qual produto responde e vende melhor
          </p>
          <p className="text-[11px] text-slate-500 mb-2">
            Tempo = 1ª resposta do cliente no período (horário comercial) ·
            comercial = oportunidades com produto vinculado.
          </p>
          {tempoResposta && (tempoResposta.porProduto?.length ?? 0) > 0 ? (
            <ul className="space-y-1">
              {tempoResposta.porProduto.map((p) => (
                <li
                  key={p.nome}
                  className="flex items-center justify-between text-sm border-b border-[#1c2e4a] pb-1 last:border-0"
                >
                  <span className="text-slate-200">{p.nome}</span>
                  <span className="text-slate-400">
                    <b className="text-white">
                      {p.n > 0 ? formatarDuracao(p.media) : "sem resposta"}
                    </b>{" "}
                    · {p.n} {p.n === 1 ? "resposta" : "respostas"} ·{" "}
                    {p.oportunidades} {p.oportunidades === 1 ? "oportunidade" : "oportunidades"} ·{" "}
                    <span className="text-emerald-400">
                      {p.vendas} venda{p.vendas === 1 ? "" : "s"} (R${" "}
                      {p.valor_venda.toLocaleString("pt-BR")})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">
              {tempoResposta
                ? "Nenhuma oportunidade com produto vinculado no período."
                : "carregando…"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Meio: Funil Visual + Pipeline por Estágio ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Funil Visual - 55% */}
        <Card className="lg:col-span-7 border-[#1c2e4a] bg-[#14233c]">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              📊 Funil de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex flex-col items-center gap-1.5">
              {contagemPorColuna.map((col, index) => {
                const widthPercent = funnelWidths[index];
                const porcentagemTotal =
                  totalOportunidades > 0
                    ? ((col.total / totalOportunidades) * 100).toFixed(1)
                    : "0.0";
                const hasData = col.total > 0;

                return (
                  <div
                    key={col.id}
                    className="relative w-full flex justify-center"
                  >
                    <div
                      className="relative h-11 rounded-lg flex items-center transition-all duration-500 shadow-md"
                      style={{
                        width: `${widthPercent}%`,
                        backgroundColor: hasData ? col.cor : `${col.cor}25`,
                        boxShadow: hasData
                          ? `0 2px 8px ${col.cor}30`
                          : "none",
                      }}
                    >
                      <div className="flex items-center gap-2 pl-3 min-w-0">
                        <span className="text-base shrink-0">{col.icone}</span>
                        <span
                          className={cn(
                            "text-xs font-medium truncate",
                            hasData ? "text-white" : "text-slate-400"
                          )}
                        >
                          {col.titulo}
                        </span>
                      </div>

                      <div className="absolute left-1/2 -translate-x-1/2">
                        <span
                          className={cn(
                            "text-sm font-bold",
                            hasData ? "text-white" : "text-slate-500"
                          )}
                        >
                          {col.total}
                        </span>
                      </div>

                      <div className="absolute right-3">
                        <span
                          className={cn(
                            "text-[11px] font-semibold",
                            hasData ? "text-white/80" : "text-slate-600"
                          )}
                        >
                          {porcentagemTotal}%
                        </span>
                      </div>
                    </div>

                    {index < contagemPorColuna.length - 1 && (
                      <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10">
                        <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-[#1c2e4a]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {totalOportunidades > 0 && (
              <div className="mt-5 pt-3 border-t border-[#1c2e4a]">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Conversão geral do funil:</span>
                  <span className="font-semibold text-emerald-400">
                    {conversaoGeral}% (topo → comissão paga)
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline por Estágio - 45% */}
        <Card className="lg:col-span-5 border-[#1c2e4a] bg-[#14233c]">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-white flex items-center gap-2">
              💎 Pipeline por Estágio
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {/* Valor total do pipeline */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0c1426] border border-[#1c2e4a] mb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-[#3B64CF]" />
                <span className="text-xs text-slate-400">Valor Total</span>
              </div>
              <span className="text-sm font-bold text-white">
                {formatarMoeda(valorPipelineTotal)}
              </span>
            </div>

            {/* Barras de valor por estágio */}
            <div className="space-y-2.5">
              {valorPorColuna.map((col) => {
                const largura = col.valor > 0
                  ? Math.max((col.valor / maxValorPipeline) * 100, 8)
                  : 0;
                const hasValue = col.valor > 0;

                return (
                  <div key={col.id} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{col.icone}</span>
                        <span className="text-[11px] font-medium text-slate-300">
                          {col.titulo}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">
                          {col.total} {col.total === 1 ? "oportunidade" : "oportunidades"}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-bold",
                            hasValue ? "text-white" : "text-slate-600"
                          )}
                        >
                          {formatarMoeda(col.valor)}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[#0c1426] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${largura}%`,
                          backgroundColor: col.cor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Baixo: Últimas Atividades + Top Oportunidades ─── */}
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
                  const coluna = colunas.find((c) => c.id === t.coluna_kanban);
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
                  const coluna = colunas.find((c) => c.id === t.coluna_kanban);
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
