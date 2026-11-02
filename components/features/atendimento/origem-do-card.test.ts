import { describe, it, expect } from "vitest";
import { origemDoCard } from "@/components/features/atendimento/kanban-oportunidades";

/**
 * 22/10 — pedido do João: o card do Kanban tem que mostrar a ORIGEM.
 * Regra: usa a da própria oportunidade; sem origem própria, cai na
 * origem do CADASTRO do cliente vinculado (origem_tipo).
 */
describe("origemDoCard — origem mostrada no card do Kanban", () => {
  it("usa a origem da própria oportunidade quando existe", () => {
    expect(
      origemDoCard({ origem_lead: "whatsapp", clientes: { origem_tipo: "vendedor" } })
    ).toBe("whatsapp");
  });

  it("cai na origem do CLIENTE quando a oportunidade não tem", () => {
    expect(
      origemDoCard({ origem_lead: null, clientes: { origem_tipo: "vendedor" } })
    ).toBe("vendedor");
  });

  it("aceita os tipos da origem nova (parceiro/marketing)", () => {
    expect(origemDoCard({ origem_lead: null, clientes: { origem_tipo: "parceiro" } })).toBe("parceiro");
    expect(origemDoCard({ origem_lead: "marketing", clientes: null })).toBe("marketing");
  });

  it("ignora origem própria desconhecida e usa a do cliente", () => {
    expect(
      origemDoCard({ origem_lead: "qualquer_coisa", clientes: { origem_tipo: "vendedor" } })
    ).toBe("vendedor");
  });

  it("sem nenhuma origem válida devolve null (sem badge)", () => {
    expect(origemDoCard({ origem_lead: null, clientes: null })).toBeNull();
    expect(origemDoCard({ origem_lead: "", clientes: { origem_tipo: null } })).toBeNull();
  });

  it("cliente sem vínculo não quebra", () => {
    expect(origemDoCard({ origem_lead: "site", clientes: null })).toBe("site");
  });
});
