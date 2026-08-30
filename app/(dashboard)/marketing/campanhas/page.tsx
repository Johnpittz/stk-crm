"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Megaphone, Plus, Calendar, Target, TrendingUp, 
  MoreVertical, Eye, Edit, Trash2, Loader2, Send, Link
} from "lucide-react";
import { useApi, useCreate } from "@/lib/hooks/use-api";

// Tipos
interface Campanha {
  id: string;
  nome: string;
  status: string;
  data_inicio: string;
  data_fim: string;
  publico_alvo: string;
  orcamento: number;
  gasto: number;
  conversoes: number;
  tipo: string;
}

interface Disparo {
  id: string;
  name: string;
  status: string;
  sent: number;
  failed: number;
  created_at: string;
  campanha_id: string | null;
}

const statusConfig: Record<string, { label: string; cor: string }> = {
  ativa: { label: "Ativa", cor: "bg-green-500/20 text-green-400" },
  agendada: { label: "Agendada", cor: "bg-yellow-500/20 text-yellow-400" },
  finalizada: { label: "Finalizada", cor: "bg-gray-500/20 text-gray-400" },
  pausada: { label: "Pausada", cor: "bg-red-500/20 text-red-400" },
  rascunho: { label: "Rascunho", cor: "bg-gray-500/20 text-gray-400" },
};

