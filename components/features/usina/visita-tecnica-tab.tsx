"use client";
/**
 * 25/11/2026 — Fase2-C: ABA "VISITA TÉCNICA" da pasta do cliente.
 *
 * Checklist da visita técnica de usina solar (no espírito do checklist de
 * homologação da Reonic): itens típicos com checkbox + nota opcional,
 * progresso "X/Y completo" e botão Salvar.
 *
 * PERSISTÊNCIA SEM MIGRATION: reusa a tabela existente
 * `cliente_pasta_linhas` (migration 099) com a linha textual nova
 * "visita_tecnica" — a mesma que o restante da pasta usa.
 * ⚠ A CHECK da tabela (migration 102) ainda só aceita os 6 ids antigos;
 * até o João rodar NO SQL EDITOR (sem migration nova):
 *
 *   ALTER TABLE public.cliente_pasta_linhas
 *     DROP CONSTRAINT IF EXISTS cliente_pasta_linhas_linha_check;
 *   ALTER TABLE public.cliente_pasta_linhas
 *     ADD CONSTRAINT cliente_pasta_linhas_linha_check
 *     CHECK (linha IN ('eletroposto','sigma','bess','gestao_fatura',
 *                      'mercado_livre','usina','visita_tecnica'));
 *
 * UPLOAD DE FOTOS: a análise de conta só guarda arquivo no bucket privado
 * "faturas-contas" pelo servidor (service role) e o endpoint é específico
 * de fatura — não dá pra reusar sem criar rota nova. Enquanto isso o
 * botão fica desabilitado com o aviso de "upload em construção".
 */
