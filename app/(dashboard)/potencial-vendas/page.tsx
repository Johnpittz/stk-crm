"use client";

/**
 * PEDIDO 1 (11/10) — DASHBOARD DO VENDEDOR: POTENCIAL DE VENDAS.
 *
 * Visão gerencial: quanto cada vendedor vendeu e DE QUAL PRODUTO ele mais
 * vendeu (mix + produto líder) para a gestão direcionar mais demanda
 * daquele produto. Venda = resultado "sucesso" registrado na oportunidade.
 *
 * Perfil: vendedor vê só o próprio potencial (filtro no servidor).
 */

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Trophy, DollarSign, Users, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

type MixProduto = {
  produto_id: string | null;
  produto_nome: string;
  qtd: number;
  valor_total: number;
};

type PotencialVendedor = {
  vendedor_id: string;
  nome: string;
  total_vendas: number;
  valor_total: number;
  mix: MixProduto[];
  produto_lider: MixProduto | null;
  participacao: number;
};

type Resposta = {
  perfil: string;
  periodo_dias: number;
  vendedores: PotencialVendedor[];
  total_geral: { total_vendas: number; valor_total: number };
};

const PERIODOS = [
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
  { dias: 180, rotulo: "180 dias" },
];

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PotencialVendasPage() {
  const [dias, setDias] = useState(30);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setLoading(true);
      setErro(null);
      try {
        const res = await fetch(`/api/dashboard/potencial-vendas?dias=${dias}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Falha ao carregar");
        if (vivo) setDados(json);
      } catch (e: any) {
        if (vivo) setErro(e?.message || "Falha ao carregar");
      } finally {
        if (vivo) setLoading(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [dias]);

  const ehVendedor = dados?.perfil === "vendedor";

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {ehVendedor ? "SEU Potencial de Vendas" : "Potencial de Vendas"}
          </h1>
          <p className="text-sm text-slate-500">
            Quem vendeu mais, de qual produto — para direcionar a demanda certa para cada
            vendedor.
          </p>
        </div>
        <div className="flex gap-2">
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                dias === p.dias
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">{erro}</CardContent>
        </Card>
      )}

      {loading && (
        <p className="py-10 text-center text-sm text-slate-500">Carregando vendas…</p>
      )}

      {!loading && !erro && dados && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <Trophy className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">{dados.total_geral.total_vendas}</p>
                  <p className="text-xs text-slate-500">VENDAS NO PERÍODO</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <DollarSign className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{brl(dados.total_geral.valor_total)}</p>
                  <p className="text-xs text-slate-500">VALOR FATURADO</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 py-4">
                <Users className="h-8 w-8 text-violet-500" />
                <div>
                  <p className="text-2xl font-bold">{dados.vendedores.length}</p>
                  <p className="text-xs text-slate-500">VENDEDORES COM VENDA</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vazio */}
          {dados.vendedores.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-slate-500">
                Nenhuma venda registrada neste período.
                <br />
                Registre o resultado da oportunidade como <b>“sucesso”</b> com o valor da
                venda para aparecer aqui.
              </CardContent>
            </Card>
          )}

          {/* Por vendedor */}
          <div className="space-y-4">
            {dados.vendedores.map((v, idx) => (
              <Card key={v.vendedor_id}>
                <CardContent className="space-y-4 py-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      {idx === 0 && !ehVendedor && (
                        <TrendingUp className="h-5 w-5 text-emerald-500" />
                      )}
                      <span className="text-lg font-semibold">{v.nome}</span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {v.participacao}% do faturamento
                      </span>
                    </div>
                    <div className="text-sm text-slate-600">
                      <b>{v.total_vendas}</b> venda{v.total_vendas === 1 ? "" : "s"} ·{" "}
                      <b>{brl(v.valor_total)}</b>
                    </div>
                  </div>

                  {/* Barra de participação */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.max(v.participacao, 1)}%` }}
                    />
                  </div>

                  {/* Mix por produto */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      O que ele vendeu (por produto)
                    </p>
                    {v.mix.map((m) => {
                      const lider = v.produto_lider && m.produto_id === v.produto_lider.produto_id && m.produto_nome === v.produto_lider.produto_nome;
                      return (
                        <div
                          key={`${m.produto_id || "sem"}-${m.produto_nome}`}
                          className={cn(
                            "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                            lider ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white",
                          )}
                        >
                          <span className="flex items-center gap-2 font-medium">
                            {m.produto_nome}
                            {lider && (
                              <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                MAIS VENDIDO
                              </span>
                            )}
                          </span>
                          <span className="text-slate-600">
                            {m.qtd}× · {brl(m.valor_total)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dica de direcionamento */}
                  {v.produto_lider && !ehVendedor && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <b>Direcione mais demanda de {v.produto_lider.produto_nome}</b> para{" "}
                        {v.nome} — é o produto que ele mais vendeu ({v.produto_lider.qtd}×).
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
