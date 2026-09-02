import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, TrendingUp, Users, Package, BarChart3, Lightbulb } from "lucide-react";

export function ConteudoDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-[#3B64CF]/20 bg-gradient-to-r from-[#15317B]/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-[#15317B] flex items-center justify-center shrink-0">
              <LayoutDashboard className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">📊 Dashboard</h2>
              <p className="text-slate-600 mt-1">
                A visão gerencial do CRM. Aqui você acompanha métricas, gráficos e indicadores de performance
                da equipe e do seu desempenho individual.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* O que é */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#3B64CF]" />
            O que é o Dashboard?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>
            O Dashboard é a tela de <strong>visão gerencial</strong>. Ele mostra indicadores importantes como
            número de clientes, vendas, atendimentos e performance da equipe em tempo real.
          </p>
          <p>
            É ideal para gestores acompanharem os resultados e para vendedores monitorarem seu próprio desempenho.
          </p>
        </CardContent>
      </Card>

      {/* Métricas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#3B64CF]" />
            Métricas Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-[#3B64CF]" />
                <Badge className="bg-[#15317B]">Clientes</Badge>
              </div>
              <p className="text-xs text-slate-600">Total de clientes ativos, novos clientes no mês e distribuição por vendedor.</p>
            </div>
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-[#3B64CF]" />
                <Badge className="bg-[#3B64CF]">Vendas</Badge>
              </div>
              <p className="text-xs text-slate-600">Volume de vendas, ticket médio e comparativo com períodos anteriores.</p>
            </div>
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-[#3B64CF]" />
                <Badge className="bg-purple-100 text-purple-700 border-purple-200">Performance</Badge>
              </div>
              <p className="text-xs text-slate-600">Indicadores de performance individual e da equipe.</p>
            </div>
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-[#3B64CF]" />
                <Badge className="bg-amber-100 text-amber-700 border-amber-200">Metas</Badge>
              </div>
              <p className="text-xs text-slate-600">Acompanhamento de metas mensais e projeções de fechamento.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Como usar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4 text-[#3B64CF]" />
            Como Usar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <ol className="list-decimal list-inside space-y-2">
            <li><strong>Acesse:</strong> Clique em "Dashboard" na sidebar</li>
            <li><strong>Visualize:</strong> Os gráficos e métricas são carregados automaticamente</li>
            <li><strong>Filtre:</strong> Use os filtros de período para ver dados de datas específicas</li>
            <li><strong>Compare:</strong> Analise tendências ao longo do tempo</li>
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
            <li>✅ Acesse o Dashboard no início do dia para acompanhar seus números</li>
            <li>✅ Use as métricas para identificar oportunidades de melhoria</li>
            <li>✅ Gestores: compare performance entre vendedores para identificar treinamentos</li>
            <li>✅ Os dados são atualizados em tempo real conforme você usa o CRM</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}