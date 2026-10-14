"use client";

/**
 * PEDIDO 3 (11/10) — MARKETING > Criar Artes.
 *
 * Assistente guiado (decisão do João 11/10): o vendedor escolhe o TIPO
 * de post, preenche assunto/texto/estilo e tudo vira UM "grande prompt"
 * (lib/marketing/gerar-prompt) que o Gemini (Nano Banana) transforma em
 * imagem. A arte entra na galeria com botão DISPARAR — leva a imagem
 * pronta para a fila de disparo.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Download, Send, Trash2, Palette } from "lucide-react";
import { montarPromptArte } from "@/lib/marketing/gerar-prompt";

type Arte = {
  id: string;
  titulo: string;
  formato: string;
  prompt: string;
  imagem_url: string | null;
  status: string;
  created_at: string;
};

type Referencia = {
  id: string;
  nome: string;
  marker: string;
  imagem_url: string;
};

const FORMATOS_TELA = [
  { chave: "feed_insta", icone: "📷", nome: "Feed do Instagram", desc: "Quadrado 1080x1080" },
  { chave: "story", icone: "📱", nome: "Story / Reels", desc: "Vertical 1080x1920" },
  { chave: "facebook", icone: "👍", nome: "Post do Facebook", desc: "Quadrado 1080x1080" },
  { chave: "banner", icone: "🪧", nome: "Banner / anúncio", desc: "Horizontal 1200x628" },
];

const ESTILOS = [
  "Moderno e limpo (padrão)",
  "Elegante",
  "Vibrante e chamativo",
  "Técnico e informativo",
  "Promoção / desconto",
];

export default function CriarArtesPage() {
  const [formato, setFormato] = useState("feed_insta");
  const [assunto, setAssunto] = useState("");
  const [texto, setTexto] = useState("");
  const [estilo, setEstilo] = useState(ESTILOS[0]);
  const [observacoes, setObservacoes] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [artes, setArtes] = useState<Arte[]>([]);
  const [carregando, setCarregando] = useState(true);
  // MELHORIA 13/10: clique na arte abre em tamanho cheio (lightbox)
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const [referencias, setReferencias] = useState<Referencia[]>([]);
  const [nomeRef, setNomeRef] = useState("");
  const [arquivoRef, setArquivoRef] = useState<File | null>(null);
  const [subindoRef, setSubindoRef] = useState(false);

  // "Moderno e limpo (padrão)" = deixar o montador usar o padrão dele
  const estiloEfetivo = estilo.startsWith("Moderno") ? "" : estilo;

  const prompt = useMemo(
    () =>
      assunto.trim() && texto.trim()
        ? montarPromptArte({ formato, assunto, texto, estilo: estiloEfetivo, observacoes })
        : "",
    [formato, assunto, texto, estiloEfetivo, observacoes],
  );

  async function carregar() {
    try {
      const res = await fetch("/api/marketing/artes");
      const json = await res.json();
      if (res.ok) setArtes(json.artes || []);
    } catch {
      /* galeria fica vazia; o card mostra o estado */
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    carregarReferencias();
  }, []);

  async function carregarReferencias() {
    try {
      const res = await fetch("/api/marketing/artes/referencias");
      const json = await res.json();
      if (res.ok) setReferencias(json.referencias || []);
    } catch {
      /* sem referências; a seção fica com o formulário só */
    }
  }

  function inserirMarker(r: Referencia) {
    setObservacoes((o) => (o ? `${o} ` : "") + `{{${r.marker}}}`);
  }

  async function subirReferencia() {
    if (!arquivoRef || !nomeRef.trim()) {
      setErro("Dê um nome e escolha a imagem da referência.");
      return;
    }
    setSubindoRef(true);
    setErro(null);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error("Falha ao ler o arquivo"));
        fr.readAsDataURL(arquivoRef);
      });
      const res = await fetch("/api/marketing/artes/referencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nomeRef.trim(),
          base64: dataUrl.split(",")[1] || "",
          mimetype: arquivoRef.type,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao enviar a imagem");
      setNomeRef("");
      setArquivoRef(null);
      await carregarReferencias();
    } catch (e: any) {
      setErro(e?.message || "Falha ao enviar a imagem");
    } finally {
      setSubindoRef(false);
    }
  }

  async function excluirReferencia(r: Referencia) {
    if (!confirm(`Excluir a referência "${r.nome}"?`)) return;
    try {
      const res = await fetch(`/api/marketing/artes/referencias?id=${r.id}`, { method: "DELETE" });
      if (res.ok) setReferencias((lista) => lista.filter((x) => x.id !== r.id));
    } catch {
      /* ignora; a próxima carga corrige */
    }
  }

  async function gerar() {
    if (!assunto.trim() || !texto.trim()) {
      setErro("Preencha o ASSUNTO e o TEXTO da arte.");
      return;
    }
    setGerando(true);
    setErro(null);
    try {
      const res = await fetch("/api/marketing/artes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formato,
          assunto,
          texto,
          estilo: estiloEfetivo || null,
          observacoes: observacoes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao gerar a arte");
      setArtes((atual) => [json.arte, ...atual]);
      setAssunto("");
      setTexto("");
      setObservacoes("");
    } catch (e: any) {
      setErro(e?.message || "Falha ao gerar a arte");
    } finally {
      setGerando(false);
    }
  }

  async function excluir(arte: Arte) {
    if (!confirm(`Excluir a arte "${arte.titulo}"?`)) return;
    try {
      const res = await fetch(`/api/marketing/artes?id=${arte.id}`, { method: "DELETE" });
      if (res.ok) setArtes((atual) => atual.filter((a) => a.id !== arte.id));
    } catch {
      /* mantém a arte; ele pode tentar de novo */
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#3B64CF]/20">
          <Palette className="h-6 w-6 text-[#7ea6ff]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Criar Artes</h1>
          <p className="text-sm text-white/50">
            Escolha o tipo de post, conte o que quer na arte e a IA gera — depois é só disparar.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,420px)_1fr] gap-6 items-start">
        {/* ─── Assistente guiado ─── */}
        <Card className="bg-[#0f1b30] border-[#1c2e4a]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg">1. Tipo de post</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              {FORMATOS_TELA.map((f) => (
                <button
                  key={f.chave}
                  onClick={() => setFormato(f.chave)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    formato === f.chave
                      ? "border-[#3B64CF] bg-[#3B64CF]/15"
                      : "border-[#1c2e4a] bg-white/5 hover:border-[#3B64CF]/50"
                  }`}
                >
                  <div className="text-lg">{f.icone}</div>
                  <div className="text-xs font-medium text-white mt-1">{f.nome}</div>
                  <div className="text-[10px] text-white/40">{f.desc}</div>
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <Label className="text-white/60">2. Assunto (produto / oferta)</Label>
              <Input
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Ex.: Instalação de painéis solares"
                className="bg-[#0a1222] border-[#1c2e4a] text-white"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-white/60">3. Texto que aparece NA arte</Label>
              <Textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Ex.: Economize até 40% na conta de luz"
                rows={2}
                className="bg-[#0a1222] border-[#1c2e4a] text-white"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-white/60">4. Estilo</Label>
              <select
                value={estilo}
                onChange={(e) => setEstilo(e.target.value)}
                className="w-full h-9 rounded-md bg-[#0a1222] border border-[#1c2e4a] text-white text-sm px-3"
              >
                {ESTILOS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-white/60">5. Observações (opcional)</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex.: fundo azul escuro, incluir logo da STK"
                rows={2}
                className="bg-[#0a1222] border-[#1c2e4a] text-white"
              />
            </div>

            {/* Prévia do grande prompt */}
            <div className="space-y-1">
              <Label className="text-white/60">Prévia do prompt que vai para a IA</Label>
              <div className="p-3 rounded-lg bg-[#0a1222] border border-[#1c2e4a] text-[11px] text-white/50 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {prompt || "Preencha assunto e texto para ver o prompt pronto."}
              </div>
            </div>

            {erro && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                {erro}
              </p>
            )}

            <Button
              onClick={gerar}
              disabled={gerando}
              className="w-full bg-[#3B64CF] hover:bg-[#2f52b3] text-white"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {gerando ? "Gerando... pode levar até 30s" : "Gerar arte"}
            </Button>
          </CardContent>
        </Card>

        {/* ─── Galeria ─── */}
        <Card className="bg-[#0f1b30] border-[#1c2e4a]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-lg">Suas artes</CardTitle>
          </CardHeader>
          <CardContent>
            {carregando ? (
              <p className="text-sm text-white/40">Carregando galeria...</p>
            ) : artes.length === 0 ? (
              <p className="text-sm text-white/40">
                Nenhuma arte ainda. Preencha o assistente à esquerda e clique em
                &quot;Gerar arte&quot;.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {artes.map((arte) => (
                  <div
                    key={arte.id}
                    className="rounded-lg border border-[#1c2e4a] bg-white/5 overflow-hidden"
                  >
                    {arte.imagem_url ? (
                      <button
                        type="button"
                        onClick={() => setAmpliada(arte.imagem_url)}
                        title="Clique para ver em tamanho cheio"
                        className="block w-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={arte.imagem_url}
                          alt={arte.titulo}
                          className="w-full h-40 object-cover bg-[#0a1222] cursor-zoom-in hover:opacity-90 transition-opacity"
                        />
                      </button>
                    ) : (
                      <div className="w-full h-40 flex items-center justify-center text-white/30 text-xs bg-[#0a1222]">
                        {arte.status === "erro" ? "Falha na geração" : "Gerando..."}
                      </div>
                    )}
                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-white truncate">{arte.titulo}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#3B64CF]/20 text-[#7ea6ff] whitespace-nowrap">
                          {FORMATOS_TELA.find((f) => f.chave === arte.formato)?.icone}{" "}
                          {arte.formato}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/30">
                        {new Date(arte.created_at).toLocaleString("pt-BR")}
                      </p>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/disparo?arte=${encodeURIComponent(arte.imagem_url || "")}&arte_titulo=${encodeURIComponent(arte.titulo)}`}
                          className="flex-1"
                        >
                          <Button
                            size="sm"
                            className="w-full bg-[#3B64CF] hover:bg-[#2f52b3] text-white"
                            disabled={!arte.imagem_url}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" />
                            Disparar
                          </Button>
                        </Link>
                        <a
                          href={arte.imagem_url || "#"}
                          download
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-md border border-[#1c2e4a] text-white/60 hover:text-white transition-colors"
                          title="Baixar"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          onClick={() => excluir(arte)}
                          className="p-2 rounded-md border border-[#1c2e4a] text-white/40 hover:text-red-400 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* MELHORIA 12/10 — imagens de referência (logo, foto, cenário) */}
        <Card className="mt-6 border-white/10 bg-white/[0.03]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-white">
              🖼 Imagens de referência (opcional) — logo, foto de produto, cenário
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-white/50">
              Clique no marker para inserir no campo <span className="text-white/70">Observações</span>{" "}
              — a imagem entra exatamente naquele ponto do pedido. Sem citar, ela vai na frente.
            </p>
            {referencias.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {referencias.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.imagem_url}
                      alt={r.nome}
                      onClick={() => setAmpliada(r.imagem_url)}
                      title="Clique para ver em tamanho cheio"
                      className="h-12 w-12 rounded object-cover border border-white/10 cursor-zoom-in hover:opacity-80"
                    />
                    <div>
                      <p className="text-xs text-white/80">{r.nome}</p>
                      <button
                        onClick={() => inserirMarker(r)}
                        className="font-mono text-[11px] text-[#3B64CF] hover:underline"
                        title="Inserir no campo Observações"
                      >
                        {`{{${r.marker}}}`}
                      </button>
                    </div>
                    <button
                      onClick={() => excluirReferencia(r)}
                      className="ml-1 text-white/40 hover:text-red-400"
                      title="Excluir referência"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-white/60">Nome (vira o marker)</Label>
                <Input
                  value={nomeRef}
                  onChange={(e) => setNomeRef(e.target.value)}
                  placeholder="Ex.: Logo STK"
                  className="h-8 w-44 bg-[#0f1b30] border-[#1c2e4a] text-white"
                />
              </div>
              <label className="flex items-center gap-2 rounded-lg border border-dashed border-white/15 px-3 py-2 text-xs text-white/40 hover:border-[#3B64CF]/50 cursor-pointer">
                {arquivoRef ? `📎 ${arquivoRef.name}` : "📷 Escolher imagem (PNG/JPG, até 2,5MB)"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => setArquivoRef(e.target.files?.[0] ?? null)}
                />
              </label>
              <Button
                onClick={subirReferencia}
                disabled={subindoRef || !arquivoRef || !nomeRef.trim()}
                className="h-8"
              >
                {subindoRef ? "Enviando…" : "＋ Adicionar referência"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MELHORIA 13/10 — luz de fundo com a arte em tamanho cheio */}
      {ampliada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-10"
          onClick={() => setAmpliada(null)}
          role="dialog"
          aria-label="Arte em tamanho cheio"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ampliada}
            alt="Arte em tamanho cheio"
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setAmpliada(null)}
            aria-label="Fechar"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white text-lg hover:bg-white/20"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
