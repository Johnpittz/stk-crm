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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Megaphone, Trash2, ChevronDown, ChevronUp, Send, Loader2, Upload, FileSpreadsheet, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import * as XLSX from 'xlsx';

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
  tipo_envio?: string;
  contatos?: any[];
  promocao?: { id: string; nome: string; desconto: number; cupom: string };
}

interface CampanhaStats {
  totalDisparos: number;
  totalEnviados: number;
  totalEntregues: number;
  totalLidos: number;
  totalFalhas: number;
}

interface ContatoPlanilha {
  nome: string;
  telefone: string;
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
  const [tipoEnvio, setTipoEnvio] = useState<'avulso' | 'massa'>('avulso');
  const [contatosImportados, setContatosImportados] = useState<ContatoPlanilha[]>([]);
  const [fileName, setFileName] = useState('');
  const supabase = createClient();

  const [novaCampanha, setNovaCampanha] = useState({
    nome: '', descricao: '', tipo: 'promocional', status: 'rascunho',
    data_inicio: '', data_fim: '', meta: 0
  });

  const [novoDisparo, setNovoDisparo] = useState({
    nome: '', mensagem: '', instanceName: '', phone_from: '',
    delay_min: 5, delay_max: 30, promocao_id: '',
    telefone_avulso: ''
  });

