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
import { Sparkles, Download, Trash2, Palette, Pencil, Check, RefreshCw, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { montarPromptArte } from "@/lib/marketing/gerar-prompt";
import { montarTextoImagem, POSICOES_ARTE } from "@/lib/marketing/textos-imagem";

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

// REFORMULAÇÃO24/11 — mercado: de5 para30+ estilos com busca.
const ESTILOS = [
  "Moderno e limpo (padrão)",
  "Elegante",
  "Vibrante e chamativo",
  "Técnico e informativo",
  "Promoção / desconto",
  "Vintage / retrô",
  "Minimalista",
  "Fotográfico realista",
  "Ilustração / desenho à mão",
  "Cartoon divertido",
  "3D / renderização",
  "Neon futurista",
  "Aquarela suave",
  "Corporativo sério",
  "Rústico artesanal",
  "Luxo premium",
  "Pop colorido",
  "Dramático escuro",
  "Soft / tons pastel",
  "Geométrico",
  "Orgânico / natural",
  "Esportivo dinâmico",
  "Infantil / alegre",
  "Gastronômico apetitoso",
  "Tecnológico high-tech",
  "Beleza / cosmético",
  "Imobiliário / arquitetura",
  "Moda / lifestyle",
  "Automotivo",
  "Boho / praia",
  "Estilo Japones (anime)",
  " HQ / quadrinhos",
  "✍️ Outro (descreva você)",
];
const ESTILO_OUTRO = "✍️ Outro (descreva você)";

// PASSO1 — objetivo da peça (novo campo pedido em24/11)
const OBJETIVOS = [
  "Divulgar produto ou serviço",
  "Promover oferta / promoção",
  "Criar anúncio (pago)",
  "Anunciar novidade / lançamento",
  "Convidar para evento",
  "Recado / atendimento ao cliente",
  "Informativo / dica do dia",
  "Captação de clientes (gerar contatos)",
  "Outro objetivo",
];

// PASSO2 — sugestões de "o que você quer" (1 clique preenche)
const SUGESTOES_ASSUNTO = [
  "Anúncio de produto",
  "Promoção / oferta",
  "Novidade / lançamento",
  "Evento / convite",
  "Recado ao cliente",
  "Informativo / dica",
];

// PASSO3 — preferências novas
const CORES_ARTE = [
  "Sem preferência",
  "Azul",
  "Verde",
  "Vermelho",
  "Amarelo",
  "Laranja",
  "Rosa",
  "Roxo",
  "Preto",
  "Branco",
  "Cinza",
  "Marrom / bege",
  "Dourado",
  "Prata",
];
const RESOLUCOES = [
  "72 DPI — apenas tela (digital)",
  "150 DPI — impressão comum",
  "300 DPI — impressão profissional",
];

export default function CriarArtesPage() {
  const [formato, setFormato] = useState("feed_insta");
  const [assunto, setAssunto] = useState("");
  const [texto, setTexto] = useState("");
  const [estilo, setEstilo] = useState(ESTILOS[0]);
  const [observacoes, setObservacoes] = useState("");
  const [gerando, setGerando] = useState(false);
  // OPÇÃO2 (18/11) — levar o prompt pronto para o ChatGPT do usuário.
  const [copiandoPrompt, setCopiandoPrompt] = useState(false);
  const [promptCopiado, setPromptCopiado] = useState(false);
  // Se o navegador negar a cópia automática, o prompt aparece aqui
  // (dialog) para o cliente copiar à mão — nunca fica sem ele.
  const [promptEmergencia, setPromptEmergencia] = useState<string | null>(null);

  /** Copia com fallback: clipboard moderno → execCommand → null. */
  async function copiarTexto(texto: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = texto;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  }
  const [erro, setErro] = useState<string | null>(null);
  const [artes, setArtes] = useState<Arte[]>([]);
  const [carregando, setCarregando] = useState(true);
  // MELHORIA 13/10: clique na arte abre em tamanho cheio (lightbox)
  const [ampliada, setAmpliada] = useState<string | null>(null);
  const [referencias, setReferencias] = useState<Referencia[]>([]);
  const [nomeRef, setNomeRef] = useState("");
  const [arquivoRef, setArquivoRef] = useState<File | null>(null);
  const [subindoRef, setSubindoRef] = useState(false);
  // ITEM 3 — textos cadastrados (número/opções) + posição na imagem
  const [textosCadastrados, setTextosCadastrados] = useState<Array<{ id: string; tipo: string; texto: string }>>([]);
  const [numeroInput, setNumeroInput] = useState("");
  const [opcaoInput, setOpcaoInput] = useState("");
  const [usarNumero, setUsarNumero] = useState(false);
  const [opcoesMarcadas, setOpcoesMarcadas] = useState<string[]>([]);
  const [posicao, setPosicao] = useState("automatica");
  // 07/11 — REFORMULAÇÃO (pedido do João: "está confuso, precisa estar melhor explicado"):
  // referências clicáveis entram sozinhas no prompt (fim do marker manual);
  // modal único de confirmação no lugar do confirm() nativo; filtro de formato;
  // renomear na galeria; botão "criar outra variante".
  const [refsMarcadas, setRefsMarcadas] = useState<string[]>([]);
  const [excluirPendente, setExcluirPendente] = useState<
    null | { tipo: "arte" | "referencia" | "texto"; item: { id: string; nome?: string; titulo?: string; texto?: string } }
  >(null);
  const [filtroFormato, setFiltroFormato] = useState("todos");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [tituloEditado, setTituloEditado] = useState("");
  const [jaGerou, setJaGerou] = useState(false);
  // REFORMULAÇÃO24/11 — campos novos dos4 passos (pedido do João)
  const [objetivo, setObjetivo] = useState("");
  const [buscaEstilo, setBuscaEstilo] = useState("");
  const [estiloOutro, setEstiloOutro] = useState("");
  const [extraArte, setExtraArte] = useState("");
  const [cor, setCor] = useState("Sem preferência");
  const [meio, setMeio] = useState("");
  const [resolucao, setResolucao] = useState("");
  const [sujeito, setSujeito] = useState("");
  // Modal de revisão (estilo "criar anúncio no Google") antes do ChatGPT
  const [modalRevisao, setModalRevisao] = useState(false);

  // "Moderno e limpo (padrão)" = deixar o montador usar o padrão dele;
  // "Outro" usa o que a pessoa descreveu no campo ao lado.
  const estiloEfetivo =
    estilo === ESTILO_OUTRO
      ? estiloOutro.trim()
      : estilo.startsWith("Moderno")
        ? ""
        : estilo;

  // Estilos filtrados pela busca (digitou "vintage" já aparece) — a
  // escolha atual entra mesmo se a busca escondê-la (evita pular sozinho)
  const estilosFiltrados = useMemo(() => {
    const termo = buscaEstilo.trim().toLowerCase();
    const base = !termo
      ? ESTILOS
      : ESTILOS.filter((e) => e.toLowerCase().includes(termo));
    if (estilo && !base.includes(estilo)) return [estilo, ...base];
    return base;
  }, [buscaEstilo, estilo]);

  const numeroSalvo = textosCadastrados.find((t) => t.tipo === "numero")?.texto || "";
  const opcoesSalvas = textosCadastrados.filter((t) => t.tipo === "opcao").map((t) => t.texto);

  async function carregarTextos() {
    try {
      const res = await fetch("/api/marketing/artes/textos");
      const json = await res.json();
      if (res.ok) setTextosCadastrados(json.textos || []);
    } catch {
      /* sem cadastro; a seção fica só com os formulários */
    }
  }

  // ITEM 3 — linha extra do prompt: textos marcados + posição escolhida
  const textoImagem = useMemo(
    () =>
      montarTextoImagem(
        usarNumero ? numeroSalvo : "",
        opcoesSalvas.filter((o) => opcoesMarcadas.includes(o)),
        posicao,
      ),
    [numeroSalvo, usarNumero, opcoesSalvas.join("|"), opcoesMarcadas.join("|"), posicao],
  );

  // Observações + markers das referências MARCADAS nos cards (07/11: o
  // usuário clica na imagem e ela entra sozinha — sem copiar {{marker}}).
  const observacoesEfetivas = useMemo(() => {
    const markers = referencias
      .filter((r) => refsMarcadas.includes(r.id))
      .map((r) => `{{${r.marker}}}`);
    return [observacoes.trim(), ...markers].filter(Boolean).join(" ");
  }, [observacoes, referencias, refsMarcadas]);

  const prompt = useMemo(
    () =>
      assunto.trim() && texto.trim()
        ? montarPromptArte({
            formato,
            assunto,
            texto,
            estilo: estiloEfetivo,
            observacoes: observacoesEfetivas,
            textoImagem,
            // REFORMULAÇÃO 24/11
            objetivo,
            extra: extraArte,
            cor,
            meio,
            resolucao,
            sujeito,
          })
        : "",
    [
      formato,
      assunto,
      texto,
      estiloEfetivo,
      observacoesEfetivas,
      textoImagem,
      objetivo,
      extraArte,
      cor,
      meio,
      resolucao,
      sujeito,
    ],
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
    carregarTextos();
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
    setExcluirPendente({ tipo: "referencia", item: { id: r.id, nome: r.nome } });
  }

  // modal de confirmação único (antes: confirm() nativo em3 lugares)
  async function confirmarExclusao() {
    const pendente = excluirPendente;
    setExcluirPendente(null);
    if (!pendente) return;
    if (pendente.tipo === "referencia") {
      const r = { id: pendente.item.id, nome: pendente.item.nome || "" };
      try {
      const res = await fetch(`/api/marketing/artes/referencias?id=${r.id}`, { method: "DELETE" });
      if (res.ok) setReferencias((lista) => lista.filter((x) => x.id !== r.id));
      } catch {
      /* ignora; a próxima carga corrige */
      }
      } else if (pendente.tipo === "texto") {
      try {
      const res = await fetch(`/api/marketing/artes/textos?id=${pendente.item.id}`, { method: "DELETE" });
      if (res.ok) {
        setOpcoesMarcadas((lista) => lista.filter((o) => o !== pendente.item.texto));
        await carregarTextos();
      }
      } catch {
      /* recarrega depois */
      }
      } else if (pendente.tipo === "arte") {
      try {
      const res = await fetch(`/api/marketing/artes?id=${pendente.item.id}`, { method: "DELETE" });
      if (res.ok) setArtes((atual) => atual.filter((a) => a.id !== pendente.item.id));
      } catch {
      /* mantém a arte; ele pode tentar de novo */
      }
      }
      }

  // ITEM 3 — cadastro de número/opções (tabela artes_textos)
  async function salvarTextoCadastrado(tipo: "numero" | "opcao", valor: string) {
    if (!valor.trim()) return;
    try {
      const res = await fetch("/api/marketing/artes/textos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, texto: valor.trim() }),
      });
      if (res.ok) {
        if (tipo === "numero") {
          setNumeroInput("");
          setUsarNumero(true);
        } else {
          setOpcaoInput("");
        }
        await carregarTextos();
      }
    } catch {
      /* próxima tentativa recarrega */
    }
  }

  async function excluirTextoCadastrado(t: { id: string; texto: string }) {
    setExcluirPendente({ tipo: "texto", item: { id: t.id, texto: t.texto } });
  }

  /** Mesmo corpo do pedido — usado por gerar() e pelo caminho ChatGPT. */
  function corpoArte() {
    return {
      formato,
      assunto,
      texto,
      estilo: estiloEfetivo || null,
      observacoes: observacoesEfetivas || null,
      numero: usarNumero ? numeroSalvo : "",
      opcoes: opcoesSalvas.filter((o) => opcoesMarcadas.includes(o)),
      posicao,
      // REFORMULAÇÃO 24/11 — campos novos dos 4 passos
      objetivo: objetivo || null,
      extra: extraArte || null,
      cor: cor || null,
      meio: meio || null,
      resolucao: meio === "Impressão" ? resolucao || null : null,
      sujeito: sujeito || null,
    };
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
        body: JSON.stringify(corpoArte()),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao gerar a arte");
      setArtes((atual) => [json.arte, ...atual]);
      // 07/11: os campos ficam preenchidos — dá pra ajustar e clicar em
      // "Criar outra variante" sem refazer tudo. Limpar era re-trabalho.
      setJaGerou(true);
    } catch (e: any) {
      setErro(e?.message || "Falha ao gerar a arte");
    } finally {
      setGerando(false);
    }
  }

  /**
   * OPÇÃO2 (18/11) — leva o prompt JÁ MONTADO para o ChatGPT do usuário:
   * monta no servidor (sem gerar imagem, custo zero), copia para a
   * área de transferência e abre o ChatGPT — ele só dá Ctrl+V.
   */
  async function gerarNoChatGPT() {
    if (!assunto.trim() || !texto.trim()) {
      setErro("Preencha o ASSUNTO e o TEXTO antes de levar para o ChatGPT.");
      return;
    }
    setCopiandoPrompt(true);
    setErro(null);
    setPromptCopiado(false);
    try {
      const res = await fetch("/api/marketing/artes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...corpoArte(), apenasPrompt: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Não foi possível montar o prompt");
      const copiado = await copiarTexto(json.prompt);
      if (copiado) {
        setPromptCopiado(true);
      } else {
        // navegador negou a cópia: mostra o prompt para copiar à mão
        setPromptEmergencia(json.prompt);
      }
      window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
    } catch (e: any) {
      setErro(e?.message || "Falha ao montar o prompt");
    } finally {
      setCopiandoPrompt(false);
    }
  }

  async function excluir(arte: Arte) {
    setExcluirPendente({ tipo: "arte", item: { id: arte.id, titulo: arte.titulo } });
  }

  // 07/11 — referência clicável: marca/desmarca para entrar sozinha no prompt
  function alternarReferencia(r: Referencia) {
    setRefsMarcadas((lista) =>
      lista.includes(r.id) ? lista.filter((x) => x !== r.id) : [...lista, r.id],
    );
  }

  // 07/11 — renomear na galeria (PATCH /api/marketing/artes)
  async function salvarRenomear() {
    if (!editandoId || !tituloEditado.trim()) { setEditandoId(null); return; }
    try {
      const res = await fetch("/api/marketing/artes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editandoId, titulo: tituloEditado.trim() }),
      });
      if (res.ok) {
        const novo = tituloEditado.trim();
        setArtes((atual) => atual.map((a) => (a.id === editandoId ? { ...a, titulo: novo } : a)));
      } else {
        // sem aviso o título simplesmente "não grava" e o usuário não sabe por quê
        const j = await res.json().catch(() => ({}) as { error?: string });
        setErro(j.error || "Não foi possível renomear — só o criador da arte ou um administrador pode.");
      }
    } catch {
      setErro("Falha de rede ao renomear — tente de novo.");
    }
    setEditandoId(null);
  }

  return (
    <div className="space-y-6">
      {/* ============ CABEÇALHO ============ */}
      <div>
        <h1 className="text-2xl font-bold text-white">Criar Artes</h1>
        <p className="text-white/50 text-sm mt-1">
          Quatro passos e a IA monta a imagem para você. Depois é só clicar em
          &quot;Disparar&quot; — a arte vai pronta para o formulário de envio.
        </p>
      </div>

      {/* ============ ASSISTENTE ============ */}
      <Card className="bg-[#1a2236] border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg">✨ Criar arte —4 passos rápidos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-7">
          {/* PASSO1 — objetivo + formato (REFORMULAÇÃO24/11) */}
          <section>
            <h3 className="text-white font-semibold">1. Qual o objetivo e o formato?</h3>
            <div className="mt-2 mb-3">
              <Label htmlFor="objetivo-arte">Qual é o objetivo desta arte?</Label>
              <select
                id="objetivo-arte"
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white"
              >
                <option value="" className="bg-[#1a2236]">
                  Selecione o objetivo...
                </option>
                {OBJETIVOS.map((o) => (
                  <option key={o} value={o} className="bg-[#1a2236]">
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-white/40 text-xs mb-3">
              Escolha onde a arte vai ser publicada — o tamanho da imagem é ajustado sozinho.
              <b className="text-white/60">
                {" "}
                Todos os formatos também servem para WhatsApp
              </b>{" "}
              (grupo, status e conversa) — é só recortar depois se precisar.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FORMATOS_TELA.map((f) => {
                const ativo = formato === f.chave;
                const proporcao =
                  f.chave === "story" ? "h-10 w-6" : f.chave === "banner" ? "h-6 w-12" : "h-8 w-8";
                return (
                  <button
                    key={f.chave}
                    type="button"
                    onClick={() => setFormato(f.chave)}
                    className={`rounded-lg border p-3 text-center transition ${
                      ativo
                        ? "border-[#3B64CF] bg-[#3B64CF]/15"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    }`}
                  >
                    <span className="text-xl">{f.icone}</span>
                    <p className={`text-xs font-medium mt-1 ${ativo ? "text-white" : "text-white/70"}`}>
                      {f.nome}
                    </p>
                    <span
                      className={`mx-auto mt-2 block border rounded-sm ${
                        ativo ? "border-[#3B64CF] bg-[#3B64CF]/30" : "border-white/20 bg-white/10"
                      } ${proporcao}`}
                    />
                    <p className="text-[10px] text-white/40 mt-1">{f.desc}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* PASSO2 — conteúdo */}
          <section className="space-y-3">
            <div>
              <h3 className="text-white font-semibold">2. O que vai na arte?</h3>
              <p className="text-white/40 text-xs mt-1">Escreva o básico, em português mesmo.</p>
            </div>
            <div>
              <Label htmlFor="assunto">O que você quer? (o que a peça vai anunciar ou contar)</Label>
              <Input
                id="assunto"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Ex: anúncio de painéis solares, promoção de fim de ano, convite para a feira..."
                className="mt-1 bg-white/5 border-white/10"
              />
              {/* sugestões de1 clique — cobre anúncio, promoção, evento... */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SUGESTOES_ASSUNTO.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setAssunto(s)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60 transition hover:border-[#3B64CF]/60 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="texto-arte">Texto que aparece NA imagem</Label>
              <Textarea
                id="texto-arte"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={3}
                placeholder="Ex: Economize até40% na conta de luz"
                className="mt-1 bg-white/5 border-white/10"
              />
            </div>
            <div>
              <Label htmlFor="estilo-busca">Visual — procure pelo jeito que quiser</Label>
              <Input
                id="estilo-busca"
                value={buscaEstilo}
                onChange={(e) => setBuscaEstilo(e.target.value)}
                placeholder="🔍 Buscar estilo... (ex: vintage, neon, minimalista,3D, aquarela...)"
                className="mt-1 bg-white/5 border-white/10"
              />
              <select
                id="estilo-arte"
                value={estilo}
                onChange={(e) => setEstilo(e.target.value)}
                className="mt-2 h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white"
              >
                {estilosFiltrados.map((e) => (
                  <option key={e} value={e} className="bg-[#1a2236]">
                    {e}
                  </option>
                ))}
              </select>
              {estilo === ESTILO_OUTRO && (
                <Textarea
                  value={estiloOutro}
                  onChange={(e) => setEstiloOutro(e.target.value)}
                  rows={2}
                  placeholder="Descreva o visual que quer... ex: fundo escuro com brilho dourado, estilo anos80"
                  className="mt-2 bg-white/5 border-white/10"
                />
              )}
            </div>
          </section>

          {/* PASSO3 — incluir na arte (é AQUI que mora o cadastro, não lá embaixo) */}
          <section className="space-y-3">
            <div>
              <h3 className="text-white font-semibold">3. O que mais você quer incluir? (opcional)</h3>
              <p className="text-white/40 text-xs mt-1">
                Número da empresa e preferências da arte. Sem nada preenchido, a arte sai com o
                texto do passo2.
              </p>
            </div>

            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs font-medium text-white/70 mb-2">📱 Número / WhatsApp da empresa</p>
              {numeroSalvo && (
                <label className="flex items-center gap-2 text-sm text-white cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={usarNumero}
                    onChange={(e) => setUsarNumero(e.target.checked)}
                    className="accent-[#3B64CF]"
                  />
                  Incluir <b>{numeroSalvo}</b> na arte
                </label>
              )}
              <div className="flex gap-2">
                <Input
                  value={numeroInput}
                  onChange={(e) => setNumeroInput(e.target.value)}
                  placeholder={numeroSalvo ? "Salvar outro número..." : "Ex: (11)99999-0000"}
                  className="bg-white/5 border-white/10"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/15 text-white/80"
                  onClick={() => salvarTextoCadastrado("numero", numeroInput)}
                >
                  💾 Salvar
                </Button>
              </div>
            </div>

            {/* REFORMULAÇÃO24/11 — "frases prontas" saiu; entram as
                preferências pedidas (extra, cor, uso, sujeito, resolução) */}
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs font-medium text-white/70 mb-2">
                ✏️ O que mais você quer adicionar?
              </p>
              <Textarea
                value={extraArte}
                onChange={(e) => setExtraArte(e.target.value)}
                rows={2}
                placeholder="Ex: QR code no canto, selo de garantia, nome do vendedor, horário de funcionamento..."
                className="bg-white/5 border-white/10"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="cor-arte">Cor de preferência</Label>
                <select
                  id="cor-arte"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white"
                >
                  {CORES_ARTE.map((c) => (
                    <option key={c} value={c} className="bg-[#1a2236]">
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="meio-arte">Vai ser digital ou impressão?</Label>
                <select
                  id="meio-arte"
                  value={meio}
                  onChange={(e) => {
                    setMeio(e.target.value);
                    if (e.target.value !== "Impressão") setResolucao("");
                  }}
                  className="mt-1 h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white"
                >
                  <option value="" className="bg-[#1a2236]">Selecione...</option>
                  <option value="Digital" className="bg-[#1a2236]">Digital (tela / redes / WhatsApp)</option>
                  <option value="Impressão" className="bg-[#1a2236]">Impressão (folheto, banner, adesivo)</option>
                  <option value="Ainda não sei" className="bg-[#1a2236]">Ainda não sei</option>
                </select>
              </div>
            </div>

            {meio === "Impressão" && (
              <div>
                <Label htmlFor="resolucao-arte">Se for imprimir, qual resolução?</Label>
                <select
                  id="resolucao-arte"
                  value={resolucao}
                  onChange={(e) => setResolucao(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white"
                >
                  <option value="" className="bg-[#1a2236]">Selecione a resolução...</option>
                  {RESOLUCOES.map((r) => (
                    <option key={r} value={r} className="bg-[#1a2236]">{r}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label htmlFor="sujeito-arte">A arte vai mostrar humano ou equipamento?</Label>
              <select
                id="sujeito-arte"
                value={sujeito}
                onChange={(e) => setSujeito(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white"
              >
                <option value="" className="bg-[#1a2236]">Selecione...</option>
                <option value="Humano (pessoa)" className="bg-[#1a2236]">Humano (pessoa)</option>
                <option value="Equipamento (produto)" className="bg-[#1a2236]">Equipamento (produto)</option>
                <option value="Humano e equipamento" className="bg-[#1a2236]">Humano e equipamento</option>
                <option value="Sem preferência" className="bg-[#1a2236]">Sem preferência</option>
              </select>
            </div>

            {(usarNumero && numeroSalvo) || opcoesMarcadas.length > 0 ? (
              <div>
                <Label htmlFor="posicao-arte">Onde colocar esses textos na imagem?</Label>
                <select
                  id="posicao-arte"
                  value={posicao}
                  onChange={(e) => setPosicao(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white"
                >
                  {Object.entries(POSICOES_ARTE).map(([chave, nome]) => (
                    <option key={chave} value={chave} className="bg-[#1a2236]">
                      {nome}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </section>

          {/* REFERÊNCIAS — clicáveis, entram sozinhas no prompt */}
          <section>
            <h3 className="text-white font-semibold">🖼 Imagens de referência (opcional)</h3>
            <p className="text-white/40 text-xs mt-1 mb-3">
              Logo, foto de produto, material da marca... <b className="text-white/70">Clique numa
              imagem para usá-la nesta arte</b> (fica destacada) — sem precisar digitar nada.
            </p>
            <div className="flex flex-wrap gap-3">
              {referencias.map((r) => {
                const marcada = refsMarcadas.includes(r.id);
                return (
                  <div
                    key={r.id}
                    onClick={() => alternarReferencia(r)}
                    title={marcada ? "Clique para tirar da arte" : "Clique para usar nesta arte"}
                    className={`relative w-24 cursor-pointer rounded-lg border p-1 transition ${
                      marcada
                        ? "border-[#3B64CF] bg-[#3B64CF]/15"
                        : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    }`}
                  >
                    <img
                      src={r.imagem_url}
                      alt={r.nome}
                      className="h-16 w-full rounded object-cover"
                    />
                    <p className="mt-1 truncate text-center text-[10px] text-white/60">{r.nome}</p>
                    {marcada && (
                      <span className="absolute -right-1 -top-1 rounded-full bg-[#3B64CF] px-1.5 text-[10px] text-white">
                        ✓
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        excluirReferencia(r);
                      }}
                      className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-xs text-white/70 hover:bg-red-600 hover:text-white"
                      aria-label={`Excluir referência ${r.nome}`}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <Label htmlFor="ref-nome" className="text-xs text-white/60">
                  Nome (vira a identificação da imagem)
                </Label>
                <Input
                  id="ref-nome"
                  value={nomeRef}
                  onChange={(e) => setNomeRef(e.target.value)}
                  placeholder="Ex: logo da empresa"
                  className="mt-1 h-9 w-44 bg-white/5 border-white/10"
                />
              </div>
              <div>
                <Label htmlFor="ref-arquivo" className="text-xs text-white/60">
                  📷 Imagem (PNG/JPG, até2,5MB)
                </Label>
                <Input
                  id="ref-arquivo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setArquivoRef(e.target.files?.[0] || null)}
                  className="mt-1 h-9 w-56 bg-white/5 border-white/10"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/15 text-white/80"
                disabled={subindoRef || !arquivoRef || !nomeRef.trim()}
                onClick={subirReferencia}
              >
                {subindoRef ? "Enviando..." : "＋ Adicionar"}
              </Button>
            </div>
          </section>

          {/* PASSO4 — detalhes extras */}
          <section>
            <h3 className="text-white font-semibold">4. Detalhes extras (opcional)</h3>
            <p className="text-white/40 text-xs mt-1 mb-2">
              Quer ajustar alguma coisa? Escreva do seu jeito — ex: &quot;fundo escuro&quot;,
              &quot;sem texto no topo&quot;, &quot;tom de alerta&quot;.
            </p>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Detalhes para a IA (opcional)"
              className="bg-white/5 border-white/10"
            />
          </section>

          {/* PRÉVIA — escondida por padrão (jargão sai da vista) */}
          <details className="rounded-lg border border-white/10 bg-white/[0.03]">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs text-white/50 hover:text-white/80">
              ▼ Ver como a IA vai ler seu pedido (avançado)
            </summary>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 pb-3 pt-1 text-[11px] leading-relaxed text-white/50">
              {prompt || "Preencha assunto e texto para ver a prévia."}
            </pre>
          </details>

          {/* FEEDBACK */}
          {erro && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {erro}
            </p>
          )}
          {gerando && (
            <div className="rounded-lg border border-[#3B64CF]/40 bg-[#3B64CF]/10 px-3 py-2 text-sm text-[#9db8ff]">
              ✨ Gerando a arte... pode levar até30 segundos. A galeria lá embaixo recebe a imagem.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={gerar}
              disabled={gerando}
              className="bg-[#3B64CF] hover:bg-[#2d50a8] text-white"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {gerando ? "Gerando..." : "Criar arte"}
            </Button>
            <Button
              type="button"
              onClick={gerar}
              disabled={gerando || !jaGerou}
              variant="outline"
              className="border-white/15 text-white/80"
              title={jaGerou ? "Gera uma nova imagem com o mesmo pedido" : "Crie a primeira arte para habilitar"}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Criar outra variante
            </Button>
            {/* OPÇÃO2 (18/11) — leva o prompt pronto para o ChatGPT do
                usuário: monta no servidor (sem gerar aqui, custo zero),
                copia e abre o ChatGPT. */}
            <Button
              type="button"
              onClick={gerarNoChatGPT}
              disabled={gerando || copiandoPrompt}
              variant="outline"
              className="border-white/15 text-white/80"
              title="Monta o prompt pronto, copia e abre o ChatGPT — a imagem é gerada lá, sem custo para o sistema"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {copiandoPrompt ? "Montando prompt..." : "Gerar no ChatGPT"}
            </Button>
          </div>
          {promptCopiado && (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              ✅ Prompt copiado! Cole no ChatGPT (Ctrl+V) e mande gerar.
              Obs.: imagens de referência (logo/foto) não acompanham o
              texto — anexe-as lá se a arte precisar delas.
            </p>
          )}

          {/* Cópia automática bloqueada pelo navegador: prompt à mostra
              para o cliente copiar (Ctrl+C) — nunca fica sem ele. */}
          <Dialog
            open={!!promptEmergencia}
            onOpenChange={(ab) => {
              if (!ab) setPromptEmergencia(null);
            }}
          >
            <DialogContent className="max-w-2xl border-white/10 bg-[#1a2236] text-white">
              <DialogHeader>
                <DialogTitle className="text-white">
                  Prompt pronto para o ChatGPT
                </DialogTitle>
              </DialogHeader>
              <p className="text-xs text-white/50">
                A cópia automática foi bloqueada pelo navegador — selecione
                o texto e copie (Ctrl+C), depois cole no ChatGPT (Ctrl+V).
              </p>
              <textarea
                readOnly
                value={promptEmergencia || ""}
                onFocus={(e) => e.currentTarget.select()}
                className="h-64 w-full rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/80"
              />
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* ============ GALERIA ============ */}
      <Card className="bg-[#1a2236] border-white/10">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-white">🖼 Suas artes</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-white/50" htmlFor="filtro-formato">
              Filtrar:
            </Label>
            <select
              id="filtro-formato"
              data-sem-guard="true"
              value={filtroFormato}
              onChange={(e) => setFiltroFormato(e.target.value)}
              className="h-8 rounded-md border border-white/10 bg-white/5 px-2 text-xs text-white"
            >
              <option value="todos" className="bg-[#1a2236]">
                Todos os formatos
              </option>
              {FORMATOS_TELA.map((f) => (
                <option key={f.chave} value={f.chave} className="bg-[#1a2236]">
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="text-white/50 text-sm">Carregando galeria...</p>
          ) : artes.length === 0 ? (
            <div className="py-10 text-center">
              <Palette className="mx-auto mb-3 h-10 w-10 text-white/20" />
              <p className="text-sm text-white/60">
                Nenhuma arte ainda — preencha os4 passos acima e clique em &quot;Criar arte&quot;.
              </p>
            </div>
          ) : (
            (() => {
              const filtradas =
                filtroFormato === "todos" ? artes : artes.filter((a) => a.formato === filtroFormato);
              if (filtradas.length === 0) {
                return (
                  <p className="py-6 text-center text-sm text-white/50">
                    Nenhuma arte neste formato.
                  </p>
                );
              }
              return (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {filtradas.map((a) => (
                    <div
                      key={a.id}
                      className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]"
                    >
                      <button
                        type="button"
                        onClick={() => a.imagem_url && setAmpliada(a.imagem_url)}
                        className="block w-full"
                        title="Clique para ver em tamanho cheio"
                      >
                        {a.imagem_url ? (
                          <img
                            src={a.imagem_url}
                            alt={a.titulo}
                            className="h-36 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-36 items-center justify-center text-xs text-white/30">
                            sem imagem
                          </div>
                        )}
                      </button>
                      <div className="p-2">
                        {editandoId === a.id ? (
                          <div className="flex gap-1">
                            <Input
                              autoFocus
                              data-sem-guard="true"
                              value={tituloEditado}
                              onChange={(e) => setTituloEditado(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") salvarRenomear();
                                if (e.key === "Escape") setEditandoId(null);
                              }}
                              className="h-7 bg-white/10 text-xs"
                            />
                            <Button
                              type="button"
                              size="icon"
                              className="h-7 w-7 bg-[#3B64CF] hover:bg-[#2d50a8]"
                              onClick={salvarRenomear}
                              aria-label="Salvar nome"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-xs text-white/80" title={a.titulo}>
                              {a.titulo}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setEditandoId(a.id);
                                setTituloEditado(a.titulo);
                              }}
                              className="text-white/40 hover:text-white"
                              aria-label={`Renomear ${a.titulo}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        <p className="mt-0.5 text-[10px] text-white/40">
                          {FORMATOS_TELA.find((f) => f.chave === a.formato)?.nome || a.formato}
                        </p>
                        <div className="mt-2 flex gap-1">
                          <Link
                            href={`/disparo?arte=${encodeURIComponent(a.imagem_url || "")}&arte_titulo=${encodeURIComponent(a.titulo)}`}
                            className="flex-1 rounded-md bg-emerald-600/90 px-2 py-1 text-center text-[11px] font-medium text-white hover:bg-emerald-600"
                          >
                            Disparar
                          </Link>
                          {a.imagem_url && (
                            <a
                              href={a.imagem_url}
                              download
                              className="rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/70 hover:text-white"
                              title="Baixar"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => excluir(a)}
                            className="rounded-md border border-white/15 px-2 py-1 text-[11px] text-white/50 hover:border-red-500/50 hover:text-red-400"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>

      {/* ============ LIGHTBOX ============ */}
      {ampliada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setAmpliada(null)}
        >
          <img src={ampliada} alt="Arte ampliada" className="max-h-full max-w-full rounded-lg" />
          <button
            type="button"
            className="absolute right-6 top-4 text-2xl text-white/70 hover:text-white"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
      )}

      {/* ============ MODAL DE CONFIRMAÇÃO (substitui o confirm() nativo) ============ */}
      <Dialog
        open={!!excluirPendente}
        onOpenChange={(open) => {
          if (!open) setExcluirPendente(null);
        }}
      >
        <DialogContent className="border-white/10 bg-[#1a2236] text-white">
          <DialogHeader>
            <DialogTitle>
              {excluirPendente?.tipo === "arte"
                ? "Excluir a arte?"
                : excluirPendente?.tipo === "referencia"
                  ? "Excluir a referência?"
                  : "Excluir o texto?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/70">
            {excluirPendente?.tipo === "arte"
              ? `A arte "${excluirPendente?.item?.titulo}" será apagada da galeria. Não dá para desfazer.`
              : excluirPendente?.tipo === "referencia"
                ? `A imagem "${excluirPendente?.item?.nome}" sai da lista de referências. Não dá para desfazer.`
                : `O texto "${excluirPendente?.item?.texto}" sai do cadastro. Não dá para desfazer.`}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="text-white/70 hover:text-white"
              onClick={() => setExcluirPendente(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmarExclusao}
            >
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
