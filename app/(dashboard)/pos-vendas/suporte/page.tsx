"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  LifeBuoy, Plus, Clock, CheckCircle, AlertTriangle, 
  MessageSquare, User, MoreVertical, Search, Filter, 
  ArrowUpRight, Headphones 
} from "lucide-react";

// Mock data
const chamados = [
  { 
    id: 1, 
    cliente: "Maria Silva", 
    assunto: "Produto com defeito - Não liga", 
    categoria: "tecnico",
    status: "aberto", 
    prioridade: "alta",
    data: "10/12/2024 14:30",
    atendente: null,
    tempoEspera: "2h 15min"
  },
  { 
    id: 2, 
    cliente: "João Santos", 
    assunto: "Dúvida sobre garantia estendida", 
    categoria: "duvida",
    status: "em_atendimento", 
    prioridade: "media",
    data: "10/12/2024 13:15",
    atendente: "Ana Costa",
    tempoEspera: "3h 30min"
  },
  { 
    id: 3, 
    cliente: "Ana Oliveira", 
    assunto: "Nota fiscal com dados errados", 
    categoria: "financeiro",
    status: "aguardando_cliente", 
    prioridade: "alta",
    data: "10/12/2024 11:45",
    atendente: "Pedro Lima",
    tempoEspera: "5h"
  },
  { 
    id: 4, 
    cliente: "Pedro Costa", 
    assunto: "Solicitar cancelamento de pedido", 
    categoria: "financeiro",
    status: "resolvido", 
    prioridade: "media",
    data: "10/12/2024 10:20",
    atendente: "Maria Souza",
    tempoEspera: "1h 45min"
  },
  { 
    id: 5, 
    cliente: "Carlos Lima", 
    assunto: "Reclamação sobre atraso na entrega", 
    categoria: "reclamacao",
    status: "aberto", 
    prioridade: "critica",
    data: "10/12/2024 15:00",
    atendente: null,
    tempoEspera: "45min"
  },
];

const categoriaConfig = {
  tecnico: { label: "Técnico", cor: "bg-blue-500/20 text-blue-400" },
  financeiro: { label: "Financeiro", cor: "bg-purple-500/20 text-purple-400" },
  duvida: { label: "Dúvida", cor: "bg-yellow-500/20 text-yellow-400" },
  reclamacao: { label: "Reclamação", cor: "bg-red-500/20 text-red-400" },
};

const statusConfig = {
  aberto: { label: "Aberto", cor: "bg-yellow-500/20 text-yellow-400" },
  em_atendimento: { label: "Em Atendimento", cor: "bg-blue-500/20 text-blue-400" },
  aguardando_cliente: { label: "Aguardando Cliente", cor: "bg-orange-500/20 text-orange-400" },
  resolvido: { label: "Resolvido", cor: "bg-green-500/20 text-green-400" },
};

const prioridadeConfig = {
  critica: { label: "Crítica", cor: "bg-red-600/20 text-red-300" },
  alta: { label: "Alta", cor: "bg-red-500/20 text-red-400" },
  media: { label: "Média", cor: "bg-yellow-500/20 text-yellow-400" },
  baixa: { label: "Baixa", cor: "bg-green-500/20 text-green-400" },
};

export default function PosVendasSuportePage() {
  const [showNewChamado, setShowNewChamado] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Suporte</h2>
          <p className="text-muted-foreground">Atendimento e resolução de problemas</p>
        </div>
        <Button onClick={() => setShowNewChamado(!showNewChamado)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Chamado
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <MessageSquare className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Abertos</p>
                <p className="text-2xl font-bold">23</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Headphones className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Atendimento</p>
                <p className="text-2xl font-bold">12</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio</p>
                <p className="text-2xl font-bold">2.8h</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resolvidos Hoje</p>
                <p className="text-2xl font-bold">18</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulário Novo Chamado */}
      {showNewChamado && (
        <Card>
          <CardHeader>
            <CardTitle>Novo Chamado de Suporte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Cliente</label>
                <Input placeholder="Nome ou telefone do cliente" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <select className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]">
                  <option>Técnico</option>
                  <option>Financeiro</option>
                  <option>Dúvida</option>
                  <option>Reclamação</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <select className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]">
                  <option>Crítica</option>
                  <option>Alta</option>
                  <option>Média</option>
                  <option>Baixa</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Assunto</label>
                <Input placeholder="Resumo do problema" className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <textarea 
                className="w-full mt-1 p-2 border rounded-md bg-[#0f3830] min-h-[100px]"
                placeholder="Descreva o problema detalhadamente..."
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewChamado(false)}>Cancelar</Button>
              <Button>Abrir Chamado</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Chamados */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Chamados Recentes</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar chamado..." className="pl-9 w-64" />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {chamados.map((chamado) => (
              <div 
                key={chamado.id}
                className="p-4 border rounded-lg hover:bg-white/5 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{chamado.assunto}</h4>
                      <Badge className={prioridadeConfig[chamado.prioridade as keyof typeof prioridadeConfig].cor}>
                        {prioridadeConfig[chamado.prioridade as keyof typeof prioridadeConfig].label}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {chamado.cliente}
                      </div>
                      <Badge className={categoriaConfig[chamado.categoria as keyof typeof categoriaConfig].cor}>
                        {categoriaConfig[chamado.categoria as keyof typeof categoriaConfig].label}
                      </Badge>
                      <span>{chamado.data}</span>
                    </div>

                    {chamado.atendente && (
                      <p className="text-sm mt-2">
                        <span className="text-muted-foreground">Atendente:</span> {chamado.atendente}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Tempo de espera</p>
                      <p className="text-sm font-medium">{chamado.tempoEspera}</p>
                    </div>
                    
                    <Badge className={statusConfig[chamado.status as keyof typeof statusConfig].cor}>
                      {statusConfig[chamado.status as keyof typeof statusConfig].label}
                    </Badge>

                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
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