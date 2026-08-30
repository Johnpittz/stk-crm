'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, 
  Megaphone, 
  Calendar, 
  Target, 
  Users, 
  TrendingUp, 
  MoreVertical,
  Trash2,
  Eye,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
  BarChart3,
  MessageSquare,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Campanha {
  id: string;
  nome: string;
  descricao: string;
  tipo: string;
  status: string;
  data_inicio: string;
  data_fim: string;
  meta: number;
  created_at: string;
  disparos?: Disparo[];
}

interface Disparo {
  id: string;
  nome: string;
  mensagem: string;
  instanceName: string;
  phone_from: string;
  status: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  delay_min: number;
  delay_max: number;
  created_at: string;
  promocao?: {
    id: string;
    nome: string;
    desconto: number;
    cupom: string;
  };
}

interface CampanhaStats {
  totalDisparos: number;
  totalEnviados: number;
  totalEntregues: number;
  totalLidos: number;
  totalFalhas: number;
}

export default function CampanhasPage() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNovoDialog, setShowNovoDialog] = useState(false);
  const [showDisparoDialog, setShowDisparoDialog] = useState(false);
  const [showDetalhesDialog, setShowDetalhesDialog] = useState(false);
  const [campanhaSelecionada, setCampanhaSelecionada] = useState<Campanha | null>(null);
  const [expandedCampanha, setExpandedCampanha] = useState<string | null>(null);
  const [instances, setInstances] = useState<any[]>([]);
  const [promocoes, setPromocoes] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const [novaCampanha, setNovaCampanha] = useState({
    nome: '',
    descricao: '',
    tipo: 'promocional',
    status: 'rascunho',
    data_inicio: '',
    data_fim: '',
    meta: 0
  });

  const [novoDisparo, setNovoDisparo] = useState({
    nome: '',
    mensagem: '',
    instanceName: '',
    phone_from: '',
    delay_min: 5,
    delay_max: 30,
    promocao_id: ''
  });

  const loadCampanhas = useCallback(async () => {
    try {
      const { data: campanhasData, error: campanhasError } = await supabase
        .from('campanhas')
        .select('*')
        .order('created_at', { ascending: false });

      if (campanhasError) throw campanhasError;

      const campanhasComDisparos = await Promise.all(
        (campanhasData || []).map(async (campanha) => {
          const { data: disparos } = await supabase
            .from('bulk_campaigns')
            .select('*, promocao:promocoes_marketing(id, nome, desconto, cupom)')
            .eq('campanha_id', campanha.id)
            .order('created_at', { ascending: false });

          return { ...campanha, disparos: disparos || [] };
        })
      );

      setCampanhas(campanhasComDisparos);
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
      toast({
        title: "Erro ao carregar campanhas",
        description: "Não foi possível carregar as campanhas.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadInstances = useCallback(async () => {
    try {
      const response = await fetch('/api/instances');
      const data = await response.json();
      if (data.success) {
        setInstances(data.instances);
      }
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    }
  }, []);

  const loadPromocoes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('promocoes_marketing')
        .select('*')
        .eq('status', 'ativa')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromocoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar promoções:', error);
    }
  }, []);

  useEffect(() => {
    loadCampanhas();
    loadInstances();
    loadPromocoes();
  }, [loadCampanhas, loadInstances, loadPromocoes]);

  const getCampanhaStats = (campanha: Campanha): CampanhaStats => {
    const disparos = campanha.disparos || [];
    return {
      totalDisparos: disparos.length,
      totalEnviados: disparos.reduce((sum, d) => sum + (d.sent || 0), 0),
      totalEntregues: disparos.reduce((sum, d) => sum + (d.delivered || 0), 0),
      totalLidos: disparos.reduce((sum, d) => sum + (d.read || 0), 0),
      totalFalhas: disparos.reduce((sum, d) => sum + (d.failed || 0), 0)
    };
  };

  const criarCampanha = async () => {
    if (!novaCampanha.nome) {
      toast({
        title: "Erro",
        description: "Nome da campanha é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('campanhas')
        .insert([{
          nome: novaCampanha.nome,
          descricao: novaCampanha.descricao,
          tipo: novaCampanha.tipo,
          status: novaCampanha.status,
          data_inicio: novaCampanha.data_inicio || null,
          data_fim: novaCampanha.data_fim || null,
          meta: novaCampanha.meta || 0
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Campanha criada!",
        description: "A campanha foi criada com sucesso."
      });

      setShowNovoDialog(false);
      setNovaCampanha({
        nome: '',
        descricao: '',
        tipo: 'promocional',
        status: 'rascunho',
        data_inicio: '',
        data_fim: '',
        meta: 0
      });
      loadCampanhas();
    } catch (error) {
      console.error('Erro ao criar campanha:', error);
      toast({
        title: "Erro ao criar campanha",
        description: "Não foi possível criar a campanha.",
        variant: "destructive"
      });
    }
  };

  const criarDisparo = async () => {
    if (!novoDisparo.nome || !novoDisparo.mensagem || !novoDisparo.instanceName || !campanhaSelecionada) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    try {
      let mensagemFinal = novoDisparo.mensagem;
      
      if (novoDisparo.promocao_id) {
        const promocao = promocoes.find(p => p.id === novoDisparo.promocao_id);
        if (promocao) {
          mensagemFinal = mensagemFinal.replace(/\{\{promocao\}\}/g, promocao.cupom);
        }
      }

      const { data, error } = await supabase
        .from('bulk_campaigns')
        .insert([{
          nome: novoDisparo.nome,
          instanceName: novoDisparo.instanceName,
          phone_from: novoDisparo.phone_from || null,
          delay_min: novoDisparo.delay_min || 5,
          delay_max: novoDisparo.delay_max || 30,
          status: 'rascunho',
          mensagem: mensagemFinal,
          campanha_id: campanhaSelecionada.id,
          promocao_id: novoDisparo.promocao_id || null
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Disparo criado!",
        description: "O disparo foi vinculado à campanha."
      });

      setShowDisparoDialog(false);
      setNovoDisparo({
        nome: '',
        mensagem: '',
        instanceName: '',
        phone_from: '',
        delay_min: 5,
        delay_max: 30,
        promocao_id: ''
      });
      loadCampanhas();
    } catch (error) {
      console.error('Erro ao criar disparo:', error);
      toast({
        title: "Erro ao criar disparo",
        description: "Não foi possível criar o disparo.",
        variant: "destructive"
      });
    }
  };

  const enviarDisparo = async (disparoId: string) => {
    setSending(true);
    try {
      const response = await fetch('/api/bulk/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: disparoId })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Disparo enviado!",
          description: result.message || "Mensagens sendo enviadas."
        });
        loadCampanhas();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Erro ao enviar disparo:', error);
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar o disparo.",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const excluirCampanha = async (campanhaId: string) => {
    try {
      const { error } = await supabase
        .from('campanhas')
        .delete()
        .eq('id', campanhaId);

      if (error) throw error;

      toast({
        title: "Campanha excluída",
        description: "A campanha foi removida."
      });
      loadCampanhas();
    } catch (error) {
      console.error('Erro ao excluir campanha:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir a campanha.",
        variant: "destructive"
      });
    }
  };

  const excluirDisparo = async (disparoId: string) => {
    try {
      const { error } = await supabase
        .from('bulk_campaigns')
        .delete()
        .eq('id', disparoId);

      if (error) throw error;

      toast({
        title: "Disparo excluído",
        description: "O disparo foi removido."
      });
      loadCampanhas();
    } catch (error) {
      console.error('Erro ao excluir disparo:', error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o disparo.",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      'rascunho': 'bg-gray-600 text-gray-100',
      'agendado': 'bg-blue-600 text-blue-100',
      'em_andamento': 'bg-yellow-600 text-yellow-100',
      'concluido': 'bg-green-600 text-green-100',
      'pausado': 'bg-orange-600 text-orange-100',
      'enviado': 'bg-green-600 text-green-100',
      'processando': 'bg-blue-600 text-blue-100',
      'erro': 'bg-red-600 text-red-100'
    };
    
    const labels: Record<string, string> = {
      'rascunho': 'Rascunho',
      'agendado': 'Agendado',
      'em_andamento': 'Em Andamento',
      'concluido': 'Concluído',
      'pausado': 'Pausado',
      'enviado': 'Enviado',
      'processando': 'Processando',
      'erro': 'Erro'
    };
    
    return (
      <Badge className={styles[status] || 'bg-gray-600'}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campanhas</h1>
          <p className="text-gray-400">Crie e gerencie suas campanhas e disparos</p>
        </div>
        <Dialog open={showNovoDialog} onOpenChange={setShowNovoDialog}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" />
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">Criar Nova Campanha</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-300">Nome da Campanha *</Label>
                <Input
                  value={novaCampanha.nome}
                  onChange={(e) => setNovaCampanha({...novaCampanha, nome: e.target.value})}
                  placeholder="Ex: Black Friday 2026"
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Descrição</Label>
                <Textarea
                  value={novaCampanha.descricao}
                  onChange={(e) => setNovaCampanha({...novaCampanha, descricao: e.target.value})}
                  placeholder="Descreva o objetivo da campanha..."
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Tipo</Label>
                  <Select value={novaCampanha.tipo} onValueChange={(v) => setNovaCampanha({...novaCampanha, tipo: v})}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      <SelectItem value="promocional">Promocional</SelectItem>
                      <SelectItem value="lancamento">Lançamento</SelectItem>
                      <SelectItem value="engajamento">Engajamento</SelectItem>
                      <SelectItem value="sazonal">Sazonal</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-300">Status</Label>
                  <Select value={novaCampanha.status} onValueChange={(v) => setNovaCampanha({...novaCampanha, status: v})}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="agendado">Agendado</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Data Início</Label>
                  <Input
                    type="date"
                    value={novaCampanha.data_inicio}
                    onChange={(e) => setNovaCampanha({...novaCampanha, data_inicio: e.target.value})}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Data Fim</Label>
                  <Input
                    type="date"
                    value={novaCampanha.data_fim}
                    onChange={(e) => setNovaCampanha({...novaCampanha, data_fim: e.target.value})}
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-300">Meta de Mensagens</Label>
                <Input
                  type="number"
                  value={novaCampanha.meta}
                  onChange={(e) => setNovaCampanha({...novaCampanha, meta: parseInt(e.target.value) || 0})}
                  placeholder="0"
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <Button onClick={criarCampanha} className="w-full bg-emerald-600 hover:bg-emerald-700">
                Criar Campanha
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {campanhas.length === 0 ? (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Megaphone className="h-12 w-12 text-gray-500 mb-4" />
              <p className="text-gray-400 text-lg">Nenhuma campanha criada</p>
              <p className="text-gray-500 text-sm mt-1">Crie sua primeira campanha para começar</p>
            </CardContent>
          </Card>
        ) : (
          campanhas.map((campanha) => {
            const stats = getCampanhaStats(campanha);
            const isExpanded = expandedCampanha === campanha.id;
            
            return (
              <Card key={campanha.id} className="bg-gray-800/50 border-gray-700">
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-700/30 transition-colors"
                  onClick={() => setExpandedCampanha(isExpanded ? null : campanha.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                        <Megaphone className="h-6 w-6 text-emerald-400" />
                      </div>
                      <div>
                        <CardTitle className="text-white text-lg">{campanha.nome}</CardTitle>
                        <p className="text-gray-400 text-sm">{campanha.descricao || 'Sem descrição'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-white font-semibold">{stats.totalDisparos} disparos</p>
                        <p className="text-gray-400 text-sm">{stats.totalEnviados} mensagens</p>
                      </div>
                      {getStatusBadge(campanha.status)}
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                {isExpanded && (
                  <CardContent className="border-t border-gray-700">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-medium">Disparos desta Campanha</h3>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCampanhaSelecionada(campanha);
                              setShowDisparoDialog(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Novo Disparo
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              excluirCampanha(campanha.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {campanha.disparos && campanha.disparos.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow className="border-gray-700">
                              <TableHead className="text-gray-300">Nome</TableHead>
                              <TableHead className="text-gray-300">Instância</TableHead>
                              <TableHead className="text-gray-300">Promoção</TableHead>
                              <TableHead className="text-gray-300">Enviados</TableHead>
                              <TableHead className="text-gray-300">Entregues</TableHead>
                              <TableHead className="text-gray-300">Status</TableHead>
                              <TableHead className="text-gray-300">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {campanha.disparos.map((disparo) => (
                              <TableRow key={disparo.id} className="border-gray-700">
                                <TableCell className="text-white font-medium">{disparo.nome}</TableCell>
                                <TableCell className="text-gray-300">{disparo.instanceName}</TableCell>
                                <TableCell>
                                  {disparo.promocao ? (
                                    <Badge className="bg-purple-600 text-purple-100">
                                      {disparo.promocao.cupom}
                                    </Badge>
                                  ) : (
                                    <span className="text-gray-500">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-gray-300">{disparo.sent || 0}</TableCell>
                                <TableCell className="text-gray-300">{disparo.delivered || 0}</TableCell>
                                <TableCell>{getStatusBadge(disparo.status)}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    {disparo.status === 'rascunho' && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => enviarDisparo(disparo.id)}
                                        disabled={sending}
                                        className="text-emerald-400 hover:text-emerald-300"
                                      >
                                        <Send className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => excluirDisparo(disparo.id)}
                                      className="text-red-400 hover:text-red-300"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Send className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Nenhum disparo criado para esta campanha</p>
                          <p className="text-sm mt-1">Clique em "Novo Disparo" para começar</p>
                        </div>
                      )}

                      {stats.totalDisparos > 0 && (
                        <div className="grid grid-cols-4 gap-4 mt-4">
                          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-white">{stats.totalEnviados}</p>
                            <p className="text-gray-400 text-sm">Enviados</p>
                          </div>
                          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-green-400">{stats.totalEntregues}</p>
                            <p className="text-gray-400 text-sm">Entregues</p>
                          </div>
                          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-blue-400">{stats.totalLidos}</p>
                            <p className="text-gray-400 text-sm">Lidos</p>
                          </div>
                          <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-red-400">{stats.totalFalhas}</p>
                            <p className="text-gray-400 text-sm">Falhas</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={showDisparoDialog} onOpenChange={setShowDisparoDialog}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              Criar Disparo - {campanhaSelecionada?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Nome do Disparo *</Label>
              <Input
                value={novoDisparo.nome}
                onChange={(e) => setNovoDisparo({...novoDisparo, nome: e.target.value})}
                placeholder="Ex: Envio 1 - Clientes Ativos"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-300">Mensagem *</Label>
              <Textarea
                value={novoDisparo.mensagem}
                onChange={(e) => setNovoDisparo({...novoDisparo, mensagem: e.target.value})}
                placeholder="Olá! Temos uma oferta especial para você..."
                className="bg-gray-700 border-gray-600 text-white min-h-[120px]"
              />
              <p className="text-gray-500 text-xs mt-1">
                Use {'{{nome}}'}, {'{{telefone}}'}, {'{{promocao}}'} como variáveis
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Instância WhatsApp *</Label>
                <Select value={novoDisparo.instanceName} onValueChange={(v) => setNovoDisparo({...novoDisparo, instanceName: v})}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    {instances.map((instance) => (
                      <SelectItem key={instance.name} value={instance.name}>
                        {instance.name} ({instance.number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">Promoção (Opcional)</Label>
                <Select value={novoDisparo.promocao_id} onValueChange={(v) => setNovoDisparo({...novoDisparo, promocao_id: v})}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    <SelectItem value="">Nenhuma</SelectItem>
                    {promocoes.map((promocao) => (
                      <SelectItem key={promocao.id} value={promocao.id}>
                        {promocao.nome} ({promocao.cupom})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Delay Mínimo (seg)</Label>
                <Input
                  type="number"
                  value={novoDisparo.delay_min}
                  onChange={(e) => setNovoDisparo({...novoDisparo, delay_min: parseInt(e.target.value) || 5})}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-300">Delay Máximo (seg)</Label>
                <Input
                  type="number"
                  value={novoDisparo.delay_max}
                  onChange={(e) => setNovoDisparo({...novoDisparo, delay_max: parseInt(e.target.value) || 30})}
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4">
              <p className="text-gray-300 text-sm">
                <strong>Vinculado à campanha:</strong> {campanhaSelecionada?.nome}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Os disparos ficam organizados dentro desta campanha
              </p>
            </div>
            <Button onClick={criarDisparo} className="w-full bg-emerald-600 hover:bg-emerald-700">
              Criar Disparo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}