"use client";

/**
 * Configurações do Disparo — Fase 1 da proposta de reorganização
 * ("Gestão de Sessões WhatsApp").
 *
 * O que existe HOJE de verdade: o WAHA expõe as sessões em GET /api/instances
 * (nome, número, status open/closed). Este painel só CONSOME esse dado — não
 * inventa status.
 *
 * O que AINDA NÃO existe no app (declarado para não parecer que falta aqui):
 * pareamento por QR Code, reiniciar/deslogar sessão e trocar a instância
 * padrão do envio. Essas ações continuam no painel do WAHA
 * (http://172.16.1.1:3000) e entram na Fase 1 da próxima rodada.
 */
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Smartphone, ExternalLink } from "lucide-react";

interface SessaoWhatsApp {
  id: string;
  name: string;
  number: string | null;
  status: string;
}

export function ConfiguracoesDisparo() {
  const [sessoes, setSessoes] = useState<SessaoWhatsApp[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/instances", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSessoes(Array.isArray(data?.instancias) ? data.instancias : []);
    } catch (e: any) {
      setErro(e?.message || "Falha ao consultar as sessões");
      setSessoes([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abertas = sessoes.filter((s) => s.status === "open").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Smartphone size={18} /> Sessões WhatsApp
            </CardTitle>
            <p className="text-white/50 text-sm mt-1">
              Números pareados que podem enviar disparo. Só sessão{" "}
              <strong className="text-emerald-300">aberta</strong> envia.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={carregar}
            disabled={carregando}
            className="border-white/20 text-white/80"
          >
            {carregando ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <div className="flex items-center justify-center py-10 text-white/50">
              <Loader2 size={20} className="animate-spin mr-2" /> Consultando
              sessões…
            </div>
          ) : erro ? (
            <div className="py-8 text-center">
              <p className="text-amber-300 text-sm">
                Não consegui listar as sessões: {erro}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={carregar}
                className="mt-3 border-white/20 text-white/80"
              >
                Tentar de novo
              </Button>
            </div>
          ) : sessoes.length === 0 ? (
            <p className="py-8 text-center text-white/50 text-sm">
              Nenhuma sessão encontrada.
            </p>
          ) : (
            <>
              <p className="text-xs text-white/40 mb-3">
                {abertas} de {sessoes.length} sessão(ões) aberta(s)
              </p>
              <ul className="space-y-2">
                {sessoes.map((s) => {
                  const aberta = s.status === "open";
                  return (
                    <li
                      key={s.id || s.name}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {s.name}
                        </p>
                        <p className="text-xs text-white/50 truncate">
                          {s.number || "número não informado"}
                        </p>
                      </div>
                      <Badge
                        className={
                          aberta
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                        }
                        variant="outline"
                      >
                        {aberta ? "✅ Aberta" : "❌ Fechada"}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-white text-base">
            Parear um número novo
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-white/60 space-y-2">
          <p>
            O pareamento (QR Code) ainda é feito no painel do WAHA, não aqui:
            abra <code className="text-white/80">http://172.16.1.1:3000</code>,
            escolha a sessão e leia o QR com o WhatsApp do número.
          </p>
          <p>
            Depois clique em <strong className="text-white/80">Atualizar</strong>{" "}
            nesta tela — a sessão aparece aqui como <em>Aberta</em> e já pode
            ser usada em um disparo.
          </p>
          <a
            href="http://172.16.1.1:3000"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[#3B64CF] hover:underline"
          >
            Abrir painel do WAHA <ExternalLink size={13} />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
