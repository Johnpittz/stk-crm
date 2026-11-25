"use client";
/**
 * 25/11/2026 — Fase2-A: LANDING pública "quanto posso economizar" (topo do
 * funil da Reonic). Cliente final entra sem login, vê a estimativa na hora e
 * vira lead com score em `leads_marketing` (origem "site").
 *
 * Rota: /usina (pública — o middleware só renova sessão, não redireciona).
 */
import { useMemo, useState } from "react";
import { CheckCircle2, Calculator, MessageCircle, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATALOGO_MODULOS, dimensionar } from "@/lib/usina/dimensionamento";
import { TARIFA_PADRAO_RKWH, montarLeadUsina } from "@/lib/usina/lead-usina";

const fmt = (v: number, casas = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function LandingUsinaPage() {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidade, setCidade] = useState("");
  const [gasto, setGasto] = useState("");
  const [consumoKwh, setConsumoKwh] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [campos, setCampos] = useState<string[]>([]);
  const [enviado, setEnviado] = useState<{ score: number } | null>(null);

  // Estimativa ao vivo (mesmo motor do Estudo Usina da pasta do cliente)
  const estimativa = useMemo(() => {
    const g = parseFloat(gasto.replace(/\./g, "").replace(",", ".")) || 0;
    const k = parseFloat(consumoKwh.replace(",", ".")) || 0;
    const consumo = k > 0 ? k : g > 0 ? g / TARIFA_PADRAO_RKWH : 0;
    if (consumo <= 0) return null;
    const r = dimensionar({
      consumoMensalKwh: consumo,
      tarifaRpkwh: TARIFA_PADRAO_RKWH,
      metaPct: 100,
      moduloWp: CATALOGO_MODULOS[0].wp,
    });
    return r.erros.length ? null : r;
  }, [gasto, consumoKwh]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErroApi(null);
    setCampos([]);

    // validação local ANTES da rede (mesma regra pura do servidor)
    const g = gasto ? parseFloat(gasto.replace(/\./g, "").replace(",", ".")) : null;
    const k = consumoKwh ? parseFloat(consumoKwh.replace(",", ".")) : null;
    const local = montarLeadUsina({ nome, telefone, cidade, gastoMensalR: g, consumoKwh: k });
    if (local.erros.length > 0) {
      setCampos(local.erros);
      setErroApi("Confira os campos destacados.");
      setEnviando(false);
      return;
    }

    try {
      const res = await fetch("/api/leads/usina", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          telefone,
          cidade,
          gastoMensalR: gasto ? parseFloat(gasto.replace(/\./g, "").replace(",", ".")) : null,
          consumoKwh: consumoKwh ? parseFloat(consumoKwh.replace(",", ".")) : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 400 && Array.isArray(json.campos)) {
          setCampos(json.campos);
          setErroApi("Confira os campos destacados.");
        } else {
          setErroApi(json.error || "Não foi possível enviar agora. Tente de novo.");
        }
        return;
      }
      setEnviado({ score: json.score ?? 0 });
    } catch {
      setErroApi("Sem conexão — confira sua internet e tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  const marcar = (campo: string) => (campos.includes(campo) ? "border-red-500" : "");

  return (
    <div className="min-h-screen bg-[#0b1526] text-white">
      <header className="flex items-center gap-2 px-6 py-4 border-b border-[#1c2e4a]">
        <Sun className="h-5 w-5 text-yellow-400" />
        <span className="font-bold tracking-wide">STK · Energia Solar</span>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 grid gap-8 md:grid-cols-2 items-start">
        <section>
          <h1 className="text-3xl font-bold leading-tight">
            Descubra quanto sua casa pode economizar com energia solar
          </h1>
          <p className="mt-3 text-slate-400">
            Responda em30 segundos e receba um estudo personalizado — sem compromisso.
          </p>

          <ul className="mt-6 space-y-3 text-sm text-slate-300">
            <li className="flex gap-2">
              <Calculator className="h-4 w-4 text-[#3B64CF] shrink-0" /> Dimensionamento na hora:
              painéis, potência e economia estimada.
            </li>
            <li className="flex gap-2">
              <MessageCircle className="h-4 w-4 text-[#3B64CF] shrink-0" /> Um especialista fala
              com você pelo WhatsApp para fechar os detalhes.
            </li>
            <li className="flex gap-2">
              <Sun className="h-4 w-4 text-[#3B64CF] shrink-0" /> Estudo completo com proposta em
              PDF, se fizer sentido para o seu caso.
            </li>
          </ul>

          {estimativa && (
            <div className="mt-6 rounded-xl border border-[#1c2e4a] bg-[#14233c] p-4">
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Sua estimativa (meta de100% do consumo)
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-400">Potência</p>
                  <p className="text-xl font-bold">{fmt(estimativa.kwpInstalado)} kWp</p>
                </div>
                <div>
                  <p className="text-slate-400">Painéis</p>
                  <p className="text-xl font-bold">{estimativa.numPaineis} unidades</p>
                </div>
                <div>
                  <p className="text-slate-400">Geração</p>
                  <p className="text-xl font-bold">{fmt(estimativa.geracaoMensalKwh, 0)} kWh/mês</p>
                </div>
                <div>
                  <p className="text-slate-400">Economia ≈</p>
                  <p className="text-xl font-bold text-green-400">
                    {brl(estimativa.economiaMensalR)}/mês
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Premissa: tarifa de referência de {brl(TARIFA_PADRAO_RKWH)}/kWh — o especialista
                refina com a sua conta de verdade.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#1c2e4a] bg-[#14233c] p-6">
          {enviado ? (
            <div className="text-center py-6">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-400" />
              <h2 className="mt-3 text-xl font-bold">Pedido recebido!</h2>
              <p className="mt-2 text-slate-400 text-sm">
                Um especialista da STK entra em contato pelo WhatsApp em breve com seu estudo
                personalizado.
              </p>
              <p className="mt-4 text-xs text-slate-500">
                Seu pedido entrou na fila com prioridade {enviado.score}/100.
              </p>
            </div>
          ) : (
            <form onSubmit={enviar} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="l-nome">Seu nome *</Label>
                <Input
                  id="l-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Como podemos te chamar"
                  className={`bg-[#0f1d32] border-[#1c2e4a] text-white ${marcar("nome")}`}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-tel">WhatsApp *</Label>
                <Input
                  id="l-tel"
                  inputMode="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 98765-4321"
                  className={`bg-[#0f1d32] border-[#1c2e4a] text-white ${marcar("telefone")}`}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-cidade">Cidade</Label>
                <Input
                  id="l-cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="São Paulo"
                  className="bg-[#0f1d32] border-[#1c2e4a] text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-gasto">Quanto você paga de luz por mês? *</Label>
                <Input
                  id="l-gasto"
                  inputMode="decimal"
                  value={gasto}
                  onChange={(e) => setGasto(e.target.value)}
                  placeholder="Ex:950"
                  className={`bg-[#0f1d32] border-[#1c2e4a] text-white ${marcar("gasto")}`}
                />
                <p className="text-[11px] text-slate-500">
                  Valor médio da conta — dá para achar na fatura.
                </p>
              </div>
              <details className="text-sm text-slate-400">
                <summary className="cursor-pointer">Sei o consumo em kWh</summary>
                <Input
                  inputMode="decimal"
                  value={consumoKwh}
                  onChange={(e) => setConsumoKwh(e.target.value)}
                  placeholder="Ex:1000"
                  className="mt-2 bg-[#0f1d32] border-[#1c2e4a] text-white"
                />
              </details>

              {erroApi && <p className="text-sm text-red-400">{erroApi}</p>}

              <Button
                type="submit"
                disabled={enviando}
                className="w-full bg-[#3B64CF] hover:bg-[#2d50a8] text-white"
              >
                {enviando ? "Enviando..." : "Quero meu estudo grátis"}
              </Button>
              <p className="text-[11px] text-slate-500 text-center">
                Sem compromisso. Seus dados só são usados para este contato.
              </p>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
