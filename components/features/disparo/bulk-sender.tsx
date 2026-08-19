"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Play, 
  Pause, 
  Square, 
  Send, 
  Users, 
  CheckCircle, 
  XCircle, 
  Clock,
  FileText,
  Trash2
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Campaign {
  id: string;
  name: string;
  message: string;
  numbers: string[];
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  sent: number;
  failed: number;
  createdAt: string;
}

export function BulkSender() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [newCampaign, setNewCampaign] = useState({ name: "", message: "", numbers: "" });
  const [creating, setCreating] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const supabase = createClient();

  // Carregar campanhas
  const fetchCampaigns = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/bulk/campaigns", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error("Erro ao carregar campanhas:", err);
    }
  }, [supabase]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Criar nova campanha
  const criarCampanha = async () => {
    if (!newCampaign.name || !newCampaign.message || !newCampaign.numbers) return;

    setCreating(true);
    try {
      const numbers = newCampaign.numbers
        .split("\n")
        .map((n) => n.trim())
        .filter((n) => n.length > 0);

      if (numbers.length === 0) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/bulk/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: newCampaign.name,
          message: newCampaign.message,
          numbers,
        }),
      });

      if (res.ok) {
        setNewCampaign({ name: "", message: "", numbers: "" });
        fetchCampaigns();
      }
    } catch (err) {
      console.error("Erro ao criar campanha:", err);
    } finally {
      setCreating(false);
    }
  };

  // Enviar campanha
  const enviarCampanha = async (campaign: Campaign) => {
    setActiveCampaign({ ...campaign, status: "running", sent: 0, failed: 0 });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/bulk/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ campaignId: campaign.id }),
      });

      if (res.ok) {
        fetchCampaigns();
      }
    } catch (err) {
      console.error("Erro ao enviar campanha:", err);
    } finally {
      setActiveCampaign(null);
    }
  };

  // Deletar campanha
  const deletarCampanha = async (id: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/bulk/campaigns?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        fetchCampaigns();
      }
    } catch (err) {
      console.error("Erro ao deletar campanha:", err);
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">📨 Disparo em Massa</h1>
          <p className="text-sm text-slate-500">Envie mensagens para múltiplos contatos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Formulário de nova campanha */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Nova Campanha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Nome da Campanha</label>
              <Input
                placeholder="Ex: Promoção de Verão"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Mensagem</label>
              <textarea
                placeholder="Digite sua mensagem aqui..."
                className="w-full h-32 px-3 py-2 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                value={newCampaign.message}
                onChange={(e) => setNewCampaign({ ...newCampaign, message: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                Telefones (um por linha)
              </label>
              <textarea
                placeholder={"5562999999999\n5562888888888"}
                className="w-full h-24 px-3 py-2 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                value={newCampaign.numbers}
                onChange={(e) => setNewCampaign({ ...newCampaign, numbers: e.target.value })}
              />
              <p className="text-xs text-slate-400 mt-1">
                {newCampaign.numbers.split("\n").filter((n) => n.trim()).length} números
              </p>
            </div>
            <Button
              onClick={criarCampanha}
              disabled={creating || !newCampaign.name || !newCampaign.message || !newCampaign.numbers}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {creating ? "Criando..." : "Criar Campanha"}
            </Button>
          </CardContent>
        </Card>

        {/* Lista de campanhas */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-320px)]">
              {campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                  <FileText className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma campanha criada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-slate-900">{campaign.name}</h3>
                            <Badge
                              variant={
                                campaign.status === "running"
                                  ? "default"
                                  : campaign.status === "completed"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {campaign.status === "pending" && "⏳ Pendente"}
                              {campaign.status === "running" && "▶️ Enviando"}
                              {campaign.status === "paused" && "⏸️ Pausada"}
                              {campaign.status === "completed" && "✅ Concluída"}
                              {campaign.status === "failed" && "❌ Falhou"}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                            {campaign.message}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {campaign.numbers.length} contatos
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              {campaign.sent} enviados
                            </span>
                            <span className="flex items-center gap-1">
                              <XCircle className="h-3 w-3 text-red-500" />
                              {campaign.failed} falharam
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatarData(campaign.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {campaign.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => enviarCampanha(campaign)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Enviar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deletarCampanha(campaign.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
