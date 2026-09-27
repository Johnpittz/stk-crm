/**
 * Fase 6 / C4 de docs/plano-acao-modulos.md — dados do documento de proposta.
 *
 * "Hoje não existe 'proposta' como entidade, só a oportunidade": este módulo
 * monta o dado a partir das três fontes que existem hoje (payload da fila AXS,
 * cadastro do cliente e oportunidade) e valida o que é OBRIGATÓRIO para o PDF
 * nascer.
 */
import { describe, it, expect } from "vitest";
import {
  montarDadosDocumento,
  validarDadosDocumento,
  numeroProposta,
  consumoMedioKwh,
  mascaraDocumento,
  VALIDADE_DIAS,
} from "./documento";

const AGORA = new Date("2026-09-27T12:00:00.000Z");

const CLIENTE = {
  id: "cli-1",
  nome_razao_social: "João da Silva",
  cnpj_cpf: "12345678900",
  telefone: "(62) 3333-4444",
  email: "joao@email.com",
  endereco: "Rua das Flores",
  numero: "10",
  complemento: "Casa",
  bairro: "Setor Central",
  cep: "74000000",
  cidade: "Goiânia",
  estado: "go",
  concessionaria: "CEMIG",
  instalacao: "99887766",
  classe_tarifaria: "Residencial",
  subgrupo_tarifario: "B1",
  vencimento_fatura: 10,
  consumo_jan: 300,
  consumo_fev: 330,
  consumo_mar: 0,
  consumo_abr: 0,
  consumo_mai: 0,
  consumo_jun: 0,
  consumo_jul: 0,
  consumo_ago: 0,
  consumo_set: 0,
  consumo_out: 0,
  consumo_nov: 0,
  consumo_dez: 0,
  geracao_jan: 0,
  geracao_fev: 0,
};

const OPORTUNIDADE = {
  id: "opp-1",
  cliente_id: "cli-1",
  titulo: "GD — João da Silva",
  etapa: "proposta_feita",
  cliente_nome: "João da Silva",
  uc: "11223344",
  consumo_kwh: 400,
  concessionaria: "CEMIG",
  valor_proposta: 1500,
  valor_venda: 1700,
};

