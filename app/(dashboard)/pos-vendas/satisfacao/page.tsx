"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Star, TrendingUp, Users, ThumbsUp, ThumbsDown, 
  BarChart3, Download, Filter 
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar 
} from "recharts";

// Métricas gerais
const metricas = [
  { titulo: "NPS Score", valor: "72", icon: TrendingUp, cor: "text-green-500", bg: "bg-green-500/10", tendencia: "+3 pontos" },
  { titulo: "CSAT Score", valor: "4.6/5", icon: Star, cor: "text-yellow-500", bg: "bg-yellow-500/10", tendencia: "+0.2" },
  { titulo: "Respostas Recebidas", valor: "847", icon: Users, cor: "text-blue-500", bg: "bg-blue-500/10", tendencia: "+125" },
  { titulo: "Taxa Resposta", valor: "68%", icon: BarChart3, cor: "text-purple-500", bg: "bg-purple-500/10", tendencia: "+5%" },
];

// Distribuição NPS
const distribuicaoNPS = [
  { tipo: "Promotores (9-10)", quantidade: 520, cor: "#22c55e" },
  { tipo: "Neutros (7-8)", quantidade: 215, cor: "#eab308" },
  { tipo: "Detratores (0-6)", quantidade: 112, cor: "#ef4444" },
];

// Evolução NPS mensal
const evolucaoNPS = [
  { mes: "Jul", nps: 65, csat: 4.3 },
  { mes: "Ago", nps: 68, csat: 4.4 },
  { mes: "Set", nps: 66, csat: 4.3 },
  { mes: "Out", nps: 70, csat: 4.5 },
  { mes: "Nov", nps: 69, csat: 4.4 },
  { mes: "Dez", nps: 72, csat: 4.6 },
];

// Últimas avaliações
const avaliacoes = [
  { id: 1, cliente: "Maria Silva", nota: 5, comentario: "Excelente atendimento! Produto chegou rápido.", data: "10/12/2024", tipo: "promotor" },
  { id: 2, cliente: "João Santos", nota: 4, comentario: "Bom produto, mas demorou um pouco para entregar.", data: "10/12/2024", tipo: "neutro" },
  { id: 3, cliente: "Ana Oliveira", nota: 2, comentario: "Produto veio com defeito, estou aguardando troca.", data: "09/12/2024", tipo: "detrator" },
  { id: 4, cliente: "Pedro Costa", nota: 5, comparison: "Comprei pela primeira vez e superou expectativas!", data: "09/12/2024", tipo: "promotor" },
  { id: 5, cliente: "Carlos Lima", nota: 3, comparison: "Produto ok, mas atendimento poderia ser melhor.", data: "08/12/2024", tipo: "neutro" },
];

const tipoConfig = {
  promotor: { label: "Promotor", cor: "bg-green-500/20 text-green-400" },
  neutro: { label: "Neutro", cor: "bg-yellow-500/20 text-yellow-400" },
  detrator: { label: "Detrator", cor: "bg-red-500/20 text-red-400" },
};

const getStars = (nota: number) => {
  return Array.from({ length: 5 }, (_, i) => (
    <Star 
      key={i} 
      className={`w-4 h-4 ${i < nota ? 'fill-yellow-500 text-yellow-500' : 'text-gray-600'}`}
    />
  ));
};

export default function PosVendasSatisfacaoPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Satisfação</h2>
          <p className="text-muted-foreground">Pesquisas e métricas de satisfação do cliente</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar Relatório
          </Button>
          <Button>
            <Filter className="w-4 h-4 mr-2" />
            Filtrar Período
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {metricas.map((metrica, index) => {
          const Icon = metrica.icon;
          return (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{metrica.titulo}</p>
                    <p className="text-2xl font-bold">{metrica.valor}</p>
                    <p className="text-xs text-green-500">{metrica.tendencia}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${metrica.bg}`}>
                    <Icon className={`w-6 h-6 ${metrica.cor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição NPS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição NPS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-8">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={distribuicaoNPS}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="quantidade"
                  >
                    {distribuicaoNPS.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {distribuicaoNPS.map((tipo, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tipo.cor }} />
                    <span className="text-sm">{tipo.tipo}</span>
                    <span className="text-sm text-muted-foreground ml-auto font-medium">{tipo.quantidade}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evolução NPS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolução Mensal - NPS vs CSAT</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={evolucaoNPS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a3a32" />
                <XAxis dataKey="mes" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f3830', border: '1px solid #1a5c4a' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="nps" stroke="#22c55e" strokeWidth={2} name="NPS" />
                <Line type="monotone" dataKey="csat" stroke="#3b82f6" strokeWidth={2} name="CSAT" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Últimas Avaliações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimas Avaliações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {avaliacoes.map((avaliacao) => (
              <div 
                key={avaliacao.id}
                className="p-4 border rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#14919B]/20 flex items-center justify-center">
                      <span className="font-medium text-[#14919B]">{avaliacao.cliente.charAt(0)}</span>
                    </div>
                    <div>
                      <h4 className="font-medium">{avaliacao.cliente}</h4>
                      <div className="flex items-center gap-1">
                        {getStars(avaliacao.nota)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{avaliacao.data}</span>
                    <Badge className={tipoConfig[avaliacao.tipo as keyof typeof tipoConfig].cor}>
                      {tipoConfig[avaliacao.tipo as keyof typeof tipoConfig].label}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground ml-13">{avaliacao.comentario}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}