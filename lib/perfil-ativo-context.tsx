"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type PerfilAtivo = "crm" | "marketing" | "pos_vendas";

interface PerfilAtivoContextType {
  perfilAtivo: PerfilAtivo;
  setPerfilAtivo: (perfil: PerfilAtivo) => void;
  canSwitch: boolean; // true apenas para admins
}

const PerfilAtivoContext = createContext<PerfilAtivoContextType | null>(null);

// Mapeamento de cargo → perfil padrão
const cargoParaPerfil: Record<string, PerfilAtivo> = {
  // CRM
  vendedor: "crm",
  demonstracao: "crm",
  gerente_comercial: "crm",
  
  // Marketing
  marketing: "marketing",
  analista_marketing: "marketing",
  
  // Pós-Vendas
  pos_vendas: "pos_vendas",
  supervisor_pos: "pos_vendas",
  
  // Admin vê tudo (padrão: CRM)
  admin: "crm",
  diretor: "crm",
};

// Cargos que podem trocar de perfil
const cargosQueTrocam = ["admin", "diretor"];

export function PerfilAtivoProvider({
  children,
  cargo,
}: {
  children: React.ReactNode;
  cargo: string;
}) {
  const podeTrocar = cargosQueTrocam.includes(cargo);
  const perfilPadrao = cargoParaPerfil[cargo] || "crm";

  // Carregar do localStorage (se disponível)
  const [perfilAtivo, setPerfilAtivoState] = useState<PerfilAtivo>(() => {
    if (typeof window !== "undefined" && podeTrocar) {
      const salvo = localStorage.getItem("stk_perfil_ativo") as PerfilAtivo;
      if (salvo && ["crm", "marketing", "pos_vendas"].includes(salvo)) {
        return salvo;
      }
    }
    return perfilPadrao;
  });

  // Salvar no localStorage quando mudar
  const setPerfilAtivo = useCallback((perfil: PerfilAtivo) => {
    setPerfilAtivoState(perfil);
    if (typeof window !== "undefined") {
      localStorage.setItem("stk_perfil_ativo", perfil);
    }
  }, []);

  // Se não pode trocar, sempre usar o perfil padrão
  useEffect(() => {
    if (!podeTrocar) {
      setPerfilAtivoState(perfilPadrao);
    }
  }, [podeTrocar, perfilPadrao]);

  return (
    <PerfilAtivoContext.Provider
      value={{ perfilAtivo, setPerfilAtivo, canSwitch: podeTrocar }}
    >
      {children}
    </PerfilAtivoContext.Provider>
  );
}

export function usePerfilAtivo() {
  const ctx = useContext(PerfilAtivoContext);
  if (!ctx) {
    // Fallback para quando não tem provider (SSR)
    return { perfilAtivo: "crm" as PerfilAtivo, setPerfilAtivo: () => {}, canSwitch: false };
  }
  return ctx;
}
