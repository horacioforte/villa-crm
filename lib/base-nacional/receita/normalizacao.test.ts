import { describe, expect, it } from "vitest";
import {
  capitalSocialParaNumero,
  cnpjCompleto,
  dataReceitaParaDate,
  ehMatrizReceita,
  emailReceitaNormalizado,
  hashRegistroEstabelecimento,
  telefoneReceitaNormalizado,
} from "./normalizacao";
import { chaveOrdenacao } from "../contatos";

describe("cnpjCompleto", () => {
  it("junta as 3 partes em 14 dígitos (CNPJ fictício, DV inválido de propósito)", () => {
    // DV "89" é inválido de propósito (dado fictício de teste) — cnpjCompleto só concatena
    // e valida o formato de 14 dígitos; validação de DV é cnpjValido() em ../cnpj.
    expect(cnpjCompleto("90009001", "0001", "89")).toBe("90009001000189");
  });
  it("retorna null se o total ficar abaixo de 12 dígitos (fora do intervalo aceito por normalizarCnpj)", () => {
    expect(cnpjCompleto("9000", "0001", "89")).toBeNull();
  });
});

describe("ehMatrizReceita", () => {
  it("\"1\" é matriz", () => expect(ehMatrizReceita("1")).toBe(true));
  it("\"2\" é filial", () => expect(ehMatrizReceita("2")).toBe(false));
});

describe("dataReceitaParaDate", () => {
  it("AAAAMMDD válido", () => {
    const d = dataReceitaParaDate("20150101");
    expect(d?.toISOString().slice(0, 10)).toBe("2015-01-01");
  });
  it("\"00000000\" é null (data zerada da Receita)", () => expect(dataReceitaParaDate("00000000")).toBeNull());
  it("vazio, undefined ou formato errado são null, nunca lança", () => {
    expect(dataReceitaParaDate("")).toBeNull();
    expect(dataReceitaParaDate(undefined)).toBeNull();
    expect(dataReceitaParaDate("2015-01-01")).toBeNull();
    expect(dataReceitaParaDate("20261331")).toBeNull(); // mês 13 inválido
    expect(dataReceitaParaDate("20260230")).toBeNull(); // 30/02 não existe
  });
});

describe("capitalSocialParaNumero", () => {
  it("vírgula como separador decimal (padrão Receita)", () => {
    expect(capitalSocialParaNumero("2500000,00")).toBe(2500000);
    expect(capitalSocialParaNumero("800000,50")).toBe(800000.5);
  });
  it("ponto de milhar é removido antes da vírgula decimal", () => {
    expect(capitalSocialParaNumero("2.500.000,00")).toBe(2500000);
  });
  it("vazio ou inválido é null", () => {
    expect(capitalSocialParaNumero("")).toBeNull();
    expect(capitalSocialParaNumero(undefined)).toBeNull();
  });
});

describe("telefoneReceitaNormalizado", () => {
  it("junta DDD + número fictício em dígitos normalizados", () => {
    expect(telefoneReceitaNormalizado("81", "00000101")).toBe("8100000101");
  });
  it("sem número vira null", () => expect(telefoneReceitaNormalizado("81", "")).toBeNull());
  it("muito curto (lixo) vira null", () => expect(telefoneReceitaNormalizado("", "123")).toBeNull());
});

describe("emailReceitaNormalizado", () => {
  it("trim + minúsculas", () => expect(emailReceitaNormalizado(" DEMO@FICTICIA-TESTE.INVALID ")).toBe("demo@ficticia-teste.invalid"));
  it("vazio é null", () => expect(emailReceitaNormalizado("")).toBeNull());
});

describe("hashRegistroEstabelecimento", () => {
  const base = {
    situacaoCadastral: "02",
    nomeFantasia: "DEMO FICTÍCIA",
    cnaePrincipal: "2330305",
    cnaesSecundarios: ["4930202"],
    logradouro: "RUA FICTÍCIA",
    numero: "100",
    complemento: null,
    bairro: "CENTRO",
    cep: "50000000",
    uf: "PE",
    municipio: "2531",
    telefone1: "8100000101",
    telefone2: null,
    email: null,
  };
  it("mesmos campos geram o mesmo hash (idempotente)", () => {
    expect(hashRegistroEstabelecimento(base)).toBe(hashRegistroEstabelecimento({ ...base }));
  });
  it("ordem dos CNAEs secundários não importa (lista é ordenada antes do hash)", () => {
    const a = hashRegistroEstabelecimento({ ...base, cnaesSecundarios: ["4930202", "4120400"] });
    const b = hashRegistroEstabelecimento({ ...base, cnaesSecundarios: ["4120400", "4930202"] });
    expect(a).toBe(b);
  });
  it("mudar a situação cadastral muda o hash", () => {
    expect(hashRegistroEstabelecimento(base)).not.toBe(hashRegistroEstabelecimento({ ...base, situacaoCadastral: "08" }));
  });
  it("mudar o endereço muda o hash", () => {
    expect(hashRegistroEstabelecimento(base)).not.toBe(hashRegistroEstabelecimento({ ...base, logradouro: "OUTRA RUA FICTÍCIA" }));
  });
});

describe("nomeOrdenacao reaproveita chaveOrdenacao (../contatos) — não duplicado aqui", () => {
  it("minúsculas sem acento, mesma regra da tela manual", () => {
    expect(chaveOrdenacao("DEMO — CONCRETEIRA FICTÍCIA ÉPSILON")).toBe("demo — concreteira ficticia epsilon");
  });
});
