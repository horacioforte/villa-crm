import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { oportunidade: { findMany: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  buscarOportunidadesRelacionadas,
  oportunidadesAbertas,
  oportunidadesPerdidas,
  palavrasDistintivas,
} from "./historico-oportunidades";

beforeEach(() => {
  vi.clearAllMocks();
});

const OPORTUNIDADE_RNEST = {
  id: "cmsx93me9000m04jpr6w7nq75",
  titulo: "RNEST Expansão Abreu e Lima / PE",
  status: "PERDIDA",
  motivoPerda: "Início da obra para 2029",
  fechadaEm: new Date("2026-10-14"),
  updatedAt: new Date("2026-10-14"),
  responsavel: { nome: "Morgana" },
};

describe("palavrasDistintivas", () => {
  it("extrai palavras distintivas e ignora genéricas/números soltos", () => {
    expect(palavrasDistintivas("Petrobras — RNEST Refinaria Abreu e Lima Trem 2")).toEqual(
      expect.arrayContaining(["PETROBRAS", "RNEST", "REFINARIA", "ABREU", "LIMA"]),
    );
    expect(palavrasDistintivas("Petrobras — RNEST Refinaria Abreu e Lima Trem 2")).not.toContain("TREM");
  });
  it("normaliza acentos", () => {
    expect(palavrasDistintivas("Implantação de Unidade Abreu e Lima")).toEqual(
      expect.arrayContaining(["IMPLANTACAO"]),
    );
  });
  it("remove rótulo de categoria entre colchetes e termos de setor genéricos — caso real Nestlé x Toyota", () => {
    const nestle = palavrasDistintivas("Radar João — [Pilar 1 / Grandes Indústrias] Nova Fábrica Nestlé Ituiutaba / MG");
    const toyota = palavrasDistintivas("Radar João — [Pilar 1 / Grandes Indústrias] Complexo Industrial Toyota Sorocaba (2ª fábrica) / SP");
    expect(nestle).toEqual(expect.arrayContaining(["NESTLE", "ITUIUTABA"]));
    expect(toyota).toEqual(expect.arrayContaining(["TOYOTA", "SOROCABA"]));
    expect(nestle.filter(p => toyota.includes(p))).toHaveLength(0);
  });
});

describe("buscarOportunidadesRelacionadas — caso real RNEST/Petrobras", () => {
  it("acha a oportunidade PERDIDA por título parecido mesmo sem empresaId/obraId em comum", async () => {
    prismaMock.oportunidade.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if ("empresaId" in where) return [];
      if ("obraId" in where) return [];
      return [OPORTUNIDADE_RNEST]; // busca por título
    });

    const relacionadas = await buscarOportunidadesRelacionadas({
      titulo: "Petrobras — RNEST Refinaria Abreu e Lima Trem 2",
      empresaId: "empresa-dossie-diferente", // 9 cadastros de Petrobras — pode não bater
      obraId: null,
    });

    expect(relacionadas).toHaveLength(1);
    expect(relacionadas[0]).toMatchObject({ id: OPORTUNIDADE_RNEST.id, status: "PERDIDA", motivoMatch: "título parecido", confianca: "alta" });
    expect(relacionadas[0].palavrasEmComum.length).toBeGreaterThanOrEqual(3);

    expect(oportunidadesPerdidas(relacionadas)).toHaveLength(1);
    expect(oportunidadesAbertas(relacionadas)).toHaveLength(0);
  });

  it("duas obras de 'Data Center' em cidades diferentes não batem — Data/Center/categoria são genéricos demais", async () => {
    const outroDataCenter = {
      id: "oportunidade-data-center-nao-relacionada",
      titulo: "Zopone Engenharia - Data Center Pecém/CE",
      status: "PERDIDA",
      motivoPerda: "Cliente não tinha interesse",
      fechadaEm: new Date("2026-05-01"),
      updatedAt: new Date("2026-05-01"),
      responsavel: null,
    };
    prismaMock.oportunidade.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if ("empresaId" in where) return [];
      if ("obraId" in where) return [];
      return [outroDataCenter];
    });

    const relacionadas = await buscarOportunidadesRelacionadas({
      titulo: "Radar João — Pilar 1 / Data Center Terranova Campinas / SP",
      empresaId: null,
      obraId: null,
    });

    expect(relacionadas).toHaveLength(0);
  });

  it("título parecido com exatamente 2 palavras em comum vira confiança 'media', não 'alta'", async () => {
    const outraPonte = {
      id: "oportunidade-ponte-nao-relacionada",
      titulo: "Ponte Suspensa Canaã Verde/PA",
      status: "PERDIDA",
      motivoPerda: "Sem interesse",
      fechadaEm: new Date("2026-05-01"),
      updatedAt: new Date("2026-05-01"),
      responsavel: null,
    };
    prismaMock.oportunidade.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if ("empresaId" in where) return [];
      if ("obraId" in where) return [];
      return [outraPonte];
    });

    const relacionadas = await buscarOportunidadesRelacionadas({
      titulo: "Ponte — Teixeira Duarte — Canaã dos Carajás/PA",
      empresaId: null,
      obraId: null,
    });

    expect(relacionadas).toHaveLength(1);
    expect(relacionadas[0].palavrasEmComum).toEqual(expect.arrayContaining(["PONTE", "CANAA"]));
    expect(relacionadas[0].confianca).toBe("media");
  });

  it("'mesma empresa' sozinha vira confiança 'media' (neste CRM a Empresa é muitas vezes a construtora, que atua em várias obras)", async () => {
    prismaMock.oportunidade.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if ("empresaId" in where) return [{ ...OPORTUNIDADE_RNEST, status: "NEGOCIACAO", motivoPerda: null }];
      if ("obraId" in where) return [];
      return [];
    });

    const relacionadas = await buscarOportunidadesRelacionadas(
      { titulo: "Obra qualquer sem palavra em comum", empresaId: "empresa-1" },
      { empresasRelacionadasIds: ["empresa-2-duplicada"] },
    );

    expect(relacionadas).toHaveLength(1);
    expect(relacionadas[0]).toMatchObject({ motivoMatch: "mesma empresa", confianca: "media" });
    expect(oportunidadesAbertas(relacionadas)).toHaveLength(1);
  });

  it("'mesma obra' é confiança 'alta' (um site físico específico é um sinal confiável)", async () => {
    prismaMock.oportunidade.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => {
      if ("empresaId" in where) return [];
      if ("obraId" in where) return [{ ...OPORTUNIDADE_RNEST, status: "NEGOCIACAO", motivoPerda: null }];
      return [];
    });

    const relacionadas = await buscarOportunidadesRelacionadas({ titulo: "Obra qualquer sem palavra em comum", obraId: "obra-1" });

    expect(relacionadas).toHaveLength(1);
    expect(relacionadas[0]).toMatchObject({ motivoMatch: "mesma obra", confianca: "alta" });
  });

  it("sem empresaId, obraId nem palavras distintivas, não chama o banco e devolve vazio", async () => {
    const relacionadas = await buscarOportunidadesRelacionadas({ titulo: "obra radar joão" });
    expect(relacionadas).toEqual([]);
    expect(prismaMock.oportunidade.findMany).not.toHaveBeenCalled();
  });
});
