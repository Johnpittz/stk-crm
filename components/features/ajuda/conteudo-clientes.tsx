import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Search, Plus, Building2, Lightbulb } from "lucide-react";

export function ConteudoClientes() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-[#14919B]/20 bg-gradient-to-r from-[#0D3B33]/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-[#0D3B33] flex items-center justify-center shrink-0">
              <Users className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">👥 Clientes</h2>
              <p className="text-slate-600 mt-1">
                A base de clientes ativos da ROMA. Aqui você busca, cadastra e acompanha todos os clientes
                que já compraram ou estão em processo de venda.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* O que é */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-[#14919B]" />
            O que é a tela de Clientes?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>
            A tela de Clientes lista todas as empresas que são clientes da ROMA. Cada cliente tem dados
            como razão social, CNPJ, telefone, endereço e o vendedor responsável.
          </p>
          <p>
            Os clientes são cadastrados manualmente ou importados do ERP Millennium.
          </p>
        </CardContent>
      </Card>

      {/* Como usar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-[#14919B]" />
            Como Usar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <ol className="list-decimal list-inside space-y-2">
            <li><strong>Buscar cliente:</strong> Use a barra de busca para pesquisar por nome, CNPJ ou cidade</li>
            <li><strong>Filtrar:</strong> Use os filtros disponíveis para refinar a busca</li>
            <li><strong>Cadastrar novo:</strong> Clique em "Novo Cliente" e preencha os dados</li>
            <li><strong>Ver detalhes:</strong> Clique em um cliente para ver todas as informações</li>
          </ol>
        </CardContent>
      </Card>

      {/* Cadastro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#14919B]" />
            Cadastrar Novo Cliente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>Para cadastrar um novo cliente:</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>Clique no botão <strong>"Novo Cliente"</strong></li>
            <li>Digite o <strong>CNPJ</strong> — o sistema pode buscar os dados automaticamente</li>
            <li>Preencha os dados de contato (telefone, email, endereço)</li>
            <li>Selecione o <strong>vendedor responsável</strong></li>
            <li>Clique em <strong>"Salvar"</strong></li>
          </ol>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-xs">
              💡 <strong>Integração Millennium:</strong> Alguns dados do cliente podem ser importados automaticamente
              do ERP Millennium, evitando digitação manual.
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
            <li>✅ Mantenha os dados dos clientes sempre atualizados</li>
            <li>✅ Ao cadastrar um novo cliente, verifique se o CNPJ já existe (evitar duplicatas)</li>
            <li>✅ Use a busca para encontrar clientes rapidamente durante ligações</li>
            <li>✅ O vendedor responsável é quem aparece como dono do cliente no sistema</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}