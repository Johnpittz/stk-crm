"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils/cn";

/**
 * Layout do Dashboard (Rotas Autenticadas)
 * 
 * Este layout envolve todas as páginas que requerem autenticação.
 * Inclui a sidebar de navegação e o header com título da página.
 * 
 * Estrutura:
 * - Sidebar: Navegação principal (fixa à esquerda)
 * - Header: Título e ações da página (sticky no topo)
 * - Content: Área principal de conteúdo
 */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)} 
      />

      {/* Main Content */}
      <main
        className={cn(
          "min-h-screen transition-all duration-300 ease-in-out",
          sidebarOpen ? "ml-64" : "ml-20"
        )}
      >
        {/* Header */}
        <Header />

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
