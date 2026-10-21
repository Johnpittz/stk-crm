"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Send,
  CheckCircle,
  XCircle,
  TrendingUp,
  FileText,
  Trash2,
  Smartphone,
  Timer,
  Loader2,
  Image,
  X,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resumoEnvios } from "./resumo-envios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampanhasConteudo } from "@/components/features/campanhas/campanhas-conteudo";

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
  intervalo: number | null;
  imagem_url: string | null;
  createdAt: string;
}

interface InstanciaWhatsApp {
  name: string;
  number: string;
  status: string;
}

/** 19/10 — cartão de indicador do painel de envios (padrão dashboard). */
function Kpi({
  titulo,
  valor,
  cor,
  icone,
}: {
  titulo: string;
  valor: number | string;
  cor: string;
  icone: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-white/40 mb-1">
        {icone}
        {titulo}
      </div>
      <p className={`text-2xl font-bold ${cor}`}>
        {typeof valor === "number" ? valor.toLocaleString("pt-BR") : valor}
      </p>
    </div>
  );
}

export function BulkSender() {
  // 19/10 (pedido do João) — as 3 opções de disparo NA TELA: Avulso é o
  // form daqui; Em Massa/Remarketing embutem o mesmo formulário do
  // "Novo Disparo" (sem modal), já na aba certa.
  const [abaDisparo, setAbaDisparo] = useState<"avulso" | "massa" | "remarketing">("avulso");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [newInstance, setNewInstance] = useState("STK-3");
  const [newIntervalo, setNewIntervalo] = useState(5);
  const [newCampaign, setNewCampaign] = useState({
    name: "",
    message: "",
    numbers: "",
  });
  const [newImage, setNewImage] = useState<{
    base64: string;
    preview: string;
    mimetype: string;
    name: string;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  // 19/10 (pedido do João) — FLUXO DE MENSAGENS no Avulso, igual ao
  // Disparo em Massa: sequência texto → imagem → texto, com pausa entre
  // passos. O robô da VPS já sabe enviar (fluxo_mensagens + intervalo_passos);
  // faltava só o form.
  const [fluxoSteps, setFluxoSteps] = useState<Array<{
    id: string;
    type: "text" | "image";
    content?: string;
    base64?: string;
    preview?: string;
    mimetype?: string;
    name?: string;
  }>>([]);
  const [fluxoPausa, setFluxoPausa] = useState(2);

  const adicionarPassoFluxo = (tipo: "text" | "image") => {
    setFluxoSteps((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, type: tipo },
    ]);
  };
  const removerPassoFluxo = (id: string) =>
    setFluxoSteps((prev) => prev.filter((s) => s.id !== id));
  const atualizarPassoTexto = (id: string, content: string) =>
    setFluxoSteps((prev) => prev.map((s) => (s.id === id ? { ...s, content } : s)));
  const moverPassoFluxo = (id: string, dir: "up" | "down") =>
    setFluxoSteps((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      if (i === -1) return prev;
      const j = dir === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= prev.length) return prev;
      const novo = [...prev];
      [novo[i], novo[j]] = [novo[j], novo[i]];
      return novo;
    });
  const selecionarImagemFluxo = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Selecione um arquivo de imagem (JPG, PNG, WEBP)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Imagem muito grande. Máximo: 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setFluxoSteps((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, base64: reader.result as string, preview: reader.result as string, mimetype: file.type, name: file.name }
            : s
        )
      );
    reader.readAsDataURL(file);
  };
  // banner "veio da galeria" (PEDIDO 3)
  const [arteDe, setArteDe] = useState<string | null>(null);
  const [instancias, setInstancias] = useState<InstanciaWhatsApp[]>([]);
  const supabase = createClient();

  // Carregar instâncias
  useEffect(() => {
    fetch("/api/instances")
      .then((r) => r.json())
      .then((d) => setInstancias(d.instancias || []))
      .catch(() => {});
  }, []);

  // PEDIDO 3 (11/10) — veio da galeria (Marketing > Criar Artes):
  // ?arte=<url> carrega a imagem pronta no formulário de disparo.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const arteUrl = params.get("arte");
    if (!arteUrl) return;
    (async () => {
      try {
        const resp = await fetch(arteUrl);
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          setNewImage({
            base64: dataUrl,
            preview: dataUrl,
            mimetype: blob.type || "image/png",
            name: params.get("arte_titulo") || "arte.png",
          });
        };
        reader.readAsDataURL(blob);
        setArteDe(params.get("arte_titulo") || "Arte da galeria");
        // limpa a URL para um refresh futuro não recarregar sozinho
        window.history.replaceState({}, "", "/disparo");
      } catch (err) {
        console.error("Erro ao carregar a arte para disparo:", err);
      }
    })();
  }, []);

  // Handler para seleção de imagem
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith("image/")) {
      alert("Selecione um arquivo de imagem (JPG, PNG, WEBP)");
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Imagem muito grande. Máximo: 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setNewImage({
        base64,
        preview: base64,
        mimetype: file.type,
        name: file.name,
      });
    };
    reader.readAsDataURL(file);
  };

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
    const temFluxo = fluxoSteps.length > 0;
    if (!newCampaign.name || !newCampaign.numbers) return;
    // fluxo OU mensagem única (o Disparo em Massa já funciona assim)
    if (!temFluxo && !newCampaign.message) return;
    if (temFluxo) {
      for (const passo of fluxoSteps) {
        if (passo.type === "text" && !passo.content?.trim()) {
          alert("Escreva o texto de cada passo do fluxo (ou remova o passo).");
          return;
        }
        if (passo.type === "image" && !passo.base64) {
          alert("Escolha a imagem de cada passo do fluxo (ou remova o passo).");
          return;
        }
      }
    }

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
          // 19/10 — com fluxo, a mensagem única fica vazia (o robô envia
          // a sequência texto → imagem → ...); sem fluxo, o de sempre.
          message: temFluxo ? "" : newCampaign.message,
          numbers,
          instancia: newInstance,
          intervalo: newIntervalo,
          imagem_base64: newImage?.base64 || null,
          imagem_mimetype: newImage?.mimetype || null,
          // 19/10 — sequência de passos (a rota sobe as imagens pro
          // Storage; o robô da VPS dorme intervalo_passos entre elas)
          ...(temFluxo
            ? {
                intervalo_passos: fluxoPausa,
                fluxo_mensagens: fluxoSteps.map((s) =>
                  s.type === "text"
                    ? { type: "text", content: s.content }
                    : { type: "image", base64: s.base64, mimetype: s.mimetype }
                ),
              }
            : {}),
        }),
      });

      if (res.ok) {
        setNewCampaign({ name: "", message: "", numbers: "" });
        setNewImage(null);
        setArteDe(null);
        setFluxoSteps([]);
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

  const formatarData = (data: string | null | undefined) => {
    // 19/10 — "invalid date" na tela antiga: sem data ou data inválida, mostra "—"
    if (!data) return "—";
    const d = new Date(data);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col overflow-hidden">
      {/* 19/10 (pedido do João) — sem header aqui: a página já tem o
          título "Disparo" (sobrava DOIS textos falando de disparo) */}

      <Tabs
        value={abaDisparo}
        onValueChange={(v) => setAbaDisparo(v as "avulso" | "massa" | "remarketing")}
        className="flex-1 min-h-0 flex flex-col"
      >
        <TabsList className="bg-[#0f1d32] border border-white/10 w-full max-w-lg mb-4 shrink-0">
          <TabsTrigger
            value="avulso"
            className="flex-1 text-white/60 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
          >
            <Send className="h-4 w-4 mr-2" /> Avulso
          </TabsTrigger>
          <TabsTrigger
            value="massa"
            className="flex-1 text-white/60 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Em Massa
          </TabsTrigger>
          <TabsTrigger
            value="remarketing"
            className="flex-1 text-white/60 data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Remarketing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="avulso" className="flex-1 min-h-0 mt-0">
          <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                className="w-full h-10 px-3 rounded-md bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3B64CF]"
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
                Enviar a cada (segundos)
              </label>
              <Input
                type="number"
                min={1}
                max={120}
                value={newIntervalo}
                onChange={(e) => setNewIntervalo(Number(e.target.value))}
                className="bg-white/5 border-white/10 text-white text-center"
              />
              <p className="text-[10px] text-white/30 mt-1">
                Intervalo fixo de {newIntervalo}s por envio
              </p>
            </div>

            {/* 19/10 (pedido do João) — FLUXO DE MENSAGENS: mesmo recurso do
                Disparo em Massa (texto → imagem → texto), sem planilha */}
            <div>
              <label className="text-xs font-medium text-white/60 mb-1 block">
                Fluxo de Mensagens
              </label>
              <p className="text-[11px] text-white/30 mb-2">
                Monte a sequência: texto → imagem → texto → etc. (o robô manda
                cada passo com a pausa escolhida)
              </p>

              {fluxoSteps.length === 0 ? (
                <p className="text-xs text-white/30 border border-dashed border-white/10 rounded-lg p-3 text-center">
                  Nenhum passo adicionado — ou use a mensagem única abaixo
                </p>
              ) : (
                <div className="space-y-2 mb-2">
                  {fluxoSteps.map((passo, idx) => (
                    <div
                      key={passo.id}
                      className="bg-white/5 border border-white/10 rounded-lg p-2"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wide text-white/40">
                          {idx + 1}. {passo.type === "text" ? "📝 Texto" : "🖼️ Imagem"}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moverPassoFluxo(passo.id, "up")}
                            disabled={idx === 0}
                            className="text-white/40 hover:text-white disabled:opacity-30 text-xs px-1"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moverPassoFluxo(passo.id, "down")}
                            disabled={idx === fluxoSteps.length - 1}
                            className="text-white/40 hover:text-white disabled:opacity-30 text-xs px-1"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => removerPassoFluxo(passo.id)}
                            className="text-white/40 hover:text-red-400 text-xs px-1"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      {passo.type === "text" ? (
                        <textarea
                          placeholder="Escreva a mensagem deste passo..."
                          className="w-full h-20 px-2 py-1.5 bg-white/5 border border-white/10 rounded resize-none focus:outline-none focus:ring-1 focus:ring-[#3B64CF] text-white placeholder:text-white/30 text-xs"
                          value={passo.content || ""}
                          onChange={(e) => atualizarPassoTexto(passo.id, e.target.value)}
                        />
                      ) : passo.preview ? (
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={passo.preview}
                            alt={passo.name || "imagem do passo"}
                            className="h-14 w-14 object-cover rounded border border-white/10"
                          />
                          <span className="text-[10px] text-[#3B64CF] truncate">
                            ✅ {passo.name}
                          </span>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 w-full p-2 border border-dashed border-white/10 rounded cursor-pointer hover:border-[#3B64CF]/50 transition-colors">
                          <Image className="h-4 w-4 text-white/30" />
                          <span className="text-xs text-white/30">Escolher imagem</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => selecionarImagemFluxo(e, passo.id)}
                          />
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => adicionarPassoFluxo("text")}
                  className="border-white/15 text-white/70 hover:text-white hover:bg-white/10"
                >
                  + Texto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => adicionarPassoFluxo("image")}
                  className="border-white/15 text-white/70 hover:text-white hover:bg-white/10"
                >
                  + Imagem
                </Button>
              </div>

              {fluxoSteps.length > 0 && (
                <div className="mt-2">
                  <label className="text-[11px] text-white/50 block mb-1">
                    Pausa entre as mensagens do fluxo (segundos)
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={fluxoPausa}
                    onChange={(e) => setFluxoPausa(Math.max(1, parseInt(e.target.value) || 2))}
                    className="h-8 text-xs"
                  />
                </div>
              )}
            </div>

            {/* Mensagem única (alternativa ao fluxo) */}
            <div>
              <label className="text-xs font-medium text-white/60 mb-1 block">
                Mensagem única {fluxoSteps.length > 0 ? "(o fluxo acima tem prioridade)" : ""}
              </label>
              <textarea
                placeholder="Digite sua mensagem aqui..."
                className="w-full h-32 px-3 py-2 bg-white/5 border border-white/10 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#3B64CF] text-white placeholder:text-white/30 text-sm"
                value={newCampaign.message}
                onChange={(e) =>
                  setNewCampaign({ ...newCampaign, message: e.target.value })
                }
              />
            </div>

            {arteDe && (
              <div className="text-xs text-[#7ea6ff] bg-[#3B64CF]/10 border border-[#3B64CF]/30 rounded-lg p-2">
                🎨 Arte carregada da galeria: <b>{arteDe}</b> — confira a imagem abaixo,
                escreva a mensagem, escolha os números e clique em criar o disparo.
              </div>
            )}

            {/* Imagem (opcional) */}
            <div>
              <label className="text-xs font-medium text-white/60 mb-1 block">
                <Image className="inline h-3 w-3 mr-1" />
                Imagem (opcional)
              </label>
              {newImage ? (
                <div className="flex items-center gap-3 p-2 bg-white/5 rounded-lg border border-white/10">
                  <img
                    src={newImage.preview}
                    alt="Preview"
                    className="w-16 h-16 object-cover rounded-lg border border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 truncate">{newImage.name}</p>
                    <p className="text-[10px] text-[#3B64CF]">✅ Enviada após o texto</p>
                  </div>
                  <button
                    onClick={() => setNewImage(null)}
                    className="text-white/40 hover:text-red-400 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 w-full p-3 border border-dashed border-white/10 rounded-lg cursor-pointer hover:border-[#3B64CF]/50 transition-colors">
                  <Image className="h-5 w-5 text-white/30" />
                  <span className="text-sm text-white/30">Selecionar imagem</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </label>
              )}
            </div>

            {/* Números */}
            <div>
              <label className="text-xs font-medium text-white/60 mb-1 block">
                Telefones (um por linha)
              </label>
              <textarea
                placeholder={"5562999999999\n5562888888888"}
                className="w-full h-24 px-3 py-2 bg-white/5 border border-white/10 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#3B64CF] text-white placeholder:text-white/30 font-mono text-sm"
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
                (!newCampaign.message && fluxoSteps.length === 0) ||
                !newCampaign.numbers
              }
              className="w-full bg-[#3B64CF] hover:bg-[#3B64CF]/80 text-white"
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

        {/* 19/10 (pedido do João) — PAINEL DE ENVIOS no lugar da lista de
            campanhas: agregado com os números certos (dashboard) */}
        <div className="lg:col-span-2 bg-[#0f1d32] border border-white/10 rounded-lg p-4 overflow-hidden flex flex-col">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Painel de Envios</h2>
            <p className="text-xs text-white/30">
              Atualiza sozinho enquanto há disparos rodando
            </p>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            {(() => {
              const r = resumoEnvios(campaigns);
              const pendentes = campaigns.filter((c) => c.status === "pending");
              const ultimaAtividade = campaigns
                .map((c) => c.createdAt)
                .filter((d) => !!d && !Number.isNaN(new Date(d).getTime()))
                .sort()
                .pop();
              return (
                <div className="space-y-4">
                  {/* KPIs */}
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    <Kpi
                      titulo="Mensagens enviadas"
                      valor={r.enviadas}
                      cor="text-emerald-400"
                      icone={<CheckCircle className="h-4 w-4" />}
                    />
                    <Kpi
                      titulo="Falhas"
                      valor={r.falhas}
                      cor="text-red-400"
                      icone={<XCircle className="h-4 w-4" />}
                    />
                    <Kpi
                      titulo="Taxa de sucesso"
                      valor={`${r.taxa}%`}
                      cor="text-blue-300"
                      icone={<TrendingUp className="h-4 w-4" />}
                    />
                    <Kpi
                      titulo="Em andamento"
                      valor={r.emAndamento}
                      cor="text-amber-300"
                      icone={<Timer className="h-4 w-4" />}
                    />
                  </div>

                  {/* Linha de contexto */}
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-white/40 bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                    <span>
                      <b className="text-white/70">{r.totalCampanhas}</b> campanhas
                    </span>
                    <span>
                      <b className="text-white/70">{r.concluidas}</b> concluídas
                    </span>
                    <span>
                      <b className="text-white/70">{r.falharamCampanha}</b> falharam
                    </span>
                    <span>
                      <b className="text-white/70">{r.contatos.toLocaleString("pt-BR")}</b>{" "}
                      contatos na fila
                    </span>
                    <span>
                      última atividade:{" "}
                      <b className="text-white/70">{formatarData(ultimaAtividade)}</b>
                    </span>
                  </div>

                  {/* Campanhas criadas e ainda não enviadas — a ação de
                      disparar continua aqui, sem precisar da lista antiga */}
                  {pendentes.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-400/30 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-300 mb-2">
                        ⏳ {pendentes.length} disparo(s) criado(s) e ainda não enviados
                      </p>
                      <div className="space-y-2">
                        {pendentes.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-2 bg-black/20 rounded px-3 py-2"
                          >
                            <span className="text-sm text-white/70 truncate">{c.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                onClick={() => enviarCampanha(c)}
                                className="bg-[#3B64CF] hover:bg-[#3B64CF]/80 text-white"
                              >
                                <Play className="h-4 w-4 mr-1" />
                                Enviar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deletarCampanha(c.id)}
                                className="text-white/30 hover:text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.totalCampanhas === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-white/30">
                      <FileText className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">
                        Nenhum disparo ainda — os números aparecem aqui depois da
                        primeira campanha
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </ScrollArea>
        </div>
          </div>
        </TabsContent>

        <TabsContent value="massa" className="flex-1 min-h-0 mt-0 overflow-y-auto">
          <CampanhasConteudo
            exibirSomenteCriar="massa"
            aoFechar={() => setAbaDisparo("avulso")}
          />
        </TabsContent>
        <TabsContent value="remarketing" className="flex-1 min-h-0 mt-0 overflow-y-auto">
          <CampanhasConteudo
            exibirSomenteCriar="remarketing"
            aoFechar={() => setAbaDisparo("avulso")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
