"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Send, Plus, Loader2, Trash2, Search, Link, Tag
} from "lucide-react";

// Tipos
interface Instance {
  id: string;
  name: string;
  number: string;
  status: string;
}

interface CampanhaMarketing {
  id: string;
  nome: string;
  status: string;
}

interface Promocao {
  id: string;
  nome: string;
  tipo: string;
  valor: number;
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
  campanha_id: string | null;
  promocao_id: string | null;
  campanha: CampanhaMarketing | null;
  promocao: Promocao | null;
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
  const [campanhasMarketing, setCampanhasMarketing] = useState<CampanhaMarketing[]>([]);
  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState('');

  // Formulário
  const [nome, setNome] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [instancia, setInstancia] = useState('');
  const [delayMin, setDelayMin] = useState(3);
  const [delayMax, setDelayMax] = useState(8);
  const [numeros, setNumeros] = useState('');
  const [campanhaId, setCampanhaId] = useState('');
  const [promocaoId, setPromocaoId] = useState('');

  // Carregar dados
  useEffect(() => {
    Promise.all([
      fetch('/api/instances').then(r => r.json()),
      fetch('/api/bulk/campaigns').then(r => r.json()),
      fetch('/api/marketing/campanhas').then(r => r.json()),
      fetch('/api/marketing/promocoes').then(r => r.json()),
    ]).then(([instData, campData, campMpData, promoData]) => {
      setInstancias(instData.instancias || []);
      if (instData.instancias?.length > 0) {
        setInstancia(instData.instancias[0].name);
      }
      setCampanhas(campData.campaigns || []);
      setCampanhasMarketing(campMpData.data || []);
      setPromocoes(promoData.data || []);
    }).finally(() => setLoading(false));
  }, []);

  // Recarregar disparos
  const carregarCampanhas = async () => {
    const res = await fetch('/api/bulk/campaigns');
    const data = await res.json();
    setCampanhas(data.campaigns || []);
  };

  // Inserir variável de promoção na mensagem
  const handlePromocaoSelect = (id: string) => {
    setPromocaoId(id);
    const promo = promocoes.find(p => p.id === id);
    if (promo && !mensagem.includes('{{promocao}}')) {
      setMensagem(prev => prev + (prev ? '\n\n' : '') + `Use o cupom {{promocao}} e ganhe ${promo.tipo === 'percentual' ? promo.valor + '% OFF' : 'R$ ' + promo.valor + ' de desconto'}!`);
    }
  };

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
          campanha_id: campanhaId || null,
          promocao_id: promocaoId || null,
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

      setNome('');
      setMensagem('');
      setNumeros('');
      setCampanhaId('');
      setPromocaoId('');
      setShowNewDisparo(false);
      carregarCampanhas();
    } catch (err) {
      console.error('Erro ao criar campanha:', err);
      setEnviando(false);
    }
  };

  // Deletar
  const handleDeletar = async (id: string) => {
    if (!confirm('Deseja excluir este disparo?')) return;
    await fetch(`/api/bulk/campaigns?id=${id}`, { method: 'DELETE' });
    carregarCampanhas();
  };

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
                <label className="text-sm font-medium">Instância / Número de Origem</label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]"
                  value={instancia}
                  onChange={e => setInstancia(e.target.value)}
                >
                  {instancias.length > 0 ? (
                    instancias.map(inst => (
                      <option key={inst.name} value={inst.name}>
                        {inst.name} ({inst.number}) - {inst.status === 'open' ? '🟢' : '🔴'}
                      </option>
                    ))
                  ) : (
                    <option value="minha-conexao">minha-conexao (padrão)</option>
                  )}
                </select>
              </div>
            </div>

            {/* Vincular Campanha + Promoção */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  <Link className="w-4 h-4" />
                  Vincular à Campanha
                </label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]"
                  value={campanhaId}
                  onChange={e => setCampanhaId(e.target.value)}
                >
                  <option value="">Nenhuma (disparo avulso)</option>
                  {campanhasMarketing.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.status})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Vincula este disparo a uma campanha estratégica
                </p>
              </div>
              <div>
                <label className="text-sm font-medium flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  Inserir Promoção na Mensagem
                </label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]"
                  value={promocaoId}
                  onChange={e => handlePromocaoSelect(e.target.value)}
                >
                  <option value="">Nenhuma promoção</option>
                  {promocoes.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome} - {p.tipo === 'percentual' ? p.valor + '% OFF' : 'R$ ' + p.valor}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Adiciona o cupom {"{{promocao}}"} na mensagem
                </p>
              </div>
            </div>

            {/* Delay */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Delay Mínimo (segundos)</label>
                <Input 
                  type="number" min="1" max="60" className="mt-1"
                  value={delayMin} onChange={e => setDelayMin(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Delay Máximo (segundos)</label>
                <Input 
                  type="number" min="1" max="120" className="mt-1"
                  value={delayMax} onChange={e => setDelayMax(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Mensagem */}
            <div>
              <label className="text-sm font-medium">Mensagem</label>
              <Textarea 
                placeholder={"Olá {{nome}}! Temos uma oferta especial para você..."} 
                className="mt-1 h-32"
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis: {"{{nome}}"}, {"{{empresa}}"}, {"{{telefone}}"}, {"{{promocao}}"}
              </p>
            </div>

            {/* Números */}
            <div>
              <label className="text-sm font-medium">Números (1 por linha)</label>
              <Textarea 
                placeholder={"11999991234\n11988885678"}
                className="mt-1 h-24 font-mono text-sm"
                value={numeros}
                onChange={e => setNumeros(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                O sistema adiciona o 55 automaticamente se não tiver.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewDisparo(false)}>Cancelar</Button>
              <Button variant="outline" onClick={() => handleCriar('rascunho')}>Salvar Rascunho</Button>
              <Button onClick={() => handleCriar('enviar')} disabled={enviando}>
                {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
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
                  className="p-4 border rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Send className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{campanha.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {new Date(campanha.created_at).toLocaleDateString('pt-BR')} • 
                          {' '}{campanha.numbers?.length || 0} contatos • 
                          {' '}{campanha.instancia || 'minha-conexao'}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-xs text-muted-foreground">
                            Delay: {campanha.delay_min || 3}-{campanha.delay_max || 8}s
                          </p>
                          {campanha.campanha && (
                            <Badge variant="outline" className="text-xs">
                              <Link className="w-3 h-3 mr-1" />
                              {campanha.campanha.nome}
                            </Badge>
                          )}
                          {campanha.promocao && (
                            <Badge variant="outline" className="text-xs">
                              <Tag className="w-3 h-3 mr-1" />
                              {campanha.promocao.nome}
                            </Badge>
                          )}
                        </div>
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
                      <Button variant="ghost" size="icon" onClick={() => handleDeletar(campanha.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
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