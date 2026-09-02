import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Headset, MessageCircle, Phone, Check, ArrowRightLeft, Search, Download, Lightbulb, AlertTriangle } from "lucide-react";

export function ConteudoAtendimento() {
  return (
    <div className="space-y-6">
      {/* Header da seção */}
      <Card className="border-[#3B64CF]/20 bg-gradient-to-r from-[#15317B]/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-[#15317B] flex items-center justify-center shrink-0">
              <Headset className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">💬 Atendimento WhatsApp</h2>
              <p className="text-slate-600 mt-1">
                Esta é a tela principal do CRM. Aqui você recebe e responde mensagens de clientes pelo WhatsApp.
                Tudo funciona como um chat — o cliente manda mensagem, você responde pelo CRM.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* O que é */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-[#3B64CF]" />
            O que é o Atendimento?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>
            O Atendimento é o <strong>painel de WhatsApp integrado ao CRM</strong>. Quando um cliente envia uma mensagem
            pelo WhatsApp, ela aparece aqui para você responder.
          </p>
          <p>
            Cada conversa com um cliente é chamada de <strong>"atendimento"</strong>. Você pode ver o histórico,
            responder mensagens, transferir para outro vendedor e marcar como resolvido.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-xs">
              💡 <strong>Como funciona:</strong> As mensagens dos clientes entram automaticamente pelo WhatsApp.
              Você visualiza e responde diretamente pelo CRM. No futuro, a integração com o BotConversa (oficial Meta)
              permitirá envio e recebimento de mensagens reais.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* As 2 abas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Headset className="h-4 w-4 text-[#3B64CF]" />
            As 2 Abas do Atendimento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-[#15317B]">📋 Meu Trabalho</Badge>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Tela principal com <strong>Kanban de Tarefas</strong> (2/3 da tela) + <strong>Lista de Atendimentos</strong> (1/3 lateral).
              </p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Kanban organiza suas tarefas e atendimentos</li>
                <li>• Lista lateral mostra seus atendimentos em tempo real</li>
                <li>• Clique em um atendimento para abrir o chat</li>
              </ul>
            </div>
            <div className="border rounded-lg p-4 bg-slate-50">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-[#3B64CF]">💬 Atendimentos</Badge>
              </div>
              <p className="text-sm text-slate-700 mb-2">
                Lista <strong>completa</strong> de todos os atendimentos WhatsApp (seus + da fila geral).
              </p>
              <ul className="text-xs text-slate-600 space-y-1">
                <li>• Cards grandes com avatar, nome e preview da mensagem</li>
                <li>• Botão "Resolver" para fechar atendimento</li>
                <li>• Ideal para ver tudo de uma vez</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Como usar o chat */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-[#3B64CF]" />
            Como usar o Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <ol className="list-decimal list-inside space-y-2">
            <li><strong>Abra o chat:</strong> Clique em qualquer atendimento (na lista ou no kanban)</li>
            <li><strong>Veja o histórico:</strong> Mensagens do cliente ficam à direita (verde), suas à esquerda (branco)</li>
            <li><strong>Responda:</strong> Digite no campo inferior e clique no botão verde de enviar</li>
            <li><strong>Marque como lido:</strong> Ao abrir o chat, o atendimento é marcado automaticamente como lido</li>
            <li><strong>Feche o atendimento:</strong> Clique em "Resolver" no canto superior do chat</li>
          </ol>
        </CardContent>
      </Card>

      {/* Transferir */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-[#3B64CF]" />
            Transferir Atendimento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>Se um atendimento não é da sua área, você pode transferir para outro vendedor:</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>Abra o chat do atendimento</li>
            <li>Clique no botão <strong>"Transferir"</strong> no canto superior</li>
            <li>Selecione o vendedor na lista</li>
            <li>O atendimento será transferido automaticamente</li>
          </ol>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-amber-800 text-xs">
              <strong>Atenção:</strong> Ao transferir, o atendimento sai da sua lista e passa a aparecer na lista do vendedor selecionado.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-[#3B64CF]" />
            Filtros e Busca
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>Na parte superior da tela de atendimento, você encontra filtros para encontrar o que precisa:</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Busca:</strong> Pesquise por nome do cliente, telefone ou conteúdo da mensagem</li>
            <li><strong>Período:</strong> Filtre por data (início e fim)</li>
            <li><strong>Limpar:</strong> Remova todos os filtros com um clique</li>
            <li><strong>Exportar CSV:</strong> Baixe os atendimentos filtrados em formato planilha</li>
          </ul>
          <div className="bg-slate-50 border rounded-lg p-4">
            <p className="text-xs text-slate-600">
              💡 <strong>Dica:</strong> Cada aba (Kanban e Lista) tem seus próprios filtros de status. No Kanban você pode filtrar por coluna (A Fazer, Andamento, Concluído). Na Lista pode filtrar por status (Todos, Aberto, Fechado).
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
            <li>✅ Responda rápido — atendimentos abertos onde o cliente enviou a última mensagem ficam na coluna "A Fazer"</li>
            <li>✅ O chat atualiza automaticamente a cada 30 segundos</li>
            <li>✅ Ao fechar um chat, ele some da lista e vai para "Concluído" no Kanban</li>
            <li>✅ Use a busca para encontrar atendimentos antigos rapidamente</li>
            <li>✅ O sino 🔔 no header avisa quando chega mensagem nova</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}