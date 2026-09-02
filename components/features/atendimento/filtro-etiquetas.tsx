"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, X, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { ETIQUETAS_DISPONIVEIS } from "@/lib/etiquetas";

interface FiltroEtiquetasProps {
  etiquetaSelecionada: string | null;
  onSelecionar: (etiqueta: string | null) => void;
}

export function FiltroEtiquetas({ etiquetaSelecionada, onSelecionar }: FiltroEtiquetasProps) {
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [aberto, setAberto] = useState(false);
  const supabase = createClient();

  const fetchEtiquetas = useCallback(async () => {
    // Usa apenas as etiquetas definidas no helper compartilhado
    setEtiquetas([...ETIQUETAS_DISPONIVEIS]);
  }, []);

  useEffect(() => {
    fetchEtiquetas();
  }, [fetchEtiquetas]);

  if (etiquetas.length === 0 && !etiquetaSelecionada) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAberto(!aberto)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-md border transition-colors",
          etiquetaSelecionada
            ? "bg-[#3B64CF]/20 border-[#3B64CF]/30 text-[#3B64CF]"
            : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
        )}
      >
        <div className="flex items-center gap-1.5">
          <Tag className="h-3 w-3" />
          <span>{etiquetaSelecionada || "Filtrar por etiqueta"}</span>
        </div>
        {etiquetaSelecionada ? (
          <X
            className="h-3 w-3 cursor-pointer hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              onSelecionar(null);
              setAberto(false);
            }}
          />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {aberto && (
        <>
          {/* Overlay para fechar */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setAberto(false)}
          />
          {/* Dropdown */}
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#0f1d32] border border-white/10 rounded-md shadow-lg max-h-48 overflow-y-auto">
            {etiquetas.map((etiqueta) => (
              <button
                key={etiqueta}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors",
                  etiquetaSelecionada === etiqueta && "bg-[#3B64CF]/20 text-[#3B64CF] font-medium"
                )}
                onClick={() => {
                  onSelecionar(etiqueta === etiquetaSelecionada ? null : etiqueta);
                  setAberto(false);
                }}
              >
                {etiqueta}
              </button>
            ))}
            {etiquetas.length === 0 && (
              <p className="px-3 py-2 text-xs text-white/30">Nenhuma etiqueta encontrada</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
