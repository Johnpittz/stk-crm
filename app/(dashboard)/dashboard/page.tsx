"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Trophy, TrendingUp, MapPin, DollarSign, Store, AlertTriangle,
  Download, Calendar
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from "recharts";
import { cn } from "@/lib/utils";

// Mock data
const evolucaoMensal = [
  { mes: "Mar/24", vendedor: 35, media: 32 },
  { mes: "Abr/24", vendedor: 38, media: 34 },
  { mes: "Mai/24", vendedor: 42, media: 36 },
  { mes: "Jun/24", vendedor: 40, media: 35 },
  { mes: "Jul/24", vendedor: 45, media: 38 },
  { mes: "Ago/24", vendedor: 43, media: 37 },
  { mes: "Set/24", vendedor: 48, media: 39 },
  { mes: "Out/24", vendedor: 50, media: 41 },
  { mes: "Nov/24", vendedor: 47, media: 40 },
  { mes: "Dez/24", vendedor: 55, media: 45 },
  { mes: "Jan/25", vendedor: 52, media: 43 },
  { mes: "Fev/25", vendedor: 58, media: 46 },
];

const rankingVendedores = [
  { posicao: 1, nome: "Ana Silva", canal: "Loja Norte", vendas: 45000, meta: 112 },
  { posicao: 2, nome: "Pedro Santos", canal: "Loja Sul", vendas: 42000, meta: 105 },
  { posicao: 3, nome: "Maria Oliveira", canal: "Online", vendas: 38000, meta: 98 },
  { posicao: 4, nome: "João Costa", canal: "Televendas", vendas: 35000, meta: 92 },
  { posicao: 5, nome: "Carla Mendes", canal: "Loja Centro", vendas: 32000, meta: 85 },
  { posicao: 6, nome: "Lucas Pereira", canal: "Loja Norte", vendas: 29000, meta: 78 },
  { posicao: 7, nome: "Fernanda Lima", canal: "WhatsApp", vendas: 27000, meta: 72 },
  { posicao: 8, nome: "Ricardo Souza", canal: "Online", vendas: 25000, meta: 68 },
];

const vendasPorRegiao = [
  { nome: "São Paulo Capital", valor: 125000, percentual: 35, cor: "#15317B" },
  { nome: "Grande ABC", valor: 78000, percentual: 22, cor: "#3B64CF" },
  { nome: "Guarulhos", valor: 45000, percentual: 13, cor: "#2556B3" },
  { nome: "Osasco", valor: 38000, percentual: 11, cor: "#14B8A6" },
  { nome: "Santo André", valor: 32000, percentual: 9, cor: "#2DD4BF" },
  { nome: "São Bernardo", valor: 28000, percentual: 6, cor: "#5EEAD4" },
  { nome: "Outros", valor: 22000, percentual: 4, cor: "#94A3B8" },
];

const cacPorCanal = [
  { nome: "Loja Física", valor: 45, cor: "#15317B" },
  { nome: "WhatsApp", valor: 32, cor: "#3B64CF" },
  { nome: "Online", valor: 28, cor: "#14B8A6" },
  { nome: "Telefone", valor: 38, cor: "#2556B3" },
];

const ticketMedioPorCanal = [
  { canal: "Loja Norte", ticket: 320, meu: true },
  { canal: "Online", ticket: 410, meu: false },
  { canal: "Televendas", ticket: 195, meu: false },
  { canal: "WhatsApp", ticket: 340, meu: false },
  { canal: "Loja Sul", ticket: 280, meu: false },
];

const churnData = [
  { cliente: "Posto Shell", vendedor: "João Costa", dias: 21, valor: 4500 },
  { cliente: "Loja Central", vendedor: "Ana Silva", dias: 19, valor: 8200 },
  { cliente: "Mercado Silva", vendedor: "Pedro Santos", dias: 15, valor: 3200 },
  { cliente: "Auto Peças Turbo", vendedor: "Maria Oliveira", dias: 12, valor: 1800 },
  { cliente: "Restaurante Bom Sabor", vendedor: "Lucas Pereira", dias: 10, valor: 2600 },
];

