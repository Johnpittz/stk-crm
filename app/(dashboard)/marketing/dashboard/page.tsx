"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Send, Loader2 } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line 
} from "recharts";
import { useApi } from "@/lib/hooks/use-api";

// Tipos
interface Campanha { id: string; status: string; conversoes: number; nome: string; }
interface Lead { id: string; origem: string; status: string; created_at: string; }
interface Promocao { id: string; uso_atual: number; }

export default function MarketingDashboardPage() {
  const { data: campanhas, loading: loadingCampanhas } = useApi<Campanha[]>({ url: '/api/marketing/campanhas' });
  const { data: leads, loading: loadingLeads } = useApi<Lead[]>({ url: '/api/marketing/leads' });
  const { data: promocoes } = useApi<Promocao[]>({ url: '/api/marketing/promocoes' });

  const loading = loadingCampanhas || loadingLeads;

  // Métricas reais
  const campanhasAtivas = campanhas?.filter(c => c.status === 'ativa').length || 0;
  const totalLeads = leads?.length || 0;
  const totalConversoes = campanhas?.reduce((acc, c) => acc + (c.conversoes || 0), 0) || 0;
  const totalUtilizacoesPromo = promocoes?.reduce((acc, p) => acc + (p.uso_atual || 0), 0) || 0;
  const taxaConversao = totalLeads > 0 ? ((totalConversoes / totalLeads) * 100).toFixed(1) : '0';

  // Leads por origem (dados reais)
  const leadsPorOrigemMap: Record<string, number> = {};
  leads?.forEach(l => {
    const origem = l.origem || 'outro';
    leadsPorOrigemMap[origem] = (leadsPorOrigemMap[origem] || 0) + 1;
  });
  const leadsPorOrigem = Object.entries(leadsPorOrigemMap).map(([nome, valor]) => ({
    nome: nome.charAt(0).toUpperCase() + nome.slice(1),
    valor,
  }));
  const origemCores: Record<string, string> = {
    whatsapp: '#25D366', instagram: '#E1306C', facebook: '#1877F2',
    indicacao: '#FFD700', site: '#3b82f6', outro: '#94A3B8',
  };

  // Métricas gerais
  const metricasGerais = [
    { titulo: "Campanhas Ativas", valor: String(campanhasAtivas), icon: BarChart3, cor: "text-blue-500", bg: "bg-blue-500/10" },
    { titulo: "Leads Captados", valor: totalLeads.toLocaleString('pt-BR'), icon: Users, cor: "text-green-500", bg: "bg-green-500/10" },
    { titulo: "Utilizações Promoções", valor: totalUtilizacoesPromo.toLocaleString('pt-BR'), icon: Send, cor: "text-purple-500", bg: "bg-purple-500/10" },
    { titulo: "Taxa de Conversão", valor: `${taxaConversao}%`, icon: TrendingUp, cor: "text-orange-500", bg: "bg-orange-500/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Métricas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricasGerais.map((metrica, index) => {
          const Icon = metrica.icon;
          return (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{metrica.titulo}</p>
                    <p className="text-2xl font-bold">{metrica.valor}</p>
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
        {/* Leads por Origem */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Leads por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#3B64CF]" />
              </div>
            ) : leadsPorOrigem.length > 0 ? (
              <div className="flex items-center justify-center gap-8">
                <ResponsiveContainer width={200} height={200}>
                  <PieChart>
                    <Pie
                      data={leadsPorOrigem}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="valor"
                    >
                      {leadsPorOrigem.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={origemCores[entry.nome.toLowerCase()] || '#94A3B8'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {leadsPorOrigem.map((origem, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: origemCores[origem.nome.toLowerCase()] || '#94A3B8' }} />
                      <span className="text-sm">{origem.nome}</span>
                      <span className="text-sm text-muted-foreground ml-auto">{origem.valor}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum lead cadastrado ainda</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campanhas por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Campanhas por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCampanhas ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#3B64CF]" />
              </div>
            ) : campanhas && campanhas.length > 0 ? (
              <div className="space-y-4">
                {['ativa', 'agendada', 'rascunho', 'finalizada', 'pausada'].map(status => {
                  const count = campanhas.filter(c => c.status === status).length;
                  const labels: Record<string, string> = {
                    ativa: 'Ativa', agendada: 'Agendada', rascunho: 'Rascunho',
                    finalizada: 'Finalizada', pausada: 'Pausada'
                  };
                  const cores: Record<string, string> = {
                    ativa: 'bg-green-500', agendada: 'bg-yellow-500', rascunho: 'bg-gray-500',
                    finalizada: 'bg-blue-500', pausada: 'bg-red-500'
                  };
                  if (count === 0) return null;
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${cores[status]}`} />
                        <span className="text-sm">{labels[status]}</span>
                      </div>
                      <span className="font-bold">{count}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhuma campanha criada ainda</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}