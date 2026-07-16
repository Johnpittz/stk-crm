"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, X, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface FiltroEtiquetasProps {
  etiquetaSelecionada: string | null;
  onSelecionar: (etiqueta: string | null) => void;
}

export function FiltroEtiquetas({ etiquetaSelecionada, onSelecionar }: FiltroEtiquetasProps) {
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [aberto, setAberto] = useState(false);
  const supabase = createClient();

  const fetchEtiquetas = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/atendimentos/etiquetas?todas=true", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setEtiquetas(data.etiquetas || []);
      }
    } catch (err) {
      console.error("Erro ao buscar etiquetas:", err);
    }
  }, [supabase]);

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
            ? "bg-blue-50 border-blue-200 text-blue-700"
            : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
        )}
      >
        <div className="flex items-center gap-1.5">
          <Tag className="h-3 w-3" />
          <span>{etiquetaSelecionada || "Filtrar por etiqueta"}</span>
        </div>
        {etiquetaSelecionada ? (
          <X
            className="h-3 w-3 cursor-pointer hover:text-blue-900"
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
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
            {etiquetas.map((etiqueta) => (
              <button
                key={etiqueta}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs hover:bg-slate-50 transition-colors",
                  etiquetaSelecionada === etiqueta && "bg-blue-50 text-blue-700 font-medium"
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
              <p className="px-3 py-2 text-xs text-slate-400">Nenhuma etiqueta encontrada</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}