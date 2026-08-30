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
import { 
  Plus, 
  Megaphone, 
  MoreVertical,
  Trash2,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
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
  const [campanhaSelecionada, setCampanhaSelecionada] = useState<Campanha | null>(null);
  const [expandedCampanha, setExpandedCampanha] = useState<string | null>(null);
  const [instances, setInstances] = useState<any[]>([]);
  const [promocoes, setPromocoes] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

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
      toast.error("Não foi possível carregar as campanhas.");
    } finally {
      setLoading(false);
    }
  }, []);

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
      toast.error("Nome da campanha é obrigatório");
      return;
    }

    try {
      const { error } = await supabase
        .from('campanhas')
        .insert([{
          nome: novaCampanha.nome,
          descricao: novaCampanha.descricao,
          tipo: novaCampanha.tipo,
          status: novaCampanha.status,
          data_inicio: novaCampanha.data_inicio || null,
          data_fim: novaCampanha.data_fim || null,
          meta: novaCampanha.meta || 0
        }]);

      if (error) throw error;

      toast.success("A campanha foi criada com sucesso.");

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
      toast.error("Não foi possível criar a campanha.");
    }
  };

  const criarDisparo = async () => {
    if (!novoDisparo.nome || !novoDisparo.mensagem || !novoDisparo.instanceName || !campanhaSelecionada) {
      toast.error("Preencha todos os campos obrigatórios");
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

      const { error } = await supabase
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
        }]);

      if (error) throw error;

      toast.success("O disparo foi vinculado à campanha.");

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
      toast.error("Não foi possível criar o disparo.");
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
      toast.error("Não foi possível enviar o disparo.");
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

      toast.success("A campanha foi removida.");
      loadCampanhas();
    } catch (error) {
      console.error('Erro ao excluir campanha:', error);
      toast.error("Não foi possível excluir a campanha.");
    }
  };

  const excluirDisparo = async (disparoId: string) => {
    try {
      const { error } = await supabase
        .from('bulk_campaigns')
        .delete()
        .eq('id', disparoId);

      if (error) throw error;

      toast.success("O disparo foi removido.");
      loadCampanhas();
    } catch (error) {
      console.error('Erro ao excluir disparo:', error);
      toast.error("Não foi possível excluir o disparo.");
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
