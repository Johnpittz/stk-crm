/**
 * 06/10 — montarPayloadCliente: o formulário fala em nomes de UI, a tabela
 * clientes tem outras colunas. Fixo aqui o mapeamento que a tela Editar usava
 * ERRADO (mandava `nome_completo`, coluna inexistente → PGRST204 e o save
 * nunca passava) e que a tela Novo mandava pela metade (energia/consumo
 * ficavam de fora).
 */
import { describe, it, expect } from "vitest";
import { montarPayloadCliente, type FormularioCliente } from "./montar-payload";

function formBase(): FormularioCliente {
  return {
    nome_razao_social: "",
    tipo: "pj",
    cpf_cnpj: "",
    rg_ie: "",
    data_nascimento: "",
    email: "",
    telefone: "",
    whatsapp: "",
    celular: "",
    nome_contato: "",
    cargo_contato: "",
    cpf_proprietario: "",
    data_nascimento_proprietario: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
    concessionaria: "",
    classe_tarifaria: "",
    subgrupo: "",
    uc_instalacao: "",
    vencimento_fatura: "",
    consumo_meses: {
      jan: "", fev: "", mar: "", abr: "", mai: "", jun: "",
      jul: "", ago: "", set: "", out: "", nov: "", dez: "",
    },
    geracao_propria: false,
    geracao_meses: {
      jan: "", fev: "", mar: "", abr: "", mai: "", jun: "",
      jul: "", ago: "", set: "", out: "", nov: "", dez: "",
    },
    usina: "",
    observacoes: "",
    status: "ativo",
    classificacao: "",
    origem: "",
  };
}

describe("montarPayloadCliente", () => {
  it("mapeia a UI para as colunas REAIS (reprova o bug do nome_completo)", () => {
    const p = montarPayloadCliente({
      ...formBase(),
      nome_razao_social: "Rede ABC Ltda",
      cpf_cnpj: "11222333000181",
      logradouro: "Rua A",
      subgrupo: "B1",
      uc_instalacao: "123456",
      origem: "cadastro",
      tipo: "pj",
    });

    expect(p.nome_razao_social).toBe("Rede ABC Ltda");
    expect(p.cnpj_cpf).toBe("11222333000181");
    expect(p.endereco).toBe("Rua A");
    expect(p.subgrupo_tarifario).toBe("B1");
    expect(p.instalacao).toBe("123456");
    expect(p.origem_lead).toBe("cadastro");
    expect(p.tipo_cliente).toBe("pj");
    // Nomes que NÃO existem na tabela jamais podem aparecer:
    expect(p).not.toHaveProperty("nome_completo");
    expect(p).not.toHaveProperty("cpf_cnpj");
    expect(p).not.toHaveProperty("logradouro");
    // Bandeira saiu do formulário (pedido do João, 06/10):
    expect(p).not.toHaveProperty("bandeira");
  });

  it("leva os 4 campos novos (contato/proprietário) e os dados de energia", () => {
    const f = formBase();
    f.nome_contato = "Ana Souza";
    f.cargo_contato = "Diretora";
    f.cpf_proprietario = "12345678900";
    f.data_nascimento_proprietario = "1980-05-20";
    f.concessionaria = "CERC";
    f.classe_tarifaria = "Comercial";
    f.consumo_meses!.jan = "1500";
    f.geracao_meses!.mar = "900";
    f.geracao_propria = true;

    const p = montarPayloadCliente(f);
    expect(p.nome_contato).toBe("Ana Souza");
    expect(p.cargo_contato).toBe("Diretora");
    expect(p.cpf_proprietario).toBe("12345678900");
    expect(p.data_nascimento_proprietario).toBe("1980-05-20");
    expect(p.concessionaria).toBe("CERC");
    expect(p.classe_tarifaria).toBe("Comercial");
    // coluna NUMERIC — número, não string
    expect(p.consumo_jan).toBe(1500);
    expect(p.geracao_mar).toBe(900);
    expect(p.geracao_propria).toBe(true);
  });

  it("vazio vira null (para conseguir APAGAR um campo no edit)", () => {
    const f = formBase();
    f.email = "";
    f.telefone = "  ";
    f.usina = "";
    const p = montarPayloadCliente(f);
    expect(p.email).toBeNull();
    expect(p.telefone).toBeNull();
    expect(p.usina).toBeNull();
    // booleano nunca é ignorado (apagar é um estado legítimo)
    expect(p.geracao_propria).toBe(false);
  });

  it("usina preenchida vai como texto JSON (coluna TEXT)", () => {
    const f = formBase();
    f.geracao_propria = true;
    f.usina = JSON.stringify({ CRI: "123", usina: "Fazenda Sol", potencia: "75" });
    const p = montarPayloadCliente(f);
    expect(p.usina).toContain("Fazenda Sol");
    expect(p.geracao_propria).toBe(true);
  });
});
