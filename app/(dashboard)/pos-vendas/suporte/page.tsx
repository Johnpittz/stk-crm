"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  LifeBuoy, Plus, Clock, CheckCircle, AlertTriangle, 
  MessageSquare, User, MoreVertical, Search, Filter, 
  ArrowUpRight, Headphones, Loader2 
} from "lucide-react";
import { useApi, useCreate } from "@/lib/hooks/use-api";

// Tipos
interface Chamado {
  id: string;
  cliente_nome: string;
  assunto: string;
  categoria: string;
  status: string;
  prioridade: string;
  atendente_nome: string | null;
  created_at: string;
}

const categoriaConfig: Record<string, { label: string; cor: string }> = {
  tecnico: { label: "Técnico", cor: "bg-blue-500/20 text-blue-400" },
  financeiro: { label: "Financeiro", cor: "bg-purple-500/20 text-purple-400" },
  duvida: { label: "Dúvida", cor: "bg-yellow-500/20 text-yellow-400" },
  reclamacao: { label: "Reclamação", cor: "bg-red-500/20 text-red-400" },
  sugestao: { label: "Sugestão", cor: "bg-green-500/20 text-green-400" },
};

const statusConfig: Record<string, { label: string; cor: string }> = {
  aberto: { label: "Aberto", cor: "bg-yellow-500/20 text-yellow-400" },
  em_atendimento: { label: "Em Atendimento", cor: "bg-blue-500/20 text-blue-400" },
  aguardando_cliente: { label: "Aguardando Cliente", cor: "bg-orange-500/20 text-orange-400" },
  resolvido: { label: "Resolvido", cor: "bg-green-500/20 text-green-400" },
  fechado: { label: "Fechado", cor: "bg-gray-500/20 text-gray-400" },
};

const prioridadeConfig: Record<string, { label: string; cor: string }> = {
  critica: { label: "Crítica", cor: "bg-red-600/20 text-red-300" },
  alta: { label: "Alta", cor: "bg-red-500/20 text-red-400" },
  media: { label: "Média", cor: "bg-yellow-500/20 text-yellow-400" },
  baixa: { label: "Baixa", cor: "bg-green-500/20 text-green-400" },
};

