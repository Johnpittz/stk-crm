/**
 * IA identifica oportunidades da CONTA — orquestração.
 *
 * Disparada na conversa (quando a conta aparece): pré-filtro → dedup →
 * MIMO extrai {valor, grupo} → regras no código → cria a OPORTUNIDADE
 * classificada (RECIEE/GD) já vinculada a atendimento/cliente/vendedor.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../ia-provider", () => ({
  chamarModelo: vi.fn(),
  provedorIA: () => "mimo",
  temChaveIA: () => true,
}));

import { chamarModelo } from "../ia-provider";
import { cenario } from "@/lib/testes/supabase-fake";
import { identificarOportunidadeDaConta } from "./identificar-oportunidade";

const chamar = vi.mocked(chamarModelo);

function params(extra: Record<string, unknown> = {}) {
  return {
    supabase: { from: cenario.builder },
    atendimentoId: "at1",
    telefone: "5562999990000",
    nomeCliente: "Padaria Central",
    mensagem: "a conta de luz veio 6.300 reais",
    ...extra,
  };
}

beforeEach(() => {
  cenario.limpar();
  chamar.mockReset();
  cenario.tabelas.atendimentos = [
    {
      id: "at1",
      cliente_id: "c1",
      vendedor_id: "v1",
      nome_cliente: "Padaria Central",
      telefone_cliente: "5562999990000",
      instancia: "STK-3",
    },
  ];
  cenario.tabelas.produtos = [
    { id: "p-gd", nome: "GD", ativo: true },
    { id: "p-reciee", nome: "RECIEE", ativo: true },
  ];

});

describe("identificarOportunidadeDaConta", () => {
  it("mensagem que não fala de conta → ignorado, sem chamar a IA", async () => {
    const r = await identificarOportunidadeDaConta(params({ mensagem: "bom dia, tudo bem?" }));
    expect(r.status).toBe("ignorado");
    expect(chamar).not.toHaveBeenCalled();
    expect(cenario.tabelas.oportunidades).toHaveLength(0);
  });

  it("atendimento que já tem oportunidade → não duplica e não chama a IA", async () => {
    cenario.tabelas.oportunidades.push({ id: "o1", atendimento_id: "at1" });
    const r = await identificarOportunidadeDaConta(params());
    expect(r.status).toBe("ja_existe");
    expect(chamar).not.toHaveBeenCalled();
    expect(cenario.tabelas.oportunidades).toHaveLength(1);
  });

  it("conta acima de 5K → cria oportunidade RECIEE com produto e vínculos", async () => {
    chamar.mockResolvedValue('{"achouConta":true,"valorConta":6300,"grupo":"B"}');
    const r = await identificarOportunidadeDaConta(params());

    expect(r.status).toBe("criada");
    expect(r.tipo).toBe("reciee");
    expect(cenario.tabelas.oportunidades).toHaveLength(1);
    const opp: any = cenario.tabelas.oportunidades[0];
    expect(opp.etapa).toBe("recebeu_conta");
    expect(opp.tipo).toBe("reciee");
    expect(opp.produto_id).toBe("p-reciee");
    expect(opp.atendimento_id).toBe("at1");
    expect(opp.cliente_id).toBe("c1");
    expect(opp.vendedor_id).toBe("v1");
    expect(opp.titulo).toContain("RECIEE");
    expect(opp.titulo).toContain("Padaria Central");
    expect(String(opp.descricao)).toMatch(/5\.000/);
  });

  it("conta do Grupo B até 5K → cria oportunidade GD", async () => {
    chamar.mockResolvedValue('{"achouConta":true,"valorConta":3100,"grupo":"B"}');
    const r = await identificarOportunidadeDaConta(params());

    expect(r.status).toBe("criada");
    expect(r.tipo).toBe("gd");
    const opp: any = cenario.tabelas.oportunidades[0];
    expect(opp.tipo).toBe("gd");
    expect(opp.produto_id).toBe("p-gd");
    expect(opp.titulo).toContain("GD");
  });

  it("conta até 5K e Grupo A → nada criado (só registra o motivo)", async () => {
    chamar.mockResolvedValue('{"achouConta":true,"valorConta":2900,"grupo":"A"}');
    const r = await identificarOportunidadeDaConta(params());

    expect(r.status).toBe("sem_oportunidade");
    expect(cenario.tabelas.oportunidades).toHaveLength(0);
  });

  it("IA fora do ar → status erro, sem lançar e sem criar nada", async () => {
    chamar.mockRejectedValue(new Error("MIMO HTTP 500"));
    const r = await identificarOportunidadeDaConta(params());
    expect(r.status).toBe("erro");
    expect(cenario.tabelas.oportunidades).toHaveLength(0);
  });
});
