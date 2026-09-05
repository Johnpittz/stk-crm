"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Headset,
  Users,
  Package,
  Briefcase,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Target,
  HelpCircle,
  ClipboardList,
  Zap,
  Megaphone,
  BarChart3,
  Flag,
  HeadphonesIcon,
  MessageSquare,
  Star,
  Truck,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { logout } from "@/app/(dashboard)/actions";
import { usePerfilAtivo } from "@/lib/perfil-ativo-context";
import type { PerfilAtivo } from "@/lib/perfil-ativo-context";

interface SidebarProps {
  user: {
    email: string;
    nome: string;
    canal: string;
    cargo: string;
    avatar_url: string | null;
  };
}

// Itens de navegação por perfil
const navItemsPorPerfil: Record<PerfilAtivo, Array<{
  href: string;
  label: string;
  icon: any;
  description?: string;
  badge?: string;
}>> = {
  crm: [
    {
      href: "/atendimento",
      label: "Atendimento",
      icon: Headset,
      description: "Conversas WhatsApp",
      badge: "Ativo",
    },
    {
      href: "/chatbot",
      label: "Chatbot",
      icon: Bot,
      description: "Fluxos automáticos",
    },
    {
      href: "/kanban",
      label: "Kanban",
      icon: ClipboardList,
      description: "Tarefas e acompanhamento",
    },
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      description: "Visão gerencial",
    },
    {
      href: "/clientes",
      label: "Clientes",
      icon: Users,
      description: "Gestão de clientes",
    },
  ],
  marketing: [
    {
      href: "/marketing/dashboard",
      label: "Dashboard",
      icon: BarChart3,
      description: "Métricas de marketing",
    },
    {
      href: "/marketing/campanhas",
      label: "Campanhas",
      icon: Megaphone,
      description: "Criar campanhas e disparos",
    },
    {
      href: "/marketing/leads",
      label: "Leads",
      icon: Target,
      description: "Prospecção de leads",
    },
    {
      href: "/marketing/relatorios",
      label: "Relatórios",
      icon: BarChart3,
      description: "Análises e relatórios",
    },
    {
      href: "/marketing/promocoes",
      label: "Promoções",
      icon: Flag,
      description: "Ofertas e cupons",
    },
  ],
  pos_vendas: [
    {
      href: "/pos-vendas/dashboard",
      label: "Dashboard",
      icon: BarChart3,
      description: "Visão pós-venda",
    },
    {
      href: "/pos-vendas/follow-up",
      label: "Follow-up",
      icon: MessageSquare,
      description: "Acompanhamento pós-venda",
    },
    {
      href: "/pos-vendas/satisfacao",
      label: "Satisfação",
      icon: Star,
      description: "Pesquisas e reviews",
    },
    {
      href: "/pos-vendas/suporte",
      label: "Suporte",
      icon: HeadphonesIcon,
      description: "Chamados e suporte",
    },
    {
      href: "/pos-vendas/acompanhamento",
      label: "Acompanhamento",
      icon: Truck,
      description: "Entregas e logística",
    },
  ],
  admin: [
    {
      href: "/atendimento",
      label: "Atendimento",
      icon: Headset,
      description: "Conversas WhatsApp",
    },
    {
      href: "/kanban",
      label: "Kanban",
      icon: ClipboardList,
      description: "Tarefas e acompanhamento",
    },
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      description: "Visão gerencial",
    },
    {
      href: "/clientes",
      label: "Clientes",
      icon: Users,
      description: "Gestão de clientes",
    },
    {
      href: "/marketing/dashboard",
      label: "Marketing",
      icon: Megaphone,
      description: "Campanhas e leads",
    },
    {
      href: "/pos-vendas/dashboard",
      label: "Pós-Vendas",
      icon: HeadphonesIcon,
      description: "Follow-up e suporte",
    },
    {
      href: "/reciee",
      label: "RECIEE",
      icon: Zap,
      description: "Recuperação de energia",
    },
  ],
};

// Itens do rodapé (sempre visíveis)
const bottomItems = [
  {
    href: "/configuracoes",
    label: "Configurações",
    icon: Settings,
  },
  {
    href: "/ajuda",
    label: "Ajuda",
    icon: HelpCircle,
  },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const { perfilAtivo } = usePerfilAtivo();

  const navItems = navItemsPorPerfil[perfilAtivo] || navItemsPorPerfil.crm;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-[#15317B] transition-all duration-300 ease-in-out flex flex-col",
        isOpen ? "w-64" : "w-20"
      )}
    >
      {/* Logo */}
      <div className="flex items-center border-b border-[#3B64CF]/20 h-20">
        <Link href="/atendimento" className="flex-1 flex items-center h-full overflow-hidden px-4 py-2">
          <span className="text-2xl font-bold text-white">STK</span>
        </Link>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg p-1.5 text-white/60 hover:bg-[#3B64CF]/20 hover:text-white transition-colors shrink-0"
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
                  ? "bg-[#3B64CF] text-white shadow-lg"
                  : "text-white/70 hover:bg-[#3B64CF]/20 hover:text-white"
              )}
            >
              <Icon
                size={20}
                className={cn("min-w-[20px] transition-transform", isActive && "scale-110")}
              />

              {isOpen && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{item.label}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="bg-emerald-500 text-white border-0 text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                  {isActive && item.description && (
                    <p className="text-xs text-white/70 truncate">{item.description}</p>
                  )}
                </div>
              )}

              {/* Tooltip para quando sidebar está fechada */}
              {!isOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-[#15317B] text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 border border-[#3B64CF]/20">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Config, Ajuda, User, Logout */}
      <div className="border-t border-[#3B64CF]/20 px-3 py-3 space-y-1">
        {/* Bottom nav items (Configurações, Ajuda) */}
        {bottomItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={!isOpen ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200 group relative",
                isActive
                  ? "bg-[#3B64CF] text-white"
                  : "text-white/60 hover:bg-[#3B64CF]/20 hover:text-white"
              )}
            >
              <Icon size={18} className="min-w-[18px]" />
              {isOpen && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
              {!isOpen && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-[#15317B] text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 border border-[#3B64CF]/20">
                  {item.label}
                </div>
              )}
            </Link>
          );
        })}

        {/* User + Logout */}
        <div className={cn("flex items-center gap-3 px-3 py-2", !isOpen && "flex-col")}>
          <Avatar className="h-9 w-9 border-2 border-[#3B64CF]/30 shrink-0">
            <AvatarImage src={user.avatar_url ?? undefined} alt={user.nome} />
            <AvatarFallback className="bg-[#3B64CF] text-white text-xs font-semibold">
              {user.nome.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {isOpen && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-white">{user.nome}</p>
              <p className="truncate text-xs text-white/50">{user.canal}</p>
            </div>
          )}

          <form action={logout}>
            <Button
              variant="ghost"
              size="icon"
              className="text-white/50 hover:text-white hover:bg-[#3B64CF]/20 h-8 w-8"
              title="Sair"
              type="submit"
            >
              <LogOut size={16} />
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
