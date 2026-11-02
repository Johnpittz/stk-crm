/**
 * Guarda de formulários do STK CRM (22/10, pedido do João):
 *  - ENTER salva em qualquer local de cadastro/inserção (o sistema inteiro,
 *    inclusive Marketing);
 *  - aviso "Você tem alterações não salvas. Deseja sair sem salvar?" antes
 *    de sair da página com dados digitados.
 *
 * As regras de decisão são puras (recebem a "forma" do elemento) para serem
 * testáveis sem navegador.
 */

/** Textos de botão que contam como ação de salvar/criar. */
const REGEX_SALVAR =
  /^(salvar|criar|enviar|gravar|cadastrar|registrar|adicionar|confirmar|publicar|gerar|gerar proposta|enviar disparo|iniciar|começar|enviar mensagem|responder|atualizar|concluir|finalizar|aplicar|adicionar ao funil|novo disparo)/i;

const REGEX_BUSCA = /\b(buscar|pesquisar|filtrar|procurar)\b/i;

const TIPOS_QUE_NAO_DIGITAM = [
  "checkbox", "radio", "button", "submit", "file", "range", "color",
  "image", "reset",
];

export type ElemLike = {
  tagName?: string;
  type?: string;
  placeholder?: string;
  ariaLabel?: string;
  textContent?: string | null;
  isContentEditable?: boolean;
};

/** Campo de busca/filtro: o Enter dele filtra (comportamento nativo), nunca salva. */
export function ehBusca(el: ElemLike): boolean {
  if ((el.type || "").toLowerCase() === "search") return true;
  const rotulo = `${el.placeholder || ""} ${el.ariaLabel || ""}`;
  return REGEX_BUSCA.test(rotulo);
}

/** O Enter neste elemento deve disparar o salvar? */
export function ehEnterSalvavel(el: ElemLike): boolean {
  const tag = (el.tagName || "").toUpperCase();
  if (tag === "TEXTAREA") return false;      // quebra linha (listas do lote etc.)
  if (tag === "BUTTON" || tag === "A") return false;
  if (el.isContentEditable) return false;
  if (tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  if (TIPOS_QUE_NAO_DIGITAM.includes((el.type || "").toLowerCase())) return false;
  if (ehBusca(el)) return false;
  return true;
}

/** Este elemento é um botão de salvar/criar/…? */
export function ehBotaoSalvar(el: ElemLike): boolean {
  const tag = (el.tagName || "").toUpperCase();
  if (tag !== "BUTTON") return false;
  const texto = (el.textContent || "").replace(/\s+/g, " ").trim();
  if (!texto) return false;
  return REGEX_SALVAR.test(texto);
}

/** Este elemento é o fechador (×) de um modal? */
export function ehFechadorDeModal(el: ElemLike): boolean {
  const tag = (el.tagName || "").toUpperCase();
  if (tag !== "BUTTON") return false;
  const rotulo = el.ariaLabel || "";
  if (/\bclose\b|fechar/i.test(rotulo)) return true;
  const texto = (el.textContent || "").trim();
  return texto === "\u00d7" || texto.toLowerCase() === "x";
}

/** Avisa ao fechar modal com dados digitados; devolve true se pode fechar. */
export function podeFecharModal(
  temDadosDigitados: boolean,
  confirmar: (msg: string) => boolean,
  aviso: string,
): boolean {
  if (!temDadosDigitados) return true;
  return confirmar(aviso);
}

/** Acha o botão de salvar dentro de um contêiner (form, card, modal…). */
export function acharBotaoSalvar(
  container: { querySelectorAll: (sel: string) => ArrayLike<ElemLike> },
): ElemLike | null {
  const els = container.querySelectorAll(
    'button, input[type="submit"], [role="button"]',
  );
  for (let i = 0; i < els.length; i++) {
    if (ehBotaoSalvar(els[i])) return els[i];
  }
  return null;
}