describe("montarDadosDocumento", () => {
  it("monta a proposta com o cadastro do cliente e os valores da oportunidade", () => {
    const dados = montarDadosDocumento({
      cliente: CLIENTE,
      oportunidade: OPORTUNIDADE,
      payload: null,
      agora: AGORA,
    });

    expect(dados.contratante.nome).toBe("João da Silva");
    expect(dados.contratante.documento).toBe("12345678900");
    expect(dados.endereco.logradouro).toBe("Rua das Flores");
    expect(dados.endereco.numero).toBe("10");
    expect(dados.endereco.cidade).toBe("Goiânia");
    expect(dados.endereco.estado).toBe("GO");
    expect(dados.uc.instalacao).toBe("99887766");
    expect(dados.uc.concessionaria).toBe("CEMIG");
    expect(dados.comercial.valor_proposta).toBe(1500);
    expect(dados.comercial.valor_venda).toBe(1700);
    expect(dados.titulo).toBe("GD — João da Silva");
    expect(dados.cliente_id).toBe("cli-1");
    expect(dados.oportunidade_id).toBe("opp-1");
  });

  it("o payload da fila AXS tem prioridade sobre o cadastro do cliente", () => {
    const dados = montarDadosDocumento({
      cliente: CLIENTE,
      oportunidade: OPORTUNIDADE,
      payload: {
        nome: "Maria Souza ME",
        cpf_cnpj: "11222333000181",
        logradouro: "Av. Independência",
        numero: "500",
        complemento: "",
        bairro: "Jardim",
        cep: "74100000",
        cidade: "Aparecida de Goiânia",
        estado: "go",
        uc_instalacao: "55667788",
        concessionaria: "COPEL",
        classe: "Comercial",
        subgrupo: "B3",
        vencimento_dia: "20",
        consumo_meses: { "1": "1000", "2": "1000" },
        telefone: "(62) 99999-0000",
        email: "maria@me.com",
        observacoes: "Cliente pediu instalação em telhado.",
      },
      agora: AGORA,
    });

    expect(dados.contratante.nome).toBe("Maria Souza ME");
    expect(dados.contratante.documento).toBe("11222333000181");
    expect(dados.endereco.logradouro).toBe("Av. Independência");
    expect(dados.endereco.numero).toBe("500");
    expect(dados.endereco.estado).toBe("GO");
    expect(dados.uc.instalacao).toBe("55667788");
    expect(dados.uc.concessionaria).toBe("COPEL");
    expect(dados.uc.classe).toBe("Comercial");
    expect(dados.uc.subgrupo).toBe("B3");
    expect(dados.uc.vencimento_dia).toBe(20);
    expect(dados.uc.consumo_medio_kwh).toBe(1000);
    expect(dados.contratante.telefone).toBe("(62) 99999-0000");
    expect(dados.contratante.email).toBe("maria@me.com");
    expect(dados.observacoes).toBe("Cliente pediu instalação em telhado.");
    // valores continuam vindo da oportunidade
    expect(dados.comercial.valor_proposta).toBe(1500);
  });

  it("usa a UC da oportunidade quando nem cliente nem payload têm", () => {
    const dados = montarDadosDocumento({
      cliente: { ...CLIENTE, instalacao: null },
      oportunidade: { ...OPORTUNIDADE, uc: "77889900" },
      payload: null,
      agora: AGORA,
    });
    expect(dados.uc.instalacao).toBe("77889900");
  });

  it("data de emissão e validade seguem o dia injetado (emissão + validade)", () => {
    const dados = montarDadosDocumento({
      cliente: CLIENTE,
      oportunidade: OPORTUNIDADE,
      payload: null,
      agora: AGORA,
    });
    expect(dados.data_emissao).toBe("2026-09-27");
    expect(dados.validade).toBe("2026-10-27");
    expect(VALIDADE_DIAS).toBe(30);
  });

  it("deriva geração própria do cadastro quando não há payload", () => {
    const dados = montarDadosDocumento({
      cliente: { ...CLIENTE, geracao_jan: 150 },
      oportunidade: OPORTUNIDADE,
      payload: null,
      agora: AGORA,
    });
    expect(dados.uc.geracao_propria).toBe(true);

    const semGeracao = montarDadosDocumento({
      cliente: CLIENTE,
      oportunidade: OPORTUNIDADE,
      payload: null,
      agora: AGORA,
    });
    expect(semGeracao.uc.geracao_propria).toBe(false);
  });

  it("não quebra quando não há cliente nem oportunidade (só o id)", () => {
    const dados = montarDadosDocumento({
      cliente: null,
      oportunidade: null,
      payload: null,
      agora: AGORA,
    });
    expect(dados.contratante.nome).toBe("");
    expect(dados.comercial.valor_proposta).toBeNull();
    expect(validarDadosDocumento(dados).length).toBeGreaterThan(0);
  });
});

describe("numeroProposta", () => {
  it("seguia o formato PROP-AAAAMMDD-XXXX e é estável para a mesma oportunidade no mesmo dia", () => {
    const numero = numeroProposta("opp-1", AGORA);
    expect(numero).toMatch(/^PROP-20260927-[0-9A-Z]{4}$/);
    expect(numeroProposta("opp-1", AGORA)).toBe(numero);
  });

  it("muda quando a oportunidade muda", () => {
    expect(numeroProposta("opp-2", AGORA)).not.toBe(numeroProposta("opp-1", AGORA));
  });

  it("muda de código quando muda o dia da emissão", () => {
    const outroDia = new Date("2026-09-28T12:00:00.000Z");
    expect(numeroProposta("opp-1", outroDia)).toMatch(/^PROP-20260928-/);
    expect(numeroProposta("opp-1", outroDia)).not.toBe(numeroProposta("opp-1", AGORA));
  });
});

describe("consumoMedioKwh", () => {
  it("usa a média dos meses preenchidos do cadastro do cliente", () => {
    expect(consumoMedioKwh({ payload: null, cliente: CLIENTE, oportunidade: null })).toBe(315);
  });

  it("prefere a média do payload da fila quando existe", () => {
    const media = consumoMedioKwh({
      payload: { consumo_meses: { "1": "800", "2": "1200", "3": "0" } },
      cliente: CLIENTE,
      oportunidade: null,
    });
    expect(media).toBe(1000);
  });

  it("cai para o valor da oportunidade quando as outras fontes não têm", () => {
    expect(
      consumoMedioKwh({
        payload: null,
        cliente: { consumo_jan: 0, consumo_fev: 0 },
        oportunidade: { consumo_kwh: 400 },
      })
    ).toBe(400);
  });

  it("devolve null quando ninguém informou consumo", () => {
    expect(
      consumoMedioKwh({
        payload: null,
        cliente: { consumo_jan: 0, consumo_fev: 0 },
        oportunidade: { consumo_kwh: null },
      })
    ).toBeNull();
  });
});

