import { describe, expect, it } from "vitest";
import { cnpjValido, ehMatriz, formatarCnpj, normalizarCnpj, normalizarNomeEmpresa, partesCnpj, raizCnpj } from "./cnpj";

describe("base-nacional/cnpj", () => {
  it("normaliza formatos diferentes para 14 dígitos", () => {
    expect(normalizarCnpj("33.000.167/0001-01")).toBe("33000167000101");
    expect(normalizarCnpj("33000167000101")).toBe("33000167000101");
    expect(normalizarCnpj(" 33 000 167 0001 01 ")).toBe("33000167000101");
    expect(normalizarCnpj("123")).toBeNull();
    expect(normalizarCnpj(null)).toBeNull();
  });

  it("valida dígitos verificadores", () => {
    expect(cnpjValido("33.000.167/0001-01")).toBe(true);
    expect(cnpjValido("33.000.167/0001-02")).toBe(false);
    expect(cnpjValido("11111111111111")).toBe(false);
  });

  it("matriz e filial compartilham a raiz", () => {
    expect(raizCnpj("33.000.167/0001-01")).toBe("33000167");
    expect(raizCnpj("33000167000292")).toBe("33000167");
    expect(ehMatriz("33000167000101")).toBe(true);
    expect(ehMatriz("33000167000292")).toBe(false);
  });

  it("decompõe e formata", () => {
    expect(partesCnpj("33.000.167/0001-01")).toEqual({ cnpj: "33000167000101", cnpjBasico: "33000167", cnpjOrdem: "0001", cnpjDv: "01" });
    expect(formatarCnpj("33000167000101")).toBe("33.000.167/0001-01");
  });

  it("normaliza nomes para sugestão de correspondência", () => {
    expect(normalizarNomeEmpresa("Unità Engenharia Ltda")).toBe(normalizarNomeEmpresa("Unitá Engenharia LTDA."));
    expect(normalizarNomeEmpresa("Polimix Concreto -  SP -ZSP")).toBe("polimix concreto sp zsp");
  });
});
