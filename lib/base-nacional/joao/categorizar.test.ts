// ARQUIVO: lib/base-nacional/joao/categorizar.test.ts
// REGRA: nunca remover. Apenas acrescentar.
import { describe, expect, it } from "vitest";
import { categorizar, type Indicadores } from "./categorizar";
import { lerFiltrosJoao, qsJoao } from "./fila-comercial-filtros";

const base: Indicadores = { empresas: 1, unidadesAtivas: 2, ufs: ["PE"], portes: ["03"], capitalSocial: 500_000, decisoresSocietarios: 1, outrosDecisores: 0, whatsapp: 0, emailCorporativo: 0, telefoneSite: 1, telefoneReceita: 1, emailOutros: 0 };

describe("categorias da fila comercial do João", () => {
  it("A: sócio + WhatsApp ou e-mail corporativo", () => {
    expect(categorizar({ ...base, whatsapp: 1 }).categoria).toBe("A");
    expect(categorizar({ ...base, emailCorporativo: 2 }).categoria).toBe("A");
  });
  it("B: só telefone, sem contato ou sem sócio", () => {
    expect(categorizar(base)).toMatchObject({ categoria: "B" });
    expect(categorizar({ ...base, telefoneSite: 0, telefoneReceita: 0 }).motivo).toMatch(/nenhum contato/);
    expect(categorizar({ ...base, decisoresSocietarios: 0, whatsapp: 3 }).categoria).toBe("B");
  });
  it("C: muitas unidades, vários estados ou capital alto — mesmo com WhatsApp", () => {
    expect(categorizar({ ...base, unidadesAtivas: 8, whatsapp: 1 }).categoria).toBe("C");
    expect(categorizar({ ...base, ufs: ["PE", "PB", "AL"] }).categoria).toBe("C");
    expect(categorizar({ ...base, capitalSocial: 25_000_000 }).categoria).toBe("C");
  });
  it("A deixa claro que o contato é da empresa", () => {
    expect(categorizar({ ...base, whatsapp: 1 }).motivo).toMatch(/não do sócio/);
  });
});

describe("filtros", () => {
  it("lê e recompõe filtros válidos e ignora inválidos", () => {
    const f = lerFiltrosJoao(new URLSearchParams("uf=pe&categoria=a&porte=03&unidadesMin=2&revisao=ADIAR&x=1"));
    expect(f).toMatchObject({ uf: "PE", categoria: "A", porte: "03", unidadesMin: 2, revisao: "ADIAR" });
    expect(lerFiltrosJoao(new URLSearchParams("uf=pernambuco&categoria=z&revisao=QUALQUER"))).toEqual({ uf: undefined, categoria: undefined, porte: undefined, unidadesMin: undefined, unidadesMax: undefined, revisao: undefined, busca: undefined });
    expect(qsJoao({ uf: "PE", categoria: "A" })).toBe("?uf=PE&categoria=A");
  });
});
