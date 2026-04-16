"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Headset,
  Users,
  ShoppingCart,
  Trophy,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { vendedorAtual } from "@/lib/data/mock";

// Configuração de navegação
const navItems = [
  { 
    href: "/dashboard", 
    label: "Dashboard", 
    icon: LayoutDashboard,
    description: "Visão gerencial"
  },
  { 
    href: "/atendimento", 
    label: "Atendimento", 
    icon: Headset,
    description: "Minha área de trabalho",
    badge: "Ativo"
  },
  { 
    href: "/clientes", 
    label: "Clientes", 
    icon: Users,
    description: "Gestão de clientes"
  },
  { 
    href: "/vendas", 
    label: "Vendas", 
    icon: ShoppingCart,
    description: "Histórico de vendas"
  },
  { 
    href: "/campanhas", 
    label: "Campanhas", 
    icon: Trophy,
    description: "Incentivos e metas"
  },
  { 
    href: "/configuracoes", 
    label: "Configurações", 
    icon: Settings,
    description: "Preferências do sistema"
  },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-[#0D3B33] transition-all duration-300 ease-in-out flex flex-col",
        isOpen ? "w-64" : "w-20"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-[#14919B]/20">
        <Link href="/atendimento" className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 min-w-[40px] items-center justify-center rounded-lg bg-[#14919B]">
            <span className="text-lg font-bold text-white">R</span>
          </div>
          {isOpen && (
            <span className="text-lg font-bold text-white whitespace-nowrap">
              CRM ROMA
            </span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="rounded-lg p-1.5 text-white/60 hover:bg-[#14919B]/20 hover:text-white transition-colors"
        >
          {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!isOpen ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 group relative",
                isActive
                  ? "bg-[#14919B] text-white shadow-lg"
                  : "text-white/70 hover:bg-[#14919B]/20 hover:text-white"
              )}
            >
              <Icon size={20} className={cn(
                "min-w-[20px] transition-transform",
                isActive && "scale-110"
              )} />
              
              {isOpen && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{item.label}</span>
                    {item.badge && (
                      <Badge 
                        variant="secondary" 
                        className="bg-emerald-500 text-white border-0 text-xs"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  {isActive && (
                    <p className="text-xs text-white/70 truncate">
                      {item.description}
                    </p>
                  )}
                </div>
              )}

              {/* Tooltip para quando sidebar está fechada */}
              {!isOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-[#0D3B33] text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 border border-[#14919B]/20">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="border-t border-[#14919B]/20 p-4">
        <div
          className={cn(
            "flex items-center gap-3",
            !isOpen && "flex-col"
          )}
        >
          <Avatar className="h-10 w-10 border-2 border-[#14919B]/30">
            <AvatarImage src={vendedorAtual.avatar} alt={vendedorAtual.nome} />
            <AvatarFallback className="bg-[#14919B] text-white font-semibold">
              {vendedorAtual.nome.charAt(0)}
            </AvatarFallback>
          </Avatar>
          
          {isOpen && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {vendedorAtual.nome}
              </p>
              <p className="truncate text-xs text-white/60">
                {vendedorAtual.canal}
              </p>
            </div>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="text-white/60 hover:text-white hover:bg-[#14919B]/20"
            title="Sair"
          >
            <LogOut size={18} />
          </Button>
        </div>
      </div>
    </aside>
  );
}
