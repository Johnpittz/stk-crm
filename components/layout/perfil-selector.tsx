"use client";

import { useState, useRef, useEffect } from "react";
import { usePerfilAtivo, type PerfilAtivo } from "@/lib/perfil-ativo-context";
import { Briefcase, Megaphone, HeadphonesIcon, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const perfis = [
  {
    id: "crm" as PerfilAtivo,
    label: "CRM",
    description: "Atendimento e vendas",
    icon: HeadphonesIcon,
    color: "bg-[#3B64CF]",
  },
  {
    id: "marketing" as PerfilAtivo,
    label: "Marketing",
    description: "Disparo e campanhas",
    icon: Megaphone,
    color: "bg-purple-600",
  },
  {
    id: "pos_vendas" as PerfilAtivo,
    label: "Pós-Vendas",
    description: "Follow-up e suporte",
    icon: Briefcase,
    color: "bg-amber-600",
  },
];

export function PerfilSelector() {
  const { perfilAtivo, setPerfilAtivo, canSwitch } = usePerfilAtivo();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const perfilAtual = perfis.find((p) => p.id === perfilAtivo) || perfis[0];
  const Icon = perfilAtual.icon;

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Se não pode trocar, mostra apenas o badge do perfil atual
  if (!canSwitch) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
        <Icon size={14} className="text-white/70" />
        <span className="text-xs font-medium text-white/80">{perfilAtual.label}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      {/* Botão do seletor */}
      <button
        onClick={() => setAberto(!aberto)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
      >
        <Icon size={14} className="text-white/70" />
        <span className="text-xs font-medium text-white/80">{perfilAtual.label}</span>
        <ChevronDown
          size={12}
          className={cn(
            "text-white/50 transition-transform",
            aberto && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {aberto && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-[#0f1d32] rounded-xl shadow-xl border border-white/10 z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-white/10">
            <p className="text-xs text-white/40 font-medium">Trocar perfil</p>
          </div>
          <div className="p-1">
            {perfis.map((perfil) => {
              const PIcon = perfil.icon;
              const isSelected = perfil.id === perfilAtual.id;
              return (
                <button
                  key={perfil.id}
                  onClick={() => {
                    setPerfilAtivo(perfil.id);
                    setAberto(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                    isSelected
                      ? "bg-[#3B64CF]/20 text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center", perfil.color)}>
                    <PIcon size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{perfil.label}</p>
                    <p className="text-xs text-white/40">{perfil.description}</p>
                  </div>
                  {isSelected && <Check size={16} className="text-[#3B64CF] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
