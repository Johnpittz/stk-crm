"use client";

import { useState, useEffect } from "react";
import { Bot, Loader2 } from "lucide-react";

export function ToggleIA() {
  const [ligado, setLigado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Buscar estado atual
  useEffect(() => {
    async function buscar() {
      try {
        const res = await fetch("/api/config/ia-toggle");
        const data = await res.json();
        setLigado(data.ligado ?? false);
      } catch {
        setLigado(false);
      } finally {
        setLoading(false);
      }
    }
    buscar();
  }, []);

  // Toggle
  const handleToggle = async () => {
    if (salvando) return;
    setSalvando(true);
    const novoEstado = !ligado;
    try {
      await fetch("/api/config/ia-toggle", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ligado: novoEstado }),
      });
      setLigado(novoEstado);
    } catch {
      // Mantém estado anterior em caso de erro
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 text-white/40 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>IA</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleToggle}
      disabled={salvando}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
        ligado
          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30"
          : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/60"
      } ${salvando ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
      title={ligado ? "IA ligada — clique para desligar" : "IA desligada — clique para ligar"}
    >
      {salvando ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Bot className="h-3.5 w-3.5" />
      )}
      <span>IA</span>
      <div
        className={`relative w-8 h-4 rounded-full transition-colors ${
          ligado ? "bg-purple-500" : "bg-white/20"
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
            ligado ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </div>
    </button>
  );
}
