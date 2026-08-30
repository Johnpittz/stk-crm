"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Megaphone, Plus, Calendar, Target, TrendingUp, 
  MoreVertical, Eye, Edit, Trash2 
} from "lucide-react";

// Mock data
const campanhas = [
  { 
    id: 1, 
    nome: "Black Friday 2024", 
    status: "ativa", 
    inicio: "2024-11-20", 
    fim: "2024-11-30",
    publico: "Todos os clientes",
    orcamento: 5000,
    gasto: 3200,
    conversoes: 145,
    roi: 320
  },
  { 
    id: 2, 
    nome: "Natal Especial", 
    status: "agendada", 
    inicio: "2024-12-15", 
    fim: "2024-12-25",
    publico: "Clientes VIP",
    orcamento: 8000,
    gasto: 0,
    conversoes: 0,
    roi: 0
  },
  { 
    id: 3, 
    nome: "Dia dos Namorados", 
    status: "finalizada", 
    inicio: "2024-06-01", 
    fim: "2024-06-15",
    publico: "Leads qualificados",
    orcamento: 3000,
    gasto: 2800,
    conversoes: 89,
    roi: 245
  },
];

const statusConfig = {
  ativa: { label: "Ativa", cor: "bg-green-500/20 text-green-400" },
  agendada: { label: "Agendada", cor: "bg-yellow-500/20 text-yellow-400" },
  finalizada: { label: "Finalizada", cor: "bg-gray-500/20 text-gray-400" },
  pausada: { label: "Pausada", cor: "bg-red-500/20 text-red-400" },
};

export default function MarketingCampanhasPage() {
  const [showNewCampanha, setShowNewCampanha] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Campanhas</h2>
          <p className="text-muted-foreground">Crie e gerencie suas campanhas de marketing</p>
        </div>
        <Button onClick={() => setShowNewCampanha(!showNewCampanha)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      {/* Resumo Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Megaphone className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Campanhas Ativas</p>
                <p className="text-2xl font-bold">1</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Target className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Conversões</p>
                <p className="text-2xl font-bold">234</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">ROI Médio</p>
                <p className="text-2xl font-bold">282%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulário Nova Campanha */}
      {showNewCampanha && (
        <Card>
          <CardHeader>
            <CardTitle>Nova Campanha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nome da Campanha</label>
                <Input placeholder="Ex: Promoção de Verão" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Público-alvo</label>
                <select className="w-full mt-1 p-2 border rounded-md bg-background">
                  <option>Todos os clientes</option>
                  <option>Clientes VIP</option>
                  <option>Leads novos</option>
                  <option>Sem compra há 30 dias</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Data Início</label>
                <Input type="date" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Data Fim</label>
                <Input type="date" className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Orçamento (R$)</label>
              <Input type="number" placeholder="5000" className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewCampanha(false)}>Cancelar</Button>
              <Button>Criar Campanha</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Campanhas */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campanhas.map((campanha) => (
              <div 
                key={campanha.id}
                className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-lg">{campanha.nome}</h4>
                      <Badge className={statusConfig[campanha.status as keyof typeof statusConfig].cor}>
                        {statusConfig[campanha.status as keyof typeof statusConfig].label}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Período</p>
                        <p>{new Date(campanha.inicio).toLocaleDateString('pt-BR')} - {new Date(campanha.fim).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Público</p>
                        <p>{campanha.publico}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Orçamento</p>
                        <p>R$ {campanha.orcamento.toLocaleString('pt-BR')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Conversões</p>
                        <p className="font-medium text-green-500">{campanha.conversoes}</p>
                      </div>
                    </div>

                    {/* Barra de progresso do orçamento */}
                    {campanha.status === "ativa" && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Orçamento utilizado</span>
                          <span>R$ {campanha.gasto.toLocaleString('pt-BR')} / R$ {campanha.orcamento.toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${(campanha.gasto / campanha.orcamento) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="ghost" size="icon" title="Ver detalhes">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Editar">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Excluir">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}