describe("mascaraDocumento", () => {
  it("formata CPF e CNPJ", () => {
    expect(mascaraDocumento("12345678900")).toBe("123.456.789-00");
    expect(mascaraDocumento("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("devolve o valor original quando não é CPF/CNPJ", () => {
    expect(mascaraDocumento("123")).toBe("123");
    expect(mascaraDocumento("")).toBe("");
    expect(mascaraDocumento(null)).toBe("");
  });
});

describe("validarDadosDocumento", () => {
  it("aceita a proposta montada com fontes completas", () => {
    const dados = montarDadosDocumento({
      cliente: CLIENTE,
      oportunidade: OPORTUNIDADE,
      payload: null,
      agora: AGORA,
    });
    expect(validarDadosDocumento(dados)).toEqual([]);
  });

  it("lista o que falta quando o cadastro está vazio", () => {
    const dados = montarDadosDocumento({
      cliente: null,
      oportunidade: null,
      payload: null,
      agora: AGORA,
    });
    const erros = validarDadosDocumento(dados);
    expect(erros.join(" | ")).toMatch(/nome/i);
    expect(erros.join(" | ")).toMatch(/CPF\/CNPJ/);
    expect(erros.join(" | ")).toMatch(/endereço/i);
    expect(erros.join(" | ")).toMatch(/cidade/i);
    expect(erros.join(" | ")).toMatch(/\bUC\b/);
    expect(erros.join(" | ")).toMatch(/concessionária/i);
    expect(erros.join(" | ")).toMatch(/valor/i);
  });

  it("exige logradouro E número, e UF de 2 letras", () => {
    const semNumero = montarDadosDocumento({
      cliente: { ...CLIENTE, numero: null },
      oportunidade: OPORTUNIDADE,
      payload: null,
      agora: AGORA,
    });
    expect(validarDadosDocumento(semNumero).join(" ")).toMatch(/número/i);

    const semLogradouro = montarDadosDocumento({
      cliente: { ...CLIENTE, endereco: null },
      oportunidade: OPORTUNIDADE,
      payload: null,
      agora: AGORA,
    });
    expect(validarDadosDocumento(semLogradouro).join(" ")).toMatch(/endereço/i);

    const ufInvalida = montarDadosDocumento({
      cliente: { ...CLIENTE, estado: "Goiás" },
      oportunidade: OPORTUNIDADE,
      payload: null,
      agora: AGORA,
    });
    expect(validarDadosDocumento(ufInvalida).join(" ")).toMatch(/estado/i);
  });

  it("exige documento com 11 ou 14 dígitos", () => {
    const curto = montarDadosDocumento({
      cliente: { ...CLIENTE, cnpj_cpf: "123" },
      oportunidade: OPORTUNIDADE,
      payload: null,
      agora: AGORA,
    });
    expect(validarDadosDocumento(curto).join(" ")).toMatch(/CPF\/CNPJ/);
  });

  it("exige ao menos um valor comercial (proposta ou venda)", () => {
    const semValor = montarDadosDocumento({
      cliente: CLIENTE,
      oportunidade: { ...OPORTUNIDADE, valor_proposta: null, valor_venda: null },
      payload: null,
      agora: AGORA,
    });
    expect(validarDadosDocumento(semValor).join(" ")).toMatch(/valor/i);

    const soVenda = montarDadosDocumento({
      cliente: CLIENTE,
      oportunidade: { ...OPORTUNIDADE, valor_proposta: null, valor_venda: 1700 },
      payload: null,
      agora: AGORA,
    });
    expect(validarDadosDocumento(soVenda)).toEqual([]);
  });

  it("não exige os campos opcionais (CEP, e-mail, telefone, consumo)", () => {
    const dados = montarDadosDocumento({
      cliente: {
        ...CLIENTE,
        cep: null,
        email: null,
        telefone: null,
        consumo_jan: 0,
        consumo_fev: 0,
        vencimento_fatura: null,
      },
      oportunidade: { ...OPORTUNIDADE, consumo_kwh: null },
      payload: null,
      agora: AGORA,
    });
    expect(validarDadosDocumento(dados)).toEqual([]);
  });
});
