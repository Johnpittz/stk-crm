"use client";

/**
 * Aba "Propostas" do painel de Atendimento (extraída de painel-contato).
 *
 * 03/10 — conserto do bug apontado pelo João:
 *  - "Salvar Proposta GD" NÃO criava proposta nenhuma (só gravava 5 campos
 *    no cadastro do cliente) → renomeado para "Salvar cadastro GD", sem
 *    prometer o que não faz;
 *  - o input "Consumo mensal (kWh)" era pedido e DESCARTADO (nem ia no
 *    corpo do PUT) → removido — quem precisa de consumo usa o formulário
 *    AXS novo, que coleta o histórico de 12 meses que a AXS realmente usa;
 *  - não havia caminho daqui para o único formulário que enfileira
 *    proposta de verdade → link "Criar proposta na AXS" para
 *    /clientes/{id}/axs-novo (Fase 3 / C3).
 * A RECIEE continua como estava: ela cria proposta mesmo (POST /api/reciee).
 */

import { Zap, Receipt, Save, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CONCESSIONARIAS,
  CLASSES_TARIFARIAS,
  SUBGRUPOS,
  BANDEIRAS,
  ESTADOS,
  DISTRIBUIDORAS,
  SUBGRUPOS_RECIEE,
  MODALIDADES,
  CLASSES_RECIEE,
  TENSOES,
  REGIMES_TRIBUTARIOS,
  GRUPOS,
} from "./propostas-opcoes";

export type TipoProposta = "gd" | "reciee" | null;

export interface GdForm {
  concessionaria: string;
  instalacao: string;
  classe_tarifaria: string;
  subgrupo_tarifario: string;
  bandeira: string;
}

export interface RecieeForm {
  uc: string;
  estado: string;
  distribuidora: string;
  subgrupo: string;
  modalidade: string;
  classe: string;
  tensao: string;
  regime_tributario: string;
  grupo: string;
}

interface AbaPropostasProps {
  tipoProposta: TipoProposta;
  setTipoProposta: (t: TipoProposta) => void;
  gdForm: GdForm;
  setGdForm: React.Dispatch<React.SetStateAction<GdForm>>;
  recieeForm: RecieeForm;
  setRecieeForm: React.Dispatch<React.SetStateAction<RecieeForm>>;
  criarPropostaGD: () => void;
  criarPropostaRECIEE: () => void;
  salvandoCliente: boolean;
  verificandoDuplicata: boolean;
  /** cliente vinculado ao atendimento — sem ele não há para onde ir */
  clienteId?: string | null;
}

