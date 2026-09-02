import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, Plus, GripVertical, CheckCircle, Clock, AlertCircle, Lightbulb, AlertTriangle } from "lucide-react";

export function ConteudoKanban() {
  return (
    <div className="space-y-6">
      {/* Header da seção */}
      <Card className="border-[#3B64CF]/20 bg-gradient-to-r from-[#15317B]/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-[#15317B] flex items-center justify-center shrink-0">
              <ClipboardList className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">📌 Kanban de Tarefas</h2>
              <p className="text-slate-600 mt-1">
                O Kanban é seu quadro de organização pessoal. Aqui ficam suas tarefas manuais e também os atendimentos
                do WhatsApp, organizados em colunas por status.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* As 3 colunas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[#3B64CF]" />
            As 3 Colunas do Kanban
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border-2 border-amber-200 rounded-lg p-4 bg-amber-50">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <Badge className="bg-amber-100 text-amber-700 border-amber-200">A Fazer</Badge>
              </div>
              <p className="text-sm text-slate-700 mb-2">Tarefas pendentes que precisam da sua ação.</p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Atendimentos onde o <strong>cliente</strong> enviou a última mensagem</li>
                <li>• Tarefas manuais que você criou</li>
                <li>• Leads novos aguardando contato</li>
              </ul>
            </div>
            <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <Badge className="bg-blue-100 text-blue-700 border-blue-200">Andamento</Badge>
              </div>
              <p className="text-sm text-slate-700 mb-2">Tarefas em andamento onde você já interagiu.</p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Atendimentos onde o <strong>vendedor</strong> (você) enviou a última mensagem</li>
                <li>• Tarefas que você já iniciou</li>
              </ul>
            </div>
            <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <Badge className="bg-green-100 text-green-700 border-green-200">Concluído</Badge>
              </div>
              <p className="text-sm text-slate-700 mb-2">Tarefas e atendimentos finalizados.</p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Atendimentos marcados como "Resolvido"</li>
                <li>• Tarefas que você concluiu</li>
                <li>• Aparece apenas dos últimos 7 dias</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Criar nova tarefa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#3B64CF]" />
            Como Criar uma Nova Tarefa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <ol className="list-decimal list-inside space-y-2">
            <li>Clique no botão <strong>"+ Nova Tarefa"</strong> no canto superior do Kanban</li>
            <li>Preencha o <strong>título</strong> da tarefa (obrigatório)</li>
            <li>Adicione uma <strong>descrição</strong> (recomendado)</li>
            <li>Defina <strong>prioridade</strong> (Normal, Alta, Urgente)</li>
            <li>Escolha a <strong>data de início</strong> e <strong>data fim</strong> (opcional)</li>
            <li>Clique em <strong>"Criar"</strong></li>
          </ol>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-xs">
              💡 <strong>O que aparece no Kanban:</strong> Além das tarefas manuais que você cria, o Kanban também mostra
              automaticamente seus <strong>atendimentos WhatsApp</strong> e, para gestores, os <strong>leads</strong> atribuídos.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Concluir tarefa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-[#3B64CF]" />
            Como Concluir uma Tarefa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>Para mover uma tarefa para "Concluído":</p>
          <ol className="list-decimal list-inside space-y-2">
            <li><strong>Arraste o card</strong> da coluna atual para a coluna "Concluído"</li>
            <li>Ou clique no card e mude o status manualmente</li>
          </ol>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-amber-800 text-xs">
              <p className="font-semibold mb-1">⚠️ Regra importante:</p>
              <p>Para concluir uma tarefa, é <strong>obrigatório adicionar informações</strong> (descrição ou observações).
              O sistema pode barrar a conclusão se a tarefa não tiver detalhes suficientes.</p>
              <p className="mt-1">Isso garante que você registre o que foi feito antes de finalizar.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drag and Drop */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-[#3B64CF]" />
            Arrastar e Soltar (Drag and Drop)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>
            O Kanban funciona com <strong>arrastar e soltar</strong>. Basta clicar e segurar um card
            e arrastá-lo para outra coluna. Quando você solta, o status da tarefa é atualizado automaticamente.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>A Fazer → Andamento:</strong> Você começou a trabalhar na tarefa</li>
            <li><strong>Andamento → Concluído:</strong> Tarefa finalizada</li>
            <li><strong>Concluído → A Fazer:</strong> Precisou reabrir a tarefa</li>
          </ul>
        </CardContent>
      </Card>

      {/* Filtros do Kanban */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[#3B64CF]" />
            Filtros do Kanban
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>No canto superior do Kanban, você encontra um mini-dropdown com filtros:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Todas:</strong> Mostra todas as colunas</li>
            <li><strong>A Fazer:</strong> Mostra apenas a coluna "A Fazer"</li>
            <li><strong>Andamento:</strong> Mostra apenas a coluna "Andamento"</li>
            <li><strong>Concluído:</strong> Mostra apenas a coluna "Concluído"</li>
          </ul>
          <div className="bg-slate-50 border rounded-lg p-4">
            <p className="text-xs text-slate-600">
              💡 <strong>Dica:</strong> Ao selecionar uma coluna específica, o layout muda de 3 colunas para 1 coluna ampla,
              focando apenas naquela coluna. Clique em "Todas" para voltar ao layout normal.
            </p>
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
            <li>✅ Crie tarefas para organizar seu dia (reuniões, follow-ups, visitas)</li>
            <li>✅ Use prioridade "Urgente" para o que precisa de atenção imediata</li>
            <li>✅ Ao concluir, descreva o que foi feito — isso ajuda no futuro</li>
            <li>✅ Atendimentos WhatsApp aparecem automaticamente no Kanban</li>
            <li>✅ Gestores: leads atribuídos também aparecem como cards no Kanban</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}