"use client";

import { Trophy, Target, Gift, Calendar, Users, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils/cn";

// Mock de campanhas
const campanhasAtivas = [
  {
    id: 1,
    titulo: "Meta do Mês - Viagem para Cancun",
    descricao: "Venda R$ 100.000 em março e ganhe uma viagem com acompanhante!",
    imagem: "🏝️",
    tipo: "volume",
    progresso: 82,
    valorAtual: 82000,
    valorMeta: 100000,
    ranking: 3,
    dataFim: "31/03/2026",
    participantes: 24,
    premiacao: "Viagem internacional",
  },
  {
    id: 2,
    titulo: "Desafio Semanal - Novos Clientes",
    descricao: "Cadastre 5 novos clientes esta semana e ganhe bônus de R$ 500",
    imagem: "🎯",
    tipo: "novos_clientes",
    progresso: 60,
    atual: 3,
    meta: 5,
    dataFim: "08/03/2026",
    participantes: 18,
    premiacao: "R$ 500,00",
  },
  {
    id: 3,
    titulo: "Recuperação de Churn",
    descricao: "Recupere 3 clientes inativos e ganhe um day off",
    imagem: "🔄",
    tipo: "recuperacao",
    progresso: 33,
    atual: 1,
    meta: 3,
    dataFim: "15/03/2026",
    participantes: 12,
    premiacao: "Day off",
  },
];

const rankingGeral = [
  { posicao: 1, nome: "Ana Silva", vendas: 82000, avatar: "AS" },
  { posicao: 2, nome: "Pedro Santos", vendas: 78000, avatar: "PS" },
  { posicao: 3, nome: "Maria Oliveira", vendas: 72000, avatar: "MO" },
  { posicao: 4, nome: "João Costa", vendas: 65000, avatar: "JC" },
  { posicao: 5, nome: "Carla Mendes", vendas: 58000, avatar: "CM" },
];

const conquistas = [
  { id: 1, titulo: "Primeira Venda", descricao: "Realizou sua primeira venda", icone: "🎯", data: "15/01/2026" },
  { id: 2, titulo: "Meta do Mês", descricao: "Atingiu 100% da meta em fevereiro", icone: "🏆", data: "28/02/2026" },
  { id: 3, titulo: "Top 3", descricao: "Entrou no top 3 do ranking", icone: "🥉", data: "10/02/2026" },
];

export default function CampanhasPage() {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <Tabs defaultValue="ativas" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="ativas">Campanhas Ativas</TabsTrigger>
          <TabsTrigger value="ranking">Ranking</TabsTrigger>
          <TabsTrigger value="conquistas">Minhas Conquistas</TabsTrigger>
        </TabsList>

        {/* Campanhas Ativas */}
        <TabsContent value="ativas" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campanhasAtivas.map((campanha) => (
              <Card key={campanha.id} className="overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500" />
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{campanha.imagem}</div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{campanha.titulo}</CardTitle>
                      <CardDescription className="mt-1">
                        {campanha.descricao}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progresso */}
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-slate-600">Progresso</span>
                      <span className="font-bold text-slate-900">{campanha.progresso}%</span>
                    </div>
                    <Progress value={campanha.progresso} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                      <span>
                        {campanha.valorAtual
                          ? formatCurrency(campanha.valorAtual)
                          : `${campanha.atual} concluído`}
                      </span>
                      <span>
                        {campanha.valorMeta
                          ? `Meta: ${formatCurrency(campanha.valorMeta)}`
                          : `Meta: ${campanha.meta}`}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="h-4 w-4" />
                      <span>Até {campanha.dataFim}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Users className="h-4 w-4" />
                      <span>{campanha.participantes} participantes</span>
                    </div>
                  </div>

                  {/* Premiação */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800">
                        Premiação: {campanha.premiacao}
                      </span>
                    </div>
                  </div>

                  {campanha.ranking && (
                    <div className="flex items-center justify-between">
                      <Badge className="bg-blue-100 text-blue-700">
                        <Trophy className="h-3 w-3 mr-1" />
                        {campanha.ranking}º lugar
                      </Badge>
                      <Button size="sm" variant="outline">
                        Ver Detalhes
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Ranking */}
        <TabsContent value="ranking">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Ranking Geral - Março/2026
              </CardTitle>
              <CardDescription>
                Top vendedores do mês atual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rankingGeral.map((vendedor, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg border",
                      index === 0 && "bg-amber-50 border-amber-200",
                      index === 1 && "bg-slate-50 border-slate-200",
                      index === 2 && "bg-orange-50 border-orange-200",
                      index > 2 && "bg-white border-slate-200"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full font-bold",
                      index === 0 && "bg-amber-500 text-white",
                      index === 1 && "bg-slate-400 text-white",
                      index === 2 && "bg-orange-400 text-white",
                      index > 2 && "bg-slate-200 text-slate-700"
                    )}>
                      {index + 1}
                    </div>
                    
                    <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-slate-700">
                      {vendedor.avatar}
                    </div>

                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{vendedor.nome}</p>
                      <p className="text-sm text-slate-500">Vendedor</p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-slate-900">
                        {formatCurrency(vendedor.vendas)}
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round((vendedor.vendas / 100000) * 100)}% da meta
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conquistas */}
        <TabsContent value="conquistas">
          <Card>
            <CardHeader>
              <CardTitle>Minhas Conquistas</CardTitle>
              <CardDescription>
                Badges e reconhecimentos obtidos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {conquistas.map((conquista) => (
                  <div
                    key={conquista.id}
                    className="p-6 rounded-lg border bg-gradient-to-br from-slate-50 to-white text-center"
                  >
                    <div className="text-5xl mb-4">{conquista.icone}</div>
                    <h3 className="font-semibold text-slate-900 mb-1">
                      {conquista.titulo}
                    </h3>
                    <p className="text-sm text-slate-500 mb-3">
                      {conquista.descricao}
                    </p>
                    <p className="text-xs text-slate-400">
                      Conquistado em {conquista.data}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
