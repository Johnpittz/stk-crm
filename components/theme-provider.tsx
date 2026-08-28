"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface ThemeContextType {
  compact: boolean;
  setCompact: (v: boolean) => void;
  animations: boolean;
  setAnimations: (v: boolean) => void;
  loaded: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = "crm-roma-ui";

function applyCompactClass(compact: boolean) {
  const root = document.documentElement;
  if (compact) root.classList.add("compact");
  else root.classList.remove("compact");
}

function applyAnimationsClass(animations: boolean) {
  const root = document.documentElement;
  if (!animations) root.classList.add("reduce-motion");
  else root.classList.remove("reduce-motion");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const [compact, setCompactState] = useState(false);
  const [animations, setAnimationsState] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Aplica classes no <html> sempre que mudar
  useEffect(() => {
    applyCompactClass(compact);
  }, [compact]);

  useEffect(() => {
    applyAnimationsClass(animations);
  }, [animations]);

  // Garante que nunca fique em dark mode
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  // Carrega preferências do Supabase (e localStorage como cache inicial)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (typeof window !== "undefined") {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (!cancelled) {
              setCompactState(parsed.compact || false);
              setAnimationsState(parsed.animations !== false);
            }
          }
        } catch {
          // ignora JSON inválido
        }
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const { data, error } = await supabase
          .from("preferencias_notificacoes")
          .select("modo_compacto, animacoes_ativadas")
          .eq("user_id", user.id)
          .single();

        // Ignora erros de tabela inexistente (42P01) ou registro não encontrado (PGRST116)
        if (error && (error.code === "PGRST116" || error.code === "42P01" || error.message?.includes("does not exist"))) {
          // Tabela não existe ou sem registro — usa defaults
        } else if (data && !cancelled) {
          const c = data.modo_compacto || false;
          const a = data.animacoes_ativadas !== false;
          setCompactState(c);
          setAnimationsState(a);
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ compact: c, animations: a }));
        }
      } catch {
        // falha silenciosa - tabela pode não existir
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [supabase]);

  const save = useCallback(
    async (prefs: { compact: boolean; animations: boolean }) => {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("preferencias_notificacoes").upsert(
            {
              user_id: user.id,
              modo_compacto: prefs.compact,
              animacoes_ativadas: prefs.animations,
            },
            { onConflict: "user_id" }
          );
        }
      } catch {
        // falha silenciosa
      }
    },
    [supabase]
  );

  const setCompact = (v: boolean) => {
    setCompactState(v);
    save({ compact: v, animations });
  };

  const setAnimations = (v: boolean) => {
    setAnimationsState(v);
    save({ compact, animations: v });
  };

  return (
    <ThemeContext.Provider value={{ compact, setCompact, animations, setAnimations, loaded }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
