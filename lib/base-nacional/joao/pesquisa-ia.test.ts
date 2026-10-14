import { describe, expect, it } from "vitest";
import {
  montarEntradaImportarWeb,
  montarPromptPesquisaIA,
  validarAchadosPesquisaIA,
  type AchadoBrutoPesquisaIA,
  type ClienteBuscaIA,
} from "./pesquisa-ia";

const EMPRESA = ["DEMO — CONCRETEIRA FICTÍCIA ALFA LTDA"];

function achado(parcial: Partial<AchadoBrutoPesquisaIA>): AchadoBrutoPesquisaIA {
  return {
    nome: "Carlos Eduardo Souza",
    cargo: "Gerente de Compras",
    linkedinUrl: "https://www.linkedin.com/in/carlos-exemplo",
    fonteUrl: "https://www.linkedin.com/in/carlos-exemplo",
    trecho: "Carlos atua como gerente de compras na DEMO — Concreteira Fictícia Alfa Ltda desde 2021.",
    ...parcial,
  };
}

describe("validarAchadosPesquisaIA — mesmas regras de --importar-web", () => {
  it("aceita um achado plausível, com fonte https e trecho citando a empresa", () => {
    const r = validarAchadosPesquisaIA([achado({})], EMPRESA);
    expect(r.rejeitados).toEqual([]);
    expect(r.achados).toHaveLength(1);
    expect(r.achados[0]).toMatchObject({ nome: "Carlos Eduardo Souza", cargo: "Gerente de Compras", confianca: "ALTA" });
  });

  it("rejeita sem URL de fonte (URL obrigatória)", () => {
    const r = validarAchadosPesquisaIA([achado({ fonteUrl: "" })], EMPRESA);
    expect(r.achados).toEqual([]);
    expect(r.rejeitados[0].motivo).toMatch(/URL de fonte/);
  });

  it("rejeita URL que não é https (http simples não vale)", () => {
    const r = validarAchadosPesquisaIA([achado({ fonteUrl: "http://exemplo.invalid/pagina" })], EMPRESA);
    expect(r.achados).toEqual([]);
    expect(r.rejeitados[0].motivo).toMatch(/URL de fonte/);
  });

  it("rejeita nome implausível (nome de departamento, não de pessoa)", () => {
    const r = validarAchadosPesquisaIA([achado({ nome: "Departamento Comercial" })], EMPRESA);
    expect(r.achados).toEqual([]);
    expect(r.rejeitados[0].motivo).toMatch(/não plausível/);
  });

  it("rejeita quando o trecho não cita a empresa (risco de homônimo)", () => {
    const r = validarAchadosPesquisaIA([achado({ trecho: "Carlos atua como gerente de compras em uma empresa do setor." })], EMPRESA);
    expect(r.achados).toEqual([]);
    expect(r.rejeitados[0].motivo).toMatch(/homônimo/);
  });

  it("rejeita cargo fora do público-alvo (ex.: recepcionista)", () => {
    const r = validarAchadosPesquisaIA([achado({ cargo: "Recepcionista", trecho: "Trabalha na recepção da DEMO — Concreteira Fictícia Alfa Ltda." })], EMPRESA);
    expect(r.achados).toEqual([]);
    expect(r.rejeitados[0].motivo).toMatch(/fora do público/);
  });

  it("aceita gerente de frota, manutenção e operações (público-alvo dos grupos B/C)", () => {
    const cargos = ["Gerente de Frota", "Gerente de Manutenção", "Coordenador de Operações"];
    for (const cargo of cargos) {
      const r = validarAchadosPesquisaIA([achado({ cargo, trecho: `Responsável por ${cargo.toLowerCase()} na DEMO — Concreteira Fictícia Alfa Ltda.` })], EMPRESA);
      expect(r.rejeitados, cargo).toEqual([]);
      expect(r.achados, cargo).toHaveLength(1);
    }
  });

  it("confiança MEDIA quando não há LinkedIn pessoal", () => {
    const r = validarAchadosPesquisaIA([achado({ linkedinUrl: null, fonteUrl: "https://exemplo-noticia.invalid/materia" })], EMPRESA);
    expect(r.achados[0].confianca).toBe("MEDIA");
  });

  it("normaliza a URL do LinkedIn pessoal (reaproveita normalizarLinkedinPessoa)", () => {
    const r = validarAchadosPesquisaIA([achado({ linkedinUrl: "https://br.linkedin.com/in/Carlos-Exemplo?trk=x" })], EMPRESA);
    expect(r.achados[0].linkedinUrl).toBe("https://www.linkedin.com/in/carlos-exemplo");
  });

  it("vários achados: aceita os válidos e rejeita os inválidos no mesmo lote", () => {
    const r = validarAchadosPesquisaIA([achado({}), achado({ fonteUrl: "" }), achado({ cargo: "Recepcionista" })], EMPRESA);
    expect(r.achados).toHaveLength(1);
    expect(r.rejeitados).toHaveLength(2);
  });
});

describe("montarPromptPesquisaIA — função pura", () => {
  it("inclui nome, cidade/UF e pede JSON com os campos certos", () => {
    const p = montarPromptPesquisaIA({ nome: "DEMO Alfa", cidadeUf: "Recife/PE", dominio: "alfa-demo.invalid" });
    expect(p).toContain("DEMO Alfa");
    expect(p).toContain("Recife/PE");
    expect(p).toContain("alfa-demo.invalid");
    expect(p).toContain("fonteUrl");
  });
  it("sem domínio, avisa para evitar homônimos em vez de citar um domínio inexistente", () => {
    const p = montarPromptPesquisaIA({ nome: "DEMO Beta", cidadeUf: "Salvador/BA", dominio: null });
    expect(p).not.toContain("O site oficial");
    expect(p.toLowerCase()).toContain("homônimo");
  });
});

describe("montarEntradaImportarWeb — formato de --importar-web", () => {
  it("monta grupoChave, consultas e achados prontos para o script existente", () => {
    const { achados } = validarAchadosPesquisaIA([achado({})], EMPRESA);
    const e = montarEntradaImportarWeb({ grupoChave: "jg-demo123", entrada: { nome: "DEMO Alfa", cidadeUf: "Recife/PE", dominio: null }, achados, tokensEstimados: 1500 });
    expect(e.grupoChave).toBe("jg-demo123");
    expect(e.consultas).toHaveLength(1);
    expect(e.tokensEstimados).toBe(1500);
    expect(e.achados).toEqual(achados);
  });
});

describe("ClienteBuscaIA — interface só é usada via mock nos testes (nenhuma chamada real)", () => {
  it("um cliente simulado produz achados que passam pela mesma validação", async () => {
    const clienteSimulado: ClienteBuscaIA = {
      provedor: "claude",
      async buscar() {
        return { achados: [achado({})], tokensEstimados: 900, custoUsd: 0.0009 };
      },
    };
    const resposta = await clienteSimulado.buscar({ nome: "DEMO Alfa", cidadeUf: "Recife/PE", dominio: null }, "prompt de teste");
    const r = validarAchadosPesquisaIA(resposta.achados, EMPRESA);
    expect(r.achados).toHaveLength(1);
    expect(resposta.custoUsd).toBeGreaterThan(0);
  });
});
