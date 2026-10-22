import { describe, expect, it } from "vitest";
import { encontrarEmpresaExistente, normalizarNomeEmpresa, somenteDigitos } from "./encontrar-existente";

function clienteFake(empresas: { id: string; razaoSocial: string; cnpj: string | null }[]) {
  return { empresa: { findMany: async () => empresas } };
}

describe("somenteDigitos", () => {
  it("remove tudo que não é número", () => {
    expect(somenteDigitos("33.000.167/0001-01")).toBe("33000167000101");
  });
});

describe("normalizarNomeEmpresa", () => {
  it("remove acento, sufixo societário e maiusculiza", () => {
    expect(normalizarNomeEmpresa("Petróleo Brasileiro S.A.")).toBe("PETROBRAS");
    expect(normalizarNomeEmpresa("Petrobras LTDA")).toBe("PETROBRAS");
  });
  it("ignora conteúdo entre parênteses", () => {
    expect(normalizarNomeEmpresa("Petrobras (RNEST)")).toBe("PETROBRAS");
  });
});

describe("encontrarEmpresaExistente — caso real RNEST/Petrobras", () => {
  const empresas = [
    { id: "emp-1", razaoSocial: "Petróleo Brasileiro S.A.", cnpj: "33.000.167/0001-01" },
    { id: "emp-2", razaoSocial: "Petrobras (RNEST)", cnpj: "33000167000101" }, // mesmo CNPJ, formatação diferente
    { id: "emp-3", razaoSocial: "Petrobras Distribuidora", cnpj: "34.274.233/0001-02" },
  ];

  it("acha por CNPJ mesmo com formatação diferente", async () => {
    const achada = await encontrarEmpresaExistente({ cnpj: "33000167000101" }, clienteFake(empresas));
    expect(achada).toMatchObject({ id: "emp-1", motivoMatch: "cnpj" });
  });

  it("acha por nome normalizado quando não há CNPJ", async () => {
    const achada = await encontrarEmpresaExistente({ nome: "Petrobras (RNEST Refinaria)" }, clienteFake(empresas));
    expect(achada).toMatchObject({ motivoMatch: "nome" });
    expect(["emp-1", "emp-2"]).toContain(achada?.id);
  });

  it("não confunde Petrobras Distribuidora (CNPJ e nome diferentes) com a Petrobras principal", async () => {
    const achada = await encontrarEmpresaExistente({ cnpj: "11111111000199", nome: "Empresa Nova Qualquer" }, clienteFake(empresas));
    expect(achada).toBeNull();
  });

  it("sem cnpj nem nome, devolve null sem consultar nada", async () => {
    const achada = await encontrarEmpresaExistente({}, clienteFake(empresas));
    expect(achada).toBeNull();
  });
});
