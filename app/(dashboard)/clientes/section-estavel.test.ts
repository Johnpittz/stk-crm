/**
 * REGRESSÃO — bug do cursor (João, 16/10): o `Section` (cartão do
 * formulário) estava declarado DENTRO da página. Como cada render cria
 * uma função nova, o React tratava como componente diferente e
 * DESMONTAVA o campo a cada tecla — o cursor sumia e era preciso
 * clicar de novo. Componente auxiliar tem que ficar no escopo do
 * módulo.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ARQUIVOS = [
  "app/(dashboard)/clientes/novo/page.tsx",
  "app/(dashboard)/clientes/[clienteId]/editar/page.tsx",
];

describe("Section fora do componente (cursor não pode sumir)", () => {
  for (const arquivo of ARQUIVOS) {
    it(`${arquivo}: Section declarada antes do componente da página`, () => {
      const src = readFileSync(join(process.cwd(), arquivo), "utf8");
      const posSection = src.indexOf("const Section = ({");
      const posExport = src.indexOf("export default function");
      expect(posSection).toBeGreaterThan(-1);
      expect(posExport).toBeGreaterThan(-1);
      // A definição precisa vir ANTES do componente (escopo do módulo)
      expect(posSection).toBeLessThan(posExport);
    });
  }
});
