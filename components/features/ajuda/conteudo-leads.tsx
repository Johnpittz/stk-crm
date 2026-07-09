import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Search, UserCheck, ArrowRightLeft, Inbox, Lightbulb, AlertTriangle } from "lucide-react";

export function ConteudoLeads() {
  return (
    <div className="space-y-6">
      {/* Header da seção */}
      <Card className="border-[#14919B]/20 bg-gradient-to-r from-[#0D3B33]/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-[#0D3B33] flex items-center justify-center shrink-0">
              <Target className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">👥 Leads</h2>
              <p className="text-slate-600 mt-1">
                Leads são empresas potenciais para venda (B2B). Aqui você busca novas empresas, acompanha leads
                atribuídos a você e registra o progresso de cada contato.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* O que são leads */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-[#14919B]" />
            O que são Leads?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>
            Um <strong>lead</strong> é uma empresa que pode se tornar sua cliente. O CRM permite buscar empresas
            na base pública da Receita Federal (via CNPJ Aberto), importar para a fila e atribuir aos vendedores.
          </p>
          <p>
            Cada lead tem um <strong>status</strong> que indica onde ele está no processo:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            <div className="border rounded-lg p-3 bg-blue-50 text-center">
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 mb-1">Novo</Badge>
              <p className="text-xs text-slate-600">Recém-importado, aguardando atribuição</p>
            </div>
            <div className="border rounded-lg p-3 bg-amber-50 text-center">
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 mb-1">Em Atendimento</Badge>
              <p className="text-xs text-slate-600">Atribuído a um vendedor, em contato</p>
            </div>
            <div className="border rounded-lg p-3 bg-green-50 text-center">
              <Badge className="bg-green-100 text-green-700 border-green-200 mb-1">Convertido</Badge>
              <p className="text-xs text-slate-600">Tornou-se cliente!</p>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50 text-center">
              <Badge className="bg-slate-100 text-slate-700 border-slate-200 mb-1">Descartado</Badge>
              <p className="text-xs text-slate-600">Não era um lead viável</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3 Abas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="h-4 w-4 text-[#14919B]" />
            As 3 Abas da Página de Leads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-[#0D3B33]">🔍 Buscar Empresas</Badge>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                <strong>Só gestores.</strong> Busque empresas por CNAE (atividade econômica) na base da Receita Federal.
              </p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Escolha o código CNAE (ex: instalação elétrica)</li>
                <li>• Selecione quantas empresas buscar</li>
                <li>• Marque as empresas e importe para a fila</li>
              </ul>
            </div>
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-[#14919B]">📥 Fila de Leads</Badge>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Lista de todos os leads. Gestores veem todos; vendedores veem apenas os seus.
              </p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Busque por empresa ou CNPJ</li>
                <li>• Filtre por status e período</li>
                <li>• Registre observações</li>
              </ul>
            </div>
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-purple-100 text-purple-700 border-purple-200">👥 Por Vendedor</Badge>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                <strong>Só gestores.</strong> Veja os leads agrupados por vendedor e por CNAE.
              </p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Selecione um vendedor</li>
                <li>• Veja leads agrupados por atividade</li>
                <li>• Acompanhe a carga de cada vendedor</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Para vendedores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-[#14919B]" />
            Para Vendedores — Como Trabalhar com Leads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <ol className="list-decimal list-inside space-y-2">
            <li><strong>Veja seus leads:</strong> Na aba "Meus Leads", veja todas as empresas atribuídas a você</li>
            <li><strong>Registre contato:</strong> Clique em um lead e adicione observações sobre o contato</li>
            <li><strong>Mude o status:</strong> Quando o lead avançar, mude de "Novo" para "Em Atendimento"</li>
            <li><strong>Converta ou descarte:</strong> Quando o lead virar cliente, marque como "Convertido". Se não for viável, marque como "Descartado"</li>
          </ol>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-xs">
              💡 <strong>Dica:</strong> Ao atribuir um lead a um vendedor, uma tarefa de prospecção é criada automaticamente
              no Kanban de Tarefas. Assim você não esquece de跟进 o contato!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Para gestores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-[#14919B]" />
            Para Gestores — Atribuição e Distribuição
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p><strong>Atribuir lead individual:</strong></p>
          <ol className="list-decimal list-inside space-y-1 mb-4">
            <li>Na aba "Fila de Leads", clique em "Atribuir" no card do lead</li>
            <li>Selecione o vendedor no dropdown</li>
            <li>Clique em "Atribuir" — o lead vai para a lista do vendedor</li>
          </ol>

          <p><strong>Reatribuir lead:</strong></p>
          <ol className="list-decimal list-inside space-y-1 mb-4">
            <li>Se um lead já está atribuído, o botão mostra "Reatribuir"</li>
            <li>Clique, selecione o novo vendedor e confirme</li>
          </ol>

          <p><strong>Distribuição automática:</strong></p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Clique em "Distribuir Leads"</li>
            <li>Defina quantos leads por vendedor</li>
            <li>Veja o preview e confirme</li>
            <li>O sistema distribui automaticamente entre a equipe</li>
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
            <li>✅ Sempre registre observações sobre cada contato — ajuda no acompanhamento</li>
            <li>✅ Use filtros para encontrar leads específicos rapidamente</li>
            <li>✅ Exporte leads em CSV para usar em其他 ferramentas</li>
            <li>✅ Gestores: distribute leads periodicamente para manter a equipe produtiva</li>
            <li>✅ Leads convertidos viram clientes automaticamente no CRM</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}