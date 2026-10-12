import { describe, expect, it } from "vitest";
import { COLUNAS_ESTABELECIMENTOS, COLUNAS_EMPRESAS, dividirCnaesSecundarios, dividirLinhaCsv, parseLinhaEmpresa, parseLinhaEstabelecimento } from "./layout";

// Dados FICTÍCIOS de teste: CNPJ com dígito verificador propositalmente inválido
// (89 em vez do DV correto) e razão social claramente marcada "DEMO ... FICTÍCIA".
const RAIZ = "90009001";

function linhaEstabelecimento(partial: Partial<Record<(typeof COLUNAS_ESTABELECIMENTOS)[number], string>>): string {
  const base: Record<(typeof COLUNAS_ESTABELECIMENTOS)[number], string> = {
    cnpjBasico: RAIZ,
    cnpjOrdem: "0001",
    cnpjDv: "89", // DV inválido de propósito — dado fictício de teste
    identificadorMatrizFilial: "1",
    nomeFantasia: "DEMO TESTE FICTÍCIA",
    situacaoCadastral: "02",
    dataSituacaoCadastral: "20200115",
    motivoSituacaoCadastral: "00",
    nomeCidadeExterior: "",
    pais: "",
    dataInicioAtividade: "20150101",
    cnaeFiscalPrincipal: "2330305",
    cnaeFiscalSecundaria: "",
    tipoLogradouro: "RUA",
    logradouro: "DAS DEMONSTRAÇÕES FICTÍCIAS",
    numero: "100",
    complemento: "",
    bairro: "CENTRO",
    cep: "50000000",
    uf: "PE",
    municipio: "2531",
    ddd1: "81",
    telefone1: "00000101",
    ddd2: "",
    telefone2: "",
    dddFax: "",
    fax: "",
    email: "demo@fictícia-teste.invalid",
    situacaoEspecial: "",
    dataSituacaoEspecial: "",
  };
  return COLUNAS_ESTABELECIMENTOS.map(c => `"${{ ...base, ...partial }[c]}"`).join(";");
}

describe("dividirLinhaCsv", () => {
  it("separa campos entre aspas por ponto e vírgula", () => {
    expect(dividirLinhaCsv('"a";"b";"c"')).toEqual(["a", "b", "c"]);
  });
  it("mantém acentos (dado em latin1 já decodificado para string JS)", () => {
    expect(dividirLinhaCsv('"DEMO — CONCRETEIRA FICTÍCIA ÉPSILON";"São João"')).toEqual([
      "DEMO — CONCRETEIRA FICTÍCIA ÉPSILON",
      "São João",
    ]);
  });
  it("aspas duplicadas escapam uma aspa literal dentro do campo", () => {
    expect(dividirLinhaCsv('"RUA ""A"" FICTÍCIA";"100"')).toEqual(['RUA "A" FICTÍCIA', "100"]);
  });
  it("campo vazio entre aspas vira string vazia", () => {
    expect(dividirLinhaCsv('"a";"";"c"')).toEqual(["a", "", "c"]);
  });
});

describe("dividirCnaesSecundarios", () => {
  it("separa lista por vírgula", () => {
    expect(dividirCnaesSecundarios("4930202,4120400")).toEqual(["4930202", "4120400"]);
  });
  it("vazio vira lista vazia", () => {
    expect(dividirCnaesSecundarios("")).toEqual([]);
  });
});

describe("parseLinhaEstabelecimento", () => {
  it("matriz com CNAE alvo como principal", () => {
    const r = parseLinhaEstabelecimento(linhaEstabelecimento({}));
    expect(r).not.toBeNull();
    expect(r!.identificadorMatrizFilial).toBe("1");
    expect(r!.cnaeFiscalPrincipal).toBe("2330305");
    expect(r!.cnpjBasico).toBe(RAIZ);
  });
  it("filial (identificador 2, ordem diferente de 0001)", () => {
    const r = parseLinhaEstabelecimento(linhaEstabelecimento({ cnpjOrdem: "0002", identificadorMatrizFilial: "2" }));
    expect(r!.identificadorMatrizFilial).toBe("2");
    expect(r!.cnpjOrdem).toBe("0002");
  });
  it("CNAE alvo só no secundário (principal é outro)", () => {
    const r = parseLinhaEstabelecimento(
      linhaEstabelecimento({ cnaeFiscalPrincipal: "4930202", cnaeFiscalSecundaria: "2330305,4120400" }),
    );
    expect(r!.cnaeFiscalPrincipal).toBe("4930202");
    expect(dividirCnaesSecundarios(r!.cnaeFiscalSecundaria)).toContain("2330305");
  });
  it("CNAE fora do alvo (nem principal nem secundário)", () => {
    const r = parseLinhaEstabelecimento(linhaEstabelecimento({ cnaeFiscalPrincipal: "4930202", cnaeFiscalSecundaria: "4120400" }));
    expect(dividirCnaesSecundarios(r!.cnaeFiscalSecundaria)).not.toContain("2330305");
  });
  it("acentos e caracteres especiais (latin1 já decodificado) preservados", () => {
    const r = parseLinhaEstabelecimento(
      linhaEstabelecimento({ nomeFantasia: "DEMO — CONCRETEIRA FICTÍCIA ÉPSILON SÃO JOÃO (DEMO)", logradouro: "AV. SÃO JOÃO, S/Nº" }),
    );
    expect(r!.nomeFantasia).toBe("DEMO — CONCRETEIRA FICTÍCIA ÉPSILON SÃO JOÃO (DEMO)");
    expect(r!.logradouro).toBe("AV. SÃO JOÃO, S/Nº");
  });
  it("linha malformada (número de colunas errado) retorna null, não lança", () => {
    expect(parseLinhaEstabelecimento('"muito";"poucas";"colunas"')).toBeNull();
    expect(parseLinhaEstabelecimento("")).toBeNull();
    expect(parseLinhaEstabelecimento("   ")).toBeNull();
  });
});

describe("parseLinhaEmpresa", () => {
  function linhaEmpresa(partial: Partial<Record<(typeof COLUNAS_EMPRESAS)[number], string>>): string {
    const base: Record<(typeof COLUNAS_EMPRESAS)[number], string> = {
      cnpjBasico: RAIZ,
      razaoSocial: "DEMO — CONCRETEIRA FICTÍCIA DE TESTE LTDA",
      naturezaJuridica: "2062",
      qualificacaoResponsavel: "49",
      capitalSocial: "2500000,00",
      porte: "05",
      enteFederativoResponsavel: "",
    };
    return COLUNAS_EMPRESAS.map(c => `"${{ ...base, ...partial }[c]}"`).join(";");
  }
  it("faz o parse dos 7 campos oficiais", () => {
    const r = parseLinhaEmpresa(linhaEmpresa({}));
    expect(r).toMatchObject({ cnpjBasico: RAIZ, naturezaJuridica: "2062", porte: "05", capitalSocial: "2500000,00" });
  });
  it("linha malformada retorna null, não lança", () => {
    expect(parseLinhaEmpresa('"só";"três";"colunas"')).toBeNull();
  });
});
