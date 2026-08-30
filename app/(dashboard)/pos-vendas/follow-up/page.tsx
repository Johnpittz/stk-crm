"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  CalendarCheck, Plus, Clock, CheckCircle, AlertTriangle, 
  Phone, Mail, MessageSquare, MoreVertical, Search, Filter, Loader2 
} from "lucide-react";
import { useApi, useCreate } from "@/lib/hooks/use-api";

// Tipos
interface FollowUp {
  id: string;
  cliente_nome: string;
  tipo: string;
  motivo: string;
  data_agendada: string;
  status: string;
  prioridade: string;
  responsavel_nome: string;
  created_at: string;
}

const tipoConfig: Record<string, { label: string; icon: any; cor: string; bg: string }> = {
  ligacao: { label: "Ligação", icon: Phone, cor: "text-blue-500", bg: "bg-blue-500/10" },
  whatsapp: { label: "WhatsApp", icon: MessageSquare, cor: "text-green-500", bg: "bg-green-500/10" },
  email: { label: "E-mail", icon: Mail, cor: "text-purple-500", bg: "bg-purple-500/10" },
  visita: { label: "Visita", icon: CalendarCheck, cor: "text-orange-500", bg: "bg-orange-500/10" },
};

const statusConfig: Record<string, { label: string; cor: string }> = {
  pendente: { label: "Pendente", cor: "bg-yellow-500/20 text-yellow-400" },
  concluido: { label: "Concluído", cor: "bg-green-500/20 text-green-400" },
  atrasado: { label: "Atrasado", cor: "bg-red-500/20 text-red-400" },
  agendado: { label: "Agendado", cor: "bg-blue-500/20 text-blue-400" },
};

const prioridadeConfig: Record<string, { label: string; cor: string }> = {
  alta: { label: "Alta", cor: "bg-red-500/20 text-red-400" },
  media: { label: "Média", cor: "bg-yellow-500/20 text-yellow-400" },
  baixa: { label: "Baixa", cor: "bg-green-500/20 text-green-400" },
};

export default function PosVendasFollowUpPage() {
  const [showNewFollowUp, setShowNewFollowUp] = useState(false);
  const [novoFollowUp, setNovoFollowUp] = useState({
    cliente_nome: '',
    tipo: 'ligacao',
    motivo: '',
    data_agendada: '',
    prioridade: 'media',
    responsavel_nome: ''
  });

  const { data: followUps, loading, refetch } = useApi<FollowUp[]>({ url: '/api/pos-vendas/followups' });
  const { create: criarFollowUp, loading: criando } = useCreate<typeof novoFollowUp>('/api/pos-vendas/followups');

  const handleCriarFollowUp = async () => {
    if (!novoFollowUp.cliente_nome || !novoFollowUp.motivo || !novoFollowUp.data_agendada) return;
    
    const resultado = await criarFollowUp(novoFollowUp);
    if (resultado) {
      setShowNewFollowUp(false);
      setNovoFollowUp({ cliente_nome: '', tipo: 'ligacao', motivo: '', data_agendada: '', prioridade: 'media', responsavel_nome: '' });
      refetch();
    }
  };

  // Estatísticas
  const stats = {
    pendentes: followUps?.filter(f => f.status === 'pendente').length || 0,
    atrasados: followUps?.filter(f => f.status === 'atrasado').length || 0,
    concluidosHoje: followUps?.filter(f => {
      const data = new Date(f.created_at);
      const hoje = new Date();
      return data.toDateString() === hoje.toDateString() && f.status === 'concluido';
    }).length || 0,
    agendados: followUps?.filter(f => f.status === 'agendado').length || 0,
  };

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
                <p className="text-2xl font-bold">{stats.pendentes}</p>
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
                <p className="text-2xl font-bold">{stats.atrasados}</p>
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
                <p className="text-2xl font-bold">{stats.concluidosHoje}</p>
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
                <p className="text-2xl font-bold">{stats.agendados}</p>
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
                <label className="text-sm font-medium">Cliente *</label>
                <Input 
                  placeholder="Nome do cliente" 
                  className="mt-1"
                  value={novoFollowUp.cliente_nome}
                  onChange={(e) => setNovoFollowUp({ ...novoFollowUp, cliente_nome: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo de Contato</label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]"
                  value={novoFollowUp.tipo}
                  onChange={(e) => setNovoFollowUp({ ...novoFollowUp, tipo: e.target.value })}
                >
                  <option value="ligacao">Ligação</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                  <option value="visita">Visita</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Motivo *</label>
                <Input 
                  placeholder="Ex: Verificar satisfação" 
                  className="mt-1"
                  value={novoFollowUp.motivo}
                  onChange={(e) => setNovoFollowUp({ ...novoFollowUp, motivo: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Data/Hora *</label>
                <Input 
                  type="datetime-local" 
                  className="mt-1"
                  value={novoFollowUp.data_agendada}
                  onChange={(e) => setNovoFollowUp({ ...novoFollowUp, data_agendada: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]"
                  value={novoFollowUp.prioridade}
                  onChange={(e) => setNovoFollowUp({ ...novoFollowUp, prioridade: e.target.value })}
                >
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="baixa">Baixa</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Responsável</label>
                <Input 
                  placeholder="Nome do responsável" 
                  className="mt-1"
                  value={novoFollowUp.responsavel_nome}
                  onChange={(e) => setNovoFollowUp({ ...novoFollowUp, responsavel_nome: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewFollowUp(false)}>Cancelar</Button>
              <Button onClick={handleCriarFollowUp} disabled={criando}>
                {criando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Agendar Follow-up
              </Button>
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
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#14919B]" />
            </div>
          ) : followUps && followUps.length > 0 ? (
            <div className="space-y-4">
              {followUps.map((followUp) => {
                const TipoIcon = tipoConfig[followUp.tipo]?.icon || Phone;
                return (
                  <div 
                    key={followUp.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${tipoConfig[followUp.tipo]?.bg || 'bg-gray-500/10'}`}>
                        <TipoIcon className={`w-5 h-5 ${tipoConfig[followUp.tipo]?.cor || 'text-gray-500'}`} />
                      </div>
                      <div>
                        <h4 className="font-medium">{followUp.cliente_nome}</h4>
                        <p className="text-sm text-muted-foreground">{followUp.motivo}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm">{new Date(followUp.data_agendada).toLocaleDateString('pt-BR')}</p>
                        <p className="text-xs text-muted-foreground">{new Date(followUp.data_agendada).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Responsável</p>
                        <p className="text-sm">{followUp.responsavel_nome || '-'}</p>
                      </div>

                      <Badge className={prioridadeConfig[followUp.prioridade]?.cor || 'bg-gray-500/20 text-gray-400'}>
                        {prioridadeConfig[followUp.prioridade]?.label || followUp.prioridade}
                      </Badge>

                      <Badge className={statusConfig[followUp.status]?.cor || 'bg-gray-500/20 text-gray-400'}>
                        {statusConfig[followUp.status]?.label || followUp.status}
                      </Badge>

                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <CalendarCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum follow-up agendado</p>
              <Button className="mt-4" onClick={() => setShowNewFollowUp(true)}>
                Agendar Primeiro Follow-up
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}