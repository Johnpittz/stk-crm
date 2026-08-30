"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Tag, Plus, Percent, DollarSign, Calendar, 
  MoreVertical, Edit, Trash2, Copy, Gift, Loader2 
} from "lucide-react";
import { useApi, useCreate } from "@/lib/hooks/use-api";

// Tipos
interface Promocao {
  id: string;
  nome: string;
  tipo: string;
  valor: number;
  uso_atual: number;
  limite_uso: number | null;
  data_inicio: string;
  data_fim: string;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; cor: string }> = {
  ativa: { label: "Ativa", cor: "bg-green-500/20 text-green-400" },
  agendada: { label: "Agendada", cor: "bg-yellow-500/20 text-yellow-400" },
  finalizada: { label: "Finalizada", cor: "bg-gray-500/20 text-gray-400" },
  pausada: { label: "Pausada", cor: "bg-red-500/20 text-red-400" },
};

const tipoConfig: Record<string, { label: string; icon: any }> = {
  percentual: { label: "% OFF", icon: Percent },
  fixo: { label: "R$ OFF", icon: DollarSign },
  frete: { label: "Frete Grátis", icon: Gift },
  quantidade: { label: "Leve +", icon: Tag },
};

export default function MarketingPromocoesPage() {
  const [showNewPromocao, setShowNewPromocao] = useState(false);
  const [novaPromocao, setNovaPromocao] = useState({
    nome: '',
    tipo: 'percentual',
    valor: 0,
    limite_uso: 0,
    data_inicio: '',
    data_fim: ''
  });

  const { data: promocoes, loading, refetch } = useApi<Promocao[]>({ url: '/api/marketing/promocoes' });
  const { create: criarPromocao, loading: criando } = useCreate<typeof novaPromocao>('/api/marketing/promocoes');

  const handleCriarPromocao = async () => {
    if (!novaPromocao.nome) return;
    
    const resultado = await criarPromocao(novaPromocao);
    if (resultado) {
      setShowNewPromocao(false);
      setNovaPromocao({ nome: '', tipo: 'percentual', valor: 0, limite_uso: 0, data_inicio: '', data_fim: '' });
      refetch();
    }
  };

  // Estatísticas
  const stats = {
    ativas: promocoes?.filter(p => p.status === 'ativa').length || 0,
    totalUtilizacoes: promocoes?.reduce((acc, p) => acc + (p.uso_atual || 0), 0) || 0,
    descontoTotal: 18450, // Mock - calcular com dados reais depois
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Promoções</h2>
          <p className="text-muted-foreground">Gerencie ofertas e cupons de desconto</p>
        </div>
        <Button onClick={() => setShowNewPromocao(!showNewPromocao)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Promoção
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Tag className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Promoções Ativas</p>
                <p className="text-2xl font-bold">{stats.ativas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Percent className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Utilizações</p>
                <p className="text-2xl font-bold">{stats.totalUtilizacoes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Desconto Total Dado</p>
                <p className="text-2xl font-bold">R$ {stats.descontoTotal.toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulário Nova Promoção */}
      {showNewPromocao && (
        <Card>
          <CardHeader>
            <CardTitle>Nova Promoção</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nome da Promoção *</label>
                <Input 
                  placeholder="Ex: Natal com 30% OFF" 
                  className="mt-1"
                  value={novaPromocao.nome}
                  onChange={(e) => setNovaPromocao({ ...novaPromocao, nome: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <select 
                  className="w-full mt-1 p-2 border rounded-md bg-[#0f3830]"
                  value={novaPromocao.tipo}
                  onChange={(e) => setNovaPromocao({ ...novaPromocao, tipo: e.target.value })}
                >
                  <option value="percentual">Percentual (%)</option>
                  <option value="fixo">Valor Fixo (R$)</option>
                  <option value="frete">Frete Grátis</option>
                  <option value="quantidade">Leve + (quantidade)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Valor do Desconto</label>
                <Input 
                  type="number" 
                  placeholder="20" 
                  className="mt-1"
                  value={novaPromocao.valor || ''}
                  onChange={(e) => setNovaPromocao({ ...novaPromocao, valor: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Limite de Uso</label>
                <Input 
                  type="number" 
                  placeholder="500 (ou 0 para ilimitado)" 
                  className="mt-1"
                  value={novaPromocao.limite_uso || ''}
                  onChange={(e) => setNovaPromocao({ ...novaPromocao, limite_uso: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Data Início</label>
                <Input 
                  type="date" 
                  className="mt-1"
                  value={novaPromocao.data_inicio}
                  onChange={(e) => setNovaPromocao({ ...novaPromocao, data_inicio: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Data Fim</label>
                <Input 
                  type="date" 
                  className="mt-1"
                  value={novaPromocao.data_fim}
                  onChange={(e) => setNovaPromocao({ ...novaPromocao, data_fim: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewPromocao(false)}>Cancelar</Button>
              <Button onClick={handleCriarPromocao} disabled={criando}>
                {criando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Criar Promoção
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Promoções */}
      <Card>
        <CardHeader>
          <CardTitle>Todas as Promoções</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#14919B]" />
            </div>
          ) : promocoes && promocoes.length > 0 ? (
            <div className="space-y-4">
              {promocoes.map((promocao) => {
                const TipoIcon = tipoConfig[promocao.tipo]?.icon || Tag;
                return (
                  <div 
                    key={promocao.id}
                    className="p-4 border rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg">
                          <TipoIcon className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-lg">{promocao.nome}</h4>
                            <Badge className={statusConfig[promocao.status]?.cor || 'bg-gray-500/20 text-gray-400'}>
                              {statusConfig[promocao.status]?.label || promocao.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {promocao.data_inicio ? new Date(promocao.data_inicio).toLocaleDateString('pt-BR') : '-'} 
                              {' - '} 
                              {promocao.data_fim ? new Date(promocao.data_fim).toLocaleDateString('pt-BR') : '-'}
                            </span>
                            <span>
                              {promocao.tipo === 'percentual' && `${promocao.valor}% OFF`}
                              {promocao.tipo === 'fixo' && `R$ ${promocao.valor} OFF`}
                              {promocao.tipo === 'frete' && 'Frete Grátis'}
                              {promocao.tipo === 'quantidade' && `Leve ${promocao.valor + 1} pague ${promocao.valor}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">{promocao.uso_atual || 0} utilizações</p>
                          {promocao.limite_uso && promocao.limite_uso > 0 && (
                            <p className="text-xs text-muted-foreground">de {promocao.limite_uso} disponíveis</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" title="Editar">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Duplicar">
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Excluir">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Tag className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhuma promoção encontrada</p>
              <Button className="mt-4" onClick={() => setShowNewPromocao(true)}>
                Criar Primeira Promoção
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}