"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Download, Calendar, TrendingUp, Users, 
  BarChart3, PieChart, Filter 
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar 
} from "recharts";

// Mock data
const relatoriosDisponiveis = [
  { id: 1, titulo: "Performance de Campanhas", tipo: "campanhas", ultimoGerado: "2024-11-28", status: "pronto" },
  { id: 2, titulo: "Análise de Leads", tipo: "leads", ultimoGerado: "2024-11-27", status: "pronto" },
  { id: 3, titulo: "ROI por Canal", tipo: "roi", ultimoGerado: "2024-11-26", status: "pronto" },
  { id: 4, titulo: "Taxa de Conversão", tipo: "conversao", ultimoGerado: "2024-11-25", status: "processando" },
];

const dadosPerformance = [
  { mes: "Jul", leads: 180, conversoes: 42, custo: 2500 },
  { mes: "Ago", leads: 220, conversoes: 55, custo: 2800 },
  { mes: "Set", leads: 195, conversoes: 48, custo: 2200 },
  { mes: "Out", leads: 280, conversoes: 72, custo: 3500 },
  { mes: "Nov", leads: 350, conversoes: 89, custo: 4200 },
  { mes: "Dez", leads: 420, conversoes: 105, custo: 5000 },
];

const roiPorCanal = [
  { canal: "WhatsApp", roi: 450, investimento: 1200 },
  { canal: "Instagram", roi: 320, investimento: 800 },
  { canal: "Facebook", roi: 280, investimento: 600 },
  { canal: "Indicação", roi: 890, investimento: 200 },
];

export default function MarketingRelatoriosPage() {
  const [periodoSelecionado, setPeriodoSelecionado] = useState("mes");

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

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Mensal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Performance Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dadosPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="mes" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} name="Leads" />
                <Line type="monotone" dataKey="conversoes" stroke="#22c55e" strokeWidth={2} name="Conversões" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* ROI por Canal */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              ROI por Canal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={roiPorCanal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="canal" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="roi" fill="#22c55e" name="ROI %" />
                <Bar dataKey="investimento" fill="#3b82f6" name="Investimento (R$)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Resumo Executivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo Executivo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-500">R$ 45.200</p>
              <p className="text-sm text-muted-foreground">Receita Total</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-500">R$ 12.500</p>
              <p className="text-sm text-muted-foreground">Investimento Total</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-500">362%</p>
              <p className="text-sm text-muted-foreground">ROI Geral</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-500">23.5%</p>
              <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Relatórios Disponíveis para Download */}
      <Card>
        <CardHeader>
          <CardTitle>Relatórios Anteriores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {relatoriosDisponiveis.map((relatorio) => (
              <div 
                key={relatorio.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{relatorio.titulo}</h4>
                    <p className="text-sm text-muted-foreground">
                      Último gerado: {new Date(relatorio.ultimoGerado).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={relatorio.status === "pronto" ? "default" : "secondary"}>
                    {relatorio.status === "pronto" ? "Pronto" : "Processando..."}
                  </Badge>
                  {relatorio.status === "pronto" && (
                    <Button variant="ghost" size="icon">
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}