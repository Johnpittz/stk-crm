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
import { identificarOportunidadeDaConta } from './identificar-oportunidade'
import { analisarMidiaComIA } from './classificar-conta'

// Mock PARCIAL: mantém as funções puras reais (regras/pré-filtro) e só
// substitui o analisador de mídia (foto/PDF) — o texto segue via chamarModelo.
vi.mock('./classificar-conta', async (orig) => ({
  ...((await orig()) as object),
  analisarMidiaComIA: vi.fn(),
}))

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

  /* ── V2 (06/10): conta que chega como FOTO ou PDF ── */

  describe("mídia do cliente", () => {
    beforeEach(() => {
      vi.mocked(analisarMidiaComIA).mockReset()
      cenario.tabelas.oportunidades = []
      cenario.tabelas.atendimentos = [{
        id: "at1", cliente_id: "c1", vendedor_id: "v1", nome_cliente: "Padaria Central",
        canal: "whatsapp", status: "aberto", telefone_cliente: "6282735286",
        created_at: "2026-10-06T12:00:00Z",
      }]
      cenario.tabelas.produtos = [
        { id: "p-gd", nome: "GD", ativo: true, tipo: "servico", created_at: "2026-10-01T10:00:00Z" },
        { id: "p-reciee", nome: "RECIEE", ativo: true, tipo: "servico", created_at: "2026-10-01T10:00:00Z" },
      ]
    })

    it("imagem sem palavra de conta na legenda → analisa a FOTO e cria RECIEE", async () => {
      vi.mocked(analisarMidiaComIA).mockResolvedValue({ achouConta: true, valorConta: 6200, grupo: null })
      const r = await identificarOportunidadeDaConta({
        supabase: { from: cenario.builder },
        atendimentoId: "at1",
        telefone: "6282735286",
        nomeCliente: "Padaria Central",
        mensagem: "[image]",
        midia: { url: "https://x/media/conta.png", tipo: "image" },
      })
      expect(r.status).toBe("criada")
      expect(r.tipo).toBe("reciee")
      expect(analisarMidiaComIA).toHaveBeenCalledTimes(1)
      const arg = (analisarMidiaComIA as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(arg.url).toBe("https://x/media/conta.png")
      expect(arg.tipo).toBe("image")
      const criada = cenario.tabelas.oportunidades.find((o: any) => o.atendimento_id === "at1")
      expect(criada?.etapa).toBe("recebeu_conta")
      expect(criada?.produto_id).toBe("p-reciee")
    })

    it("PDF com legenda → caminho de arquivo e cria GD (Grupo B até 5K)", async () => {
      vi.mocked(analisarMidiaComIA).mockResolvedValue({ achouConta: true, valorConta: 3000, grupo: "B" })
      const r = await identificarOportunidadeDaConta({
        supabase: { from: cenario.builder },
        atendimentoId: "at1",
        telefone: "6282735286",
        mensagem: "[document]",
        midia: { url: "https://x/media/fatura.pdf", tipo: "document", legenda: "fatura de julho" },
      })
      expect(r.status).toBe("criada")
      expect(r.tipo).toBe("gd")
      const arg = (analisarMidiaComIA as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(arg.legenda).toBe("fatura de julho")
      expect(cenario.tabelas.oportunidades[0].produto_id).toBe("p-gd")
    })

    it("áudio/vídeo não é conta → ignorado sem chamar IA", async () => {
      const r = await identificarOportunidadeDaConta({
        supabase: { from: cenario.builder },
        atendimentoId: "at1",
        telefone: "6282735286",
        mensagem: "[audio]",
        midia: { url: "https://x/media/a.ogg", tipo: "audio" },
      })
      expect(r.status).toBe("ignorado")
      expect(analisarMidiaComIA).not.toHaveBeenCalled()
    })
  })

  it("IA fora do ar → status erro, sem lançar e sem criar nada", async () => {
    chamar.mockRejectedValue(new Error("MIMO HTTP 500"));
    const r = await identificarOportunidadeDaConta(params());
    expect(r.status).toBe("erro");
    expect(cenario.tabelas.oportunidades).toHaveLength(0);
  });
});