const motivosChurn = [
  { valor: "", label: "Selecione..." },
  { valor: "preco", label: "Preço alto" },
  { valor: "concorrente", label: "Concorrente" },
  { valor: "logistica", label: "Problema logística" },
  { valor: "atendimento", label: "Atendimento" },
  { valor: "nao_informado", label: "Não informado" },
];

const taxaPositivacao = {
  percentual: 67.5,
  grupos: { compraram: 8, carteira: 12 },
  individuais: { compraram: 19, carteira: 28 },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState("mes");

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col gap-2">
      
      {/* HEADER */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[160px] h-10">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Esta Semana</SelectItem>
              <SelectItem value="mes">Este Mês</SelectItem>
              <SelectItem value="trimestre">Trimestre</SelectItem>
              <SelectItem value="ano">Este Ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-10 gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* TAXA DE POSITIVAÇÃO - COMPACTA */}
      <Card className="border-l-4 border-l-[#15317B] bg-gradient-to-r from-[#15317B]/5 to-transparent shrink-0">
        <CardContent className="p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#15317B]">{taxaPositivacao.percentual}%</div>
                <div className="text-xs text-slate-500">Taxa de Positivação</div>
              </div>
              <div className="h-10 w-px bg-slate-200" />
              <div className="flex gap-6 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Grupos</span>
                  <span className="font-semibold">{taxaPositivacao.grupos.compraram}/{taxaPositivacao.grupos.carteira}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Individuais</span>
                  <span className="font-semibold">{taxaPositivacao.individuais.compraram}/{taxaPositivacao.individuais.carteira}</span>
                </div>
              </div>
            </div>
            <div className="h-10 w-28">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[{ v: 60 }, { v: 65 }, { v: 67.5 }]}>
                  <Area type="monotone" dataKey="v" stroke="#15317B" fill="#15317B" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LINHA 1: EVOLUÇÃO MENSAL */}
      <Card className="border-0 shadow-sm shrink-0 h-[230px]">
        <CardHeader className="py-2 px-5">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-[#3B64CF]" />
            Evolução Mensal (12 meses) vs Média Comercial
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[190px] px-5 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolucaoMensal} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis 
                dataKey="mes" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748B', fontSize: 12 }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748B', fontSize: 12 }} 
                tickFormatter={(v) => `R$${v}k`} 
              />
              <Tooltip 
                formatter={(v: number) => `R$ ${v}k`} 
                contentStyle={{ fontSize: 14, borderRadius: 8 }} 
              />
              <Line 
                type="monotone" 
                dataKey="vendedor" 
                name="Minhas Vendas" 
                stroke="#15317B" 
                strokeWidth={3} 
                dot={{ fill: "#15317B", strokeWidth: 0, r: 6 }} 
                activeDot={{ r: 8 }} 
              />
              <Line 
                type="monotone" 
                dataKey="media" 
                name="Média Comercial" 
                stroke="#3B64CF" 
                strokeWidth={2} 
                strokeDasharray="5 5" 
                dot={{ fill: "#3B64CF", strokeWidth: 0, r: 5 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* LINHA 2: GRID DE 5 CARDS */}
      <div className="grid grid-cols-5 gap-3 flex-1 min-h-0 overflow-hidden">
        
        {/* RANKING */}
        <Card className="border-0 shadow-sm flex flex-col min-h-0">
          <CardHeader className="py-2 px-3 shrink-0">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-[#15317B]" />
              Ranking
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-1.5 pr-1">
                {rankingVendedores.map((v) => (
                  <div key={v.posicao} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50">
                    <div className={cn(
                      "flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold shrink-0",
                      v.posicao === 1 && "bg-amber-400 text-amber-900",
                      v.posicao === 2 && "bg-slate-300 text-slate-700",
                      v.posicao === 3 && "bg-orange-400 text-orange-900",
                      v.posicao > 3 && "bg-white text-slate-500 border border-slate-200"
                    )}>
                      {v.posicao}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-slate-900 truncate">{v.nome}</p>
                      <p className="text-[9px] text-slate-500">{v.canal}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[11px] font-bold">{formatCurrency(v.vendas)}</p>
                      <Badge className={cn(
                        "text-[8px] px-1 py-0 h-3",
                        v.meta >= 100 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {v.meta}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* REGIÕES - SEM LABELS NO GRÁFICO */}
        <Card className="border-0 shadow-sm flex flex-col min-h-0">
          <CardHeader className="py-2 px-3 shrink-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#15317B]" />
              Regiões
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 flex-1 min-h-0 overflow-hidden flex flex-col">
            {/* Gráfico com tooltip */}
            <div className="h-24 shrink-0 flex justify-center">
              <ResponsiveContainer width={100} height="100%">
                <PieChart>
                  <Tooltip 
                    formatter={(value: number, name: string, props: any) => [`${value}%`, props.payload.nome]}
                    contentStyle={{ fontSize: 12, borderRadius: 6 }}
                  />
                  <Pie 
                    data={vendasPorRegiao} 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={48}
                    dataKey="percentual"
                  >
                    {vendasPorRegiao.map((e, i) => <Cell key={i} fill={e.cor} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legenda completa com scroll */}
            <ScrollArea className="flex-1">
              <div className="space-y-1 pr-1">
                {vendasPorRegiao.map((r) => (
                  <div key={r.nome} className="flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.cor }} />
                      <span className="text-slate-700 truncate max-w-[80px]">{r.nome}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">{formatCurrency(r.valor)}</span>
                      <span className="text-slate-400 ml-1">({r.percentual}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* CAC */}
        <Card className="border-0 shadow-sm flex flex-col min-h-0">
          <CardHeader className="py-2 px-3 shrink-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-[#2556B3]" />
              CAC
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="h-20 shrink-0 flex justify-center">
              <ResponsiveContainer width={80} height="100%">
                <PieChart>
                  <Pie 
                    data={cacPorCanal} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={18}
                    outerRadius={35} 
                    dataKey="valor"
                    paddingAngle={2}
                  >
                    {cacPorCanal.map((e, i) => <Cell key={i} fill={e.cor} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-1 pr-1">
                {cacPorCanal.map((c) => (
                  <div key={c.nome} className="flex justify-between items-center text-[10px] p-1 rounded bg-slate-50">
                    <span className="text-slate-600">{c.nome}</span>
                    <span className="font-semibold">R${c.valor}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* TICKET */}
        <Card className="border-0 shadow-sm flex flex-col min-h-0">
          <CardHeader className="py-2 px-3 shrink-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <Store className="h-4 w-4 text-[#14B8A6]" />
              Ticket Médio
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-1.5 pr-1">
                {ticketMedioPorCanal.map((t) => (
                  <div key={t.canal} className={cn(
                    "flex justify-between items-center p-1.5 rounded-lg text-[11px]",
                    t.meu ? "bg-[#15317B] text-white" : "bg-slate-50"
                  )}>
                    <div className="flex items-center gap-1">
                      <span className={cn("font-medium", t.meu ? "" : "text-slate-700")}>{t.canal}</span>
                      {t.meu && <Badge className="text-[8px] px-1 py-0 h-3 bg-white/20 text-white">eu</Badge>}
                    </div>
                    <span className="font-bold">{formatCurrency(t.ticket)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* CHURN */}
        <Card className="border-0 shadow-sm border-l-4 border-l-red-400 flex flex-col min-h-0">
          <CardHeader className="py-2 px-3 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-4 w-4" />
                Churn
              </CardTitle>
              <Badge variant="destructive" className="text-xs">{churnData.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3 flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-1.5 pr-1">
                {churnData.map((c, i) => (
                  <div key={i} className="p-2 bg-red-50/60 rounded border border-red-100">
                    <div className="flex justify-between items-start mb-1">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-slate-900">{c.cliente}</p>
                        <p className="text-[9px] text-slate-500">{c.vendedor}</p>
                      </div>
                      <Badge variant="secondary" className="bg-red-100 text-red-700 shrink-0 text-[9px]">
                        {c.dias}d
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-medium">{formatCurrency(c.valor)}</span>
                      <select className="text-[9px] border rounded px-1 py-0.5 bg-white w-20">
                        {motivosChurn.map((m) => (
                          <option key={m.valor} value={m.valor}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
