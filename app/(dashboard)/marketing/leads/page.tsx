"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Users, Plus, Search, Filter, MoreVertical, 
  Phone, Mail, Building, TrendingUp, Star, Clock, Loader2 
} from "lucide-react";
import { useApi, useCreate } from "@/lib/hooks/use-api";

// Tipos
interface Lead {
  id: string;
  nome: string;
  empresa: string;
  telefone: string;
  email: string;
  origem: string;
  status: string;
  score: number;
  created_at: string;
}

const statusConfig: Record<string, { label: string; cor: string }> = {
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
  const [busca, setBusca] = useState('');
  const [novoLead, setNovoLead] = useState({
    nome: '',
    empresa: '',
    telefone: '',
    email: '',
    origem: 'whatsapp',
    status: 'novo'
  });

  const { data: leads, loading, refetch } = useApi<Lead[]>({ url: '/api/marketing/leads' });
  const { create: criarLead, loading: criando } = useCreate<typeof novoLead>('/api/marketing/leads');

  const handleCriarLead = async () => {
    if (!novoLead.nome) return;
    
    const resultado = await criarLead(novoLead);
    if (resultado) {
      setShowNewLead(false);
      setNovoLead({ nome: '', empresa: '', telefone: '', email: '', origem: 'whatsapp', status: 'novo' });
      refetch();
    }
  };

  // Filtrar leads por busca
  const leadsFiltrados = leads?.filter(lead => 
    lead.nome.toLowerCase().includes(busca.toLowerCase()) ||
    lead.empresa?.toLowerCase().includes(busca.toLowerCase()) ||
    lead.email?.toLowerCase().includes(busca.toLowerCase())
  ) || [];

  // Estatísticas
  const stats = {
    total: leads?.length || 0,
    qualificados: leads?.filter(l => l.status === 'qualificado').length || 0,
    convertidos: leads?.filter(l => l.status === 'convertido').length || 0,
    novosUltimaSemana: leads?.filter(l => {
      const data = new Date(l.created_at);
      const umaSemanaAtras = new Date();
      umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);
      return data >= umaSemanaAtras;
    }).length || 0,
  };

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
                <p className="text-2xl font-bold">{stats.total}</p>
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
                <p className="text-2xl font-bold">{stats.qualificados}</p>
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
                <p className="text-2xl font-bold">{stats.convertidos}</p>
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
                <p className="text-2xl font-bold">{stats.novosUltimaSemana}</p>
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
                <label className="text-sm font-medium">Nome *</label>
                <Input 
                  placeholder="Nome do lead" 
                  className="mt-1"
                  value={novoLead.nome}
                  onChange={(e) => setNovoLead({ ...novoLead, nome: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Empresa</label>
                <Input 
                  placeholder="Nome da empresa" 
                  className="mt-1"
                  value={novoLead.empresa}
                  onChange={(e) => setNovoLead({ ...novoLead, empresa: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Telefone</label>
                <Input 
                  placeholder="(11) 99999-9999" 
                  className="mt-1"
                  value={novoLead.telefone}
                  onChange={(e) => setNovoLead({ ...novoLead, telefone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">E-mail</label>
                <Input 
                  type="email" 
                  placeholder="email@empresa.com" 
                  className="mt-1"
                  value={novoLead.email}
                  onChange={(e) => setNovoLead({ ...novoLead, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Origem</label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]"
                  value={novoLead.origem}
                  onChange={(e) => setNovoLead({ ...novoLead, origem: e.target.value })}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="indicacao">Indicação</option>
                  <option value="site">Site</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]"
                  value={novoLead.status}
                  onChange={(e) => setNovoLead({ ...novoLead, status: e.target.value })}
                >
                  <option value="novo">Novo</option>
                  <option value="qualificado">Qualificado</option>
                  <option value="em_contato">Em Contato</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewLead(false)}>Cancelar</Button>
              <Button onClick={handleCriarLead} disabled={criando}>
                {criando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Salvar Lead
              </Button>
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
                <Input 
                  placeholder="Buscar lead..." 
                  className="pl-9 w-64"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#14919B]" />
            </div>
          ) : leadsFiltrados.length > 0 ? (
            <div className="space-y-4">
              {leadsFiltrados.map((lead) => (
                <div 
                  key={lead.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="font-medium text-primary">{lead.nome.charAt(0)}</span>
                    </div>
                    <div>
                      <h4 className="font-medium">{lead.nome}</h4>
                      <p className="text-sm text-muted-foreground">{lead.empresa || 'Sem empresa'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                      {lead.telefone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {lead.telefone}
                        </div>
                      )}
                      {lead.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {lead.email}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Score</p>
                      <p className={`font-bold ${getScoreColor(lead.score || 0)}`}>{lead.score || 0}</p>
                    </div>

                    <Badge className={statusConfig[lead.status]?.cor || 'bg-gray-500/20 text-gray-400'}>
                      {statusConfig[lead.status]?.label || lead.status}
                    </Badge>

                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {busca ? 'Nenhum lead encontrado para essa busca' : 'Nenhum lead cadastrado'}
              </p>
              {!busca && (
                <Button className="mt-4" onClick={() => setShowNewLead(true)}>
                  Adicionar Primeiro Lead
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}