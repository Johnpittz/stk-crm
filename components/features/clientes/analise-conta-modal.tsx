"use client";

/**
 * PARTE 11 (PPTX 17/10) — "Análise da conta": sobe a foto/PDF da fatura,
 * a IA lê e o resumo entra na pasta do cliente.
 */
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { KanbanFaturas } from "./kanban-faturas";
import {
  FLUXO_RECEBIDA,
  diaDeHoje,
  dicaAnalise,
  estadoAnalise,
  linhasDeHoje,
  rotuloBotaoAnalise,
  temArquivoGuardado,
  temRecebidaHoje,
} from "@/lib/clientes/analise-conta";
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
  /**
   * 19/10 — a página re-busca a pasta/funil/quadro na hora: a fatura
   * aparece sem F5 assim que inserir e assim que analisar.
   */
  aoAtualizar?: () => void;
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

export function AnaliseContaModal({ clienteId, onClose, aoAtualizar }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  // 18/10 — FLUXO ÚNICO: escolher o arquivo já registra a conta como
  // RECEBIDA (card no kanban de faturas). A análise vira ANALISADA.
  // O rótulo vem do BANCO, não da memória — quem abre a página de novo
  // não perdia o passo 1 e o "Analisar conta" ficava travado pra sempre.
  const [recebida, setRecebida] = useState(false);
  const [recebidaGravada, setRecebidaGravada] = useState(false);
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
  const [dica, setDica] = useState<string | null>(null);
  const [pendenteAnalise, setPendenteAnalise] = useState(false);
  const [linhaHoje, setLinhaHoje] = useState<{ id: string; arquivo: boolean } | null>(
    null
  );

  // Passo 1.5 — o que já está gravado manda no rótulo do botão.
  // É o passo que faltava: sem isso a tela esquecia que a conta já tinha
  // sido registrada e o "Analisar conta" ficava desabilitado pra sempre.
  useEffect(() => {
    if (!clienteId) return;
    let vivo = true;
    (async () => {
      try {
        const { data } = await createClient()
          .from("cliente_pasta_linhas")
          .select("id, dados")
          .eq("cliente_id", clienteId)
          .eq("linha", "gestao_fatura")
          .order("created_at", { ascending: true });
        if (!vivo) return;
        const linhas = (data ?? []) as {
          id?: string;
          dados?: Record<string, unknown> | null;
        }[];
        setRecebidaGravada(temRecebidaHoje(linhas as never[]));
        // a conta do dia e se o arquivo dela está guardado: é o que o
        // REANALISAR relê sem pedir o arquivo de novo
        const doDia = linhasDeHoje(linhas);
        const ultima = doDia[doDia.length - 1];
        setLinhaHoje(
          ultima
            ? {
                id: String(ultima.id ?? ""),
                arquivo: temArquivoGuardado(ultima.dados ?? null),
              }
            : null
        );
      } catch {
        // sem leitura não há rótulo: fica no passo 1, que é o seguro
      }
    })();
    return () => {
      vivo = false;
    };
  }, [clienteId, chaveKanban]);

  // Um botão só, duas funções — a coluna do kanban é quem manda.
  const passoAnalise = estadoAnalise([
    { dados: recebidaGravada ? { dia: diaDeHoje(), fluxo: FLUXO_RECEBIDA } : null },
  ]);

  // Passo 1 — a conta entra como CARD "Fatura Recebida".
  async function registrarRecebida(file: File) {
    setRecebendo(true);
    setErro(null);
    setDica(null);
    setRecebida(false);
    try {
      const { data: { session } } = await createClient().auth.getSession();
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
      const json = await res.json().catch(() => null);
      if (!json) {
        // 19/10 — resposta sem JSON (Vercel cortou) nunca mais vira erro cru
        throw new Error("O servidor não respondeu ao registrar a conta — tente de novo.");
      }
      if (!res.ok) throw new Error(json.error || "Falha ao registrar a conta.");
      setRecebida(true);
      // o card aparece no kanban na hora e o botão vira "Analisar conta"
      setRecebidaGravada(true);
      setChaveKanban((k) => k + 1);
      if (json.cardCriado) setCardFunil(true);
      // 19/10 — página re-busca tudo: a conta aparece sem F5
      aoAtualizar?.();
      return true;
    } catch (e: any) {
      setErro(e.message || "Erro ao registrar a conta.");
      return false;
    } finally {
      setRecebendo(false);
    }
  }

  /** Resultado igual para os dois caminhos (arquivo novo ou guardado). */
  function aplicarAnaliseFeita(json: any) {
    setDica(null);
    setResumo(json.resumo);
    setChaveKanban((k) => k + 1);
    // 19/10 — página re-busca tudo: a análise aparece sem F5
    aoAtualizar?.();
    setSalvo(!!json.salvo);
    setOportunidades(Array.isArray(json.oportunidades) ? json.oportunidades : []);
    setAbasCriadas(Array.isArray(json.abasCriadas) ? json.abasCriadas : []);
  }

  /**
   * REANALISAR (19/10): relê a conta JÁ INSERIDA com o arquivo que ficou
   * guardado no passo 1 — sem pedir o arquivo de novo.
   */
  async function analisarLinha(linhaId: string) {
    setResumo(null);
    setAnalisando(true);
    setErro(null);
    setDica(null);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre de novo.");
      const fd = new FormData();
      fd.append("linha_id", linhaId);
      const url = `/api/clientes/${clienteId}/analise-conta`;
      // 19/10 — falha transitória JÁ aconteceu: a 1ª análise do dia morria
      // no limite da Vercel e o vendedor via um erro mudo, sem saber que
      // era só esperar. DUAS tentativas antes de avisar; erro da API
      // (traduzido) não repete — só rede/timeout.
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const ultima = tentativa === 1;
        let res: Response;
        try {
          res = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
          });
        } catch {
          if (!ultima) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          throw new Error("Sem conexão com o servidor — tente de novo.");
        }
        let json: any = null;
        try {
          json = await res.json();
        } catch {
          // resposta sem JSON = a função morreu no meio (timeout da Vercel)
          if (!ultima) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          throw new Error(
            "A análise caiu no meio (o servidor demorou) — tente de novo."
          );
        }
        if (!res.ok) {
          setDica(dicaAnalise(json.detalhe));
          throw new Error(json.error || "Falha na análise.");
        }
        aplicarAnaliseFeita(json);
        return;
      }
    } catch (e: any) {
      setErro(e.message || "Não consegui analisar a conta.");
    } finally {
      setAnalisando(false);
    }
  }

  async function analisar(file?: File) {
    const alvo = file ?? arquivo;
    if (!alvo) {
      // 19/10 — relê o BANCO no clique, não confia no estado de quando o
      // modal abriu: se a conta chegou depois (ou a leitura ainda vinha),
      // o botão morria sem efeito nenhum e sem avisar nada.
      let alvoLinha = linhaHoje;
      try {
        const { data } = await createClient()
          .from("cliente_pasta_linhas")
          .select("id, dados")
          .eq("cliente_id", clienteId)
          .eq("linha", "gestao_fatura")
          .order("created_at", { ascending: true });
        const linhas = (data ?? []) as {
          id?: string;
          dados?: Record<string, unknown> | null;
        }[];
        const doDia = linhasDeHoje(linhas);
        const ultima = doDia[doDia.length - 1];
        if (ultima) {
          alvoLinha = {
            id: String(ultima.id ?? ""),
            arquivo: temArquivoGuardado(ultima.dados ?? null),
          };
          setLinhaHoje(alvoLinha);
        }
      } catch {
        // sem leitura agora, segue com o que a tela já sabia
      }
      // a conta do dia já está guardada → relê sem escolher de novo
      if (alvoLinha?.arquivo && alvoLinha.id) {
        await analisarLinha(alvoLinha.id);
        return;
      }
      // sem arquivo guardado (linha antiga): escolhe e analisa em seguida
      setPendenteAnalise(true);
      inputRef.current?.click();
      return;
    }
    setAnalisando(true);
    setErro(null);
    try {
      const { data: { session } } = await createClient().auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada. Entre de novo.");
      const auth = ["Bearer", token].join(" ");
      const fd = new FormData();
      fd.append("arquivo", alvo);
      // 19/10 — o corte da Vercel chega como corpo SEM JSON ("An error
      // o..."): DUAS tentativas antes de avisar, igual ao reanalisar.
      let json: any = null;
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const ultima = tentativa === 1;
        let res: Response;
        try {
          res = await fetch(`/api/clientes/${clienteId}/analise-conta`, {
            method: "POST",
            headers: { Authorization: auth },
            body: fd,
          });
        } catch {
          if (!ultima) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          throw new Error("Sem conexão com o servidor — tente de novo.");
        }
        try {
          json = await res.json();
        } catch {
          // resposta sem JSON = a função morreu no meio (timeout da Vercel)
          if (!ultima) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          throw new Error(
            "A análise caiu no meio (o servidor demorou) — tente de novo."
          );
        }
        if (!res.ok) {
          // guarda o PORQUÊ (pdf_sem_texto, ia_vazia...) pra explicar na tela
          setDica(dicaAnalise(json.detalhe));
          throw new Error(json.error || "Falha na análise.");
        }
        break;
      }
      if (!json) throw new Error("Não consegui analisar a conta — tente de novo.");
      setDica(null);
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
      const { data: { session } } = await createClient().auth.getSession();
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
            onAnalisar={(card) => {
              setResumo(null);
              // o card sabe se o arquivo da conta está guardado: com ele,
              // reanalisar NÃO pede arquivo de novo (pedido 19/10)
              if (card?.arquivo && card.id) {
                void analisarLinha(card.id);
                return;
              }
              // linha antiga (antes de guardarmos o arquivo): precisa
              // escolher o PDF de novo — e analisa assim que chegar.
              // erro+dica juntos: é o par que a tela mostra para explicar
              setPendenteAnalise(true);
              setErro("Esta conta não tem o arquivo guardado.");
              setDica(dicaAnalise("sem_arquivo_guardado"));
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
                if (!f) return;
                registrarRecebida(f).then(async (ok) => {
                  // reanálise: quem clicou em "Analisar" sem arquivo quer
                  // analisar assim que o arquivo chegar
                  if (ok && pendenteAnalise) {
                    setPendenteAnalise(false);
                    await analisar(f);
                  }
                });
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
                : passoAnalise.recebidaHoje
                ? "📎 Trocar conta"
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
            {erro && (
              <div className="space-y-1">
                <p className="text-sm text-red-400">{erro}</p>
                {dica && <p className="text-xs text-slate-400">{dica}</p>}
              </div>
            )}
            {erro && arquivo && (
              <Button
                variant="outline"
                onClick={() => analisar()}
                disabled={analisando}
                className="w-full"
              >
                {analisando ? "Analisando com a IA..." : "🔄 Tentar analisar de novo"}
              </Button>
            )}
            <Button
              onClick={() => analisar()}
              disabled={analisando || recebendo || !passoAnalise.recebidaHoje}
              className="w-full"
            >
              {analisando
                ? "Analisando com a IA..."
                : rotuloBotaoAnalise(passoAnalise)}
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