export default function MarketingCampanhasPage() {
  const [showNewCampanha, setShowNewCampanha] = useState(false);
  const [campanhaExpandida, setCampanhaExpandida] = useState<string | null>(null);
  const [novaCampanha, setNovaCampanha] = useState({
    nome: '', tipo: 'whatsapp', publico_alvo: 'todos',
    orcamento: 0, data_inicio: '', data_fim: ''
  });

  const { data: campanhas, loading, refetch } = useApi<Campanha[]>({ url: '/api/marketing/campanhas' });
  const { data: disparos } = useApi<Disparo[]>({ url: '/api/bulk/campaigns' });
  const { create: criarCampanha, loading: criando } = useCreate<typeof novaCampanha>('/api/marketing/campanhas');

  const handleCriar = async () => {
    if (!novaCampanha.nome) return;
    const resultado = await criarCampanha(novaCampanha);
    if (resultado) {
      setShowNewCampanha(false);
      setNovaCampanha({ nome: '', tipo: 'whatsapp', publico_alvo: 'todos', orcamento: 0, data_inicio: '', data_fim: '' });
      refetch();
    }
  };

  // Contar disparos vinculados a cada campanha
  const contarDisparos = (campanhaId: string) => {
    return disparos?.filter(d => d.campanha_id === campanhaId) || [];
  };

  const stats = {
    ativas: campanhas?.filter(c => c.status === 'ativa').length || 0,
    conversoes: campanhas?.reduce((acc, c) => acc + (c.conversoes || 0), 0) || 0,
    totalDisparos: disparos?.length || 0,
  };

  return (
    <div className="space-y-6">
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

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Megaphone className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Campanhas Ativas</p>
                <p className="text-2xl font-bold">{stats.ativas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Send className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Disparos</p>
                <p className="text-2xl font-bold">{stats.totalDisparos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Target className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Conversões</p>
                <p className="text-2xl font-bold">{stats.conversoes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulário */}
      {showNewCampanha && (
        <Card>
          <CardHeader><CardTitle>Nova Campanha</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nome da Campanha</label>
                <Input placeholder="Ex: Black Friday 2024" className="mt-1"
                  value={novaCampanha.nome}
                  onChange={e => setNovaCampanha({ ...novaCampanha, nome: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Público-alvo</label>
                <select className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]"
                  value={novaCampanha.publico_alvo}
                  onChange={e => setNovaCampanha({ ...novaCampanha, publico_alvo: e.target.value })}
                >
                  <option value="todos">Todos os clientes</option>
                  <option value="vip">Clientes VIP</option>
                  <option value="leads">Leads novos</option>
                  <option value="inativos">Inativos há 30 dias</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Orçamento (R$)</label>
                <Input type="number" placeholder="5000" className="mt-1"
                  value={novaCampanha.orcamento || ''}
                  onChange={e => setNovaCampanha({ ...novaCampanha, orcamento: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Data Início</label>
                <Input type="date" className="mt-1"
                  value={novaCampanha.data_inicio}
                  onChange={e => setNovaCampanha({ ...novaCampanha, data_inicio: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Data Fim</label>
                <Input type="date" className="mt-1"
                  value={novaCampanha.data_fim}
                  onChange={e => setNovaCampanha({ ...novaCampanha, data_fim: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewCampanha(false)}>Cancelar</Button>
              <Button onClick={handleCriar} disabled={criando}>
                {criando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar Campanha
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Campanhas com Disparos Vinculados */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Campanhas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#14919B]" />
            </div>
          ) : campanhas && campanhas.length > 0 ? (
            <div className="space-y-4">
              {campanhas.map((campanha) => {
                const disparosDaCampanha = contarDisparos(campanha.id);
                const totalEnviados = disparosDaCampanha.reduce((acc, d) => acc + (d.sent || 0), 0);
                const isExpandida = campanhaExpandida === campanha.id;
                
                return (
                  <div key={campanha.id} className="border rounded-lg overflow-hidden">
                    {/* Cabeçalho da Campanha */}
                    <div 
                      className="p-4 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => setCampanhaExpandida(isExpandida ? null : campanha.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium text-lg">{campanha.nome}</h4>
                            <Badge className={statusConfig[campanha.status]?.cor || 'bg-gray-500/20 text-gray-400'}>
                              {statusConfig[campanha.status]?.label || campanha.status}
                            </Badge>
                            {disparosDaCampanha.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Send className="w-3 h-3 mr-1" />
                                {disparosDaCampanha.length} disparos • {totalEnviados} enviados
                              </Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Período</p>
                              <p>
                                {campanha.data_inicio ? new Date(campanha.data_inicio).toLocaleDateString('pt-BR') : '-'} 
                                {' - '} 
                                {campanha.data_fim ? new Date(campanha.data_fim).toLocaleDateString('pt-BR') : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Público</p>
                              <p>{campanha.publico_alvo || 'Todos'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Orçamento</p>
                              <p>R$ {(campanha.orcamento || 0).toLocaleString('pt-BR')}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Conversões</p>
                              <p className="font-medium text-green-500">{campanha.conversoes || 0}</p>
                            </div>
                          </div>

                          {campanha.status === 'ativa' && campanha.orcamento > 0 && (
                            <div className="mt-3">
                              <div className="w-full bg-muted rounded-full h-2">
                                <div 
                                  className="bg-primary h-2 rounded-full transition-all"
                                  style={{ width: `${Math.min(((campanha.gasto || 0) / (campanha.orcamento || 1)) * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <Button variant="ghost" size="icon" onClick={e => e.stopPropagation()}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Disparos vinculados (expandido) */}
                    {isExpandida && (
                      <div className="border-t bg-[#0a2e28]/50 p-4">
                        <p className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Send className="w-4 h-4" />
                          Disparos vinculados ({disparosDaCampanha.length})
                        </p>
                        {disparosDaCampanha.length > 0 ? (
                          <div className="space-y-2">
                            {disparosDaCampanha.map(disparo => (
                              <div key={disparo.id} className="flex items-center justify-between p-2 border rounded-lg bg-white/5">
                                <div className="flex items-center gap-3">
                                  <Send className="w-4 h-4 text-muted-foreground" />
                                  <div>
                                    <p className="text-sm font-medium">{disparo.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(disparo.created_at).toLocaleDateString('pt-BR')}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm">{disparo.sent || 0} enviados</span>
                                  <Badge className={statusConfig[disparo.status]?.cor || 'bg-gray-500/20 text-gray-400'}>
                                    {statusConfig[disparo.status]?.label || disparo.status}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Nenhum disparo vinculado ainda. Crie um na aba Disparo.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Megaphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhuma campanha encontrada</p>
              <Button className="mt-4" onClick={() => setShowNewCampanha(true)}>Criar Primeira Campanha</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}