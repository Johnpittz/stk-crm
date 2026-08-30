"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Send, Upload, Clock, CheckCircle, XCircle, 
  MoreVertical, Search, Filter, Plus 
} from "lucide-react";

// Mock data
const disparosRecentes = [
  { id: 1, nome: "Promoção Black Friday", status: "concluido", enviados: 2500, abertos: 1800, data: "2024-11-25" },
  { id: 2, nome: "Lembrete Natal", status: "agendado", enviados: 0, abertos: 0, data: "2024-12-20" },
  { id: 3, nome: "Pesquisa Satisfação", status: "concluido", enviados: 850, abertos: 620, data: "2024-11-15" },
  { id: 4, nome: "Convite Evento", status: "erro", enviados: 120, abertos: 0, data: "2024-11-10" },
];

const statusConfig = {
  concluido: { label: "Concluído", cor: "bg-green-500/20 text-green-400" },
  agendado: { label: "Agendado", cor: "bg-yellow-500/20 text-yellow-400" },
  erro: { label: "Erro", cor: "bg-red-500/20 text-red-400" },
  rascunho: { label: "Rascunho", cor: "bg-gray-500/20 text-gray-400" },
};

export default function MarketingDisparoPage() {
  const [showNewDisparo, setShowNewDisparo] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header com ações */}
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
                <Input placeholder="Ex: Promoção de Natal" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Canal</label>
                <select className="w-full mt-1 p-2 border rounded-md bg-background">
                  <option>WhatsApp</option>
                  <option>E-mail</option>
                  <option>SMS</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Mensagem</label>
              <Textarea 
                placeholder="Digite sua mensagem aqui... Use {{nome}} para personalizar" 
                className="mt-1 h-32"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Variáveis disponíveis: {"{{nome}}"}, {"{{empresa}}"}, {"{{telefone}}"}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Segmento</label>
                <select className="w-full mt-1 p-2 border rounded-md bg-background">
                  <option>Todos os contatos</option>
                  <option>Clientes ativos</option>
                  <option>Leads novos</option>
                  <option>Sem compra há 30 dias</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Agendamento</label>
                <Input type="datetime-local" className="mt-1" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline">Salvar Rascunho</Button>
              <Button>
                <Send className="w-4 h-4 mr-2" />
                Enviar Agora
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
                <Input placeholder="Buscar disparo..." className="pl-9 w-64" />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {disparosRecentes.map((disparo) => (
              <div 
                key={disparo.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Send className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">{disparo.nome}</h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(disparo.data).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {disparo.status === "concluido" && (
                    <div className="text-right">
                      <p className="text-sm font-medium">{disparo.enviados} enviados</p>
                      <p className="text-xs text-muted-foreground">{disparo.abertos} abertos</p>
                    </div>
                  )}
                  <Badge className={statusConfig[disparo.status as keyof typeof statusConfig].cor}>
                    {statusConfig[disparo.status as keyof typeof statusConfig].label}
                  </Badge>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}