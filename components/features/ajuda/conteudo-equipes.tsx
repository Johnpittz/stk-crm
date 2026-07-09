import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Users, UserPlus, BarChart3, Lightbulb, AlertTriangle } from "lucide-react";

export function ConteudoEquipes() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-[#14919B]/20 bg-gradient-to-r from-[#0D3B33]/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-[#0D3B33] flex items-center justify-center shrink-0">
              <Briefcase className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">🏢 Equipes</h2>
              <p className="text-slate-600 mt-1">
                Gerencie os vendedores da sua equipe. Esta seção é acessível apenas para gestores
                (gerente comercial, diretor e admin).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aviso */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Apenas para Gestores</p>
            <p className="text-xs text-amber-700 mt-1">
              Esta seção só aparece para vendedores com cargo de <strong>Gerente Comercial</strong>, <strong>Diretor</strong> ou <strong>Admin</strong>.
              Vendedores comuns não veem o item "Equipes" na sidebar.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* O que é */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-[#14919B]" />
            O que é a tela de Equipes?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>
            A tela de Equipes permite aos gestores <strong>cadastrar, visualizar e gerenciar</strong> todos os vendedores
            da empresa. É o painel de controle da equipe comercial.
          </p>
        </CardContent>
      </Card>

      {/* Funcionalidades */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-[#14919B]" />
            Funcionalidades
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="h-4 w-4 text-[#14919B]" />
                <Badge className="bg-[#0D3B33]">Cadastrar Vendedor</Badge>
              </div>
              <p className="text-xs text-slate-600">
                Adicione novos vendedores ao sistema. Preencha nome, email, cargo e telephone.
                O vendedor recebe um email de convite para criar sua senha.
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-[#14919B]" />
                <Badge className="bg-[#14919B]">Acompanhar Performance</Badge>
              </div>
              <p className="text-xs text-slate-600">
                Veja os indicadores de cada vendedor: atendimentos, leads, vendas e metas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cargos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-[#14919B]" />
            Cargos Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3 bg-slate-50 text-center">
              <Badge className="bg-slate-100 text-slate-700 border-slate-200 mb-1">Vendedor</Badge>
              <p className="text-xs text-slate-600">Acessa suas funções básicas</p>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50 text-center">
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 mb-1">Gerente Comercial</Badge>
              <p className="text-xs text-slate-600">Gerencia sua equipe</p>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50 text-center">
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 mb-1">Diretor</Badge>
              <p className="text-xs text-slate-600">Acesso total</p>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50 text-center">
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 mb-1">Admin</Badge>
              <p className="text-xs text-slate-600">Acesso total + configs</p>
            </div>
          </div>
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
            <li>✅ Cadastre novos vendedores assim que entrarem na equipe</li>
            <li>✅ Verifique regularmente se todos os vendedores estão ativos</li>
            <li>✅ Use o Dashboard para comparar performance entre vendedores</li>
            <li>✅ Gestores: distribua leads proporcionalmente entre a equipe</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}