export default function AbaPropostas({
  tipoProposta,
  setTipoProposta,
  gdForm,
  setGdForm,
  recieeForm,
  setRecieeForm,
  criarPropostaGD,
  criarPropostaRECIEE,
  salvandoCliente,
  verificandoDuplicata,
  clienteId,
}: AbaPropostasProps) {
  return (
    <div>
      <div className="px-4 py-3">
        <p className="text-xs text-white/50 mb-2">Selecione o tipo de proposta:</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={tipoProposta === "gd" ? "default" : "outline"}
            className={
              tipoProposta === "gd"
                ? "flex-1 gap-1 bg-green-600 hover:bg-green-700"
                : "flex-1 gap-1"
            }
            onClick={() => setTipoProposta(tipoProposta === "gd" ? null : "gd")}
          >
            <Zap className="h-3.5 w-3.5" />
            GD
          </Button>
          <Button
            size="sm"
            variant={tipoProposta === "reciee" ? "default" : "outline"}
            className={
              tipoProposta === "reciee"
                ? "flex-1 gap-1 bg-yellow-600 hover:bg-yellow-700"
                : "flex-1 gap-1"
            }
            onClick={() => setTipoProposta(tipoProposta === "reciee" ? null : "reciee")}
          >
            <Receipt className="h-3.5 w-3.5" />
            RECIEE
          </Button>
        </div>
      </div>

      {tipoProposta === "gd" && (
        <div className="px-4 pb-3 space-y-2">
          <h4 className="text-xs font-medium text-green-400 flex items-center gap-1">
            <Zap className="h-3.5 w-3.5" />
            Dados GD do cliente (cadastro)
          </h4>
          <select
            value={gdForm.concessionaria}
            onChange={(e) => setGdForm({ ...gdForm, concessionaria: e.target.value })}
            className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2 w-full"
          >
            <option value="">Concessionária *</option>
            {CONCESSIONARIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <Input
            placeholder="UC / Instalação *"
            value={gdForm.instalacao}
            onChange={(e) => setGdForm({ ...gdForm, instalacao: e.target.value })}
            className="h-10 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={gdForm.classe_tarifaria}
              onChange={(e) => setGdForm({ ...gdForm, classe_tarifaria: e.target.value })}
              className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
            >
              <option value="">Classe</option>
              {CLASSES_TARIFARIAS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={gdForm.subgrupo_tarifario}
              onChange={(e) => setGdForm({ ...gdForm, subgrupo_tarifario: e.target.value })}
              className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
            >
              <option value="">Subgrupo</option>
              {SUBGRUPOS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <select
            value={gdForm.bandeira}
            onChange={(e) => setGdForm({ ...gdForm, bandeira: e.target.value })}
            className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2 w-full"
          >
            <option value="">Bandeira</option>
            {BANDEIRAS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
            onClick={criarPropostaGD}
            disabled={
              salvandoCliente ||
              verificandoDuplicata ||
              !gdForm.concessionaria ||
              !gdForm.instalacao
            }
          >
            {salvandoCliente ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {salvandoCliente ? "Salvando..." : "Salvar cadastro GD"}
          </Button>

          {clienteId && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] leading-snug text-white/40">
                Isso grava os dados acima no cliente. A proposta AXS (fila,
                card e mensalidade) nasce no formulário completo da pasta do
                cliente:
              </p>
              <Link
                href={`/clientes/${clienteId}/axs-novo`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
              >
                Criar proposta na AXS <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}

      {tipoProposta === "reciee" && (
        <div className="px-4 pb-3 space-y-2">
          <h4 className="text-xs font-medium text-yellow-400 flex items-center gap-1">
            <Receipt className="h-3.5 w-3.5" />
            Proposta RECIEE
          </h4>
          <Input
            placeholder="UC *"
            value={recieeForm.uc}
            onChange={(e) => setRecieeForm({ ...recieeForm, uc: e.target.value })}
            className="h-10 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={recieeForm.estado}
              onChange={(e) => setRecieeForm({ ...recieeForm, estado: e.target.value })}
              className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
            >
              <option value="">UF *</option>
              {ESTADOS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
            <select
              value={recieeForm.distribuidora}
              onChange={(e) => setRecieeForm({ ...recieeForm, distribuidora: e.target.value })}
              className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
            >
              <option value="">Distribuidora *</option>
              {DISTRIBUIDORAS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={recieeForm.subgrupo}
              onChange={(e) => setRecieeForm({ ...recieeForm, subgrupo: e.target.value })}
              className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
            >
              <option value="">Subgrupo</option>
              {SUBGRUPOS_RECIEE.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={recieeForm.modalidade}
              onChange={(e) => setRecieeForm({ ...recieeForm, modalidade: e.target.value })}
              className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
            >
              <option value="">Modalidade</option>
              {MODALIDADES.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={recieeForm.classe}
              onChange={(e) => setRecieeForm({ ...recieeForm, classe: e.target.value })}
              className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
            >
              <option value="">Classe</option>
              {CLASSES_RECIEE.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={recieeForm.tensao}
              onChange={(e) => setRecieeForm({ ...recieeForm, tensao: e.target.value })}
              className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
            >
              <option value="">Tensão</option>
              {TENSOES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={recieeForm.regime_tributario}
              onChange={(e) => setRecieeForm({ ...recieeForm, regime_tributario: e.target.value })}
              className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
            >
              <option value="">Regime</option>
              {REGIMES_TRIBUTARIOS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              value={recieeForm.grupo}
              onChange={(e) => setRecieeForm({ ...recieeForm, grupo: e.target.value })}
              className="h-10 text-sm rounded-md border border-slate-600 bg-slate-800 text-white px-2"
            >
              <option value="">Grupo</option>
              {GRUPOS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <Button
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white gap-2"
            onClick={criarPropostaRECIEE}
            disabled={salvandoCliente || verificandoDuplicata || !recieeForm.uc}
          >
            {salvandoCliente ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {salvandoCliente ? "Salvando..." : "Salvar Proposta RECIEE"}
          </Button>
        </div>
      )}

      {!tipoProposta && (
        <div className="px-4 pb-4 text-center">
          <p className="text-xs text-white/30">Selecione GD ou RECIEE acima</p>
        </div>
      )}
    </div>
  );
}