  const loadCampanhas = useCallback(async () => {
    try {
      const { data: campanhasData, error: campanhasError } = await supabase
        .from('campanhas').select('*').order('created_at', { ascending: false });
      if (campanhasError) throw campanhasError;

      const campanhasComDisparos = await Promise.all(
        (campanhasData || []).map(async (campanha: any) => {
          const { data: disparos } = await supabase
            .from('bulk_campaigns')
            .select('*')
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
  }, [supabase]);

  const loadInstances = useCallback(async () => {
    try {
      const response = await fetch('/api/instances');
      const data = await response.json();
      setInstances(data.instancias || data.instances || []);
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    }
  }, []);

  const loadPromocoes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('promocoes_marketing').select('*').eq('status', 'ativa')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPromocoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar promoções:', error);
    }
  }, [supabase]);

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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

        // Converter tudo para arrays brutos para encontrar o header corretamente
        const rawData: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });

        // Encontrar a linha do header: procura a linha que contém coluna de telefone
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rawData.length, 10); i++) {
          const row = rawData[i];
          const rowJoined = row.map((c: any) => String(c).toLowerCase()).join(' | ');
          if (/whatsapp|telefone|celular|phone|cel/.test(rowJoined)) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          toast.error("Nao foi possivel encontrar coluna de telefone na planilha.");
          return;
        }

        const headers: string[] = rawData[headerRowIndex].map((h: any) => String(h || '').trim());
        const dataRows = rawData.slice(headerRowIndex + 1);

        console.log('[Planilha] Headers encontrados:', headers);
        console.log('[Planilha] Total de linhas de dados:', dataRows.length);

        const contatos: ContatoPlanilha[] = dataRows
          .filter((row: any[]) => row.some((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== ''))
          .map((row: any[]) => {
            const rowObj: Record<string, string> = {};
            headers.forEach((h, idx) => { rowObj[h] = String(row[idx] || ''); });
            
            // Buscar nome
            const nomeKey = headers.find(h => /nome.*estabelecimento|razao|empresa|name/i.test(h)) || headers[0];
            const nome = rowObj[nomeKey] || '';
            
            // Buscar telefone
            const telKey = headers.find(h => /whatsapp|telefone|celular|phone|cel/i.test(h)) || '';
            const telefoneRaw = rowObj[telKey] || '';
            const telefone = telefoneRaw.replace(/\D/g, '');

            return { nome, telefone };
          })
          .filter(c => c.telefone.length >= 10);

        console.log('[Planilha] Contatos validos:', contatos.length);

        setContatosImportados(contatos);
        toast.success(`${contatos.length} contatos importados com sucesso!`);
      } catch (error) {
        console.error('Erro ao ler planilha:', error);
        toast.error("Erro ao ler a planilha. Verifique o formato.");
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const criarCampanha = async () => {
    if (!novaCampanha.nome) {
      toast.error("Nome da campanha é obrigatório");
      return;
    }
    try {
      const { error } = await supabase.from('campanhas').insert([{
        nome: novaCampanha.nome, descricao: novaCampanha.descricao,
        tipo: novaCampanha.tipo, status: novaCampanha.status,
        data_inicio: novaCampanha.data_inicio || null,
        data_fim: novaCampanha.data_fim || null,
        meta: novaCampanha.meta || 0
      }]);
      if (error) throw error;
      toast.success("Campanha criada com sucesso!");
      setShowNovoDialog(false);
      setNovaCampanha({ nome: '', descricao: '', tipo: 'promocional', status: 'rascunho', data_inicio: '', data_fim: '', meta: 0 });
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

    // Validação por tipo de envio
    if (tipoEnvio === 'avulso') {
      const numeros = novoDisparo.telefone_avulso
        .split(/[\n,]+/)
        .map(n => n.replace(/\D/g, '').trim())
        .filter(n => n.length >= 10);
      if (numeros.length === 0) {
        toast.error("Digite pelo menos um número de telefone válido");
        return;
      }
    }

    if (tipoEnvio === 'massa' && contatosImportados.length === 0) {
      toast.error("Faça upload de uma planilha com contatos");
      return;
    }

    try {
      let mensagemFinal = novoDisparo.mensagem;
      if (novoDisparo.promocao_id) {
        const promocao = promocoes.find(p => p.id === novoDisparo.promocao_id);
        if (promocao) mensagemFinal = mensagemFinal.replace(/\{\{promocao\}\}/g, promocao.cupom);
      }

      const contatosAvulso = tipoEnvio === 'avulso'
        ? novoDisparo.telefone_avulso
            .split(/[\n,]+/)
            .map(n => n.replace(/\D/g, '').trim())
            .filter(n => n.length >= 10)
            .map(n => ({ nome: '', telefone: n }))
        : [];

      const contatosFinais = tipoEnvio === 'massa' ? contatosImportados : contatosAvulso;
      const { error } = await supabase.from('bulk_campaigns').insert([{
        name: novoDisparo.nome,
        message: mensagemFinal,
        numbers: contatosFinais.map(c => c.telefone || c),
        status: 'rascunho',
        sent: 0,
        failed: 0,
      }]);

      if (error) throw error;

      const msg = tipoEnvio === 'avulso'
        ? "Disparo avulso criado!"
        : `Disparo em massa criado! ${contatosImportados.length} contatos.`;
      toast.success(msg);

      resetarDialog();
      loadCampanhas();
    } catch (error) {
      console.error('Erro ao criar disparo:', error);
      toast.error("Não foi possível criar o disparo.");
    }
  };

  const resetarDialog = () => {
    setShowDisparoDialog(false);
    setNovoDisparo({ nome: '', mensagem: '', instanceName: '', phone_from: '', delay_min: 5, delay_max: 30, promocao_id: '', telefone_avulso: '' });
    setContatosImportados([]);
    setFileName('');
    setTipoEnvio('avulso');
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
        toast.success(result.message || "Mensagens sendo enviadas.");
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
      const { error } = await supabase.from('campanhas').delete().eq('id', campanhaId);
      if (error) throw error;
      toast.success("Campanha excluída");
      loadCampanhas();
    } catch (error) {
      toast.error("Não foi possível excluir a campanha.");
    }
  };

  const excluirDisparo = async (disparoId: string) => {
    try {
      const { error } = await supabase.from('bulk_campaigns').delete().eq('id', disparoId);
      if (error) throw error;
      toast.success("Disparo excluído");
      loadCampanhas();
    } catch (error) {
      toast.error("Não foi possível excluir o disparo.");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      rascunho: 'bg-gray-600 text-gray-100', agendado: 'bg-blue-600 text-blue-100',
      em_andamento: 'bg-yellow-600 text-yellow-100', concluido: 'bg-green-600 text-green-100',
      pausado: 'bg-orange-600 text-orange-100', enviado: 'bg-green-600 text-green-100',
      processando: 'bg-blue-600 text-blue-100', erro: 'bg-red-600 text-red-100'
    };
    const labels: Record<string, string> = {
      rascunho: 'Rascunho', agendado: 'Agendado', em_andamento: 'Em Andamento',
      concluido: 'Concluído', pausado: 'Pausado', enviado: 'Enviado',
      processando: 'Processando', erro: 'Erro'
    };
    return <Badge className={styles[status] || 'bg-gray-600'}>{labels[status] || status}</Badge>;
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
          <p className="text-gray-400">Crie campanhas e gerencie disparos dentro delas</p>
        </div>
        <Dialog open={showNovoDialog} onOpenChange={setShowNovoDialog}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4 mr-2" /> Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">Criar Nova Campanha</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-300">Nome da Campanha *</Label>
                <Input value={novaCampanha.nome} onChange={(e) => setNovaCampanha({...novaCampanha, nome: e.target.value})} placeholder="Ex: Black Friday 2026" className="bg-gray-700 border-gray-600 text-white" />
              </div>
              <div>
                <Label className="text-gray-300">Descrição</Label>
                <Textarea value={novaCampanha.descricao} onChange={(e) => setNovaCampanha({...novaCampanha, descricao: e.target.value})} placeholder="Descreva o objetivo da campanha..." className="bg-gray-700 border-gray-600 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Tipo</Label>
                  <Select value={novaCampanha.tipo} onValueChange={(v) => setNovaCampanha({...novaCampanha, tipo: v})}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white"><SelectValue /></SelectTrigger>
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
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white"><SelectValue /></SelectTrigger>
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
                  <Input type="date" value={novaCampanha.data_inicio} onChange={(e) => setNovaCampanha({...novaCampanha, data_inicio: e.target.value})} className="bg-gray-700 border-gray-600 text-white" />
                </div>
                <div>
                  <Label className="text-gray-300">Data Fim</Label>
                  <Input type="date" value={novaCampanha.data_fim} onChange={(e) => setNovaCampanha({...novaCampanha, data_fim: e.target.value})} className="bg-gray-700 border-gray-600 text-white" />
                </div>
              </div>
              <div>
                <Label className="text-gray-300">Meta de Mensagens</Label>
                <Input type="number" value={novaCampanha.meta} onChange={(e) => setNovaCampanha({...novaCampanha, meta: parseInt(e.target.value) || 0})} placeholder="0" className="bg-gray-700 border-gray-600 text-white" />
              </div>
              <Button onClick={criarCampanha} className="w-full bg-emerald-600 hover:bg-emerald-700">Criar Campanha</Button>
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
                <CardHeader className="cursor-pointer hover:bg-gray-700/30 transition-colors" onClick={() => setExpandedCampanha(isExpanded ? null : campanha.id)}>
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
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="border-t border-gray-700">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-white font-medium">Disparos desta Campanha</h3>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); setCampanhaSelecionada(campanha); setShowDisparoDialog(true); }} className="bg-emerald-600 hover:bg-emerald-700">
                            <Plus className="h-4 w-4 mr-1" /> Novo Disparo
                          </Button>
                          <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); excluirCampanha(campanha.id); }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {campanha.disparos && campanha.disparos.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow className="border-gray-700">
                              <TableHead className="text-gray-300">Nome</TableHead>
                              <TableHead className="text-gray-300">Tipo</TableHead>
                              <TableHead className="text-gray-300">Instância</TableHead>
                              <TableHead className="text-gray-300">Contatos</TableHead>
                              <TableHead className="text-gray-300">Enviados</TableHead>
                              <TableHead className="text-gray-300">Status</TableHead>
                              <TableHead className="text-gray-300">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {campanha.disparos.map((disparo) => (
                              <TableRow key={disparo.id} className="border-gray-700">
                                <TableCell className="text-white font-medium">{disparo.name}</TableCell>
                                <TableCell className="text-gray-300">
                                  {Array.isArray(disparo.numbers) ? disparo.numbers.length : 1} contato(s)
                                </TableCell>
                                <TableCell className="text-gray-300">{disparo.sent || 0}</TableCell>
                                <TableCell>{getStatusBadge(disparo.status)}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    {disparo.status === 'rascunho' && (
                                      <Button size="sm" variant="ghost" onClick={() => enviarDisparo(disparo.id)} disabled={sending} className="text-emerald-400 hover:text-emerald-300">
                                        <Send className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button size="sm" variant="ghost" onClick={() => excluirDisparo(disparo.id)} className="text-red-400 hover:text-red-300">
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
                          <p className="text-sm mt-1">Clique em &quot;Novo Disparo&quot; para começar</p>
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

      {/* Dialog de Criar Disparo */}
      <Dialog open={showDisparoDialog} onOpenChange={(open) => { if (!open) resetarDialog(); else setShowDisparoDialog(true); }}>
        <DialogContent className="bg-gray-800 border-gray-700 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Criar Disparo - {campanhaSelecionada?.nome}</DialogTitle>
          </DialogHeader>
          
          <Tabs value={tipoEnvio} onValueChange={(v) => setTipoEnvio(v as 'avulso' | 'massa')}>
            <TabsList className="bg-gray-700 w-full">
              <TabsTrigger value="avulso" className="flex-1 data-[state=active]:bg-emerald-600">
                <Send className="h-4 w-4 mr-2" /> Avulso
              </TabsTrigger>
              <TabsTrigger value="massa" className="flex-1 data-[state=active]:bg-emerald-600">
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Em Massa
              </TabsTrigger>
            </TabsList>

            <div className="space-y-4 mt-4">
              {/* CAMPOS COMUNS */}
              <div>
                <Label className="text-gray-300">Nome do Disparo *</Label>
                <Input value={novoDisparo.nome} onChange={(e) => setNovoDisparo({...novoDisparo, nome: e.target.value})} placeholder="Ex: Envio 1 - Clientes Ativos" className="bg-gray-700 border-gray-600 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Instância WhatsApp *</Label>
                  <Select value={novoDisparo.instanceName} onValueChange={(v) => setNovoDisparo({...novoDisparo, instanceName: v})}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      {instances.map((instance) => (
                        <SelectItem key={instance.name} value={instance.name}>{instance.name} ({instance.number})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-300">Promoção (Opcional)</Label>
                  <Select value={novoDisparo.promocao_id || undefined} onValueChange={(v) => setNovoDisparo({...novoDisparo, promocao_id: v})}>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white"><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      {promocoes.map((promocao) => (
                        <SelectItem key={promocao.id} value={promocao.id}>{promocao.nome} ({promocao.cupom})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ABAS POR TIPO */}
              <TabsContent value="avulso" className="space-y-4 mt-0">
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
                  <Label className="text-gray-300">Números de Telefone *</Label>
                  <Textarea
                    value={novoDisparo.telefone_avulso}
                    onChange={(e) => {
                      // Permitir apenas números, vírgulas, espaços, quebras de linha e + no início
                      const raw = e.target.value;
                      setNovoDisparo({...novoDisparo, telefone_avulso: raw});
                    }}
                    placeholder={"556299190117\n556299190118\n556299190119"}
                    className="bg-gray-700 border-gray-600 text-white mt-1 min-h-[100px] font-mono text-sm"
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    Um número por linha, ou separados por vírgula. Formato: código do país + DDD + número
                  </p>
                  {novoDisparo.telefone_avulso && (() => {
                    const numeros = novoDisparo.telefone_avulso
                      .split(/[\n,]+/)
                      .map(n => n.replace(/\D/g, '').trim())
                      .filter(n => n.length >= 10);
                    return numeros.length > 0 ? (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge className="bg-emerald-600 text-emerald-100">{numeros.length} número{numeros.length > 1 ? 's' : ''}</Badge>
                        <span className="text-gray-400 text-xs">será{numeros.length > 1 ? 'ão' : ''} enviada{numeros.length > 1 ? 's' : ''} 1 mensagem para cada</span>
                      </div>
                    ) : null;
                  })()}
                </div>
                <div>
                  <Label className="text-gray-300">Mensagem *</Label>
                  <Textarea value={novoDisparo.mensagem} onChange={(e) => setNovoDisparo({...novoDisparo, mensagem: e.target.value})} placeholder="Olá! Temos uma oferta especial para você..." className="bg-gray-700 border-gray-600 text-white min-h-[120px]" />
                  <p className="text-gray-500 text-xs mt-1">Use {'{{nome}}'}, {'{{telefone}}'}, {'{{promocao}}'} como variáveis</p>
                </div>
              </TabsContent>

              <TabsContent value="massa" className="space-y-4 mt-0">
                <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600">
                  <Label className="text-gray-300">Planilha de Contatos *</Label>
                  <div className="mt-2">
                    <label className="flex items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-emerald-500 transition-colors">
                      <div className="text-center">
                        <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                        {fileName ? (
                          <div>
                            <p className="text-emerald-400 font-medium">{fileName}</p>
                            <p className="text-gray-500 text-xs">{contatosImportados.length} contatos encontrados</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-gray-400">Clique para fazer upload</p>
                            <p className="text-gray-500 text-xs">Formatos: .xlsx, .xls, .csv</p>
                          </div>
                        )}
                      </div>
                      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                  {contatosImportados.length > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-gray-300 text-sm font-medium">Pré-visualização dos contatos:</p>
                        <Button size="sm" variant="ghost" onClick={() => { setContatosImportados([]); setFileName(''); }} className="text-red-400 hover:text-red-300">
                          <X className="h-4 w-4 mr-1" /> Limpar
                        </Button>
                      </div>
                      <div className="max-h-40 overflow-y-auto bg-gray-800 rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-gray-700">
                              <TableHead className="text-gray-300 text-xs">Nome</TableHead>
                              <TableHead className="text-gray-300 text-xs">Telefone</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {contatosImportados.slice(0, 10).map((contato, idx) => (
                              <TableRow key={idx} className="border-gray-700">
                                <TableCell className="text-white text-sm py-1">{contato.nome || '-'}</TableCell>
                                <TableCell className="text-gray-300 text-sm py-1">{contato.telefone}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {contatosImportados.length > 10 && (
                          <p className="text-center text-gray-500 text-xs py-2">...e mais {contatosImportados.length - 10} contatos</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-gray-300">Mensagem-Padrão *</Label>
                  <Textarea value={novoDisparo.mensagem} onChange={(e) => setNovoDisparo({...novoDisparo, mensagem: e.target.value})} placeholder={'Olá {{nome}}! Temos uma proposta especial para a sua empresa...'} className="bg-gray-700 border-gray-600 text-white min-h-[120px]" />
                  <div className="flex items-center gap-4 mt-2">
                    <p className="text-gray-500 text-xs">Variáveis disponíveis:</p>
                    <button type="button" onClick={() => setNovoDisparo({...novoDisparo, mensagem: novoDisparo.mensagem + '{{nome}}'})} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-emerald-400">
                      {'{{nome}}'}
                    </button>
                    <button type="button" onClick={() => setNovoDisparo({...novoDisparo, mensagem: novoDisparo.mensagem + '{{promocao}}'})} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-emerald-400">
                      {'{{promocao}}'}
                    </button>
                  </div>
                </div>
              </TabsContent>

              {/* DELAYS COMUNS */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Delay Mínimo entre envios (seg)</Label>
                  <Input type="number" value={novoDisparo.delay_min} onChange={(e) => setNovoDisparo({...novoDisparo, delay_min: parseInt(e.target.value) || 5})} className="bg-gray-700 border-gray-600 text-white" />
                </div>
                <div>
                  <Label className="text-gray-300">Delay Máximo entre envios (seg)</Label>
                  <Input type="number" value={novoDisparo.delay_max} onChange={(e) => setNovoDisparo({...novoDisparo, delay_max: parseInt(e.target.value) || 30})} className="bg-gray-700 border-gray-600 text-white" />
                </div>
              </div>

              {/* RESUMO */}
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-gray-300 text-sm"><strong>Vinculado à campanha:</strong> {campanhaSelecionada?.nome}</p>
                {tipoEnvio === 'massa' && contatosImportados.length > 0 && (
                  <p className="text-emerald-400 text-sm mt-1"><strong>{contatosImportados.length}</strong> mensagens serão enviadas</p>
                )}
                {tipoEnvio === 'avulso' && novoDisparo.telefone_avulso && (() => {
                  const count = novoDisparo.telefone_avulso
                    .split(/[\n,]+/)
                    .map(n => n.replace(/\D/g, '').trim())
                    .filter(n => n.length >= 10).length;
                  return count > 0 ? (
                    <p className="text-emerald-400 text-sm mt-1"><strong>{count}</strong> mensagens serão enviadas</p>
                  ) : null;
                })()}
              </div>

              <Button onClick={criarDisparo} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {tipoEnvio === 'massa' ? `Criar Disparo (${contatosImportados.length} contatos)` : 'Criar Disparo'}
              </Button>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}