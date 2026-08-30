"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  ClipboardList, Package, Truck, CheckCircle, Clock, 
  Search, Filter, MoreVertical, MapPin, Calendar, Loader2 
} from "lucide-react";
import { useApi, useCreate } from "@/lib/hooks/use-api";

// Tipos
interface Pedido {
  id: string;
  cliente_nome: string;
  numero_pedido: string;
  produto: string;
  valor: number;
  status: string;
  codigo_rastreio: string | null;
  data_pedido: string;
  data_previsao_entrega: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; cor: string; icon: any }> = {
  pendente: { label: "Pendente", cor: "bg-gray-500/20 text-gray-400", icon: Clock },
  preparando: { label: "Preparando", cor: "bg-yellow-500/20 text-yellow-400", icon: Package },
  em_transito: { label: "Em Trânsito", cor: "bg-blue-500/20 text-blue-400", icon: Truck },
  entregue: { label: "Entregue", cor: "bg-green-500/20 text-green-400", icon: CheckCircle },
  devolvido: { label: "Devolvido", cor: "bg-red-500/20 text-red-400", icon: ClipboardList },
};

export default function PosVendasAcompanhamentoPage() {
  const [showRastrearPedido, setShowRastrearPedido] = useState(false);
  const [numeroPedido, setNumeroPedido] = useState('');

  const { data: pedidos, loading, refetch } = useApi<Pedido[]>({ url: '/api/pos-vendas/pedidos' });

  // Estatísticas
  const stats = {
    preparando: pedidos?.filter(p => p.status === 'preparando').length || 0,
    emTransito: pedidos?.filter(p => p.status === 'em_transito').length || 0,
    entreguesHoje: pedidos?.filter(p => {
      const data = new Date(p.created_at);
      const hoje = new Date();
      return data.toDateString() === hoje.toDateString() && p.status === 'entregue';
    }).length || 0,
    devolvidos: pedidos?.filter(p => p.status === 'devolvido').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Acompanhamento</h2>
          <p className="text-muted-foreground">Monitoramento de pedidos e entregas</p>
        </div>
        <Button onClick={() => setShowRastrearPedido(!showRastrearPedido)}>
          <Package className="w-4 h-4 mr-2" />
          Rastrear Pedido
        </Button>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Package className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Preparando</p>
                <p className="text-2xl font-bold">{stats.preparando}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Truck className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Trânsito</p>
                <p className="text-2xl font-bold">{stats.emTransito}</p>
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
                <p className="text-sm text-muted-foreground">Entregues Hoje</p>
                <p className="text-2xl font-bold">{stats.entreguesHoje}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <ClipboardList className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Devoluções</p>
                <p className="text-2xl font-bold">{stats.devolvidos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulário Rastrear Pedido */}
      {showRastrearPedido && (
        <Card>
          <CardHeader>
            <CardTitle>Rastrear Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Número do Pedido</label>
                <Input 
                  placeholder="#PED-2024-XXXX" 
                  className="mt-1"
                  value={numeroPedido}
                  onChange={(e) => setNumeroPedido(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">ou Código de Rastreio</label>
                <Input placeholder="BR123456789" className="mt-1" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowRastrearPedido(false)}>Cancelar</Button>
              <Button>
                <Truck className="w-4 h-4 mr-2" />
                Rastrear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Pedidos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Pedidos</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar pedido..." className="pl-9 w-64" />
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
          ) : pedidos && pedidos.length > 0 ? (
            <div className="space-y-4">
              {pedidos.map((pedido) => {
                const StatusIcon = statusConfig[pedido.status]?.icon || Clock;
                return (
                  <div 
                    key={pedido.id}
                    className="p-4 border rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${statusConfig[pedido.status]?.cor || 'bg-gray-500/20'}`}>
                          <StatusIcon className={`w-5 h-5 ${statusConfig[pedido.status]?.cor?.split(' ')[1] || 'text-gray-400'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{pedido.numero_pedido}</h4>
                            <Badge className={statusConfig[pedido.status]?.cor || 'bg-gray-500/20 text-gray-400'}>
                              {statusConfig[pedido.status]?.label || pedido.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{pedido.produto}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Cliente</p>
                          <p className="text-sm">{pedido.cliente_nome}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Valor</p>
                          <p className="text-sm font-medium">R$ {(pedido.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Data Pedido</p>
                          <p className="text-sm">{new Date(pedido.data_pedido).toLocaleDateString('pt-BR')}</p>
                        </div>
                        {pedido.codigo_rastreio && (
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Rastreio</p>
                            <p className="text-sm text-[#14919B]">{pedido.codigo_rastreio}</p>
                          </div>
                        )}
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum pedido encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}