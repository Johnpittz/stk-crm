"use client";
/**
 * 25/11/2026 — Fase1: aba "Estudo Usina" da pasta do cliente.
 *
 * Ideia da demo Reonic: o vendedor coloca consumo + tarifa, escolhe a meta e
 * o módulo, e o dimensionamento aparece ao vivo (kWp, painéis, economia,
 * payback). Salva em `clientes.usina` (JSON existente, sem migration),
 * gera a PROPOSTA em PDF e cria a oportunidade no funil.
 * Cálculo: lib/usina/dimensionamento.ts (testada).
 */
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  FileDown,
  Save,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  dimensionar,
  CATALOGO_MODULOS,
  escolherInversor,
} from "@/lib/usina/dimensionamento";
import { parseEstudo, gravarEstudo, type EstudoUsina } from "@/lib/usina/estudo";
import { gerarPropostaPdf } from "@/lib/usina/proposta-pdf";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** número digitado no padrão BR: "1.234,56" →1234.56 (vírgula é decimal). */
export function numeroBR(texto: string): number {
  const t = String(texto).trim();
  if (!t) return 0;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = parseFloat(normal);
  return Number.isNaN(n) ? 0 : n;
}

const META_OPCOES = [
  { pct: 100, titulo: "Zerar a conta", desc: "Cobre o consumo do ano" },
  { pct: 120, titulo: "Acumular créditos", desc: "Excedente p/ meses fracos" },
  { pct: 150, titulo: "Maximizar geração", desc: "Mais crédito / carro elétrico" },
];

export interface ClienteEstudo {
  nome_razao_social?: string | null;
  usina?: string | null;
  cidade?: string | null;
  estado?: string | null;
  consumo_jan?: number | null;
  consumo_fev?: number | null;
  consumo_mar?: number | null;
  consumo_abr?: number | null;
  consumo_mai?: number | null;
  consumo_jun?: number | null;
  consumo_jul?: number | null;
  consumo_ago?: number | null;
  consumo_set?: number | null;
  consumo_out?: number | null;
  consumo_nov?: number | null;
  consumo_dez?: number | null;
}

interface Props {
  cliente: ClienteEstudo | null;
  clienteId: string;
}

