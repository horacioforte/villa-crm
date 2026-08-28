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

  it("aceita concreteira verdadeira e rejeita fábrica automotiva e usina de biocombustível", () => {
    const concreteira = {
      titulo: "Central de Concreto Norte — Planta de concreto usinado em Recife",
      segmento: "Concreteira",
      cidade: "Recife",
      estado: "PE",
      clienteFinal: "Central de Concreto Norte",
      faseObra: "Mobilização",
      resumo: "Planta de concreto usinado com operação de dosagem e entrega de concreto em obra",
    };

    const gmw = {
      titulo: "GWM — Nova Fábrica Automotiva em Aracruz/ES",
      segmento: "Automotiva",
      cidade: "Aracruz",
      estado: "ES",
      resumo: "Fábrica de veículos e mobilização da nova unidade automotiva",
    };

    const inpasa = {
      titulo: "INPASA — Nova Biorrefinaria em Rondonópolis",
      segmento: "Biocombustível",
      cidade: "Rondonópolis",
      estado: "MT",
      resumo: "Planta industrial de biocombustível e ampliação de capacidade",
    };

    expect(classificarDossieEmCarteiras(concreteira).map((item) => item.carteira)).toContain("CONCRETEIRAS");
    expect(classificarDossieEmCarteiras(gmw).map((item) => item.carteira)).not.toContain("CONCRETEIRAS");
    expect(classificarDossieEmCarteiras(inpasa).map((item) => item.carteira)).not.toContain("CONCRETEIRAS");
  });

  it("aceita pré-moldados reais e rejeita indústria genérica com fábrica", () => {
    const real = {
      titulo: "Fábrica de pré-moldados de concreto em Jaboatão",
      segmento: "Pré-moldados",
      cidade: "Jaboatão dos Guararapes",
      estado: "PE",
      resumo: "Planta de fabricação de vigas, pilares e painéis pré-moldados de concreto",
    };

    const genérica = {
      titulo: "Nova fábrica industrial em Pernambuco",
      segmento: "Indústria",
      cidade: "Pernambuco",
      estado: "PE",
      resumo: "Nova unidade industrial focada em produção de insumos, sem pré-moldado ou elementos estruturais",
    };

    expect(classificarDossieEmCarteiras(real).map((item) => item.carteira)).toContain("PRE_MOLDADOS");
    expect(classificarDossieEmCarteiras(genérica).map((item) => item.carteira)).not.toContain("PRE_MOLDADOS");
  });

  it("aceita concessionária real de caminhões e rejeita infraestrutura e porto", () => {
    const revenda = {
      titulo: "Concessionária Volvo Caminhões e Ônibus em Recife",
      segmento: "Revenda",
      cidade: "Recife",
      estado: "PE",
      resumo: "Concessionária autorizada de caminhões pesados e frota em operação",
    };

    const porto = {
      titulo: "Porto do Açu — condomínio logístico e truck center",
      segmento: "Logística",
      cidade: "São João da Barra",
      estado: "RJ",
      resumo: "Condomínio logístico e área de apoio para caminhões sem operação de revenda",
    };

    const aeroporto = {
      titulo: "Aeroporto de Caruaru — ampliação de pista e terminal",
      segmento: "Infraestrutura",
      cidade: "Caruaru",
      estado: "PE",
      resumo: "Ampliação de pista e terminal aeroportuário em obra",
    };

    expect(classificarDossieEmCarteiras(revenda).map((item) => item.carteira)).toContain("REVENDAS_CAMINHOES");
    expect(classificarDossieEmCarteiras(porto).map((item) => item.carteira)).not.toContain("REVENDAS_CAMINHOES");
    expect(classificarDossieEmCarteiras(aeroporto).map((item) => item.carteira)).not.toContain("REVENDAS_CAMINHOES");
  });

  it("aceita empreendimento MCMV real e rejeita projeto sem vínculo habitacional", () => {
    const mcmv = {
      titulo: "Residencial Parque do Sol — MCMV em Recife",
      segmento: "Habitação",
      cidade: "Recife",
      estado: "PE",
      clienteFinal: "Residencial Parque do Sol",
      resumo: "Empreendimento residencial de interesse social com 180 unidades do Minha Casa Minha Vida",
      faseObra: "Licenciamento",
    };

    const infra = {
      titulo: "Porto do Sul — mobilização e infraestrutura",
      segmento: "Infraestrutura",
      cidade: "Pernambuco",
      estado: "PE",
      resumo: "Obra de infraestrutura portuária e mobilização sem vínculo com MCMV",
    };

    expect(classificarDossieEmCarteiras(mcmv).map((item) => item.carteira)).toContain("MCMV");
    expect(classificarDossieEmCarteiras(infra).map((item) => item.carteira)).not.toContain("MCMV");
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
