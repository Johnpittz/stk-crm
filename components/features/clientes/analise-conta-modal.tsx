"use client";

/**
 * PARTE 11 (PPTX 17/10) — "Análise da conta": sobe a foto/PDF da fatura,
 * a IA lê e o resumo entra na pasta do cliente.
 */
import { useRef, useState } from "react";
import { KanbanFaturas } from "./kanban-faturas";
import { Button } from "@/components/ui/button";
import type { OportunidadeProduto } from "@/lib/ia/regras-produtos";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  clienteId: string;
  onClose: () => void;
}

interface Resumo {
  concessionaria: string | null;
  uc: string | null;
  titular: string | null;
  cnpj_cpf: string | null;
  vencimento: string | null;
  consumo: string | null;
  valor: string | null;
}

const ROTULOS: Record<string, string> = {
  mercado_livre: "Mercado Livre",
  gd_assinatura: "Energia por Assinatura (GD-B)",
  gd_grupo_a: "GD Grupo A",
  usina_proprietaria: "Usina Solar Própria",
  bess: "BESS",
  reciee: "RECIEE",
  eletroposto: "Eletroposto",
  sigma_solar: "Sigma Solar",
};

const CORES_STATUS: Record<string, string> = {
  identificada: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  preliminar: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  nao_acionada: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  inconclusiva: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

/** FASE C — ids das LINHAS criadas na aba (não são ids de produto) */
const ROTULOS_ABA: Record<string, string> = {
  eletroposto: "Eletroposto",
  sigma: "Sigma Solar",
  bess: "BESS",
  mercado_livre: "Mercado Livre",
  usina: "Usina Própria",
};
const ROTULOS_STATUS: Record<string, string> = {
  identificada: "Identificada",
  preliminar: "Preliminar (pendente)",
  nao_acionada: "Não acionada",
  inconclusiva: "Inconclusiva",
};

export function AnaliseContaModal({ clienteId, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  // 18/10 — FLUXO ÚNICO: escolher o arquivo já registra a conta como
  // RECEBIDA (card no kanban de faturas). A análise vira ANALISADA.
  const [recebida, setRecebida] = useState(false);
  const [recebendo, setRecebendo] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [salvo, setSalvo] = useState(false);
  // FASE A — tela de oportunidades + criação direta no funil
  const [oportunidades, setOportunidades] = useState<OportunidadeProduto[]>([]);
  const [noFunil, setNoFunil] = useState<string[]>([]);
  const [criando, setCriando] = useState<string | null>(null);
  const [abasCriadas, setAbasCriadas] = useState<string[]>([]);
  const [cardFunil, setCardFunil] = useState(false);
  const [chaveKanban, setChaveKanban] = useState(0);

  // Passo 1 — a conta entra como CARD "Fatura Recebida".
  async function registrarRecebida(file: File) {
    setRecebendo(true);
    setErro(null);
    setRecebida(false);
    try {
      const { data: { session } } = await (
        await import("@/lib/supabase/client")
      ).createClient().auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre de novo.");
      const fd = new FormData();
      fd.append("arquivo", file);
      const auth = ["Bearer", token].join(" ");
      const res = await fetch(`/api/clientes/${clienteId}/fatura`, {
        method: "POST",
        headers: { Authorization: auth, },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao registrar a conta.");
      setRecebida(true);
      if (json.cardCriado) setCardFunil(true);
    } catch (e: any) {
      setErro(e.message || "Erro ao registrar a conta.");
    } finally {
      setRecebendo(false);
    }
  }

  async function analisar() {
    if (!arquivo) {
      setErro("Escolha a foto ou o PDF da conta primeiro.");
      return;
    }
    setAnalisando(true);
    setErro(null);
    try {
      const { data: { session } } = await (
        await import("@/lib/supabase/client")
      ).createClient().auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre de novo.");
      const auth = ["Bearer", token].join(" ");
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const res = await fetch(`/api/clientes/${clienteId}/analise-conta`, {
        method: "POST",
        headers: { Authorization: auth },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha na análise.");
      setResumo(json.resumo);
      setChaveKanban((k) => k + 1);
      setSalvo(!!json.salvo);
      setOportunidades(Array.isArray(json.oportunidades) ? json.oportunidades : []);
      setAbasCriadas(Array.isArray(json.abasCriadas) ? json.abasCriadas : []);
    } catch (e: any) {
      setErro(e.message || "Erro inesperado.");
    } finally {
      setAnalisando(false);
    }
  }

  async function criarNoFunil(opp: OportunidadeProduto) {
    setCriando(opp.produto);
    setErro(null);
    try {
      const { data: { session } } = await (
        await import("@/lib/supabase/client")
      ).createClient().auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre de novo.");
      const auth = ["Bearer", token].join(" ");
      const res = await fetch("/api/oportunidades", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: auth,
        },
        body: JSON.stringify({
          cliente_id: clienteId,
          titulo: ROTULOS[opp.produto] || opp.produto,
          descricao: `${opp.motivo}${opp.evidencia ? ` (evidência: ${opp.evidencia})` : ""}`,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Falha ao criar o card.");
      }
      setNoFunil((atual) => [...atual, opp.produto]);
    } catch (e: any) {
      setErro(e.message || "Erro ao criar o card no funil.");
    } finally {
      setCriando(null);
    }
  }

  const linha = (rotulo: string, valor: string | null) => (
    <div className="flex justify-between text-sm border-b border-white/5 py-1">
      <span className="text-slate-400">{rotulo}</span>
      <span className="text-white">{valor || "—"}</span>
    </div>
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0f1d32] border-[#1c2e4a] text-white max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🔍 Análise da conta</DialogTitle>
        </DialogHeader>

        {/* KANBAN DE FATURAS — recebida → analisada (pedido 18/10) */}
        <div className="pt-1">
          <KanbanFaturas
            clienteId={clienteId}
            chave={chaveKanban}
            onAnalisar={() => {
              setResumo(null);
              inputRef.current?.click();
            }}
          />
        </div>

        {!resumo && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Envie uma foto/print ou o PDF da conta de energia — a IA lê e
              preenche os dados na pasta do cliente.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setArquivo(f);
                setResumo(null);
                if (f) registrarRecebida(f);
              }}
            />
            <Button
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={recebendo}
            >
              {recebendo
                ? "Registrando a conta..."
                : arquivo
                ? `📄 ${arquivo.name}`
                : "📎 Escolher conta"}
            </Button>
            {recebida && (
              <p className="text-xs text-emerald-400">
                ✅ Conta registrada no kanban como <b>Fatura Recebida</b>. Agora
                analise para ela virar <b>Fatura Analisada</b>.
              </p>
            )}
            {cardFunil && (
              <p className="text-xs text-sky-400">
                🎯 Card aberto no Funil de Vendas (Recebeu a Conta).
              </p>
            )}
            {erro && <p className="text-sm text-red-400">{erro}</p>}
            <Button
              onClick={analisar}
              disabled={analisando || recebendo || !recebida}
              className="w-full"
            >
              {analisando ? "Analisando com a IA..." : "🔍 Analisar conta"}
            </Button>
          </div>
        )}

        {resumo && (
          <div className="space-y-3">
            {linha("Concessionária", resumo.concessionaria)}
            {linha("UC", resumo.uc)}
            {linha("Titular", resumo.titular)}
            {linha("CNPJ/CPF", resumo.cnpj_cpf)}
            {linha("Vencimento (dia)", resumo.vencimento)}
            {linha("Consumo (kWh)", resumo.consumo)}
            {linha("Valor", resumo.valor)}
            {abasCriadas.length > 0 && (
              <p className="text-xs text-sky-400">
                📌 Sugestões já criadas na aba do cliente (origem IA):{" "}
                {abasCriadas.map((a) => ROTULOS_ABA[a] ?? a).join(", ")}
              </p>
            )}
            {salvo && (
              <p className="text-xs text-emerald-400">
                ✅ Concessionária, UC e vencimento salvos na pasta do cliente.
              </p>
            )}

            {/* FASE A — TELA DE OPORTUNIDADES (protocolo dos produtos) */}
            {oportunidades.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  🎯 Oportunidades — regras comerciais
                </p>
                {oportunidades.map((opp) => (
                  <div
                    key={opp.produto}
                    className="rounded-lg border border-white/10 bg-white/5 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">
                        {ROTULOS[opp.produto] || opp.produto}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          CORES_STATUS[opp.status]
                        }`}
                      >
                        {ROTULOS_STATUS[opp.status]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{opp.motivo}</p>
                    {opp.evidencia && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Evidência: {opp.evidencia}
                      </p>
                    )}
                    {opp.pendencia && (
                      <p className="text-xs text-amber-500/90 mt-0.5">
                        Pendência: {opp.pendencia}
                      </p>
                    )}
                    {opp.status === "identificada" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7"
                        disabled={criando === opp.produto || noFunil.includes(opp.produto)}
                        onClick={() => criarNoFunil(opp)}
                      >
                        {noFunil.includes(opp.produto)
                          ? "✓ No funil"
                          : criando === opp.produto
                          ? "Criando..."
                          : "➕ Criar no funil"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {erro && <p className="text-sm text-red-400">{erro}</p>}
            <Button variant="outline" onClick={onClose} className="w-full">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
