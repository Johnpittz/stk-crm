/**
 * 18/10 — FLUXO ÚNICO DE FATURA (pedido do João).
 *
 * Regra de teste: o que está GRAVADO manda no rótulo do botão, não a
 * memória da tela. Um botão só ("Análise da Fatura"), duas funções:
 *   - nada recebido hoje  ->  "Enviar conta para a IA"
 *   - já recebido hoje    ->  "Analisar conta"  (vira analisada)
 *
 * Sem isso a segunda etapa ficava travada: a tela esquecia que a conta
 * já tinha sido registrada e mostrava sempre o passo 1.
 */
import { describe, expect, it } from "vitest";
import {
  dicaAnalise,
  estadoAnalise,
  temArquivoGuardado,
  linhasDeHoje,
  linhaDoDiaParaRegravar,
  rotuloBotaoAnalise,
  separarColunas,
  deveRegravarLinhaDoDia,
  temRecebidaHoje,
  type LinhaGestao,
} from "./analise-conta";

const HOJE = new Date().toISOString().slice(0, 10);

const recebida = (dia: string) => ({
  id: `l-${dia}-r`,
  dados: { dia, competencia: dia.slice(0, 7), fluxo: "recebida" },
});
const analisada = (dia: string) => ({
  id: `l-${dia}-a`,
  dados: {
    dia,
    competencia: dia.slice(0, 7),
    fluxo: "analise-concluida",
    resumo_analise: { valor: "R$ 4.687,56" },
  },
});

describe("rotuloBotaoAnalise (18/10)", () => {
  it("começa pedindo o envio da conta para a IA", () => {
    expect(rotuloBotaoAnalise({ recebidaHoje: false, analisadaHoje: false })).toBe(
      "Enviar conta para a IA"
    );
  });

  it("vira Analisar conta quando a conta do dia já foi recebida", () => {
    expect(rotuloBotaoAnalise({ recebidaHoje: true, analisadaHoje: false })).toBe(
      "Analisar conta"
    );
  });

  it("fica liberado para outra conta quando a do dia já foi analisada", () => {
    // a coluna "Fatura Recebida" já esvaziou: não sobra card preso
    expect(rotuloBotaoAnalise({ recebidaHoje: false, analisadaHoje: true })).toBe(
      "Enviar conta para a IA"
    );
  });
});

describe("estadoAnalise — o que decide o rótulo vem do banco", () => {
  it("sem linha de hoje, a tela oferece o envio para a IA", () => {
    const e = estadoAnalise([recebida("2026-09-30")]);
    expect(e.recebidaHoje).toBe(false);
    expect(rotuloBotaoAnalise(e)).toBe("Enviar conta para a IA");
  });

  it("com a conta de hoje registrada, oferece Analisar conta", () => {
    const e = estadoAnalise([recebida(HOJE)]);
    expect(e.recebidaHoje).toBe(true);
    expect(rotuloBotaoAnalise(e)).toBe("Analisar conta");
  });

  it("depois da análise, a coluna Recebida esvazia", () => {
    const e = estadoAnalise([analisada(HOJE)]);
    expect(e.recebidaHoje).toBe(false);
    expect(e.analisadaHoje).toBe(true);
    expect(rotuloBotaoAnalise(e)).toBe("Enviar conta para a IA");
  });

  it("linha analisada não volta a contar como recebida", () => {
    const { recebidas } = separarColunas([analisada(HOJE)]);
    expect(recebidas.length).toBe(0);
    expect(temRecebidaHoje([analisada(HOJE)])).toBe(false);
  });

  it("linha de outro dia não libera o Analisar conta de hoje", () => {
    expect(temRecebidaHoje([recebida("2026-09-30")])).toBe(false);
    expect(linhasDeHoje([recebida("2026-09-30")]).length).toBe(0);
  });

  it("duas linhas do mesmo dia: a mais recente decide o rótulo", () => {
    // é o que travava o fluxo: a conta antiga do mês voltava para a
    // coluna errada e a de hoje ficava presa em "Recebida"
    const linhas = [analisada("2026-10-03"), recebida(HOJE)];
    const alvo = linhaDoDiaParaRegravar(linhas);
    expect(alvo?.dados?.fluxo).toBe("recebida");
    expect(rotuloBotaoAnalise(estadoAnalise(linhas))).toBe("Analisar conta");
  });
});

