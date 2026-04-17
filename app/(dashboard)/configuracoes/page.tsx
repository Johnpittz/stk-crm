"use client";

import { useState } from "react";
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  CreditCard, 
  Smartphone,
  Save,
  Camera
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils/cn";

export default function ConfiguracoesPage() {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="perfil" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="perfil">Perfil</TabsTrigger>
          <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
          <TabsTrigger value="aparencia">Aparência</TabsTrigger>
          <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
        </TabsList>

        {/* Perfil */}
        <TabsContent value="perfil" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Perfil</CardTitle>
              <CardDescription>
                Atualize suas informações pessoais e dados de contato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ana" />
                  <AvatarFallback className="text-2xl bg-blue-600 text-white">
                    AS
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button variant="outline" className="gap-2">
                    <Camera className="h-4 w-4" />
                    Alterar Foto
                  </Button>
                  <p className="text-xs text-slate-500">
                    JPG, PNG ou GIF. Máximo 2MB.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo</Label>
                  <Input id="nome" defaultValue="Ana Silva" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" defaultValue="ana.silva@roma.com.br" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input id="telefone" defaultValue="(11) 98765-4321" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input id="whatsapp" defaultValue="5511987654321" />
                </div>
              </div>

              <Separator />

              {/* Canal */}
              <div className="space-y-2">
                <Label htmlFor="canal">Canal Principal</Label>
                <Input id="canal" defaultValue="Loja Norte" disabled />
                <p className="text-xs text-slate-500">
                  Para alterar o canal, entre em contato com o administrador.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notificações */}
        <TabsContent value="notificacoes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferências de Notificação</CardTitle>
              <CardDescription>
                Escolha como deseja receber as notificações do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {[
                { id: "email", label: "E-mail", desc: "Receber notificações por e-mail" },
                { id: "push", label: "Push no Navegador", desc: "Notificações push em tempo real" },
                { id: "whatsapp", label: "WhatsApp", desc: "Alertas importantes via WhatsApp" },
              ].map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{item.label}</p>
                    <p className="text-sm text-slate-500">{item.desc}</p>
                  </div>
                  <Switch defaultChecked={item.id !== "whatsapp"} />
                </div>
              ))}

              <Separator />

              <h3 className="font-medium text-slate-900">Tipos de Notificação</h3>
              {[
                { id: "metas", label: "Metas e Campanhas", desc: "Alertas sobre metas e campanhas ativas" },
                { id: "tarefas", label: "Tarefas", desc: "Lembretes de tarefas agendadas" },
                { id: "oportunidades", label: "Oportunidades", desc: "Novas oportunidades de venda" },
                { id: "churn", label: "Alertas de Churn", desc: "Clientes em risco de churn" },
              ].map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-slate-900">{item.label}</p>
                    <p className="text-sm text-slate-500">{item.desc}</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Segurança */}
        <TabsContent value="seguranca" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Segurança da Conta</CardTitle>
              <CardDescription>
                Gerencie sua senha e configurações de segurança
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium text-slate-900">Alterar Senha</h3>
                <div className="space-y-2">
                  <Label htmlFor="senha-atual">Senha Atual</Label>
                  <Input id="senha-atual" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nova-senha">Nova Senha</Label>
                  <Input id="nova-senha" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmar-senha">Confirmar Nova Senha</Label>
                  <Input id="confirmar-senha" type="password" />
                </div>
                <Button>Atualizar Senha</Button>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium text-slate-900">Autenticação em Dois Fatores</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900">2FA Ativado</p>
                    <p className="text-sm text-slate-500">
                      Proteção adicional via SMS
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium text-slate-900">Sessões Ativas</h3>
              <div className="p-4 rounded-lg border bg-slate-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">Chrome - Windows</p>
                      <p className="text-sm text-slate-500">São Paulo, Brasil • Agora</p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700">Atual</Badge>
                  </div>
                </div>
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                  Encerrar Todas as Sessões
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aparência */}
        <TabsContent value="aparencia" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Aparência do Sistema</CardTitle>
              <CardDescription>
                Personalize a interface do CRM
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium text-slate-900">Tema</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: "light", label: "Claro", color: "bg-white border-slate-200" },
                    { id: "dark", label: "Escuro", color: "bg-slate-900 border-slate-700" },
                    { id: "system", label: "Sistema", color: "bg-gradient-to-br from-white to-slate-900 border-slate-200" },
                  ].map((theme) => (
                    <button
                      key={theme.id}
                      className={cn(
                        "p-4 rounded-lg border-2 text-center transition-all",
                        theme.color,
                        theme.id === "light" && "border-blue-500 ring-2 ring-blue-500/20"
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-full mx-auto mb-2",
                        theme.id === "light" ? "bg-slate-200" : 
                        theme.id === "dark" ? "bg-slate-700" : "bg-slate-400"
                      )} />
                      <span className={cn(
                        "text-sm font-medium",
                        theme.id === "dark" ? "text-white" : "text-slate-900"
                      )}>
                        {theme.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium text-slate-900">Comportamento</h3>
                {[
                  { id: "compact", label: "Modo Compacto", desc: "Reduzir espaçamentos na interface" },
                  { id: "animations", label: "Animações", desc: "Ativar animações de transição" },
                  { id: "sound", label: "Sons", desc: "Reproduzir sons de notificação" },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{item.label}</p>
                      <p className="text-sm text-slate-500">{item.desc}</p>
                    </div>
                    <Switch defaultChecked={item.id === "animations"} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrações */}
        <TabsContent value="integracoes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integrações</CardTitle>
              <CardDescription>
                Conecte o CRM com outros sistemas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { 
                  id: "whatsapp", 
                  name: "WhatsApp Business", 
                  desc: "Integração com WhatsApp API",
                  icon: "💬",
                  connected: true 
                },
                { 
                  id: "erp", 
                  name: "ERP Empresarial", 
                  desc: "Sincronização de vendas e produtos",
                  icon: "🏢",
                  connected: true 
                },
                { 
                  id: "email", 
                  name: "E-mail", 
                  desc: "Sincronização de e-mails",
                  icon: "📧",
                  connected: false 
                },
                { 
                  id: "calendar", 
                  name: "Google Calendar", 
                  desc: "Sincronização de agenda",
                  icon: "📅",
                  connected: false 
                },
              ].map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-2xl">{integration.icon}</div>
                    <div>
                      <p className="font-medium text-slate-900">{integration.name}</p>
                      <p className="text-sm text-slate-500">{integration.desc}</p>
                    </div>
                  </div>
                  {integration.connected ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-700">Conectado</Badge>
                      <Button variant="outline" size="sm">Configurar</Button>
                    </div>
                  ) : (
                    <Button size="sm">Conectar</Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Equipe */}
        <TabsContent value="equipe" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gestão de Vendedores</CardTitle>
              <CardDescription>
                Cadastre, edite e gerencie os vendedores da equipe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500 mb-4">
                Acesse a página de vendedores para visualizar todos os membros da equipe,
                seus cargos, status e permissões.
              </p>
              <Button asChild>
                <a href="/configuracoes/vendedores">Gerenciar Vendedores</a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