export default function PosVendasSuportePage() {
  const [showNewChamado, setShowNewChamado] = useState(false);
  const [novoChamado, setNovoChamado] = useState({
    cliente_nome: '',
    cliente_telefone: '',
    cliente_email: '',
    assunto: '',
    descricao: '',
    categoria: 'duvida',
    prioridade: 'media'
  });

  const { data: chamados, loading, refetch } = useApi<Chamado[]>({ url: '/api/pos-vendas/chamados' });
  const { create: criarChamado, loading: criando } = useCreate<typeof novoChamado>('/api/pos-vendas/chamados');

  const handleCriarChamado = async () => {
    if (!novoChamado.cliente_nome || !novoChamado.assunto) return;
    
    const resultado = await criarChamado(novoChamado);
    if (resultado) {
      setShowNewChamado(false);
      setNovoChamado({ cliente_nome: '', cliente_telefone: '', cliente_email: '', assunto: '', descricao: '', categoria: 'duvida', prioridade: 'media' });
      refetch();
    }
  };

  // Estatísticas
  const stats = {
    abertos: chamados?.filter(c => c.status === 'aberto').length || 0,
    emAtendimento: chamados?.filter(c => c.status === 'em_atendimento').length || 0,
    tempoMedio: '2.8h', // Mock
    resolvidosHoje: chamados?.filter(c => {
      const data = new Date(c.created_at);
      const hoje = new Date();
      return data.toDateString() === hoje.toDateString() && c.status === 'resolvido';
    }).length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Suporte</h2>
          <p className="text-muted-foreground">Atendimento e resolução de problemas</p>
        </div>
        <Button onClick={() => setShowNewChamado(!showNewChamado)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Chamado
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <MessageSquare className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Abertos</p>
                <p className="text-2xl font-bold">{stats.abertos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Headphones className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Atendimento</p>
                <p className="text-2xl font-bold">{stats.emAtendimento}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio</p>
                <p className="text-2xl font-bold">{stats.tempoMedio}</p>
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
                <p className="text-sm text-muted-foreground">Resolvidos Hoje</p>
                <p className="text-2xl font-bold">{stats.resolvidosHoje}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulário Novo Chamado */}
      {showNewChamado && (
        <Card>
          <CardHeader>
            <CardTitle>Novo Chamado de Suporte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Cliente *</label>
                <Input 
                  placeholder="Nome do cliente" 
                  className="mt-1"
                  value={novoChamado.cliente_nome}
                  onChange={(e) => setNovoChamado({ ...novoChamado, cliente_nome: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Telefone</label>
                <Input 
                  placeholder="(11) 99999-9999" 
                  className="mt-1"
                  value={novoChamado.cliente_telefone}
                  onChange={(e) => setNovoChamado({ ...novoChamado, cliente_telefone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Categoria</label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]"
                  value={novoChamado.categoria}
                  onChange={(e) => setNovoChamado({ ...novoChamado, categoria: e.target.value })}
                >
                  <option value="tecnico">Técnico</option>
                  <option value="financeiro">Financeiro</option>
                  <option value="duvida">Dúvida</option>
                  <option value="reclamacao">Reclamação</option>
                  <option value="sugestao">Sugestão</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]"
                  value={novoChamado.prioridade}
                  onChange={(e) => setNovoChamado({ ...novoChamado, prioridade: e.target.value })}
                >
                  <option value="critica">Crítica</option>
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="baixa">Baixa</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Assunto *</label>
              <Input 
                placeholder="Resumo do problema" 
                className="mt-1"
                value={novoChamado.assunto}
                onChange={(e) => setNovoChamado({ ...novoChamado, assunto: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Descrição</label>
              <textarea 
                className="w-full mt-1 p-2 border rounded-md bg-[#0f3830] min-h-[100px]"
                placeholder="Descreva o problema detalhadamente..."
                value={novoChamado.descricao}
                onChange={(e) => setNovoChamado({ ...novoChamado, descricao: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewChamado(false)}>Cancelar</Button>
              <Button onClick={handleCriarChamado} disabled={criando}>
                {criando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Abrir Chamado
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Chamados */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Chamados Recentes</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar chamado..." className="pl-9 w-64" />
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
              <Loader2 className="w-8 h-8 animate-spin text-[#3B64CF]" />
            </div>
          ) : chamados && chamados.length > 0 ? (
            <div className="space-y-4">
              {chamados.map((chamado) => (
                <div 
                  key={chamado.id}
                  className="p-4 border rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{chamado.assunto}</h4>
                        <Badge className={prioridadeConfig[chamado.prioridade]?.cor || 'bg-gray-500/20 text-gray-400'}>
                          {prioridadeConfig[chamado.prioridade]?.label || chamado.prioridade}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {chamado.cliente_nome}
                        </div>
                        <Badge className={categoriaConfig[chamado.categoria]?.cor || 'bg-gray-500/20 text-gray-400'}>
                          {categoriaConfig[chamado.categoria]?.label || chamado.categoria}
                        </Badge>
                        <span>{new Date(chamado.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>

                      {chamado.atendente_nome && (
                        <p className="text-sm mt-2">
                          <span className="text-muted-foreground">Atendente:</span> {chamado.atendente_nome}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      <Badge className={statusConfig[chamado.status]?.cor || 'bg-gray-500/20 text-gray-400'}>
                        {statusConfig[chamado.status]?.label || chamado.status}
                      </Badge>

                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <LifeBuoy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum chamado encontrado</p>
              <Button className="mt-4" onClick={() => setShowNewChamado(true)}>
                Abrir Primeiro Chamado
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}