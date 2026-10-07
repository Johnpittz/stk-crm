"use client";

/**
 * 06/10 — LOG DE CRIAÇÃO/EDIÇÃO de clientes (recurso novo, pedido do João).
 * A leitura é protegida NA ROTA (401 sem sessão / 403 se cargo ≠ admin);
 * aqui só exibimos o que a rota devolve.
 */
import { useEffect, useState } from "react";
import { History, ShieldAlert, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LogItem {
  id: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  acao: "criado" | "editado";
  campos: string[];
  usuario_email: string | null;
  created_at: string;
}

function formatarData(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function LogAlteracoesPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/clientes/log");
        const dados = await res.json().catch(() => ({}));
        if (!vivo) return;
        if (!res.ok) {
          setErro(dados.error || "Não foi possível carregar o log.");
        } else {
          setLogs(dados.logs || []);
        }
      } catch {
        if (vivo) setErro("Não foi possível carregar o log.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <History className="h-6 w-6 text-[#3B64CF]" />
        <div>
          <h1 className="text-2xl font-bold text-white">Log de Alterações</h1>
          <p className="text-sm text-slate-400">
            Quem criou ou editou cada cliente — visível apenas para administradores.
          </p>
        </div>
      </div>

      <Card className="bg-[#14233c] border-[#1c2e4a]">
        <CardHeader>
          <CardTitle className="text-white text-lg">Registros</CardTitle>
        </CardHeader>
        <CardContent>
          {carregando && (
            <div className="flex items-center gap-2 text-slate-400 py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          )}

          {!carregando && erro && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-200">{erro}</p>
            </div>
          )}

          {!carregando && !erro && logs.length === 0 && (
            <p className="text-sm text-slate-400 py-6 text-center">
              Nenhum registro ainda.
            </p>
          )}

          {!carregando && !erro && logs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500 border-b border-[#1c2e4a]">
                    <th className="py-2 pr-4">Data / Hora</th>
                    <th className="py-2 pr-4">Cliente</th>
                    <th className="py-2 pr-4">Ação</th>
                    <th className="py-2 pr-4">Campos alterados</th>
                    <th className="py-2">Usuário</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-[#1c2e4a]/60 text-slate-300"
                    >
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        {formatarData(log.created_at)}
                      </td>
                      <td className="py-2.5 pr-4 text-white">
                        {log.cliente_nome || "—"}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span
                          className={
                            log.acao === "criado"
                              ? "rounded bg-emerald-500/15 text-emerald-300 px-2 py-0.5 text-xs"
                              : "rounded bg-[#3B64CF]/20 text-[#8fb0ff] px-2 py-0.5 text-xs"
                          }
                        >
                          {log.acao === "criado" ? "Criado" : "Editado"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-400">
                        {(log.campos || []).join(", ") || "—"}
                      </td>
                      <td className="py-2.5 text-slate-400">
                        {log.usuario_email || "desconhecido"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
