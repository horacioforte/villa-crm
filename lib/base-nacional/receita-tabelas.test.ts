import { describe, expect, it } from "vitest";
import { classificarLink, descreverCnae, descreverMudanca, descreverNatureza, descreverPorte, formatarCnae } from "./receita-tabelas";
import { ordenarPorNome } from "./ordenacao";

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
});

describe("ordenação com acentos", () => {
  it("Épsilon fica entre Delta e Gama", () => {
    const r = ordenarPorNome([{ id: "1", razaoSocial: "GAMA" }, { id: "2", razaoSocial: "ÉPSILON" }, { id: "3", razaoSocial: "delta" }, { id: "4", razaoSocial: null }]);
    expect(r.map(x => x.razaoSocial)).toEqual(["delta", "ÉPSILON", "GAMA", null]);
  });
});
