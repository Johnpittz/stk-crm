"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Star, TrendingUp, Users, ThumbsUp, ThumbsDown, 
  BarChart3, Download, Filter, Loader2 
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from "recharts";
import { useApi, useCreate } from "@/lib/hooks/use-api";

// Tipos
interface Avaliacao {
  id: string;
  cliente_nome: string;
  nota: number;
  tipo_nps: string;
  comentario: string;
  created_at: string;
}

const tipoConfig: Record<string, { label: string; cor: string }> = {
  promotor: { label: "Promotor", cor: "bg-green-500/20 text-green-400" },
  neutro: { label: "Neutro", cor: "bg-yellow-500/20 text-yellow-400" },
  detrator: { label: "Detrator", cor: "bg-red-500/20 text-red-400" },
};

const getStars = (nota: number) => {
  return Array.from({ length: 5 }, (_, i) => (
    <Star 
      key={i} 
      className={`w-4 h-4 ${i < nota ? 'fill-yellow-500 text-yellow-500' : 'text-gray-600'}`}
    />
  ));
};

export default function PosVendasSatisfacaoPage() {
  const [showNewAvaliacao, setShowNewAvaliacao] = useState(false);
  const [novaAvaliacao, setNovaAvaliacao] = useState({
    cliente_nome: '',
    nota: 5,
    comentario: ''
  });

  const { data: avaliacoes, loading, refetch } = useApi<Avaliacao[]>({ url: '/api/pos-vendas/avaliacoes' });
  const { create: criarAvaliacao, loading: criando } = useCreate<typeof novaAvaliacao>('/api/pos-vendas/avaliacoes');

  const handleCriarAvaliacao = async () => {
    if (!novaAvaliacao.cliente_nome) return;
    
    const resultado = await criarAvaliacao(novaAvaliacao);
    if (resultado) {
      setShowNewAvaliacao(false);
      setNovaAvaliacao({ cliente_nome: '', nota: 5, comentario: '' });
      refetch();
    }
  };

  // Calcular estatísticas
  const stats = {
    nps: avaliacoes ? Math.round(
      ((avaliacoes.filter(a => a.tipo_nps === 'promotor').length / avaliacoes.length) * 100) -
      ((avaliacoes.filter(a => a.tipo_nps === 'detrator').length / avaliacoes.length) * 100)
    ) : 0,
    csat: avaliacoes && avaliacoes.length > 0 
      ? (avaliacoes.reduce((acc, a) => acc + a.nota, 0) / avaliacoes.length).toFixed(1)
      : '0',
    total: avaliacoes?.length || 0,
    promotores: avaliacoes?.filter(a => a.tipo_nps === 'promotor').length || 0,
  };

  // Distribuição NPS
  const distribuicaoNPS = avaliacoes ? [
    { tipo: "Promotores (9-10)", quantidade: avaliacoes.filter(a => a.tipo_nps === 'promotor').length, cor: "#22c55e" },
    { tipo: "Neutros (7-8)", quantidade: avaliacoes.filter(a => a.tipo_nps === 'neutro').length, cor: "#eab308" },
    { tipo: "Detratores (0-6)", quantidade: avaliacoes.filter(a => a.tipo_nps === 'detrator').length, cor: "#ef4444" },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Satisfação</h2>
          <p className="text-muted-foreground">Pesquisas e métricas de satisfação do cliente</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar Relatório
          </Button>
          <Button onClick={() => setShowNewAvaliacao(!showNewAvaliacao)}>
            Nova Avaliação
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">NPS Score</p>
                <p className="text-2xl font-bold">{stats.nps}</p>
                <p className="text-xs text-green-500">+3 pontos</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">CSAT Score</p>
                <p className="text-2xl font-bold">{stats.csat}/5</p>
                <p className="text-xs text-green-500">+0.2</p>
              </div>
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <Star className="w-6 h-6 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Respostas Recebidas</p>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-green-500">+125</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Promotores</p>
                <p className="text-2xl font-bold">{stats.promotores}</p>
                <p className="text-xs text-green-500">+5%</p>
              </div>
              <div className="p-3 rounded-lg bg-purple-500/10">
                <ThumbsUp className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulário Nova Avaliação */}
      {showNewAvaliacao && (
        <Card>
          <CardHeader>
            <CardTitle>Nova Avaliação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Cliente *</label>
                <Input 
                  placeholder="Nome do cliente" 
                  className="mt-1"
                  value={novaAvaliacao.cliente_nome}
                  onChange={(e) => setNovaAvaliacao({ ...novaAvaliacao, cliente_nome: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Nota (1-10)</label>
                <Input 
                  type="number" 
                  min="1" 
                  max="10" 
                  className="mt-1"
                  value={novaAvaliacao.nota}
                  onChange={(e) => setNovaAvaliacao({ ...novaAvaliacao, nota: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Comentário</label>
              <textarea 
                className="w-full mt-1 p-2 border rounded-md bg-[#0f3830] min-h-[80px]"
                placeholder="Deixe seu comentário..."
                value={novaAvaliacao.comentario}
                onChange={(e) => setNovaAvaliacao({ ...novaAvaliacao, comentario: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewAvaliacao(false)}>Cancelar</Button>
              <Button onClick={handleCriarAvaliacao} disabled={criando}>
                {criando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Enviar Avaliação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição NPS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição NPS</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#14919B]" />
              </div>
            ) : distribuicaoNPS.length > 0 ? (
              <div className="flex items-center justify-center gap-8">
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={distribuicaoNPS}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="quantidade"
                    >
                      {distribuicaoNPS.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {distribuicaoNPS.map((tipo, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tipo.cor }} />
                      <span className="text-sm">{tipo.tipo}</span>
                      <span className="text-sm text-muted-foreground ml-auto font-medium">{tipo.quantidade}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhuma avaliação ainda</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="w-5 h-5 text-green-500" />
                  <span>Promotores (9-10)</span>
                </div>
                <span className="font-bold text-green-500">
                  {stats.promotores} ({stats.total > 0 ? Math.round((stats.promotores / stats.total) * 100) : 0}%)
                </span>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-yellow-500" />
                  <span>Neutros (7-8)</span>
                </div>
                <span className="font-bold text-yellow-500">
                  {avaliacoes?.filter(a => a.tipo_nps === 'neutro').length || 0} ({stats.total > 0 ? Math.round(((avaliacoes?.filter(a => a.tipo_nps === 'neutro').length || 0) / stats.total) * 100) : 0}%)
                </span>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <ThumbsDown className="w-5 h-5 text-red-500" />
                  <span>Detratores (0-6)</span>
                </div>
                <span className="font-bold text-red-500">
                  {avaliacoes?.filter(a => a.tipo_nps === 'detrator').length || 0} ({stats.total > 0 ? Math.round(((avaliacoes?.filter(a => a.tipo_nps === 'detrator').length || 0) / stats.total) * 100) : 0}%)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Últimas Avaliações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Últimas Avaliações</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#14919B]" />
            </div>
          ) : avaliacoes && avaliacoes.length > 0 ? (
            <div className="space-y-4">
              {avaliacoes.slice(0, 10).map((avaliacao) => (
                <div 
                  key={avaliacao.id}
                  className="p-4 border rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#14919B]/20 flex items-center justify-center">
                        <span className="font-medium text-[#14919B]">{avaliacao.cliente_nome.charAt(0)}</span>
                      </div>
                      <div>
                        <h4 className="font-medium">{avaliacao.cliente_nome}</h4>
                        <div className="flex items-center gap-1">
                          {getStars(avaliacao.nota)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(avaliacao.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      <Badge className={tipoConfig[avaliacao.tipo_nps]?.cor || 'bg-gray-500/20 text-gray-400'}>
                        {tipoConfig[avaliacao.tipo_nps]?.label || avaliacao.tipo_nps}
                      </Badge>
                    </div>
                  </div>
                  {avaliacao.comentario && (
                    <p className="text-sm text-muted-foreground ml-13">{avaliacao.comentario}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Star className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhuma avaliação ainda</p>
              <Button className="mt-4" onClick={() => setShowNewAvaliacao(true)}>
                Enviar Primeira Avaliação
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}