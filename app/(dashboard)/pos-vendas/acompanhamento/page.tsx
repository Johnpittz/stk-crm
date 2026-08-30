"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  ClipboardList, Package, Truck, CheckCircle, Clock, 
  Search, Filter, MoreVertical, MapPin, Calendar 
} from "lucide-react";

// Mock data
const pedidos = [
  { 
    id: 1, 
    cliente: "Maria Silva", 
    pedido: "#PED-2024-1234",
    produto: "Smartphone XYZ Pro",
    status: "entregue",
    dataPedido: "01/12/2024",
    dataEntrega: "05/12/2024",
    tracking: "BR123456789",
    valor: 2499.90
  },
  { 
    id: 2, 
    cliente: "João Santos", 
    pedido: "#PED-2024-1235",
    produto: "Notebook ABC Plus",
    status: "em_transito",
    dataPedido: "03/12/2024",
    dataEntrega: "10/12/2024",
    tracking: "BR987654321",
    valor: 4599.90
  },
  { 
    id: 3, 
    cliente: "Ana Oliveira", 
    pedido: "#PED-2024-1236",
    produto: "Fone de Ouvido Wireless",
    status: "preparando",
    dataPedido: "08/12/2024",
    dataEntrega: "12/12/2024",
    tracking: null,
    valor: 299.90
  },
  { 
    id: 4, 
    cliente: "Pedro Costa", 
    pedido: "#PED-2024-1237",
    produto: "Tablet Galaxy Tab",
    status: "devolvido",
    dataPedido: "05/12/2024",
    dataEntrega: null,
    tracking: "BR456789123",
    valor: 1899.90
  },
  { 
    id: 5, 
    cliente: "Carlos Lima", 
    pedido: "#PED-2024-1238",
    produto: "Smart TV 55\"",
    status: "em_transito",
    dataPedido: "07/12/2024",
    dataEntrega: "11/12/2024",
    tracking: "BR789123456",
    valor: 3299.90
  },
];

const statusConfig = {
  pendente: { label: "Pendente", cor: "bg-gray-500/20 text-gray-400", icon: Clock },
  preparando: { label: "Preparando", cor: "bg-yellow-500/20 text-yellow-400", icon: Package },
  em_transito: { label: "Em Trânsito", cor: "bg-blue-500/20 text-blue-400", icon: Truck },
  entregue: { label: "Entregue", cor: "bg-green-500/20 text-green-400", icon: CheckCircle },
  devolvido: { label: "Devolvido", cor: "bg-red-500/20 text-red-400", icon: ClipboardList },
};

export default function PosVendasAcompanhamentoPage() {
  const [showNewPedido, setShowNewPedido] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Acompanhamento</h2>
          <p className="text-muted-foreground">Monitoramento de pedidos e entregas</p>
        </div>
        <Button onClick={() => setShowNewPedido(!showNewPedido)}>
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
                <p className="text-2xl font-bold">8</p>
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
                <p className="text-2xl font-bold">15</p>
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
                <p className="text-2xl font-bold">12</p>
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
                <p className="text-2xl font-bold">3</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulário Rastrear Pedido */}
      {showNewPedido && (
        <Card>
          <CardHeader>
            <CardTitle>Rastrear Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Número do Pedido</label>
                <Input placeholder="#PED-2024-XXXX" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">ou Código de Rastreio</label>
                <Input placeholder="BR123456789" className="mt-1" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewPedido(false)}>Cancelar</Button>
              <Button>
                <Truck className="w-4 h-4 mr-2" />
                Rastrear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline de Entrega - Pedido em Trânsito */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pedido #PED-2024-1235 - Em Trânsito</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Cliente:</span>
              <span className="font-medium">João Santos</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Previsão:</span>
              <span className="font-medium">10/12/2024</span>
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#14919B]/30" />
            <div className="space-y-6">
              {[
                { step: "Pedido Confirmado", data: "03/12 10:30", status: "concluido" },
                { step: "Pagamento Aprovado", data: "03/12 10:35", status: "concluido" },
                { step: "Separando Itens", data: "04/12 09:00", status: "concluido" },
                { step: "Enviado para Transportadora", data: "05/12 14:20", status: "concluido" },
                { step: "Em Trânsito", data: "05/12 18:00", status: "atual" },
                { step: "Saiu para Entrega", data: "Prev: 10/12", status: "pendente" },
                { step: "Entregue", data: "Prev: 10/12", status: "pendente" },
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-4 relative">
                  <div className={`w-3 h-3 rounded-full mt-1.5 ml-0.5 z-10 ${
                    item.status === "concluido" ? "bg-green-500" : 
                    item.status === "atual" ? "bg-blue-500" : "bg-gray-600"
                  }`} />
                  <div className="flex-1">
                    <p className={`font-medium ${item.status === "pendente" ? "text-muted-foreground" : ""}`}>
                      {item.step}
                    </p>
                    <p className="text-sm text-muted-foreground">{item.data}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

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
          <div className="space-y-4">
            {pedidos.map((pedido) => {
              const StatusIcon = statusConfig[pedido.status as keyof typeof statusConfig].icon;
              return (
                <div 
                  key={pedido.id}
                  className="p-4 border rounded-lg hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${statusConfig[pedido.status as keyof typeof statusConfig].cor}`}>
                        <StatusIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{pedido.pedido}</h4>
                          <Badge className={statusConfig[pedido.status as keyof typeof statusConfig].cor}>
                            {statusConfig[pedido.status as keyof typeof statusConfig].label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{pedido.produto}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Cliente</p>
                        <p className="text-sm">{pedido.cliente}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Valor</p>
                        <p className="text-sm font-medium">R$ {pedido.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Data Pedido</p>
                        <p className="text-sm">{pedido.dataPedido}</p>
                      </div>
                      {pedido.tracking && (
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Rastreio</p>
                          <p className="text-sm text-[#14919B]">{pedido.tracking}</p>
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
        </CardContent>
      </Card>
    </div>
  );
}