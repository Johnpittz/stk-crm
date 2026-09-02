"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Search, Calendar, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificacoesBell } from "@/components/notificacoes-bell";
import { PerfilSelector } from "@/components/layout/perfil-selector";


function useFormattedDate() {
  const [formattedDate, setFormattedDate] = useState<string>("");
  useEffect(() => {
    setFormattedDate(
      new Date().toLocaleDateString("pt-BR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );
  }, []);
  return formattedDate;
}

// Mapeamento de títulos por rota
const routeTitles: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard": { title: "Dashboard", subtitle: "Visão gerencial" },
  "/atendimento": { title: "Atendimento", subtitle: "Minha área de trabalho" },
  "/disparo": { title: "Disparo em Massa", subtitle: "Envio de mensagens em massa" },
  "/clientes": { title: "Clientes", subtitle: "Gestão de clientes" },
  "/vendas": { title: "Vendas", subtitle: "Histórico de vendas" },
  "/campanhas": { title: "Campanhas", subtitle: "Incentivos e metas" },
  "/configuracoes": { title: "Configurações", subtitle: "Preferências do sistema" },
  "/ajuda": { title: "Central de Ajuda", subtitle: "Aprenda a usar o STK-CRM" },
};

function WhatsAppStatus() {
  const [status, setStatus] = useState<"connected" | "disconnected" | "loading">("loading");

  useEffect(() => {
    // Delay initial check to avoid cold start cascade on page load
    const timer = setTimeout(() => {
      async function checkStatus() {
      try {
        const res = await fetch("/api/whatsapp/status");
        const data = await res.json();
        setStatus(data.connected ? "connected" : "disconnected");
      } catch {
        setStatus("disconnected");
      }
    }
    checkStatus();
    const interval = setInterval(checkStatus, 60000); // Reduced from 30s to 60s
    return () => clearInterval(interval);
    }, 10000); // 10s delay to not compete with page-data
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
      status === "connected" 
        ? "bg-emerald-500/20 text-emerald-300" 
        : status === "loading"
        ? "bg-white/10 text-white/50"
        : "bg-red-500/20 text-red-300"
    }`}>
      <div className={`w-2 h-2 rounded-full ${
        status === "connected" 
          ? "bg-emerald-400" 
          : status === "loading"
          ? "bg-white/40 animate-pulse"
          : "bg-red-400"
      }`} />
      <span className="hidden md:inline">WhatsApp</span>
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const routeInfo = routeTitles[pathname] || { title: "STK CRM" };
  const formattedDate = useFormattedDate();

  return (
    <header className="sticky top-0 z-30 border-b border-[#3B64CF]/20 bg-[#15317B]/95 backdrop-blur-md px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-white">
            {routeInfo.title}
          </h1>
          {routeInfo.subtitle && (
            <p className="text-sm text-white/60">{routeInfo.subtitle}</p>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Perfil Selector */}
          <PerfilSelector />

          {/* WhatsApp Status */}
          <WhatsAppStatus />

          {/* Date */}
          {formattedDate && (
            <div className="hidden md:flex items-center gap-2 text-sm text-white/60 bg-white/10 px-3 py-1.5 rounded-full">
              <Calendar className="h-4 w-4" />
              <span className="capitalize">{formattedDate}</span>
            </div>
          )}

          {/* Search */}
          <Button variant="ghost" size="icon" className="relative text-white/60 hover:text-white hover:bg-white/10">
            <Search className="h-5 w-5" />
          </Button>

          {/* Ajuda */}
          <Link href="/ajuda">
            <Button variant="ghost" size="icon" title="Central de Ajuda" className="text-white/60 hover:text-white hover:bg-white/10">
              <HelpCircle className="h-5 w-5" />
            </Button>
          </Link>

          {/* Notifications */}
          <NotificacoesBell />
        </div>
      </div>
    </header>
  );
}
