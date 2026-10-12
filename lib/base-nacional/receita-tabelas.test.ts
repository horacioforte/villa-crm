import { describe, expect, it } from "vitest";
import { classificarLink, descreverCnae, descreverMudanca, descreverNatureza, descreverPorte, formatarCnae } from "./receita-tabelas";
import { ordenarPorNome } from "./ordenacao";
import { nomeMunicipioReceita, municipioCodigoIbge } from "./municipios-receita";

describe("traduções da Receita", () => {
  it("porte com código secundário", () => {
    expect(descreverPorte("05")).toEqual({ texto: "Demais empresas", codigo: "05" });
    expect(descreverPorte("1")).toEqual({ texto: "Microempresa (ME)", codigo: "01" });
    expect(descreverPorte(null).texto).toBe("—");
  });
  it("natureza jurídica aceita 2062 e 206-2", () => {
    expect(descreverNatureza("2062")).toEqual({ texto: "Sociedade empresária limitada", codigo: "206-2" });
    expect(descreverNatureza("206-2 (demo)").texto).toBe("Sociedade empresária limitada");
    expect(descreverNatureza("9999").texto).toBe("Descrição não cadastrada");
  });
  it("CNAE formatado, descrito e destacado quando é concreto usinado", () => {
    expect(formatarCnae("2330305")).toBe("2330-3/05");
    expect(descreverCnae("2330305")).toMatchObject({ formatado: "2330-3/05", concretoUsinado: true, original: "2330305" });
    expect(descreverCnae("4930202").concretoUsinado).toBe(false);
    expect(descreverCnae("0000000").descricao).toBe("Descrição não cadastrada");
  });
  it("links: válido, fictício e indisponível", () => {
    expect(classificarLink("https://www.villaempreendimentos.com.br")).toBe("valido");
    expect(classificarLink("https://exemplo.invalid/demo")).toBe("ficticio");
    expect(classificarLink("javascript:alert(1)")).toBe("indisponivel");
    expect(classificarLink(null)).toBe("indisponivel");
  });
  it("descrição simples de mudanças", () => {
    expect(descreverMudanca({ tipo: "ENDERECO_ALTERADO", campo: "logradouro", valorAnterior: "a", valorNovo: "b" })).toBe("O endereço mudou");
  });
  it("CNAE e natureza fora da tabela curada caem no fallback oficial completo (07/10/2026)", () => {
    // "0111301" não está em CNAE_DESCRICAO (curada), só na tabela RFB completa.
    expect(descreverCnae("0111301").descricao).toBe("Cultivo de arroz");
    // "2100" não está em NATUREZA_JURIDICA (curada), só na tabela RFB completa.
    expect(descreverNatureza("2100").texto).toBe("Sociedade Mercantil de Capital e Indústria");
    // Código inexistente em nenhuma das duas tabelas continua "não cadastrada" (nunca inventa).
    expect(descreverCnae("9999999").descricao).toBe("Descrição não cadastrada");
  });
});

describe("município da Receita Federal (código RFB, não é IBGE)", () => {
  it("traduz código conhecido para o nome", () => {
    expect(nomeMunicipioReceita("2531")).toBe("RECIFE");
    expect(nomeMunicipioReceita("0001")).toBe("GUAJARA-MIRIM");
  });
  it("aceita código sem zeros à esquerda", () => {
    expect(nomeMunicipioReceita("1")).toBe("GUAJARA-MIRIM");
  });
  it("código desconhecido ou vazio retorna null", () => {
    expect(nomeMunicipioReceita("9999")).toBeNull();
    expect(nomeMunicipioReceita(null)).toBeNull();
  });
  it("correspondência para IBGE é pendência registrada — sempre null por ora", () => {
    expect(municipioCodigoIbge("2531", "PE")).toBeNull();
  });
});

describe("ordenação com acentos", () => {
  it("Épsilon fica entre Delta e Gama", () => {
    const r = ordenarPorNome([{ id: "1", razaoSocial: "GAMA" }, { id: "2", razaoSocial: "ÉPSILON" }, { id: "3", razaoSocial: "delta" }, { id: "4", razaoSocial: null }]);
    expect(r.map(x => x.razaoSocial)).toEqual(["delta", "ÉPSILON", "GAMA", null]);
  });
});
