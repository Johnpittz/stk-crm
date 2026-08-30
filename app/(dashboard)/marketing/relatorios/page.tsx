"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Download, Calendar, TrendingUp, 
  BarChart3, Loader2 
} from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { useApi } from "@/lib/hooks/use-api";

// Tipos
interface Campanha { id: string; nome: string; status: string; conversoes: number; orcamento: number; gasto: number; }
interface Lead { id: string; origem: string; status: string; }
interface Avaliacao { id: string; nota: number; tipo_nps: string; }

export default function MarketingRelatoriosPage() {
  const [periodoSelecionado, setPeriodoSelecionado] = useState("mes");

  const { data: campanhas, loading: loadingCampanhas } = useApi<Campanha[]>({ url: '/api/marketing/campanhas' });
  const { data: leads, loading: loadingLeads } = useApi<Lead[]>({ url: '/api/marketing/leads' });

  const loading = loadingCampanhas || loadingLeads;

  // Métricas reais
  const totalConversoes = campanhas?.reduce((acc, c) => acc + (c.conversoes || 0), 0) || 0;
  const totalOrcamento = campanhas?.reduce((acc, c) => acc + (c.orcamento || 0), 0) || 0;
  const totalGasto = campanhas?.reduce((acc, c) => acc + (c.gasto || 0), 0) || 0;
  const totalLeads = leads?.length || 0;
  const leadsConvertidos = leads?.filter(l => l.status === 'convertido').length || 0;
  const taxaConversao = totalLeads > 0 ? ((leadsConvertidos / totalLeads) * 100).toFixed(1) : '0';
  const roiGeral = totalGasto > 0 ? (((totalConversoes * 100 - totalGasto) / totalGasto) * 100).toFixed(0) : '0';

  // Leads por origem para gráfico
  const leadsPorOrigemMap: Record<string, number> = {};
  leads?.forEach(l => {
    const origem = l.origem || 'outro';
    leadsPorOrigemMap[origem] = (leadsPorOrigemMap[origem] || 0) + 1;
  });
  const roiPorCanal = Object.entries(leadsPorOrigemMap).map(([canal, quantidade]) => ({
    canal: canal.charAt(0).toUpperCase() + canal.slice(1),
    leads: quantidade,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Relatórios</h2>
          <p className="text-muted-foreground">Análises e relatórios de marketing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Calendar className="w-4 h-4 mr-2" />
            Último mês
          </Button>
          <Button>
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filtros de Período */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Período:</span>
            <div className="flex gap-2">
              {["semana", "mes", "trimestre", "ano"].map((periodo) => (
                <Button
                  key={periodo}
                  variant={periodoSelecionado === periodo ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriodoSelecionado(periodo)}
                >
                  {periodo === "semana" && "Última Semana"}
                  {periodo === "mes" && "Último Mês"}
                  {periodo === "trimestre" && "Último Trimestre"}
                  {periodo === "ano" && "Último Ano"}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo Executivo - Dados Reais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo Executivo</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#14919B]" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-500">{totalConversoes}</p>
                <p className="text-sm text-muted-foreground">Total Conversões</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-500">R$ {totalGasto.toLocaleString('pt-BR')}</p>
                <p className="text-sm text-muted-foreground">Investimento Total</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-500">{roiGeral}%</p>
                <p className="text-sm text-muted-foreground">ROI Geral</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-500">{taxaConversao}%</p>
                <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads por Canal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Leads por Canal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#14919B]" />
              </div>
            ) : roiPorCanal.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={roiPorCanal}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a3a32" />
                  <XAxis dataKey="canal" stroke="#888" fontSize={12} />
                  <YAxis stroke="#888" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f3830', border: '1px solid #1a5c4a' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="leads" fill="#14919B" name="Leads" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum dado disponível</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Leads por Status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#14919B]" />
              </div>
            ) : leads && leads.length > 0 ? (
              <div className="space-y-4">
                {['novo', 'qualificado', 'em_contato', 'convertido', 'perdido'].map(status => {
                  const count = leads.filter(l => l.status === status).length;
                  const labels: Record<string, string> = {
                    novo: 'Novo', qualificado: 'Qualificado', em_contato: 'Em Contato',
                    convertido: 'Convertido', perdido: 'Perdido'
                  };
                  const cores: Record<string, string> = {
                    novo: 'text-blue-500', qualificado: 'text-yellow-500', em_contato: 'text-purple-500',
                    convertido: 'text-green-500', perdido: 'text-red-500'
                  };
                  if (count === 0) return null;
                  const percent = ((count / leads.length) * 100).toFixed(1);
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{labels[status]}</span>
                        <span className={`text-sm font-bold ${cores[status]}`}>{count} ({percent}%)</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum lead cadastrado ainda</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumo de Campanhas */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo das Campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCampanhas ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-[#14919B]" />
            </div>
          ) : campanhas && campanhas.length > 0 ? (
            <div className="space-y-3">
              {campanhas.slice(0, 5).map((campanha) => (
                <div 
                  key={campanha.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div>
                    <h4 className="font-medium">{campanha.nome}</h4>
                    <p className="text-sm text-muted-foreground">
                      {campanha.conversoes || 0} conversões • R$ {(campanha.gasto || 0).toLocaleString('pt-BR')} gasto
                    </p>
                  </div>
                  <Badge variant={campanha.status === 'ativa' ? 'default' : 'secondary'}>
                    {campanha.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Nenhuma campanha criada ainda</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}