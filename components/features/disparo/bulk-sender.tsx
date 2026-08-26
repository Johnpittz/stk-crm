"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Send,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Trash2,
  Smartphone,
  Timer,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Campaign {
  id: string;
  name: string;
  message: string;
  numbers: string[];
  status: "pending" | "running" | "paused" | "completed" | "failed";
  sent: number;
  failed: number;
  instancia: string | null;
  delay_min: number | null;
  delay_max: number | null;
  createdAt: string;
}

interface InstanciaWhatsApp {
  name: string;
  number: string;
  status: string;
}

export function BulkSender() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [newInstance, setNewInstance] = useState("minha-conexao");
  const [newDelayMin, setNewDelayMin] = useState(3);
  const [newDelayMax, setNewDelayMax] = useState(8);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    message: "",
    numbers: "",
  });
  const [creating, setCreating] = useState(false);
  const [instancias, setInstancias] = useState<InstanciaWhatsApp[]>([]);
  const supabase = createClient();

  // Carregar instâncias
  useEffect(() => {
    fetch("/api/instances")
      .then((r) => r.json())
      .then((d) => setInstancias(d.instancias || []))
      .catch(() => {});
  }, []);

  // Carregar campanhas
  const fetchCampaigns = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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

  // Auto-refresh: atualiza campanhas a cada 5s (apenas se tem "running")
  useEffect(() => {
    const hasRunning = campaigns.some((c) => c.status === "running");
    if (!hasRunning) return;

    const interval = setInterval(fetchCampaigns, 5000);
    return () => clearInterval(interval);
  }, [campaigns, fetchCampaigns]);

  // Criar nova campanha
  const criarCampanha = async () => {
    if (!newCampaign.name || !newCampaign.message || !newCampaign.numbers)
      return;

    setCreating(true);
    try {
      const numbers = newCampaign.numbers
        .split("\n")
        .map((n) => n.trim())
        .filter((n) => n.length > 0);

      if (numbers.length === 0) return;

      const {
        data: { session },
      } = await supabase.auth.getSession();
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
          instancia: newInstance,
          delay_min: newDelayMin,
          delay_max: newDelayMax,
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
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
    }
  };

  // Deletar campanha
  const deletarCampanha = async (id: string) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
    <div className="h-[calc(100vh-9rem)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-white">
          📨 Disparo em Massa
        </h1>
        <p className="text-sm text-white/50">
          Envie mensagens para múltiplos contatos
        </p>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Formulário */}
        <div className="lg:col-span-1 bg-[#0f1d32] border border-white/10 rounded-lg p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold text-white mb-4">
            Nova Campanha
          </h2>

          <div className="space-y-4">
            {/* Nome */}
            <div>
              <label className="text-xs font-medium text-white/60 mb-1 block">
                Nome da Campanha
              </label>
              <Input
                placeholder="Ex: Promoção de Verão"
                value={newCampaign.name}
                onChange={(e) =>
                  setNewCampaign({ ...newCampaign, name: e.target.value })
                }
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            {/* Instância */}
            <div>
              <label className="text-xs font-medium text-white/60 mb-1 block">
                <Smartphone className="inline h-3 w-3 mr-1" />
                Número de envio
              </label>
              <select
                value={newInstance}
                onChange={(e) => setNewInstance(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#14919B]"
              >
                {instancias.map((inst) => (
                  <option key={inst.name} value={inst.name} className="bg-[#0f1d32]">
                    {inst.number
                      ? `${inst.name} (${inst.number.slice(-4)})`
                      : inst.name}
                    {inst.status === "open" ? " ✅" : " ❌"}
                  </option>
                ))}
              </select>
            </div>

            {/* Timer */}
            <div>
              <label className="text-xs font-medium text-white/60 mb-1 block">
                <Timer className="inline h-3 w-3 mr-1" />
                Delay entre envios (segundos)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={newDelayMin}
                  onChange={(e) => setNewDelayMin(Number(e.target.value))}
                  className="bg-white/5 border-white/10 text-white text-center"
                />
                <span className="text-white/40 text-xs">até</span>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={newDelayMax}
                  onChange={(e) => setNewDelayMax(Number(e.target.value))}
                  className="bg-white/5 border-white/10 text-white text-center"
                />
              </div>
              <p className="text-[10px] text-white/30 mt-1">
                Aleatório entre {newDelayMin}s e {newDelayMax}s por envio
              </p>
            </div>

            {/* Mensagem */}
            <div>
              <label className="text-xs font-medium text-white/60 mb-1 block">
                Mensagem
              </label>
              <textarea
                placeholder="Digite sua mensagem aqui..."
                className="w-full h-32 px-3 py-2 bg-white/5 border border-white/10 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#14919B] text-white placeholder:text-white/30 text-sm"
                value={newCampaign.message}
                onChange={(e) =>
                  setNewCampaign({ ...newCampaign, message: e.target.value })
                }
              />
            </div>

            {/* Números */}
            <div>
              <label className="text-xs font-medium text-white/60 mb-1 block">
                Telefones (um por linha)
              </label>
              <textarea
                placeholder={"5562999999999\n5562888888888"}
                className="w-full h-24 px-3 py-2 bg-white/5 border border-white/10 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#14919B] text-white placeholder:text-white/30 font-mono text-sm"
                value={newCampaign.numbers}
                onChange={(e) =>
                  setNewCampaign({ ...newCampaign, numbers: e.target.value })
                }
              />
              <p className="text-xs text-white/30 mt-1">
                {newCampaign.numbers.split("\n").filter((n) => n.trim()).length}{" "}
                números
              </p>
            </div>

            <Button
              onClick={criarCampanha}
              disabled={
                creating ||
                !newCampaign.name ||
                !newCampaign.message ||
                !newCampaign.numbers
              }
              className="w-full bg-[#14919B] hover:bg-[#14919B]/80 text-white"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Criar Campanha
            </Button>
          </div>
        </div>

        {/* Lista de campanhas */}
        <div className="lg:col-span-2 bg-[#0f1d32] border border-white/10 rounded-lg p-4 overflow-hidden flex flex-col">
          <h2 className="text-lg font-semibold text-white mb-4">
            Campanhas
          </h2>

          <ScrollArea className="flex-1 min-h-0">
            {campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-white/30">
                <FileText className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Nenhuma campanha criada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">
                            {campaign.name}
                          </h3>
                          <Badge
                            className={
                              campaign.status === "running"
                                ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
                                : campaign.status === "completed"
                                ? "bg-green-500/20 text-green-300 border-green-500/30"
                                : campaign.status === "failed"
                                ? "bg-red-500/20 text-red-300 border-red-500/30"
                                : "bg-white/10 text-white/50 border-white/10"
                            }
                          >
                            {campaign.status === "pending" && "⏳ Pendente"}
                            {campaign.status === "running" && (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                                Enviando
                              </>
                            )}
                            {campaign.status === "paused" && "⏸️ Pausada"}
                            {campaign.status === "completed" && "✅ Concluída"}
                            {campaign.status === "failed" && "❌ Falhou"}
                          </Badge>
                          {campaign.instancia && (
                            <Badge className="bg-white/5 text-white/40 border-white/10 text-[10px]">
                              📱 {campaign.instancia.slice(-4)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-white/40 mt-1 line-clamp-2">
                          {campaign.message}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-white/30">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {campaign.numbers.length} contatos
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-400" />
                            {campaign.sent} enviados
                          </span>
                          <span className="flex items-center gap-1">
                            <XCircle className="h-3 w-3 text-red-400" />
                            {campaign.failed} falharam
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatarData(campaign.createdAt)}
                          </span>
                          {campaign.delay_min && campaign.delay_max && (
                            <span className="flex items-center gap-1">
                              <Timer className="h-3 w-3" />
                              {campaign.delay_min}-{campaign.delay_max}s
                            </span>
                          )}
                        </div>
                        {/* Barra de progresso */}
                        {campaign.status === "running" &&
                          campaign.numbers.length > 0 && (
                            <div className="mt-2">
                              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#14919B] rounded-full transition-all duration-500"
                                  style={{
                                    width: `${
                                      ((campaign.sent + campaign.failed) /
                                        campaign.numbers.length) *
                                      100
                                    }%`,
                                  }}
                                />
                              </div>
                              <p className="text-[10px] text-white/30 mt-1">
                                {campaign.sent + campaign.failed} de{" "}
                                {campaign.numbers.length}
                              </p>
                            </div>
                          )}
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {campaign.status === "pending" && (
                          <Button
                            size="sm"
                            onClick={() => enviarCampanha(campaign)}
                            className="bg-[#14919B] hover:bg-[#14919B]/80 text-white"
                          >
                            <Play className="h-4 w-4 mr-1" />
                            Enviar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deletarCampanha(campaign.id)}
                          className="text-white/30 hover:text-red-400 hover:bg-red-500/10"
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
        </div>
      </div>
    </div>
  );
}
