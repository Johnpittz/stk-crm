"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Send, Clock, CheckCircle, XCircle, 
  MoreVertical, Search, Filter, Plus, Loader2, Trash2
} from "lucide-react";

// Tipos
interface Instance {
  id: string;
  name: string;
  number: string;
  status: string;
}

interface Campanha {
  id: string;
  name: string;
  message: string;
  numbers: string[];
  status: string;
  sent: number;
  failed: number;
  instancia: string;
  delay_min: number;
  delay_max: number;
  created_at: string;
}

const statusConfig: Record<string, { label: string; cor: string }> = {
  pending: { label: "Pendente", cor: "bg-yellow-500/20 text-yellow-400" },
  running: { label: "Em execução", cor: "bg-blue-500/20 text-blue-400" },
  completed: { label: "Concluído", cor: "bg-green-500/20 text-green-400" },
  failed: { label: "Erro", cor: "bg-red-500/20 text-red-400" },
};

export default function MarketingDisparoPage() {
  const [showNewDisparo, setShowNewDisparo] = useState(false);
  const [instancias, setInstancias] = useState<Instance[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState('');

  // Formulário
  const [nome, setNome] = useState('');
  const [canal, setCanal] = useState('whatsapp');
  const [mensagem, setMensagem] = useState('');
  const [instancia, setInstancia] = useState('');
  const [delayMin, setDelayMin] = useState(3);
  const [delayMax, setDelayMax] = useState(8);
  const [agendamento, setAgendamento] = useState('');
  const [numeros, setNumeros] = useState('');

  // Carregar instâncias
  useEffect(() => {
    fetch('/api/instances')
      .then(r => r.json())
      .then(data => {
        setInstancias(data.instancias || []);
        if (data.instancias?.length > 0) {
          setInstancia(data.instancias[0].name);
        }
      })
      .catch(() => {});
  }, []);

  // Carregar campanhas
  const carregarCampanhas = async () => {
    try {
      const res = await fetch('/api/bulk/campaigns');
      const data = await res.json();
      setCampanhas(data.campaigns || []);
    } catch (err) {
      console.error('Erro ao carregar campanhas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarCampanhas();
  }, []);

  // Criar campanha
  const handleCriar = async (acao: 'enviar' | 'rascunho') => {
    if (!nome || !mensagem) return;

    const numerosArray = numeros
      .split('\n')
      .map(n => n.trim())
      .filter(n => n.length > 0);

    try {
      const res = await fetch('/api/bulk/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nome,
          message: mensagem,
          numbers: numerosArray,
          instancia,
          delay_min: delayMin,
          delay_max: delayMax,
        }),
      });

      const data = await res.json();
      
      if (data.campaign && acao === 'enviar') {
        setEnviando(true);
        await fetch('/api/bulk/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId: data.campaign.id }),
        });
        setEnviando(false);
      }

      // Limpar formulário e recarregar
      setNome('');
      setMensagem('');
      setNumeros('');
      setShowNewDisparo(false);
      carregarCampanhas();
    } catch (err) {
      console.error('Erro ao criar campanha:', err);
      setEnviando(false);
    }
  };

  // Deletar campanha
  const handleDeletar = async (id: string) => {
    if (!confirm('Deseja excluir esta campanha?')) return;
    try {
      await fetch(`/api/bulk/campaigns?id=${id}`, { method: 'DELETE' });
      carregarCampanhas();
    } catch (err) {
      console.error('Erro ao deletar:', err);
    }
  };

  // Filtrar
  const campanhasFiltradas = campanhas.filter(c =>
    c.name.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Disparo em Massa</h2>
          <p className="text-muted-foreground">Envie mensagens para múltiplos contatos</p>
        </div>
        <Button onClick={() => setShowNewDisparo(!showNewDisparo)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Disparo
        </Button>
      </div>

      {/* Formulário de Novo Disparo */}
      {showNewDisparo && (
        <Card>
          <CardHeader>
            <CardTitle>Criar Novo Disparo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nome do Disparo</label>
                <Input 
                  placeholder="Ex: Promoção de Natal" 
                  className="mt-1"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Canal</label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]"
                  value={canal}
                  onChange={e => setCanal(e.target.value)}
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
            </div>

            {/* Instância / Número de Origem */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Enviar de qual número?</label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]"
                  value={instancia}
                  onChange={e => setInstancia(e.target.value)}
                >
                  {instancias.length > 0 ? (
                    instancias.map(inst => (
                      <option key={inst.name} value={inst.name}>
                        {inst.name} ({inst.number}) - {inst.status === 'open' ? '🟢 Conectado' : '🔴 Desconectado'}
                      </option>
                    ))
                  ) : (
                    <option value="minha-conexao">minha-conexao (padrão)</option>
                  )}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Selecione a instância WhatsApp que será usada para o envio
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Agendamento</label>
                <Input 
                  type="datetime-local" 
                  className="mt-1"
                  value={agendamento}
                  onChange={e => setAgendamento(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Deixe vazio para enviar imediatamente
                </p>
              </div>
            </div>

            {/* Delay entre envios */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Delay Mínimo (segundos)</label>
                <Input 
                  type="number" 
                  min="1" 
                  max="60"
                  className="mt-1"
                  value={delayMin}
                  onChange={e => setDelayMin(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tempo mínimo entre cada envio (recomendado: 3-5s)
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Delay Máximo (segundos)</label>
                <Input 
                  type="number" 
                  min="1" 
                  max="120"
                  className="mt-1"
                  value={delayMax}
                  onChange={e => setDelayMax(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tempo máximo entre envios (aleatório entre min e max)
                </p>
              </div>
            </div>

            {/* Mensagem */}
            <div>
              <label className="text-sm font-medium">Mensagem</label>
              <Textarea 
                placeholder="Digite sua mensagem aqui... Use {{nome}} para personalizar" 
                className="mt-1 h-32"
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis disponíveis: {"{{nome}}"}, {"{{empresa}}"}, {"{{telefone}}"}
              </p>
            </div>

            {/* Números */}
            <div>
              <label className="text-sm font-medium">Números (1 por linha)</label>
              <Textarea 
                placeholder={"11999991234\n11988885678\n21977774321"}
                className="mt-1 h-24 font-mono text-sm"
                value={numeros}
                onChange={e => setNumeros(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Cole os números, 1 por linha. O sistema adiciona automaticamente o 55 (Brasil) se não tiver.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewDisparo(false)}>Cancelar</Button>
              <Button variant="outline" onClick={() => handleCriar('rascunho')}>
                Salvar Rascunho
              </Button>
              <Button onClick={() => handleCriar('enviar')} disabled={enviando}>
                {enviando ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {enviando ? 'Enviando...' : 'Enviar Agora'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Disparos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Disparos Recentes</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Buscar disparo..." 
                  className="pl-9 w-64"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#14919B]" />
            </div>
          ) : campanhasFiltradas.length > 0 ? (
            <div className="space-y-4">
              {campanhasFiltradas.map((campanha) => (
                <div 
                  key={campanha.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Send className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{campanha.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {new Date(campanha.created_at).toLocaleDateString('pt-BR')} • 
                        {campanha.numbers?.length || 0} contatos • 
                        Instância: {campanha.instancia || 'minha-conexao'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Delay: {campanha.delay_min || 3}-{campanha.delay_max || 8}s
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {campanha.status === 'completed' && (
                      <div className="text-right">
                        <p className="text-sm font-medium">{campanha.sent} enviados</p>
                        {campanha.failed > 0 && (
                          <p className="text-xs text-red-400">{campanha.failed} falharam</p>
                        )}
                      </div>
                    )}
                    {campanha.status === 'running' && (
                      <div className="text-right">
                        <p className="text-sm font-medium text-blue-400">{campanha.sent} enviados</p>
                        <Loader2 className="w-4 h-4 animate-spin text-blue-400 inline" />
                      </div>
                    )}
                    <Badge className={statusConfig[campanha.status]?.cor || 'bg-gray-500/20 text-gray-400'}>
                      {statusConfig[campanha.status]?.label || campanha.status}
                    </Badge>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDeletar(campanha.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Send className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum disparo realizado ainda</p>
              <Button className="mt-4" onClick={() => setShowNewDisparo(true)}>
                Criar Primeiro Disparo
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}