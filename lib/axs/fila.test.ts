/**
 * Fase 3 / C3 — contrato puro da fila de propostas AXS.
 * (TDD: escritos antes de mexer no form e na rota.)
 */
import { describe, it, expect } from "vitest";
import {
  STATUS_FILA,
  ROTULO_STATUS,
  COR_STATUS,
  ETAPA_RETROALIMENTO,
  montarDadosProposta,
  validarPayloadProposta,
  podeAvancarEtapa,
  type FormProposta,
} from "./fila";

const FORM: FormProposta = {
  tipo_imovel: "casa",
  tipo_pessoa: "pf",
  cpf_cnpj: "123.456.789-00",
  nome_razao_social: "  João da Silva  ",
  data_nascimento: "01/02/1990",
  email: " joao@ex.com ",
  telefone: "(62) 3333-4444",
  whatsapp: " (62) 99999-8888 ",
  cep: "74000-000",
  logradouro: " Rua A ",
  numero: " 10 ",
  complemento: " quadra 2 ",
  bairro: " Centro ",
  cidade: " Goiânia ",
  estado: "go",
  classe: "Residencial",
  subgrupo: "B1",
  uc_instalacao: " 123456 ",
  vencimento_dia: "10",
  concessionaria: "CEMIG",
  consumo_meses: { jan: "300", fev: "280" },
  geracao_propria: true,
  geracao_meses: { jan: "0" },
  observacoes: " cliente atencioso ",
};

describe("montarDadosProposta", () => {
  it("normaliza CPF/CEP para dígitos e apara os textos", () => {
    const p = montarDadosProposta(FORM);

    expect(p.cpf_cnpj).toBe("12345678900");
    expect(p.cep).toBe("74000000");
    expect(p.nome).toBe("João da Silva");
    expect(p.email).toBe("joao@ex.com");
    expect(p.logradouro).toBe("Rua A");
    expect(p.uc_instalacao).toBe("123456");
    expect(p.estado).toBe("GO");
    expect(p.observacoes).toBe("cliente atencioso");
  });

  it("mantém listas e o mapa de consumo intactos", () => {
    const p = montarDadosProposta(FORM);
    expect(p.consumo_meses).toEqual({ jan: "300", fev: "280" });
    expect(p.geracao_meses).toEqual({ jan: "0" });
    expect(p.geracao_propria).toBe(true);
    expect(p.tipo_imovel).toBe("casa");
    expect(p.concessionaria).toBe("CEMIG");
  });

  it("tolera campos nulos (cliente importado com colunas vazias)", () => {
    const p = montarDadosProposta({
      ...FORM,
      nome_razao_social: null as any,
      cpf_cnpj: null as any,
      cep: null as any,
      email: null as any,
    });
    expect(p.nome).toBe("");
    expect(p.cpf_cnpj).toBe("");
    expect(p.cep).toBe("");
    expect(p.email).toBe("");
  });
});

describe("validarPayloadProposta", () => {
  it("aceita um payload completo", () => {
    expect(validarPayloadProposta(montarDadosProposta(FORM))).toEqual([]);
  });

  it("recusa payload vazio com todos os erros principais", () => {
    const erros = validarPayloadProposta({});
    expect(erros.join(" | ")).toContain("Nome");
    expect(erros.join(" | ")).toContain("CPF");
    expect(erros.join(" | ")).toContain("telefone");
    expect(erros.join(" | ")).toContain("CEP");
    expect(erros.join(" | ")).toContain("Cidade");
    expect(erros.join(" | ")).toContain("UC de instalação");
  });

  it("exige CNPJ de 14 dígitos quando é pessoa jurídica", () => {
    const p = montarDadosProposta({ ...FORM, tipo_pessoa: "pj", cpf_cnpj: "12.345.678/0001-9" });
    expect(validarPayloadProposta(p).join(" ")).toContain("CNPJ");
  });

  it("exige telefone ou WhatsApp (não os dois)", () => {
    const semFone = montarDadosProposta({ ...FORM, telefone: "", whatsapp: "" });
    expect(validarPayloadProposta(semFone).join(" ")).toContain("telefone");

    const sóWhats = montarDadosProposta({ ...FORM, telefone: "", whatsapp: "(62) 99999-8888" });
    expect(validarPayloadProposta(sóWhats)).toEqual([]);
  });

  it("rejeita CEP incompleto, UF inválida, tipo de imóvel e classe fora da lista", () => {
    const base = montarDadosProposta(FORM);

    expect(validarPayloadProposta({ ...base, cep: "74000" }).join(" ")).toContain("CEP");
    expect(validarPayloadProposta({ ...base, estado: "Goiás" }).join(" ")).toContain("Estado");
    expect(validarPayloadProposta({ ...base, tipo_imovel: "navio" }).join(" ")).toContain("imóvel");
    expect(validarPayloadProposta({ ...base, classe: "Agronegócio" }).join(" ")).toContain("Classe");
    expect(validarPayloadProposta({ ...base, uc_instalacao: "  " }).join(" ")).toContain("UC");
  });

  it("não explode com payload malformado", () => {
    expect(validarPayloadProposta(null).length).toBeGreaterThan(0);
    expect(validarPayloadProposta("texto").length).toBeGreaterThan(0);
    expect(validarPayloadProposta(42).length).toBeGreaterThan(0);
  });
});

describe("retroalimentação do funil", () => {
  it("avança apenas de etapas anteriores para proposta_feita", () => {
    expect(ETAPA_RETROALIMENTO).toBe("proposta_feita");
    expect(podeAvancarEtapa("recebeu_conta")).toBe(true);
    expect(podeAvancarEtapa("proposta_a_fazer")).toBe(true);
  });

  it("nunca regressa uma oportunidade que já passou da proposta", () => {
    expect(podeAvancarEtapa("proposta_apresentada")).toBe(false);
    expect(podeAvancarEtapa("contrato_enviado")).toBe(false);
    expect(podeAvancarEtapa("comissao_paga")).toBe(false);
    expect(podeAvancarEtapa(null)).toBe(false);
    expect(podeAvancarEtapa(undefined)).toBe(false);
    expect(podeAvancarEtapa("")).toBe(false);
  });
});

describe("rótulos da tela da fila", () => {
  it("todo status tem rótulo e cor (a tela não pode quebrar com status novo)", () => {
    for (const s of STATUS_FILA) {
      expect(ROTULO_STATUS[s]).toBeTruthy();
      expect(COR_STATUS[s]).toBeTruthy();
    }
  });
});
