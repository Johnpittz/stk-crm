1|"use client";
2|
3|import { useState } from "react";
4|import Link from "next/link";
5|import { usePathname } from "next/navigation";
6|import {
7|  LayoutDashboard,
8|  Headset,
9|  Users,
10|  Package,
11|  Briefcase,
12|  Settings,
13|  ChevronLeft,
14|  ChevronRight,
15|  LogOut,
16|  Target,
17|  HelpCircle,
18|  ClipboardList,
19|  Zap,
20|  Megaphone,
21|  BarChart3,
22|  Flag,
23|  HeadphonesIcon,
24|  MessageSquare,
25|  Star,
26|  Truck,
27|  Bot,
28|} from "lucide-react";
29|import { cn } from "@/lib/utils/cn";
30|import { Button } from "@/components/ui/button";
31|import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
32|import { Badge } from "@/components/ui/badge";
33|import { logout } from "@/app/(dashboard)/actions";
34|import { usePerfilAtivo } from "@/lib/perfil-ativo-context";
35|import type { PerfilAtivo } from "@/lib/perfil-ativo-context";
36|
37|interface SidebarProps {
38|  user: {
39|    email: string;
40|    nome: string;
41|    canal: string;
42|    cargo: string;
43|    avatar_url: string | null;
44|  };
45|}
46|
47|// Itens de navegação por perfil
48|const navItemsPorPerfil: Record<PerfilAtivo, Array<{
49|  href: string;
50|  label: string;
51|  icon: any;
52|  description?: string;
53|  badge?: string;
54|}>> = {
55|  crm: [
56|    {
57|      href: "/atendimento",
58|      label: "Atendimento",
59|      icon: Headset,
60|      description: "Conversas WhatsApp",
61|      badge: "Ativo",
62|    },
63|    {
64|      href: "/kanban",
65|      label: "Oportunidades",
66|      icon: ClipboardList,
67|      description: "Funil de vendas",
68|    },
69|    {
70|      href: "/dashboard",
71|      label: "Dashboard",
72|      icon: LayoutDashboard,
73|      description: "Visão gerencial",
74|    },
75|    {
76|      href: "/clientes",
77|      label: "Clientes",
78|      icon: Users,
79|      description: "Gestão de clientes",
80|    },
81|  ],
82|  marketing: [
83|    {
84|      href: "/marketing/dashboard",
85|      label: "Dashboard",
86|      icon: BarChart3,
87|      description: "Métricas de marketing",
88|    },
89|    {
90|      href: "/chatbot",
91|      label: "Chatbot",
92|      icon: Bot,
93|      description: "Fluxos automáticos de qualificação",
94|    },
95|    {
96|      href: "/marketing/campanhas",
97|      label: "Campanhas",
98|      icon: Megaphone,
99|      description: "Criar campanhas e disparos",
100|    },
101|    {
102|      href: "/marketing/leads",
103|      label: "Leads",
104|      icon: Target,
105|      description: "Prospecção de leads",
106|    },
107|    {
108|      href: "/marketing/relatorios",
109|      label: "Relatórios",
110|      icon: BarChart3,
111|      description: "Análises e relatórios",
112|    },
113|    {
114|      href: "/marketing/promocoes",
115|      label: "Promoções",
116|      icon: Flag,
117|      description: "Ofertas e cupons",
118|    },
119|  ],
120|  pos_vendas: [
121|    {
122|      href: "/pos-vendas/dashboard",
123|      label: "Dashboard",
124|      icon: BarChart3,
125|      description: "Visão pós-venda",
126|    },
127|    {
128|      href: "/pos-vendas/follow-up",
129|      label: "Follow-up",
130|      icon: MessageSquare,
131|      description: "Acompanhamento pós-venda",
132|    },
133|    {
134|      href: "/pos-vendas/satisfacao",
135|      label: "Satisfação",
136|      icon: Star,
137|      description: "Pesquisas e reviews",
138|    },
139|    {
140|      href: "/pos-vendas/suporte",
141|      label: "Suporte",
142|      icon: HeadphonesIcon,
143|      description: "Chamados e suporte",
144|    },
145|    {
146|      href: "/pos-vendas/acompanhamento",
147|      label: "Acompanhamento",
148|      icon: Truck,
149|      description: "Entregas e logística",
150|    },
151|  ],
152|  admin: [
153|    {
154|      href: "/atendimento",
155|      label: "Atendimento",
156|      icon: Headset,
157|      description: "Conversas WhatsApp",
158|    },
159|    {
160|      href: "/kanban",
161|      label: "Oportunidades",
162|      icon: ClipboardList,
163|      description: "Funil de vendas",
164|    },
165|    {
166|      href: "/dashboard",
167|      label: "Dashboard",
168|      icon: LayoutDashboard,
169|      description: "Visão gerencial",
170|    },
171|    {
172|      href: "/clientes",
173|      label: "Clientes",
174|      icon: Users,
175|      description: "Gestão de clientes",
176|    },
177|    {
178|      href: "/marketing/dashboard",
179|      label: "Marketing",
180|      icon: Megaphone,
181|      description: "Campanhas e leads",
182|    },
183|    {
184|      href: "/pos-vendas/dashboard",
185|      label: "Pós-Vendas",
186|      icon: HeadphonesIcon,
187|      description: "Follow-up e suporte",
188|    },
189|    {
190|      href: "/reciee",
191|      label: "RECIEE",
192|      icon: Zap,
193|      description: "Recuperação de energia",
194|    },
195|  ],
196|};
197|
198|// Itens do rodapé (sempre visíveis)
199|const bottomItems = [
200|  {
201|    href: "/configuracoes",
202|    label: "Configurações",
203|    icon: Settings,
204|  },
205|  {
206|    href: "/ajuda",
207|    label: "Ajuda",
208|    icon: HelpCircle,
209|  },
210|];
211|
212|export function Sidebar({ user }: SidebarProps) {
213|  const pathname = usePathname();
214|  const [isOpen, setIsOpen] = useState(true);
215|  const { perfilAtivo } = usePerfilAtivo();
216|
217|  const navItems = navItemsPorPerfil[perfilAtivo] || navItemsPorPerfil.crm;
218|
219|  return (
220|    <aside
221|      className={cn(
222|        "fixed left-0 top-0 z-40 h-screen bg-[#15317B] transition-all duration-300 ease-in-out flex flex-col",
223|        isOpen ? "w-64" : "w-20"
224|      )}
225|    >
226|      {/* Logo */}
227|      <div className="flex items-center border-b border-[#3B64CF]/20 h-20">
228|        <Link href="/atendimento" className="flex-1 flex items-center h-full overflow-hidden px-4 py-2">
229|          <span className="text-2xl font-bold text-white">STK</span>
230|        </Link>
231|        <button
232|          onClick={() => setIsOpen(!isOpen)}
233|          className="rounded-lg p-1.5 text-white/60 hover:bg-[#3B64CF]/20 hover:text-white transition-colors shrink-0"
234|        >
235|          {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
236|        </button>
237|      </div>
238|
239|      {/* Navigation */}
240|      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
241|        {navItems.map((item) => {
242|          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
243|          const Icon = item.icon;
244|
245|          return (
246|            <Link
247|              key={item.href}
248|              href={item.href}
249|              title={!isOpen ? item.label : undefined}
250|              className={cn(
251|                "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 group relative",
252|                isActive
253|                  ? "bg-[#3B64CF] text-white shadow-lg"
254|                  : "text-white/70 hover:bg-[#3B64CF]/20 hover:text-white"
255|              )}
256|            >
257|              <Icon
258|                size={20}
259|                className={cn("min-w-[20px] transition-transform", isActive && "scale-110")}
260|              />
261|
262|              {isOpen && (
263|                <div className="flex-1 min-w-0">
264|                  <div className="flex items-center gap-2">
265|                    <span className="font-medium truncate">{item.label}</span>
266|                    {item.badge && (
267|                      <Badge variant="secondary" className="bg-emerald-500 text-white border-0 text-xs">
268|                        {item.badge}
269|                      </Badge>
270|                    )}
271|                  </div>
272|                  {isActive && item.description && (
273|                    <p className="text-xs text-white/70 truncate">{item.description}</p>
274|                  )}
275|                </div>
276|              )}
277|
278|              {/* Tooltip para quando sidebar está fechada */}
279|              {!isOpen && (
280|                <div className="absolute left-full ml-2 px-2 py-1 bg-[#15317B] text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 border border-[#3B64CF]/20">
281|                  {item.label}
282|                </div>
283|              )}
284|            </Link>
285|          );
286|        })}
287|      </nav>
288|
289|      {/* Bottom: Config, Ajuda, User, Logout */}
290|      <div className="border-t border-[#3B64CF]/20 px-3 py-3 space-y-1">
291|        {/* Bottom nav items (Configurações, Ajuda) */}
292|        {bottomItems.map((item) => {
293|          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
294|          const Icon = item.icon;
295|
296|          return (
297|            <Link
298|              key={item.href}
299|              href={item.href}
300|              title={!isOpen ? item.label : undefined}
301|              className={cn(
302|                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200 group relative",
303|                isActive
304|                  ? "bg-[#3B64CF] text-white"
305|                  : "text-white/60 hover:bg-[#3B64CF]/20 hover:text-white"
306|              )}
307|            >
308|              <Icon size={18} className="min-w-[18px]" />
309|              {isOpen && (
310|                <span className="text-sm font-medium truncate">{item.label}</span>
311|              )}
312|              {!isOpen && (
313|                <div className="absolute left-full ml-2 px-2 py-1 bg-[#15317B] text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 border border-[#3B64CF]/20">
314|                  {item.label}
315|                </div>
316|              )}
317|            </Link>
318|          );
319|        })}
320|
321|        {/* User + Logout */}
322|        <div className={cn("flex items-center gap-3 px-3 py-2", !isOpen && "flex-col")}>
323|          <Avatar className="h-9 w-9 border-2 border-[#3B64CF]/30 shrink-0">
324|            <AvatarImage src={user.avatar_url ?? undefined} alt={user.nome} />
325|            <AvatarFallback className="bg-[#3B64CF] text-white text-xs font-semibold">
326|              {user.nome.charAt(0).toUpperCase()}
327|            </AvatarFallback>
328|          </Avatar>
329|
330|          {isOpen && (
331|            <div className="flex-1 min-w-0">
332|              <p className="truncate text-sm font-medium text-white">{user.nome}</p>
333|              <p className="truncate text-xs text-white/50">{user.canal}</p>
334|            </div>
335|          )}
336|
337|          <form action={logout}>
338|            <Button
339|              variant="ghost"
340|              size="icon"
341|              className="text-white/50 hover:text-white hover:bg-[#3B64CF]/20 h-8 w-8"
342|              title="Sair"
343|              type="submit"
344|            >
345|              <LogOut size={16} />
346|            </Button>
347|          </form>
348|        </div>
349|      </div>
350|    </aside>
351|  );
352|}
353|