import { useCallback, useEffect, useState } from "react";
import {
  ClipboardCheck,
  ImagePlus,
  Loader2,
  MapPin,
  Save,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { LinhaId } from "@/lib/clientes/linhas";

/** linha textual nova na pasta do cliente (mesma tabela, sem migration). */
export const LINHA_VISITA: LinhaId = "visita_tecnica";

/** Itens típicos de uma visita técnica em energia solar. */
export const ITENS_VISITA: { id: string; label: string }[] = [
  { id: "fotos_telhado", label: "Fotos do telhado" },
  { id: "fotos_quadro", label: "Fotos do quadro de distribuição" },
  { id: "foto_fachada", label: "Foto da fachada" },
  { id: "ultima_conta", label: "Última conta de luz" },
  { id: "medida_telhado", label: "Medida do telhado/área" },
  { id: "observacoes_local", label: "Observações do local" },
];

export interface VisitaTecnicaTabProps {
  clienteId: string;
}

function boolsDe(origem: unknown): Record<string, boolean> {
  if (!origem || typeof origem !== "object") return {};
  const saida: Record<string, boolean> = {};
  for (const item of ITENS_VISITA) {
    saida[item.id] = Boolean((origem as Record<string, unknown>)[item.id]);
  }
  return saida;
}

function textosDe(origem: unknown): Record<string, string> {
  if (!origem || typeof origem !== "object") return {};
  const saida: Record<string, string> = {};
  for (const item of ITENS_VISITA) {
    const valor = (origem as Record<string, unknown>)[item.id];
    saida[item.id] = typeof valor === "string" ? valor : "";
  }
  return saida;
}

export function VisitaTecnicaTab({ clienteId }: VisitaTecnicaTabProps) {
  const [itens, setItens] = useState<Record<string, boolean>>({});
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [registroId, setRegistroId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  // reabre o que já foi salvo na visita anterior
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await createClient()
          .from("cliente_pasta_linhas")
          .select("id, dados")
          .eq("cliente_id", clienteId)
          .eq("linha", LINHA_VISITA)
          .order("created_at", { ascending: true });
        if (!vivo || !Array.isArray(data) || data.length === 0) return;
        // a última linha salva é a visita vigente
        const ultima = data[data.length - 1] as {
          id?: string;
          dados?: { itens?: unknown; notas?: unknown };
        };
        setRegistroId(ultima.id ? String(ultima.id) : null);
        setItens(boolsDe(ultima.dados?.itens));
        setNotas(textosDe(ultima.dados?.notas));
      } catch {
        // sem leitura, o checklist começa em branco
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [clienteId]);

  const feitos = ITENS_VISITA.filter((item) => itens[item.id]).length;
  const total = ITENS_VISITA.length;
  const completo = feitos === total;

  const salvar = useCallback(async () => {
    if (salvando) return;
    setSalvando(true);
    setAviso(null);
    const dados = {
      itens,
      notas,
      salvoEm: new Date().toISOString(),
    };
    try {
      const supabase = createClient();
      if (registroId) {
        const { error } = await supabase
          .from("cliente_pasta_linhas")
          .update({ dados })
          .eq("id", registroId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase
          .from("cliente_pasta_linhas")
          .insert({ cliente_id: clienteId, linha: LINHA_VISITA, dados })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        const id = (data as { id?: string } | null)?.id;
        if (id) setRegistroId(String(id));
      }
      setAviso({ ok: true, texto: "✓ Checklist salvo na pasta do cliente" });
    } catch (erro) {
      console.error("[visita-tecnica] salvar:", (erro as Error)?.message);
      setAviso({
        ok: false,
        texto: "Não foi possível salvar o checklist — tente de novo.",
      });
    } finally {
      setSalvando(false);
    }
  }, [salvando, itens, notas, registroId, clienteId]);

  return (
    <div className="bg-[#14233c] border border-[#1c2e4a] rounded-lg p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="h-5 w-5 text-[#3B64CF]" />
            <h3 className="text-lg font-semibold text-white">Visita Técnica</h3>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-[#3B64CF]" />
            Levantamento no local antes do dimensionamento final.
          </p>
        </div>
        <span
          className={`text-sm font-medium px-3 py-1 rounded-full ${
            completo
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : "bg-[#0f1d32] text-slate-300 border border-[#1c2e4a]"
          }`}
        >
          {feitos}/{total} completo
        </span>
      </div>

      {carregando && (
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3B64CF]" />
          Abrindo o checklist salvo…
        </p>
      )}

      <ul className="mt-5 space-y-3">
        {ITENS_VISITA.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 bg-[#0f1d32] border border-[#1c2e4a] rounded-md px-3 py-2.5"
          >
            <input
              id={`vt-${item.id}`}
              type="checkbox"
              checked={Boolean(itens[item.id])}
              onChange={(e) =>
                setItens((atual) => ({ ...atual, [item.id]: e.target.checked }))
              }
              className="h-4 w-4 shrink-0 accent-[#3B64CF] cursor-pointer"
            />
            <label
              htmlFor={`vt-${item.id}`}
              className={`flex-1 text-sm cursor-pointer ${
                itens[item.id] ? "text-white" : "text-slate-300"
              }`}
            >
              {item.label}
            </label>
            <Input
              type="text"
              value={notas[item.id] ?? ""}
              onChange={(e) =>
                setNotas((atual) => ({ ...atual, [item.id]: e.target.value }))
              }
              aria-label={`${item.label} — nota`}
              placeholder="nota opcional…"
              className="h-8 w-40 text-xs bg-[#14233c] border-[#1c2e4a] text-white placeholder:text-slate-500"
            />
          </li>
        ))}
      </ul>

      {/* UPLOAD TODO — bucket da análise de conta é privado (service role);
          sem rota nova não dá pra subir foto daqui. */}
      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <Button
          type="button"
          size="sm"
          disabled
          title="upload em construção"
          className="bg-transparent border border-dashed border-[#1c2e4a] text-slate-400 hover:bg-transparent cursor-not-allowed"
        >
          <ImagePlus className="h-4 w-4" />
          Adicionar foto
        </Button>
        <p className="text-xs text-amber-400/90">
          Upload em construção: o envio de fotos será liberado em breve — por
          enquanto anote o essencial na nota do item.
        </p>
      </div>

      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <Button
          type="button"
          size="sm"
          disabled={salvando || carregando}
          onClick={salvar}
          className="bg-[#3B64CF] hover:bg-[#3B64CF]/90 text-white"
        >
          {salvando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Checklist
        </Button>
        {aviso && (
          <p
            className={`text-xs flex items-center gap-1 ${
              aviso.ok ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {!aviso.ok && <TriangleAlert className="h-3.5 w-3.5" />}
            {aviso.texto}
          </p>
        )}
        {feitos > 0 && feitos < total && (
          <p className="text-xs text-slate-500">
            Faltam {total - feitos} item(ns) para fechar a visita.
          </p>
        )}
      </div>
    </div>
  );
}
