"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Users, Plus, Search, Filter, MoreVertical, 
  Phone, Mail, Building, TrendingUp, Star, Clock
} from "lucide-react";

// Mock data
const leads = [
  { 
    id: 1, 
    nome: "Maria Silva", 
    empresa: "Tech Solutions", 
    telefone: "(11) 99999-1234",
    email: "maria@techsolutions.com",
    origem: "WhatsApp",
    status: "qualificado",
    score: 85,
    ultimaInteracao: "2024-11-28"
  },
  { 
    id: 2, 
    nome: "João Santos", 
    empresa: "Digital Marketing Pro", 
    telefone: "(11) 98888-5678",
    email: "joao@dmpro.com",
    origem: "Instagram",
    status: "novo",
    score: 45,
    ultimaInteracao: "2024-11-27"
  },
  { 
    id: 3, 
    nome: "Ana Oliveira", 
    empresa: "Consultoria ABC", 
    telefone: "(11) 97777-9012",
    email: "ana@consultoriaabc.com",
    origem: "Indicação",
    status: "em_contato",
    score: 72,
    ultimaInteracao: "2024-11-26"
  },
  { 
    id: 4, 
    nome: "Pedro Costa", 
    empresa: "Startup XYZ", 
    telefone: "(11) 96666-3456",
    email: "pedro@startupxyz.com",
    origem: "Facebook",
    status: "convertido",
    score: 92,
    ultimaInteracao: "2024-11-25"
  },
];

const statusConfig = {
  novo: { label: "Novo", cor: "bg-blue-500/20 text-blue-400" },
  qualificado: { label: "Qualificado", cor: "bg-yellow-500/20 text-yellow-400" },
  em_contato: { label: "Em Contato", cor: "bg-purple-500/20 text-purple-400" },
  convertido: { label: "Convertido", cor: "bg-green-500/20 text-green-400" },
  perdido: { label: "Perdido", cor: "bg-red-500/20 text-red-400" },
};

const getScoreColor = (score: number) => {
  if (score >= 80) return "text-green-500";
  if (score >= 50) return "text-yellow-500";
  return "text-red-500";
};

export default function MarketingLeadsPage() {
  const [showNewLead, setShowNewLead] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Leads</h2>
          <p className="text-muted-foreground">Gerencie e qualifique seus leads</p>
        </div>
        <Button onClick={() => setShowNewLead(!showNewLead)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Lead
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Leads</p>
                <p className="text-2xl font-bold">1.247</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Star className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Qualificados</p>
                <p className="text-2xl font-bold">342</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Convertidos</p>
                <p className="text-2xl font-bold">89</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Novos (7 dias)</p>
                <p className="text-2xl font-bold">56</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulário Novo Lead */}
      {showNewLead && (
        <Card>
          <CardHeader>
            <CardTitle>Adicionar Novo Lead</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input placeholder="Nome do lead" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Empresa</label>
                <Input placeholder="Nome da empresa" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Telefone</label>
                <Input placeholder="(11) 99999-9999" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">E-mail</label>
                <Input type="email" placeholder="email@empresa.com" className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Origem</label>
                <select className="w-full mt-1 p-2 border rounded-md bg-background">
                  <option>WhatsApp</option>
                  <option>Instagram</option>
                  <option>Facebook</option>
                  <option>Indicação</option>
                  <option>Site</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select className="w-full mt-1 p-2 border rounded-md bg-background">
                  <option>Novo</option>
                  <option>Qualificado</option>
                  <option>Em Contato</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewLead(false)}>Cancelar</Button>
              <Button>Salvar Lead</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Leads */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Leads</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar lead..." className="pl-9 w-64" />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {leads.map((lead) => (
              <div 
                key={lead.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-medium text-primary">{lead.nome.charAt(0)}</span>
                  </div>
                  <div>
                    <h4 className="font-medium">{lead.nome}</h4>
                    <p className="text-sm text-muted-foreground">{lead.empresa}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {lead.telefone}
                    </div>
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {lead.email}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Score</p>
                    <p className={`font-bold ${getScoreColor(lead.score)}`}>{lead.score}</p>
                  </div>

                  <Badge className={statusConfig[lead.status as keyof typeof statusConfig].cor}>
                    {statusConfig[lead.status as keyof typeof statusConfig].label}
                  </Badge>

                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}