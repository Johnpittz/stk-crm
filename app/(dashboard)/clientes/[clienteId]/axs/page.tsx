"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  RefreshCw,
  Zap,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  ChevronRight,
  Power,
} from "lucide-react";

// ─── Tipos ───

interface Cliente {
  id: string;
  nome_razao_social: string;
  cpf_cnpj: string;
  email: string;
  axs_card_id: string | null;
  axs_status: string | null;
  axs_mensalidade: number | null;
}

interface AxSProposta {
  id: string;
  cliente_id: string;
  axs_card_id: string;
  axs_status: string;
  axs_mensalidade: number | null;
  axs_dados: any;
  created_at: string;
}

// ─── Página Principal ───

export default function AxSIntegracaoPage() {
  const params = useParams();
  const router = useRouter();
  const clienteId = params.clienteId as string;

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [propostas, setPropostas] = useState<AxSProposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [iframeWidth, setIframeWidth] = useState(70); // percent

  // ─── Carregar dados do cliente ───

  const carregarCliente = async () => {
    try {
      const res = await fetch(`/api/clientes?search=${clienteId}`);
      const data = await res.json();
      const c = (data.clientes || []).find((x: any) => x.id === clienteId);
      if (c) setCliente(c);
    } catch (err) {
      console.error(err);
    }
  };

  // ─── Carregar propostas do Supabase ───

  const carregarPropostas = async () => {
    try {
      const res = await fetch(`/api/axs/proposals?cliente_id=${clienteId}`);
      const data = await res.json();
      setPropostas(data.propostas || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    Promise.all([carregarCliente(), carregarPropostas()]).then(() =>
      setLoading(false)
    );
  }, [clienteId]);

  // ─── Sincronizar com AXS ───

  const sincronizar = async () => {
    if (!email || !senha) {
      setErro("Email e senha são obrigatórios para sincronizar");
      return;
    }

    setSincronizando(true);
    setErro(null);
    setSucesso(null);

    try {
      const res = await fetch("/api/axs/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente_id: clienteId,
          email,
          senha,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || "Erro ao sincronizar com AXS");
        return;
      }

      setSucesso(data.message || "Sincronização concluída com sucesso!");
      await Promise.all([carregarCliente(), carregarPropostas()]);
    } catch (err: any) {
      setErro("Erro de conexão ao sincronizar com AXS");
      console.error(err);
    } finally {
      setSincronizando(false);
    }
  };

  // ─── Renderização ───

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-9rem)]">
        <div className="text-slate-500 text-sm">Carregando integração AXS...</div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-9rem)] text-slate-500">
        <p className="text-sm mb-4">Cliente não encontrado</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/clientes")}>
          <ArrowLeft className="h-3 w-3 mr-1" />
          Voltar
        </Button>
      </div>
    );
  }

  const temAxS = !!cliente.axs_card_id;

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col gap-4">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-white"
            onClick={() => router.push(`/clientes/${clienteId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-[#3B64CF]" />
              Integração AXS Energia
            </h2>
            <p className="text-xs text-slate-400">
              {cliente.nome_razao_social} · {cliente.cpf_cnpj}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {temAxS ? (
            <Badge className="bg-green-500/20 text-green-400 text-[10px] gap-1">
              <CheckCircle2 className="h-3 w-3" />
              AXS Conectado
            </Badge>
          ) : (
            <Badge className="bg-yellow-500/20 text-yellow-400 text-[10px] gap-1">
              <AlertCircle className="h-3 w-3" />
              Sem cartão AXS
            </Badge>
          )}
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* ─── Iframe Area ─── */}
        <div className="flex-1 flex flex-col min-h-0" style={{ flex: `${iframeWidth} 0 0%` }}>
          <div className="relative flex-1 rounded-lg border border-[#1c2e4a] overflow-hidden bg-[#0f1d32]">
            <iframe
              src="https://portal.axsenergia.com.br/arp/"
              className="w-full h-full border-0"
              title="AXS Portal"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        </div>

        {/* ─── Sidebar ─── */}
        <div
          className="w-[320px] shrink-0 flex flex-col gap-3 overflow-y-auto"
          style={{ flex: `${100 - iframeWidth} 0 0%` }}
        >
          {/* Card: Configurações de Conexão */}
          <Card className="border-[#1c2e4a] bg-[#14233c]">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                <Power className="h-3.5 w-3.5 text-[#3B64CF]" />
                Conexão AXS
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">Email AXS</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="h-8 text-xs bg-[#0f1d32] border-[#1c2e4a] text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 mb-1 block">Senha</label>
                <Input
                  type="password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  className="h-8 text-xs bg-[#0f1d32] border-[#1c2e4a] text-white"
                />
              </div>
              <Button
                size="sm"
                className="w-full h-8 text-xs bg-[#15317B] hover:bg-[#1a3d8f] text-white"
                onClick={sincronizar}
                disabled={sincronizando}
              >
                {sincronizando ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                {sincronizando ? "Sincronizando..." : "Sincronizar propostas"}
              </Button>
            </CardContent>
          </Card>

          {/* Status Messages */}
          {erro && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{erro}</span>
            </div>
          )}
          {sucesso && (
            <div className="px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{sucesso}</span>
            </div>
          )}

          {/* Card: Status do Cliente */}
          <Card className="border-[#1c2e4a] bg-[#14233c]">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                <CreditCard className="h-3.5 w-3.5 text-[#3B64CF]" />
                Dados AXS do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {temAxS ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Card ID</span>
                    <span className="text-xs text-white font-mono">
                      {cliente.axs_card_id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Status</span>
                    <Badge
                      className={`text-[9px] ${
                        cliente.axs_status === "ativo"
                          ? "bg-green-500/20 text-green-400"
                          : cliente.axs_status === "pendente"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-slate-500/20 text-slate-400"
                      }`}
                    >
                      {cliente.axs_status || "N/A"}
                    </Badge>
                  </div>
                  {cliente.axs_mensalidade != null && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">Mensalidade</span>
                      <span className="text-xs text-white font-mono">
                        R${" "}
                        {cliente.axs_mensalidade.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Este cliente ainda não possui cadastro AXS. Use o botão de
                  sincronizar acima para buscar os dados.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card: Propostas Sincronizadas */}
          <Card className="border-[#1c2e4a] bg-[#14233c] flex-1 min-h-0">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-xs font-semibold text-white flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-[#3B64CF]" />
                Propostas AXS
                {propostas.length > 0 && (
                  <Badge className="text-[9px] bg-[#3B64CF]/20 text-[#3B64CF]">
                    {propostas.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 overflow-y-auto max-h-[300px]">
              {propostas.length === 0 ? (
                <div className="text-center py-6">
                  <Zap className="h-6 w-6 mx-auto mb-2 text-slate-600" />
                  <p className="text-[11px] text-slate-500">
                    Nenhuma proposta sincronizada
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    Clique em "Sincronizar propostas" para buscar
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {propostas.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-lg bg-[#0f1d32] border border-[#1c2e4a]"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-white font-medium">
                          Card #{p.axs_card_id}
                        </span>
                        <Badge
                          className={`text-[9px] ${
                            p.axs_status === "ativo"
                              ? "bg-green-500/20 text-green-400"
                              : p.axs_status === "pendente"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-slate-500/20 text-slate-400"
                          }`}
                        >
                          {p.axs_status || "N/A"}
                        </Badge>
                      </div>
                      {p.axs_mensalidade != null && (
                        <p className="text-[10px] text-slate-400">
                          Mensalidade: R${" "}
                          {p.axs_mensalidade.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      )}
                      <p className="text-[9px] text-slate-600 mt-1">
                        Sincronizado em{" "}
                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
