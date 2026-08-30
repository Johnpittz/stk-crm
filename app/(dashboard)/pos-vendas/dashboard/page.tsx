"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Headphones, Clock, CheckCircle, AlertTriangle, 
  TrendingUp, Users, MessageSquare, Star 
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar 
} from "recharts";

// Métricas gerais
const metricas = [
  { titulo: "Chamados Abertos", valor: "23", icon: MessageSquare, cor: "text-yellow-500", bg: "bg-yellow-500/10", tendencia: "+5" },
  { titulo: "Resolvidos Hoje", valor: "18", icon: CheckCircle, cor: "text-green-500", bg: "bg-green-500/10", tendencia: "+12" },
  { titulo: "Tempo Médio Resposta", valor: "2.3h", icon: Clock, cor: "text-blue-500", bg: "bg-blue-500/10", tendencia: "-0.5h" },
  { titulo: "NPS Score", valor: "72", icon: Star, cor: "text-purple-500", bg: "bg-purple-500/10", tendencia: "+3" },
];

// Chamados por status
const chamadosPorStatus = [
  { status: "Aberto", quantidade: 23, cor: "#eab308" },
  { status: "Em Andamento", quantidade: 12, cor: "#3b82f6" },
  { status: "Aguardando", quantidade: 8, cor: "#f97316" },
  { status: "Resolvido", quantidade: 156, cor: "#22c55e" },
];

// Chamados por tipo
const chamadosPorTipo = [
  { tipo: "Técnico", quantidade: 45 },
  { tipo: "Financeiro", quantidade: 28 },
  { tipo: "Dúvida", quantidade: 62 },
  { tipo: "Reclamação", quantidade: 18 },
  { tipo: "Sugestão", quantidade: 12 },
];

// Evolução semanal
const evolucaoSemanal = [
  { dia: "Seg", abertos: 12, resolvidos: 15 },
  { dia: "Ter", abertos: 18, resolvidos: 14 },
  { dia: "Qua", abertos: 15, resolvidos: 18 },
  { dia: "Qui", abertos: 22, resolvidos: 20 },
  { dia: "Sex", abertos: 8, resolvidos: 12 },
];

// Últimos chamados
const ultimosChamados = [
  { id: 1, cliente: "Maria Silva", assunto: "Produto com defeito", status: "aberto", prioridade: "alta", data: "10/12/2024 14:30" },
  { id: 2, cliente: "João Santos", assunto: "Dúvida sobre garantia", status: "em_andamento", prioridade: "media", data: "10/12/2024 13:15" },
  { id: 3, cliente: "Ana Oliveira", assunto: "Nota fiscal errada", status: "aguardando", prioridade: "alta", data: "10/12/2024 11:45" },
  { id: 4, cliente: "Pedro Costa", assunto: "Acompanhar entrega", status: "resolvido", prioridade: "baixa", data: "10/12/2024 10:20" },
];

const statusConfig = {
  aberto: { label: "Aberto", cor: "bg-yellow-500/20 text-yellow-400" },
  em_andamento: { label: "Em Andamento", cor: "bg-blue-500/20 text-blue-400" },
  aguardando: { label: "Aguardando", cor: "bg-orange-500/20 text-orange-400" },
  resolvido: { label: "Resolvido", cor: "bg-green-500/20 text-green-400" },
};

const prioridadeConfig = {
  alta: { label: "Alta", cor: "bg-red-500/20 text-red-400" },
  media: { label: "Média", cor: "bg-yellow-500/20 text-yellow-400" },
  baixa: { label: "Baixa", cor: "bg-green-500/20 text-green-400" },
};

export default function PosVendasDashboardPage() {
  return (
    <div className="space-y-6">
      {/* Métricas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricas.map((metrica, index) => {
          const Icon = metrica.icon;
          return (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{metrica.titulo}</p>
                    <p className="text-2xl font-bold">{metrica.valor}</p>
                    <p className={`text-xs ${metrica.tendencia.startsWith('+') ? 'text-green-500' : 'text-blue-500'}`}>
                      {metrica.tendencia} hoje
                    </p>
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
        {/* Chamados por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chamados por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-8">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={chamadosPorStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="quantidade"
                  >
                    {chamadosPorStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {chamadosPorStatus.map((status, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.cor }} />
                    <span className="text-sm">{status.status}</span>
                    <span className="text-sm text-muted-foreground ml-auto font-medium">{status.quantidade}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chamados por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chamados por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chamadosPorTipo} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1a3a32" />
                <XAxis type="number" stroke="#888" fontSize={12} />
                <YAxis type="category" dataKey="tipo" stroke="#888" fontSize={12} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f3830', border: '1px solid #1a5c4a' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="quantidade" fill="#14919B" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Evolução Semanal */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Evolução Semanal - Abertos vs Resolvidos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={evolucaoSemanal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a3a32" />
                <XAxis dataKey="dia" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f3830', border: '1px solid #1a5c4a' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="abertos" stroke="#eab308" strokeWidth={2} name="Abertos" />
                <Line type="monotone" dataKey="resolvidos" stroke="#22c55e" strokeWidth={2} name="Resolvidos" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Últimos Chamados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimos Chamados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {ultimosChamados.map((chamado) => (
              <div 
                key={chamado.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#14919B]/20 flex items-center justify-center">
                    <span className="font-medium text-[#14919B]">{chamado.cliente.charAt(0)}</span>
                  </div>
                  <div>
                    <h4 className="font-medium">{chamado.cliente}</h4>
                    <p className="text-sm text-muted-foreground">{chamado.assunto}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{chamado.data}</span>
                  <Badge className={prioridadeConfig[chamado.prioridade as keyof typeof prioridadeConfig].cor}>
                    {prioridadeConfig[chamado.prioridade as keyof typeof prioridadeConfig].label}
                  </Badge>
                  <Badge className={statusConfig[chamado.status as keyof typeof statusConfig].cor}>
                    {statusConfig[chamado.status as keyof typeof statusConfig].label}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}