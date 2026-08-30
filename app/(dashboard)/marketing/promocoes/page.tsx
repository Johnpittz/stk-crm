"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Tag, Plus, Percent, DollarSign, Calendar, 
  MoreVertical, Edit, Trash2, Copy, Gift
} from "lucide-react";

// Mock data
const promocoes = [
  { 
    id: 1, 
    nome: "Black Friday - 20% OFF", 
    tipo: "percentual", 
    valor: 20, 
    uso: 245, 
    limite: 500,
    inicio: "2024-11-25",
    fim: "2024-11-30",
    status: "ativa"
  },
  { 
    id: 2, 
    nome: "Frete Grátis", 
    tipo: "frete", 
    valor: 0, 
    uso: 180, 
    limite: null,
    inicio: "2024-12-01",
    fim: "2024-12-31",
    status: "agendada"
  },
  { 
    id: 3, 
    nome: "R$50 de desconto", 
    tipo: "fixo", 
    valor: 50, 
    uso: 89, 
    limite: 100,
    inicio: "2024-11-20",
    fim: "2024-11-25",
    status: "finalizada"
  },
  { 
    id: 4, 
    nome: "Compre 2 Leve 3", 
    tipo: "quantidade", 
    valor: 1, 
    uso: 56, 
    limite: null,
    inicio: "2024-12-10",
    fim: "2024-12-20",
    status: "ativa"
  },
];

const statusConfig = {
  ativa: { label: "Ativa", cor: "bg-green-500/20 text-green-400" },
  agendada: { label: "Agendada", cor: "bg-yellow-500/20 text-yellow-400" },
  finalizada: { label: "Finalizada", cor: "bg-gray-500/20 text-gray-400" },
};

const tipoConfig = {
  percentual: { label: "% OFF", icon: Percent },
  fixo: { label: "R$ OFF", icon: DollarSign },
  frete: { label: "Frete Grátis", icon: Gift },
  quantidade: { label: "Leve +", icon: Tag },
};

export default function MarketingPromocoesPage() {
  const [showNewPromocao, setShowNewPromocao] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Promoções</h2>
          <p className="text-muted-foreground">Gerencie ofertas e cupons de desconto</p>
        </div>
        <Button onClick={() => setShowNewPromocao(!showNewPromocao)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Promoção
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Tag className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Promoções Ativas</p>
                <p className="text-2xl font-bold">2</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Percent className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Utilizações</p>
                <p className="text-2xl font-bold">570</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Desconto Total Dado</p>
                <p className="text-2xl font-bold">R$ 18.450</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulário Nova Promoção */}
      {showNewPromocao && (
        <Card>
          <CardHeader>
            <CardTitle>Nova Promoção</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nome da Promoção</label>
                <Input placeholder="Ex: Natal com 30% OFF" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <select className="w-full mt-1 p-2 border rounded-md bg-background">
                  <option>Percentual (%)</option>
                  <option>Valor Fixo (R$)</option>
                  <option>Frete Grátis</option>
                  <option>Leve + (quantidade)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Valor do Desconto</label>
                <Input type="number" placeholder="20" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Limite de Uso</label>
                <Input type="number" placeholder="500 (ou vazio para ilimitado)" className="mt-1" />
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewPromocao(false)}>Cancelar</Button>
              <Button>Criar Promoção</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Promoções */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Promoções</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {promocoes.map((promocao) => {
              const TipoIcon = tipoConfig[promocao.tipo as keyof typeof tipoConfig].icon;
              return (
                <div 
                  key={promocao.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <TipoIcon className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-lg">{promocao.nome}</h4>
                          <Badge className={statusConfig[promocao.status as keyof typeof statusConfig].cor}>
                            {statusConfig[promocao.status as keyof typeof statusConfig].label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(promocao.inicio).toLocaleDateString('pt-BR')} - {new Date(promocao.fim).toLocaleDateString('pt-BR')}
                          </span>
                          <span>
                            {promocao.tipo === "percentual" && `${promocao.valor}% OFF`}
                            {promocao.tipo === "fixo" && `R$ ${promocao.valor} OFF`}
                            {promocao.tipo === "frete" && "Frete Grátis"}
                            {promocao.tipo === "quantidade" && `Leve ${promocao.valor + 1} pague ${promocao.valor}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{promocao.uso} utilizações</p>
                        {promocao.limite && (
                          <p className="text-xs text-muted-foreground">de {promocao.limite} disponíveis</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="Editar">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Duplicar">
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Excluir">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}