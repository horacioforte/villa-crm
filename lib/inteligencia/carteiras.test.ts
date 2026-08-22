import { describe, expect, it } from "vitest";

import { CARTEIRAS_JOAO, buildCarteiraExtras, classificarDossieEmCarteiras } from "./carteiras";

describe("classificação real das carteiras", () => {
  it("classifica um dossiê com evidência forte em mais de uma carteira", () => {
    const dossie = {
      titulo: "MCMV Parque Verde - nova central de concreto em Recife",
      resumo: "Empreendimento de habitação com expansão de central de concreto para obra da construtora.",
      segmento: "Concreto / MCMV",
      cidade: "Recife",
      estado: "PE",
      clienteFinal: "Parque Verde",
      construtora: "Construtora Norte",
      epc: "EPC One",
      faseObra: "Licenciamento",
      proximaAcaoSugerida: "Confirmar unidades e cronograma.",
      equipamentosSugeridos: "Bomba de concreto e betoneira.",
      concorrentes: "Empresa X",
      concreteiras: "Central do Vale",
      empresasRelacionadas: [{ razaoSocial: "Construtora Norte", papel: "CONSTRUTORA" }],
    };

    const result = classificarDossieEmCarteiras(dossie);
    const carteiras = result.map((item) => item.carteira);

    expect(carteiras).toEqual(expect.arrayContaining(["MCMV", "CONCRETEIRAS"]));
    expect(result.filter((item) => item.carteira === "MCMV").length).toBe(1);
    expect(result.filter((item) => item.carteira === "CONCRETEIRAS").length).toBe(1);
  });

  it("expõe as cinco carteiras do João com slugs e labels corretos", () => {
    expect(CARTEIRAS_JOAO.map((item) => item.slug)).toEqual([
      "construtoras-brasil",
      "mcmv",
      "pre-moldados",
      "concreteiras",
      "revendas-caminhoes",
    ]);

    expect(CARTEIRAS_JOAO.map((item) => item.label)).toEqual([
      "Construtoras",
      "Minha Casa Minha Vida",
      "Pré-moldados",
      "Concreteiras",
      "Agência de Caminhões",
    ]);
  });

  it("não classifica quando a evidência é fraca ou genérica", () => {
    const dossie = {
      titulo: "Obra em andamento",
      resumo: "Atividade comercial sem indicadores claros de segmento ou carteira específica.",
      segmento: "Construção",
      cidade: "São Paulo",
      estado: "SP",
      clienteFinal: "Cliente",
      construtora: "Construtora",
      faseObra: "Obra em execução",
      proximaAcaoSugerida: "Acompanhar evolução.",
    };

    expect(classificarDossieEmCarteiras(dossie)).toEqual([]);
  });

  it("monta campos extras somente com dados reais para MCMV", () => {
    const extras = buildCarteiraExtras(
      {
        titulo: "MCMV Residencial Alfa",
        resumo: "Empreendimento de habitação com foco em unidades e cronograma.",
        segmento: "Habitação",
        cidade: "Recife",
        estado: "PE",
        clienteFinal: "Residencial Alfa",
        faseObra: "Mobilização",
        proximaAcaoSugerida: "Confirmar unidades e cronograma.",
      },
      "MCMV",
    );

    expect(extras).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Empreendimento", value: "Residencial Alfa" }),
        expect.objectContaining({ label: "Fase da obra", value: "Mobilização" }),
      ]),
    );
    expect(extras.some((item) => item.label === "Unidades")).toBe(false);
  });
});
