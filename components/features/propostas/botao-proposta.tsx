"use client";

/**
 * Fase 6 / C4 — botão do documento de proposta (pasta do cliente e modal da
 * oportunidade).
 *
 * Um único botão com dois estados:
 *   • ainda não tem PDF  → "Gerar proposta" (POST /api/propostas)
 *   • já tem PDF salvo   → "Baixar proposta" (arquivo do Storage) + "Gerar de novo"
 *
 * Os erros vêm prontos da API (400 = lista do que falta no cadastro) e ficam
 * visíveis embaixo do botão, sem alert.
 */
import { useEffect, useState } from "react";
import { FileText, Download, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PropostaSalva {
  id: string;
  numero: string;
  arquivo_nome: string;
  validade: string;
  created_at: string;
}

export function BotaoProposta({
  oportunidadeId,
  className,
  label,
}: {
  oportunidadeId: string;
  className?: string;
  label?: string;
}) {
  const [proposta, setProposta] = useState<PropostaSalva | null>(null);
  const [consultando, setConsultando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/propostas?oportunidade_id=${encodeURIComponent(oportunidadeId)}`
        );
        if (!res.ok) return;
        const body = await res.json();
        if (vivo) setProposta(body.propostas?.[0] ?? null);
      } catch {
        // sem conexão: o botão continua disponível para gerar
      } finally {
        if (vivo) setConsultando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [oportunidadeId]);

  const baixar = (id: string) => {
    window.location.href = `/api/propostas/${id}/arquivo`;
  };

  const gerar = async () => {
    setErro(null);
    setGerando(true);
    try {
      const res = await fetch("/api/propostas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oportunidade_id: oportunidadeId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(
          body.erros?.join(" • ") ||
            body.error ||
            "Não consegui gerar a proposta"
        );
        return;
      }
      setProposta(body.proposta);
      baixar(body.proposta.id);
    } catch {
      setErro("Falha de conexão ao gerar a proposta");
    } finally {
      setGerando(false);
    }
  };

  const ocupado = gerando || consultando;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={() => (proposta ? baixar(proposta.id) : gerar())}
        disabled={ocupado}
        title={
          proposta
            ? `Proposta ${proposta.numero} gerada em ${new Date(
                proposta.created_at
              ).toLocaleDateString("pt-BR")}`
            : "Gerar o PDF da proposta"
        }
        className={cn(
          "flex items-center justify-center gap-1.5 h-7 px-3 text-[11px] rounded-lg border transition-colors whitespace-nowrap disabled:opacity-60",
          proposta
            ? "border-white/10 text-white/80 hover:text-white hover:bg-white/5"
            : "border-[#3B64CF]/50 bg-[#3B64CF]/15 text-[#a9c1f7] hover:bg-[#3B64CF]/25"
        )}
      >
        {ocupado ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : proposta ? (
          <Download className="h-3 w-3" />
        ) : (
          <FileText className="h-3 w-3" />
        )}
        {consultando
          ? "Proposta..."
          : gerando
          ? "Gerando..."
          : proposta
          ? label || "Baixar proposta"
          : label || "Gerar proposta"}
      </button>

      {proposta && !consultando && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[9px] text-white/40">
            {proposta.numero} · válida até{" "}
            {new Date(`${proposta.validade}T12:00:00`).toLocaleDateString("pt-BR")}
          </span>
          <button
            type="button"
            onClick={gerar}
            disabled={gerando}
            className="flex items-center gap-1 text-[9px] text-white/40 hover:text-white/70 underline underline-offset-2 disabled:opacity-60"
          >
            <RefreshCw className={cn("h-2.5 w-2.5", gerando && "animate-spin")} />
            gerar de novo
          </button>
        </div>
      )}

      {erro && (
        <p className="text-[10px] text-red-400/90 leading-snug max-w-[260px]">
          {erro}
        </p>
      )}
    </div>
  );
}
