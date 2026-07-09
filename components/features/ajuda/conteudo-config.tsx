import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, User, Bell, Shield, Palette, Lightbulb } from "lucide-react";

export function ConteudoConfig() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-[#14919B]/20 bg-gradient-to-r from-[#0D3B33]/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-[#0D3B33] flex items-center justify-center shrink-0">
              <Settings className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">⚙️ Configurações</h2>
              <p className="text-slate-600 mt-1">
                Gerencie seu perfil, notificações, segurança e aparência do CRM.
                Aqui você personaliza tudo ao seu gosto.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Abas de configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-[#14919B]" />
            Seções Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-[#14919B]" />
                <Badge className="bg-[#0D3B33]">Perfil</Badge>
              </div>
              <p className="text-sm text-slate-700 mb-1">Seus dados pessoais.</p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Nome completo</li>
                <li>• Email</li>
                <li>• Telefone</li>
                <li>• Foto de perfil</li>
              </ul>
            </div>
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="h-4 w-4 text-[#14919B]" />
                <Badge className="bg-[#14919B]">Notificações</Badge>
              </div>
              <p className="text-sm text-slate-700 mb-1">Configure seus alertas.</p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Notificações de novos atendimentos</li>
                <li>• Atribuição de leads</li>
                <li>• Alertas de sistema</li>
              </ul>
            </div>
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-[#14919B]" />
                <Badge className="bg-amber-100 text-amber-700 border-amber-200">Segurança</Badge>
              </div>
              <p className="text-sm text-slate-700 mb-1">Proteção da sua conta.</p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Alterar senha</li>
                <li>• Verificar atividade recente</li>
              </ul>
            </div>
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <Palette className="h-4 w-4 text-[#14919B]" />
                <Badge className="bg-purple-100 text-purple-700 border-purple-200">Aparência</Badge>
              </div>
              <p className="text-sm text-slate-700 mb-1">Visual do sistema.</p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Tema claro/escuro</li>
                <li>• Preferências de layout</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Como acessar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4 text-[#14919B]" />
            Como Acessar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <ol className="list-decimal list-inside space-y-2">
            <li>Clique em <strong>"Configurações"</strong> na sidebar (último item)</li>
            <li>Navegue pelas abas: Perfil, Notificações, Segurança, Aparência</li>
            <li>Faça as alterações desejadas</li>
            <li>Clique em <strong>"Salvar"</strong> para aplicar</li>
          </ol>
        </CardContent>
      </Card>

      {/* Dicas */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-6">
          <h3 className="font-semibold text-green-800 flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4" />
            Dicas Úteis
          </h3>
          <ul className="space-y-2 text-sm text-green-700">
            <li>✅ Mantenha seu perfil atualizado — outros vendedores veem seus dados</li>
            <li>✅ Configure notificações para não perder atendimentos importantes</li>
            <li>✅ Altere sua senha periodicamente para manter a conta segura</li>
            <li>✅ Se esqueceu a senha, peça ao administrador para redefinir</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}