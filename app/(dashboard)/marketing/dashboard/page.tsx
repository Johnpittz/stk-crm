"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Users, Send, Megaphone, Tag } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell 
} from "recharts";

// Mock data para demonstração
const metricasGerais = [
  { titulo: "Campanhas Ativas", valor: "12", icon: Megaphone, cor: "text-blue-500", bg: "bg-blue-500/10" },
  { titulo: "Leads Captados", valor: "1.247", icon: Users, cor: "text-green-500", bg: "bg-green-500/10" },
  { titulo: "Mensagens Enviadas", valor: "8.432", icon: Send, cor: "text-purple-500", bg: "bg-purple-500/10" },
  { titulo: "Taxa de Conversão", valor: "23.5%", icon: TrendingUp, cor: "text-orange-500", bg: "bg-orange-500/10" },
];

const desempenhoCampanhas = [
  { nome: "Black Friday", enviados: 2500, abertos: 1800, convertidos: 450 },
  { nome: "Natal", enviados: 1800, abertos: 1200, convertidos: 280 },
  { nome: "Dia das Mães", enviados: 2200, abertos: 1650, convertidos: 390 },
  { nome: "Aniversário", enviados: 950, abertos: 720, convertidos: 180 },
  { nome: "Boas-vindas", enviados: 1100, abertos: 890, convertidos: 210 },
];

const leadsPorOrigem = [
  { nome: "WhatsApp", valor: 450, cor: "#25D366" },
  { nome: "Instagram", valor: 320, cor: "#E1306C" },
  { nome: "Facebook", valor: 280, cor: "#1877F2" },
  { nome: "Indicação", valor: 197, cor: "#FFD700" },
];

const evolucaoMensal = [
  { mes: "Jul", leads: 180, conversoes: 42 },
  { mes: "Ago", leads: 220, conversoes: 55 },
  { mes: "Set", leads: 195, conversoes: 48 },
  { mes: "Out", leads: 280, conversoes: 72 },
  { mes: "Nov", leads: 350, conversoes: 89 },
  { mes: "Dez", leads: 420, conversoes: 105 },
];

export default function MarketingDashboardPage() {
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
        {/* Desempenho por Campanha */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Desempenho por Campanha</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={desempenhoCampanhas}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="nome" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="enviados" fill="#3b82f6" name="Enviados" />
                <Bar dataKey="abertos" fill="#22c55e" name="Abertos" />
                <Bar dataKey="convertidos" fill="#f59e0b" name="Convertidos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Leads por Origem */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Leads por Origem</CardTitle>
          </CardHeader>
          <CardContent>
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
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {leadsPorOrigem.map((origem, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: origem.cor }} />
                    <span className="text-sm">{origem.nome}</span>
                    <span className="text-sm text-muted-foreground ml-auto">{origem.valor}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Evolução Mensal */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Evolução Mensal - Leads vs Conversões</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolucaoMensal}>
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
      </div>
    </div>
  );
}