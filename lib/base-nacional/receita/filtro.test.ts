import { describe, expect, it } from "vitest";
import { cnaeAlvoComoPrincipal, estabelecimentoNoFiltro } from "./filtro";

describe("estabelecimentoNoFiltro", () => {
  it("entra quando o CNAE alvo é o principal", () => {
    expect(estabelecimentoNoFiltro("2330305", [])).toBe(true);
  });
  it("entra quando o CNAE alvo está só no secundário", () => {
    expect(estabelecimentoNoFiltro("4930202", ["4120400", "2330305"])).toBe(true);
  });
  it("não entra quando o CNAE alvo não aparece em nenhum dos dois", () => {
    expect(estabelecimentoNoFiltro("4930202", ["4120400"])).toBe(false);
  });
  it("lista de alvos é configurável", () => {
    const alvoCustom = new Set(["4930202"]);
    expect(estabelecimentoNoFiltro("4930202", [], alvoCustom)).toBe(true);
    expect(estabelecimentoNoFiltro("2330305", [], alvoCustom)).toBe(false);
  });
});

describe("cnaeAlvoComoPrincipal", () => {
  it("true quando o alvo é o CNAE principal deste estabelecimento", () => {
    expect(cnaeAlvoComoPrincipal("2330305")).toBe(true);
  });
  it("false quando o principal é outro (ainda que o alvo apareça como secundário em outro lugar)", () => {
    expect(cnaeAlvoComoPrincipal("4930202")).toBe(false);
  });
});
