"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Zap,
  FileText,
  Upload,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  BarChart3,
  Loader2,
} from "lucide-react";

interface ClienteReciee {
  id: string;
  nome: string;
  cpf_cnpj: string;
  uc: string;
  estado: string;
  distribuidora: string;
  subgrupo: string;
  modalidade: string;
  classe: string;
  tensao: string;
  regime_tributario: string;
  gd: boolean;
  grupo: "A" | "B";
  created_at: string;
}

interface FaturaReciee {
  id: string;
  cliente_id: string;
  competencia: string;
  consumo_kwh: number;
  tarifa_aplicada: number;
  valor_consumo: number;
  icms_valor: number;
  icms_aliquota: number;
  pis_valor: number;
  cofins_valor: number;
  bandeira: string;
  cip: number;
  valor_total: number;
  created_at: string;
}

interface AnaliseReciee {
  id: string;
  fatura_id: string;
  cliente_id: string;
  macro_indice: string;
  codigo: string;
  descricao: string;
  severidade: "critico" | "alerta" | "ok" | "info";
  valor_estimado: number;
  created_at: string;
}

export default function ClienteDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const clienteId = params.clienteId as string;

  const [cliente, setCliente] = useState<ClienteReciee | null>(null);
  const [faturas, setFaturas] = useState<FaturaReciee[]>([]);
  const [analises, setAnalises] = useState<AnaliseReciee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("faturas");

  useEffect(() => {
    carregarDados();
  }, [clienteId]);

  async function carregarDados() {
    setLoading(true);
    try {
      // Buscar cliente
      const resClientes = await fetch("/api/reciee/clientes");
      const dataClientes = await resClientes.json();
      const c = dataClientes.clientes?.find((cl: ClienteReciee) => cl.id === clienteId);
      setCliente(c || null);

      // Buscar faturas do cliente
      const resFaturas = await fetch(`/api/reciee/faturas?cliente_id=${clienteId}`);
      const dataFaturas = await resFaturas.json();
      setFaturas(dataFaturas.faturas || []);

      // Buscar análises do cliente
      const resAnalises = await fetch(`/api/reciee/analises?cliente_id=${clienteId}`);
      const dataAnalises = await resAnalises.json();
      setAnalises(dataAnalises.analises || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  }

  // Calcular estatísticas do cliente
  const totalFaturas = faturas.length;
  const totalConsumo = faturas.reduce((acc, f) => acc + (f.consumo_kwh || 0), 0);
  const totalGasto = faturas.reduce((acc, f) => acc + (f.valor_total || 0), 0);
  const criticos = analises.filter((a) => a.severidade === "critico").length;
  const alertas = analises.filter((a) => a.severidade === "alerta").length;
  const estimativaRecuperacao = analises.reduce((acc, a) => acc + (a.valor_estimado || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3B64CF] mx-auto"></div>
          <p className="mt-4 text-white/60">Carregando dados do cliente...</p>
        </div>
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-12">
        <p className="text-white/60">Cliente não encontrado</p>
        <Button onClick={() => router.push("/reciee")} className="mt-4">
          Voltar ao RECIEE
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push("/reciee")}
            className="text-white/60 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="h-6 w-6 text-[#3B64CF]" />
              {cliente.nome}
            </h1>
            <p className="text-white/60">
              {cliente.cpf_cnpj} • UC: {cliente.uc} • {cliente.estado}
            </p>
          </div>
        </div>
        <Button
          onClick={() => router.push(`/reciee/upload/${clienteId}`)}
          className="bg-[#3B64CF] hover:bg-[#2a4fa8]"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Faturas
        </Button>
      </div>

      {/* Info do Cliente */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
          <CardContent className="p-4">
            <p className="text-sm text-white/60">Distribuidora</p>
            <p className="text-white font-medium">{cliente.distribuidora || "—"}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
          <CardContent className="p-4">
            <p className="text-sm text-white/60">Grupo</p>
            <Badge
              variant="outline"
              className={
                cliente.grupo === "A"
                  ? "border-blue-500/30 text-blue-400"
                  : "border-green-500/30 text-green-400"
              }
            >
              {cliente.grupo === "A" ? "Grupo A" : "Grupo B"}
            </Badge>
          </CardContent>
        </Card>
        <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
          <CardContent className="p-4">
            <p className="text-sm text-white/60">Subgrupo</p>
            <p className="text-white font-medium">{cliente.subgrupo || "—"}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
          <CardContent className="p-4">
            <p className="text-sm text-white/60">Modalidade</p>
            <p className="text-white font-medium">{cliente.modalidade || "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Faturas</p>
                <p className="text-2xl font-bold text-white">{totalFaturas}</p>
              </div>
              <FileText className="h-8 w-8 text-[#3B64CF]" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Consumo Total</p>
                <p className="text-2xl font-bold text-white">{totalConsumo.toLocaleString("pt-BR")} kWh</p>
              </div>
              <BarChart3 className="h-8 w-8 text-[#3B64CF]" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Gasto Total</p>
                <p className="text-2xl font-bold text-white">
                  R$ {totalGasto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-[#3B64CF]" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0f1d32] border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Críticos</p>
                <p className="text-2xl font-bold text-red-400">{criticos}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0f1d32] border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/60">Est. Recuperação</p>
                <p className="text-2xl font-bold text-green-400">
                  R$ {estimativaRecuperacao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Faturas e Análises */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#0f1d32] border border-[#3B64CF]/20">
          <TabsTrigger value="faturas" className="data-[state=active]:bg-[#3B64CF]">
            <FileText className="h-4 w-4 mr-2" />
            Faturas ({totalFaturas})
          </TabsTrigger>
          <TabsTrigger value="analises" className="data-[state=active]:bg-[#3B64CF]">
            <TrendingUp className="h-4 w-4 mr-2" />
            Análises ({analises.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab Faturas */}
        <TabsContent value="faturas" className="space-y-4">
          {faturas.length === 0 ? (
            <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/60">Nenhuma fatura processada para este cliente.</p>
                <Button
                  onClick={() => router.push(`/reciee/upload/${clienteId}`)}
                  className="mt-4 bg-[#3B64CF] hover:bg-[#2a4fa8]"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Fazer Upload de Faturas
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#3B64CF]/20">
                    <th className="text-left p-3 text-white/60 font-medium">Competência</th>
                    <th className="text-right p-3 text-white/60 font-medium">Consumo</th>
                    <th className="text-right p-3 text-white/60 font-medium">Tarifa</th>
                    <th className="text-right p-3 text-white/60 font-medium">ICMS</th>
                    <th className="text-right p-3 text-white/60 font-medium">PIS/COFINS</th>
                    <th className="text-center p-3 text-white/60 font-medium">Bandeira</th>
                    <th className="text-right p-3 text-white/60 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {faturas.map((fatura) => (
                    <tr
                      key={fatura.id}
                      className="border-b border-[#3B64CF]/10 hover:bg-[#1a2744] transition-colors"
                    >
                      <td className="p-3 text-white font-medium">{fatura.competencia || "—"}</td>
                      <td className="p-3 text-white/80 text-right">{fatura.consumo_kwh?.toLocaleString("pt-BR")} kWh</td>
                      <td className="p-3 text-white/80 text-right">
                        R$ {fatura.tarifa_aplicada?.toFixed(6)}/kWh
                      </td>
                      <td className="p-3 text-white/80 text-right">
                        {fatura.icms_aliquota}% (R$ {fatura.icms_valor?.toFixed(2)})
                      </td>
                      <td className="p-3 text-white/80 text-right">
                        R$ {((fatura.pis_valor || 0) + (fatura.cofins_valor || 0)).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            fatura.bandeira === "Verde"
                              ? "border-green-500/30 text-green-400"
                              : fatura.bandeira === "Amarela"
                              ? "border-yellow-500/30 text-yellow-400"
                              : "border-red-500/30 text-red-400"
                          }
                        >
                          {fatura.bandeira === "Verde" ? "🟢" : fatura.bandeira === "Amarela" ? "🟡" : "🔴"}{" "}
                          {fatura.bandeira}
                        </Badge>
                      </td>
                      <td className="p-3 text-white font-medium text-right">
                        R$ {fatura.valor_total?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Tab Análises */}
        <TabsContent value="analises" className="space-y-4">
          {analises.length === 0 ? (
            <Card className="bg-[#0f1d32] border-[#3B64CF]/20">
              <CardContent className="p-8 text-center">
                <TrendingUp className="h-12 w-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/60">Nenhuma análise realizada para este cliente.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#3B64CF]/20">
                    <th className="text-left p-3 text-white/60 font-medium">Código</th>
                    <th className="text-left p-3 text-white/60 font-medium">Descrição</th>
                    <th className="text-center p-3 text-white/60 font-medium">Severidade</th>
                    <th className="text-right p-3 text-white/60 font-medium">Valor Estimado</th>
                    <th className="text-left p-3 text-white/60 font-medium">Macro-Índice</th>
                  </tr>
                </thead>
                <tbody>
                  {analises.map((analise) => (
                    <tr
                      key={analise.id}
                      className="border-b border-[#3B64CF]/10 hover:bg-[#1a2744] transition-colors"
                    >
                      <td className="p-3 text-white font-mono">{analise.codigo}</td>
                      <td className="p-3 text-white/80">{analise.descricao}</td>
                      <td className="p-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            analise.severidade === "critico"
                              ? "border-red-500/30 text-red-400"
                              : analise.severidade === "alerta"
                              ? "border-yellow-500/30 text-yellow-400"
                              : analise.severidade === "ok"
                              ? "border-green-500/30 text-green-400"
                              : "border-blue-500/30 text-blue-400"
                          }
                        >
                          {analise.severidade === "critico"
                            ? "🔴 Crítico"
                            : analise.severidade === "alerta"
                            ? "🟡 Alerta"
                            : analise.severidade === "ok"
                            ? "🟢 OK"
                            : "🔵 Info"}
                        </Badge>
                      </td>
                      <td className="p-3 text-white font-medium text-right">
                        R$ {analise.valor_estimado?.toFixed(2)}
                      </td>
                      <td className="p-3 text-white/80">{analise.macro_indice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
