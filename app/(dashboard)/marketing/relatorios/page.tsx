"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  FileText, Download, Calendar, TrendingUp, 
  BarChart3, Loader2, Send, Megaphone, Users, Tag
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from "recharts";
import { useApi } from "@/lib/hooks/use-api";

interface Campanha { id: string; nome: string; status: string; conversoes: number; orcamento: number; gasto: number; }
interface Lead { id: string; origem: string; status: string; }
interface Disparo { id: string; sent: number; failed: number; status: string; campanha_id: string | null; created_at: string; }
interface Avaliacao { id: string; nota: number; tipo_nps: string; }
interface Promocao { id: string; uso_atual: number; }

export default function MarketingRelatoriosPage() {
  const [periodo, setPeriodo] = useState("mes");

  const { data: campanhas, loading: l1 } = useApi<Campanha[]>({ url: '/api/marketing/campanhas' });
  const { data: leads, loading: l2 } = useApi<Lead[]>({ url: '/api/marketing/leads' });
  const { data: disparos, loading: l3 } = useApi<Disparo[]>({ url: '/api/bulk/campaigns' });
  const { data: avaliacoes } = useApi<Avaliacao[]>({ url: '/api/pos-vendas/avaliacoes' });
  const { data: promocoes } = useApi<Promocao[]>({ url: '/api/marketing/promocoes' });

  const loading = l1 || l2 || l3;

  // Métricas reais conectadas
  const totalLeads = leads?.length || 0;
  const leadsConvertidos = leads?.filter(l => l.status === 'convertido').length || 0;
  const totalConversoes = campanhas?.reduce((acc, c) => acc + (c.conversoes || 0), 0) || 0;
  const totalDisparos = disparos?.length || 0;
  const totalEnviados = disparos?.reduce((acc, d) => acc + (d.sent || 0), 0) || 0;
  const totalFalhou = disparos?.reduce((acc, d) => acc + (d.failed || 0), 0) || 0;
  const taxaResposta = totalEnviados > 0 ? (((totalEnviados - totalFalhou) / totalEnviados) * 100).toFixed(1) : '0';
  const taxaConversao = totalLeads > 0 ? ((leadsConvertidos / totalLeads) * 100).toFixed(1) : '0';
  const totalOrcamento = campanhas?.reduce((acc, c) => acc + (c.orcamento || 0), 0) || 0;
  const totalGasto = campanhas?.reduce((acc, c) => acc + (c.gasto || 0), 0) || 0;
  const totalUtilizacoesPromo = promocoes?.reduce((acc, p) => acc + (p.uso_atual || 0), 0) || 0;

  // NPS
  const npsScore = avaliacoes && avaliacoes.length > 0 
    ? Math.round(
        ((avaliacoes.filter(a => a.tipo_nps === 'promotor').length / avaliacoes.length) * 100) -
        ((avaliacoes.filter(a => a.tipo_nps === 'detrator').length / avaliacoes.length) * 100)
      )
    : 0;

  // Leads por origem
  const leadsPorOrigemMap: Record<string, number> = {};
  leads?.forEach(l => {
    const origem = l.origem || 'outro';
    leadsPorOrigemMap[origem] = (leadsPorOrigemMap[origem] || 0) + 1;
  });
  const leadsPorOrigem = Object.entries(leadsPorOrigemMap).map(([nome, valor]) => ({
    nome: nome.charAt(0).toUpperCase() + nome.slice(1), valor,
  }));
  const origemCores: Record<string, string> = {
    whatsapp: '#25D366', instagram: '#E1306C', facebook: '#1877F2',
    indicacao: '#FFD700', site: '#3b82f6', outro: '#94A3B8',
  };

  // Leads por status
  const statusMap: Record<string, number> = {};
  leads?.forEach(l => {
    const s = l.status || 'novo';
    statusMap[s] = (statusMap[s] || 0) + 1;
  });
  const leadsPorStatus = Object.entries(statusMap).map(([nome, valor]) => ({
    nome: nome.charAt(0).toUpperCase() + nome.slice(1), valor,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Relatórios</h2>
          <p className="text-muted-foreground">Análises e relatórios de marketing</p>
        </div>
        <Button>
          <Download className="w-4 h-4 mr-2" />
          Exportar PDF
        </Button>
      </div>

      {/* Resumo Executivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo Executivo</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-[#14919B]" /></div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-500">{totalDisparos}</p>
                <p className="text-xs text-muted-foreground">Disparos Criados</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{totalEnviados.toLocaleString('pt-BR')}</p>
                <p className="text-xs text-muted-foreground">Mensagens Enviadas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-500">{totalLeads}</p>
                <p className="text-xs text-muted-foreground">Leads Captados</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-500">{taxaConversao}%</p>
                <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-cyan-500">{npsScore}</p>
                <p className="text-xs text-muted-foreground">NPS Score</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads por Origem */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> Leads por Origem
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#14919B]" /></div>
            : leadsPorOrigem.length > 0 ? (
              <div className="flex items-center justify-center gap-8">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={leadsPorOrigem} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="valor">
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
            ) : <p className="text-center py-12 text-muted-foreground">Nenhum lead ainda</p>}
          </CardContent>
        </Card>

        {/* Leads por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" /> Leads por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#14919B]" /></div>
            : leadsPorStatus.length > 0 ? (
              <div className="space-y-4">
                {leadsPorStatus.map(item => {
                  const percent = totalLeads > 0 ? ((item.valor / totalLeads) * 100).toFixed(1) : '0';
                  return (
                    <div key={item.nome}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{item.nome}</span>
                        <span className="text-sm font-bold">{item.valor} ({percent}%)</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-center py-12 text-muted-foreground">Nenhum lead ainda</p>}
          </CardContent>
        </Card>

        {/* Performance de Disparos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="w-5 h-5" /> Performance de Disparos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#14919B]" /></div>
            : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Total de Disparos</span>
                  <span className="font-bold">{totalDisparos}</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Mensagens Enviadas</span>
                  <span className="font-bold text-green-500">{totalEnviados.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Falhas</span>
                  <span className="font-bold text-red-500">{totalFalhou}</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Taxa de Entrega</span>
                  <span className="font-bold text-blue-500">{taxaResposta}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Métricas de Campanhas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Megaphone className="w-5 h-5" /> Campanhas & Promoções
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#14919B]" /></div>
            : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Campanhas Criadas</span>
                  <span className="font-bold">{campanhas?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Total Conversões</span>
                  <span className="font-bold text-green-500">{totalConversoes}</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Orçamento Total</span>
                  <span className="font-bold">R$ {totalOrcamento.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Utilizações de Promoções</span>
                  <span className="font-bold text-purple-500">{totalUtilizacoesPromo}</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm">Avaliações Recebidas</span>
                  <span className="font-bold text-yellow-500">{avaliacoes?.length || 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}