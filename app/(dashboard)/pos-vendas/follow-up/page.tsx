"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  CalendarCheck, Plus, Clock, CheckCircle, AlertTriangle, 
  Phone, Mail, MessageSquare, MoreVertical, Search, Filter 
} from "lucide-react";

// Mock data
const followUps = [
  { 
    id: 1, 
    cliente: "Maria Silva", 
    tipo: "ligacao", 
    motivo: "Verificar satisfação com produto",
    data: "2024-12-10 14:00",
    status: "pendente",
    vendedor: "Ana Santos",
    prioridade: "alta"
  },
  { 
    id: 2, 
    cliente: "João Oliveira", 
    tipo: "whatsapp", 
    motivo: "Enviar cupom de desconto",
    data: "2024-12-10 10:30",
    status: "concluido",
    vendedor: "Pedro Costa",
    prioridade: "media"
  },
  { 
    id: 3, 
    cliente: "Ana Pereira", 
    tipo: "email", 
    motivo: "Apresentar novos produtos",
    data: "2024-12-09 16:00",
    status: "atrasado",
    vendedor: "Maria Lima",
    prioridade: "alta"
  },
  { 
    id: 4, 
    cliente: "Carlos Souza", 
    tipo: "visita", 
    motivo: "Demonstração em loja",
    data: "2024-12-11 09:00",
    status: "agendado",
    vendedor: "Ana Santos",
    prioridade: "media"
  },
];

const tipoConfig = {
  ligacao: { label: "Ligação", icon: Phone, cor: "text-blue-500", bg: "bg-blue-500/10" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, cor: "text-green-500", bg: "bg-green-500/10" },
  email: { label: "E-mail", icon: Mail, cor: "text-purple-500", bg: "bg-purple-500/10" },
  visita: { label: "Visita", icon: CalendarCheck, cor: "text-orange-500", bg: "bg-orange-500/10" },
};

const statusConfig = {
  pendente: { label: "Pendente", cor: "bg-yellow-500/20 text-yellow-400" },
  concluido: { label: "Concluído", cor: "bg-green-500/20 text-green-400" },
  atrasado: { label: "Atrasado", cor: "bg-red-500/20 text-red-400" },
  agendado: { label: "Agendado", cor: "bg-blue-500/20 text-blue-400" },
};

const prioridadeConfig = {
  alta: { label: "Alta", cor: "bg-red-500/20 text-red-400" },
  media: { label: "Média", cor: "bg-yellow-500/20 text-yellow-400" },
  baixa: { label: "Baixa", cor: "bg-green-500/20 text-green-400" },
};

export default function PosVendasFollowUpPage() {
  const [showNewFollowUp, setShowNewFollowUp] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Follow-up</h2>
          <p className="text-muted-foreground">Acompanhamento pós-venda automatizado</p>
        </div>
        <Button onClick={() => setShowNewFollowUp(!showNewFollowUp)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Follow-up
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">8</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Atrasados</p>
                <p className="text-2xl font-bold">3</p>
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
                <p className="text-sm text-muted-foreground">Concluídos Hoje</p>
                <p className="text-2xl font-bold">12</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <CalendarCheck className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Agendados</p>
                <p className="text-2xl font-bold">15</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulário Novo Follow-up */}
      {showNewFollowUp && (
        <Card>
          <CardHeader>
            <CardTitle>Novo Follow-up</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Cliente</label>
                <Input placeholder="Nome do cliente" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo de Contato</label>
                <select className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]">
                  <option>Ligação</option>
                  <option>WhatsApp</option>
                  <option>E-mail</option>
                  <option>Visita</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Motivo</label>
                <Input placeholder="Ex: Verificar satisfação" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Data/Hora</label>
                <Input type="datetime-local" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <select className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]">
                  <option>Alta</option>
                  <option>Média</option>
                  <option>Baixa</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Responsável</label>
                <select className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]">
                  <option>Ana Santos</option>
                  <option>Pedro Costa</option>
                  <option>Maria Lima</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewFollowUp(false)}>Cancelar</Button>
              <Button>Agendar Follow-up</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Follow-ups */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Follow-ups Agendados</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar follow-up..." className="pl-9 w-64" />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {followUps.map((followUp) => {
              const TipoIcon = tipoConfig[followUp.tipo as keyof typeof tipoConfig].icon;
              return (
                <div 
                  key={followUp.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${tipoConfig[followUp.tipo as keyof typeof tipoConfig].bg}`}>
                      <TipoIcon className={`w-5 h-5 ${tipoConfig[followUp.tipo as keyof typeof tipoConfig].cor}`} />
                    </div>
                    <div>
                      <h4 className="font-medium">{followUp.cliente}</h4>
                      <p className="text-sm text-muted-foreground">{followUp.motivo}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm">{new Date(followUp.data).toLocaleDateString('pt-BR')}</p>
                      <p className="text-xs text-muted-foreground">{new Date(followUp.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Responsável</p>
                      <p className="text-sm">{followUp.vendedor}</p>
                    </div>

                    <Badge className={prioridadeConfig[followUp.prioridade as keyof typeof prioridadeConfig].cor}>
                      {prioridadeConfig[followUp.prioridade as keyof typeof prioridadeConfig].label}
                    </Badge>

                    <Badge className={statusConfig[followUp.status as keyof typeof statusConfig].cor}>
                      {statusConfig[followUp.status as keyof typeof statusConfig].label}
                    </Badge>

                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
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