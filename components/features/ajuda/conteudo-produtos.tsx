import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Search, Filter, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";

export function ConteudoProdutos() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-[#3B64CF]/20 bg-gradient-to-r from-[#15317B]/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-xl bg-[#15317B] flex items-center justify-center shrink-0">
              <Package className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">📦 Produtos</h2>
              <p className="text-slate-600 mt-1">
                O catálogo completo de produtos da ROMA — mais de 2.000 itens de materiais elétricos.
                Busque por nome, código ou SKU e encontre o que precisa.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* O que é */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-[#3B64CF]" />
            O que é o catálogo de Produtos?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>
            O catálogo contém todos os produtos que a ROMA comercializa. Cada produto tem informações como
            código, nome, descrição, unidade de medida, marca, categoria e preço.
          </p>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div className="bg-slate-50 border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-[#3B64CF]">2.195</p>
              <p className="text-xs text-slate-600">Produtos cadastrados</p>
            </div>
            <div className="bg-slate-50 border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-[#3B64CF]">50</p>
              <p className="text-xs text-slate-600">Itens por página</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Como buscar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-[#3B64CF]" />
            Como Buscar Produtos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <ol className="list-decimal list-inside space-y-2">
            <li><strong>Barra de busca:</strong> Digite o nome do produto, código interno ou SKU</li>
            <li><strong>Filtros:</strong> Use os filtros de marca, categoria ou status para refinar</li>
            <li><strong>Paginação:</strong> Navegue pelas páginas usando os botões inferior</li>
          </ol>
          <div className="bg-slate-50 border rounded-lg p-4">
            <p className="text-xs text-slate-600">
              💡 <strong>Dica:</strong> Os filtros de marca e categoria são carregados uma única vez e ficam salvos na sessão.
              Não precisa recarregar a cada busca.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4 text-[#3B64CF]" />
            Filtros Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-3 bg-slate-50">
              <Badge className="bg-[#15317B] mb-2">Marca</Badge>
              <p className="text-xs text-slate-600">Filtre por fabricante do produto (ex: Siemens, WEG, etc.)</p>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50">
              <Badge className="bg-[#3B64CF] mb-2">Categoria</Badge>
              <p className="text-xs text-slate-600">Filtre por tipo de produto (ex: disjuntores, fios, etc.)</p>
            </div>
            <div className="border rounded-lg p-3 bg-slate-50">
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 mb-2">Status</Badge>
              <p className="text-xs text-slate-600">Filtre por produtos ativos, inativos ou em promoção</p>
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
            <li>✅ Use o código do produto para busca exata (mais rápido que pelo nome)</li>
            <li>✅ Combine busca por nome + filtros para encontrar produtos específicos</li>
            <li>✅ O catálogo é atualizado automaticamente do ERP Millennium</li>
            <li>✅ Use a busca para verificar preços durante ligações com clientes</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}