describe("linhaDoDiaParaRegravar — uma conta por dia", () => {
  it("sem linha de hoje, cria nova (nada para regravar)", () => {
    expect(linhaDoDiaParaRegravar([recebida("2026-09-30")])).toBeNull();
    expect(deveRegravarLinhaDoDia([recebida("2026-09-30")])).toBe(false);
  });

  it("com linha de hoje, reutiliza — não nasce um segundo card", () => {
    const l = linhaDoDiaParaRegravar([recebida(HOJE)]);
    expect(l?.dados?.dia).toBe(HOJE);
    expect(deveRegravarLinhaDoDia([recebida(HOJE)])).toBe(true);
  });

  it("linha antiga sem dia (pré-18/10) não bloqueia a de hoje", () => {
    const antiga: LinhaGestao = {
  id: "velha",
  dados: { competencia: "2026-10", fluxo: "recebida" },
};
    const alvo = linhaDoDiaParaRegravar([antiga, recebida(HOJE)]);
    expect(alvo?.dados?.dia).toBe(HOJE);
  });
});

describe("separarColunas — histórico antigo continua visível", () => {
  it("linha sem dia (pré-18/10) ainda aparece na coluna Recebida", () => {
    const antiga: LinhaGestao = {
  id: "velha",
  dados: { competencia: "2026-10", fluxo: "recebida" },
};
    const { recebidas } = separarColunas([antiga]);
    expect(recebidas.length).toBe(1);
  });

  it("separa as duas colunas pelo fluxo", () => {
    const { recebidas, analisadas } = separarColunas([
      recebida(HOJE),
      analisada("2026-09-30"),
    ]);
    expect(recebidas.length).toBe(1);
    expect(analisadas.length).toBe(1);
  });
});

describe("temArquivoGuardado — dá pra reanalisar sem pedir de novo?", () => {
  it("linha com arquivo guardado NÃO precisa de novo upload", () => {
    // é o coração do "reanalisar": o PDF entrou no passo 1 e ficou guardado
    expect(
      temArquivoGuardado({ dia: HOJE, fluxo: "recebida", arquivo: "cli/1-conta.pdf" })
    ).toBe(true);
  });

  it("linha sem arquivo (inserida antes do guardado) precisa do upload", () => {
    expect(temArquivoGuardado({ dia: HOJE, fluxo: "recebida" })).toBe(false);
    expect(temArquivoGuardado({ dia: HOJE, fluxo: "recebida", arquivo: "" })).toBe(false);
    expect(temArquivoGuardado(null)).toBe(false);
  });
});

describe("dicaAnalise — explicação do motivo da falha", () => {
  it("sem arquivo guardado, manda escolher o arquivo de novo (com clareza)", () => {
    const d = dicaAnalise("sem_arquivo_guardado");
    expect(d).toMatch(/escolha o PDF/i);
  });

  it("PDF sem texto selecionável não fala em nitidez", () => {
    const d = dicaAnalise("pdf_sem_texto");
    expect(d).toMatch(/foto\/print/i);
    expect(d).not.toMatch(/n[ií]tid/i);
  });

  it("PDF ilegível sugere reexportar ou foto", () => {
    expect(dicaAnalise("pdf_ilegivel")).toMatch(/exportar|foto/i);
  });

  it("IA vazia diz que tentar de novo costuma resolver", () => {
    expect(dicaAnalise("ia_vazia")).toMatch(/tentar de novo/i);
  });

  it("erro da IA mostra o motivo curto", () => {
    expect(dicaAnalise("ia: rate_limit")).toMatch(/rate_limit/);
  });

  it("sem detalhe não inventa explicação", () => {
    expect(dicaAnalise(null)).toBeNull();
    expect(dicaAnalise(undefined)).toBeNull();
    expect(dicaAnalise("")).toBeNull();
  });
});