const fmtN = (v: number, casas = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const campo =
  "bg-[#0f1d32] border-[#1c2e4a] text-white placeholder:text-slate-500";

export function EstudoUsinaTab({ cliente, clienteId }: Props) {
  const [consumo, setConsumo] = useState("");
  const [tarifa, setTarifa] = useState("");
  const [meta, setMeta] = useState(100);
  const [idxModulo, setIdxModulo] = useState(0);
  const [preco, setPreco] = useState("");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [noFunil, setNoFunil] = useState(false);

  // Pré-preenchimento: estudo salvo restaura tudo; senão, média do consumo
  // que já está cadastrado no cliente (faturas antigas).
  useEffect(() => {
    if (!cliente) return;
    const salvo = parseEstudo(cliente.usina);
    if (salvo) {
      setConsumo(String(salvo.consumoMensalKwh));
      setTarifa(String(salvo.tarifaRpkwh).replace(".", ","));
      setMeta(salvo.metaPct || 100);
      const i = CATALOGO_MODULOS.findIndex((m) => m.modelo === salvo.modulo?.modelo);
      if (i >= 0) setIdxModulo(i);
      setPreco(salvo.precoKitR ? String(salvo.precoKitR) : "");
      return;
    }
    const meses = MESES.map((m) => (cliente as any)[`consumo_${m}`]).filter(
      (v) => v != null && Number(v) > 0
    );
    if (meses.length > 0) {
      const media = meses.reduce((a, b) => a + Number(b), 0) / meses.length;
      setConsumo(String(Math.round(media)));
    }
  }, [cliente]);

  const modulo = CATALOGO_MODULOS[idxModulo] ?? CATALOGO_MODULOS[0];

  const r = useMemo(
    () =>
      dimensionar({
        consumoMensalKwh: numeroBR(consumo),
        tarifaRpkwh: numeroBR(tarifa),
        metaPct: meta,
        moduloWp: modulo.wp,
        precoKitR: preco ? numeroBR(preco) : undefined,
      }),
    [consumo, tarifa, meta, modulo, preco]
  );

  const inversor = r.erros.length === 0 ? escolherInversor(r.kwpInstalado) : null;
  const pronto = r.erros.length === 0;

  const montarEstudo = (): EstudoUsina => ({
    geradoEm: new Date().toISOString(),
    consumoMensalKwh: numeroBR(consumo),
    tarifaRpkwh: numeroBR(tarifa),
    metaPct: meta,
    modulo: { marca: modulo.marca, modelo: modulo.modelo, wp: modulo.wp },
    inversor: inversor ? { marca: inversor.marca, modelo: inversor.modelo, kw: inversor.kw } : null,
    precoKitR: preco ? numeroBR(preco) : null,
    resultado: {
      kwpNecessario: r.kwpNecessario,
      kwpInstalado: r.kwpInstalado,
      numPaineis: r.numPaineis,
      geracaoMensalKwh: r.geracaoMensalKwh,
      cobrePct: r.cobrePct,
      economiaMensalR: r.economiaMensalR,
      economiaAnualR: r.economiaAnualR,
      paybackAnos: r.paybackAnos,
      co2EvitadoTons: r.co2EvitadoTons,
      areaM2: r.areaM2,
    },
  });

  const salvar = async () => {
    if (!pronto || salvando) return;
    setSalvando(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/clientes/${clienteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usina: gravarEstudo(cliente?.usina, montarEstudo()) }),
      });
      if (!res.ok) throw new Error("save");
      setMsg({ tipo: "ok", texto: "✓ Estudo salvo na pasta do cliente" });
    } catch {
      setMsg({ tipo: "erro", texto: "Não foi possível salvar — tente de novo" });
    } finally {
      setSalvando(false);
    }
  };

  const baixarPdf = () => {
    if (!pronto) return;
    const cidade = [cliente?.cidade, cliente?.estado].filter(Boolean).join("/");
    const slug =
      (cliente?.nome_razao_social || "cliente")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 40) || "cliente";
    gerarPropostaPdf({
      clienteNome: cliente?.nome_razao_social || "Cliente",
      clienteCidade: cidade,
      estudo: montarEstudo(),
    }).save(`proposta-usina-${slug}.pdf`);
  };

  const enviarFunil = async () => {
    if (!pronto || enviando || noFunil) return;
    setEnviando(true);
    setMsg(null);
    try {
      const chk = await fetch(`/api/oportunidades?cliente_id=${clienteId}`);
      const lista = chk.ok ? ((await chk.json()).oportunidades ?? []) : [];
      const jaTem = lista.some((o: any) =>
        String(o.titulo ?? "").startsWith("Estudo de usina")
      );
      if (!jaTem) {
        const res = await fetch("/api/oportunidades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cliente_id: clienteId,
            cliente_nome: cliente?.nome_razao_social || null,
            titulo: `Estudo de usina — ${cliente?.nome_razao_social || "Cliente"}`,
            descricao: `${fmtN(r.kwpInstalado)} kWp, ${r.numPaineis} painéis, cobre ${fmtN(
              r.cobrePct,
              1
            )}% do consumo — economia de ${fmtBRL(r.economiaMensalR)}/mês.`,
            consumo_kwh: Math.round(numeroBR(consumo)),
            valor_proposta: preco ? numeroBR(preco) : null,
          }),
        });
        if (!res.ok) throw new Error("funil");
      }
      setNoFunil(true);
      setMsg({ tipo: "ok", texto: "✓ Enviado ao funil — etapa Recebeu a Conta" });
    } catch {
      setMsg({ tipo: "erro", texto: "Não foi possível enviar ao funil — tente de novo" });
    } finally {
      setEnviando(false);
    }
  };

  if (!cliente) return null;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-[#3B64CF]" />
        <div>
          <h3 className="text-white font-semibold">Estudo de usina solar</h3>
          <p className="text-slate-400 text-sm">
            Dimensione o sistema e gere a proposta em minutos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── Entradas ─── */}
        <div className="bg-[#14233c] border border-[#1c2e4a] rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="estudo-consumo" className="text-sm text-slate-300">
                Consumo mensal (kWh)
              </Label>
              <Input
                id="estudo-consumo"
                inputMode="decimal"
                value={consumo}
                onChange={(e) => setConsumo(e.target.value)}
                placeholder="Ex: 1000"
                className={campo}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estudo-tarifa" className="text-sm text-slate-300">
                Tarifa (R$/kWh)
              </Label>
              <Input
                id="estudo-tarifa"
                inputMode="decimal"
                value={tarifa}
                onChange={(e) => setTarifa(e.target.value)}
                placeholder="Ex: 0,95"
                className={campo}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm text-slate-300">Meta do cliente</Label>
            <div className="grid grid-cols-3 gap-2">
              {META_OPCOES.map((o) => (
                <button
                  key={o.pct}
                  type="button"
                  onClick={() => setMeta(o.pct)}
                  className={`text-left rounded-lg border p-2.5 transition-all ${
                    meta === o.pct
                      ? "border-[#3B64CF] bg-[#3B64CF]/15"
                      : "border-[#1c2e4a] bg-[#0f1d32] hover:border-[#3B64CF]/40"
                  }`}
                >
                  <span
                    className={`block text-sm font-semibold ${
                      meta === o.pct ? "text-white" : "text-slate-300"
                    }`}
                  >
                    {o.titulo}
                  </span>
                  <span className="block text-xs text-[#3B64CF] font-bold">{o.pct}%</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">{o.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="estudo-modulo" className="text-sm text-slate-300">
                Módulo (painel)
              </Label>
              <select
                id="estudo-modulo"
                value={idxModulo}
                onChange={(e) => setIdxModulo(Number(e.target.value))}
                className={`${campo} h-10 w-full rounded-md px-3 text-sm`}
              >
                {CATALOGO_MODULOS.map((m, i) => (
                  <option key={m.modelo} value={i}>
                    {m.marca} {m.modelo} — {m.wp} Wp
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estudo-preco" className="text-sm text-slate-300">
                Valor do pacote (R$) — opcional
              </Label>
              <Input
                id="estudo-preco"
                inputMode="decimal"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="Ex: 40000"
                className={campo}
              />
            </div>
          </div>

          {r.erros.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-200 space-y-0.5">
                {r.erros.map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!pronto || salvando}
              onClick={salvar}
              className="bg-[#3B64CF] hover:bg-[#2d50a8] text-white gap-1.5"
            >
              <Save className="h-4 w-4" />
              {salvando ? "Salvando…" : "Salvar estudo"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!pronto}
              onClick={baixarPdf}
              className="border-[#1c2e4a] text-slate-300 hover:text-white hover:bg-white/5 gap-1.5"
            >
              <FileDown className="h-4 w-4" />
              Baixar proposta PDF
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!pronto || enviando || noFunil}
              onClick={enviarFunil}
              className="border-[#1c2e4a] text-slate-300 hover:text-white hover:bg-white/5 gap-1.5"
            >
              <Send className="h-4 w-4" />
              {noFunil ? "No funil ✓" : enviando ? "Enviando…" : "Enviar para o funil"}
            </Button>
          </div>

          {msg && (
            <p
              className={`text-sm flex items-center gap-1.5 ${
                msg.tipo === "ok" ? "text-green-400" : "text-red-400"
              }`}
            >
              {msg.tipo === "ok" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {msg.texto}
            </p>
          )}
        </div>

        {/* ─── Resultado ─── */}
        <div className="bg-[#14233c] border border-[#1c2e4a] rounded-lg p-4">
          {pronto ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Sistema dimensionado
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-[#0f1d32] border-[#1c2e4a] p-3">
                  <p className="text-xs text-slate-400">Potência instalada</p>
                  <p className="text-xl font-bold text-white">{fmtN(r.kwpInstalado)} kWp</p>
                </Card>
                <Card className="bg-[#0f1d32] border-[#1c2e4a] p-3">
                  <p className="text-xs text-slate-400">Painéis</p>
                  <p className="text-xl font-bold text-white">{r.numPaineis}</p>
                </Card>
                <Card className="bg-[#0f1d32] border-[#1c2e4a] p-3">
                  <p className="text-xs text-slate-400">Geração estimada</p>
                  <p className="text-xl font-bold text-white">
                    {fmtN(r.geracaoMensalKwh, 0)}
                  </p>
                  <p className="text-[11px] text-slate-500">kWh/mês</p>
                </Card>
                <Card className="bg-[#0f1d32] border-[#1c2e4a] p-3">
                  <p className="text-xs text-slate-400">Cobre do consumo</p>
                  <p className="text-xl font-bold text-green-400">{fmtN(r.cobrePct, 1)}%</p>
                </Card>
                <Card className="bg-[#0f1d32] border-[#1c2e4a] p-3">
                  <p className="text-xs text-slate-400">Economia mensal</p>
                  <p className="text-xl font-bold text-green-400">{fmtBRL(r.economiaMensalR)}</p>
                  <p className="text-[11px] text-slate-500">
                    {fmtBRL(r.economiaAnualR)}/ano
                  </p>
                </Card>
                <Card className="bg-[#0f1d32] border-[#1c2e4a] p-3">
                  <p className="text-xs text-slate-400">Retorno do investimento</p>
                  <p className="text-xl font-bold text-white">
                    {r.paybackAnos != null ? `${fmtN(r.paybackAnos, 1)} anos` : "—"}
                  </p>
                  {r.paybackAnos == null && (
                    <p className="text-[11px] text-slate-500">
                      informe o valor do pacote
                    </p>
                  )}
                </Card>
              </div>

              <div className="text-xs text-slate-400 space-y-1 border-t border-[#1c2e4a] pt-3">
                <p>
                  Inversor sugerido:{" "}
                  <span className="text-slate-200">
                    {inversor
                      ? `${inversor.marca} ${inversor.modelo} (${fmtN(inversor.kw, 1)} kW)`
                      : "—"}
                  </span>
                </p>
                <p>
                  Área estimada no telhado:{" "}
                  <span className="text-slate-200">{fmtN(r.areaM2, 1)} m²</span> · CO₂
                  evitado:{" "}
                  <span className="text-slate-200">{fmtN(r.co2EvitadoTons, 1)} t/ano</span>
                </p>
                <p>
                  Base de cálculo:1.500 kWh por kWp ao ano — o número final é confirmado
                  na visita técnica.
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-10 gap-2">
              <Calculator className="h-8 w-8 text-slate-600" />
              <p className="text-slate-400 text-sm">
                Preencha consumo e tarifa para ver o dimensionamento.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
