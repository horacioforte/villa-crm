// ARQUIVO: lib/metrics/comercial.test.ts
// Testes de consistência da Fase 0 — Governança dos Indicadores Comerciais.
// Objetivo: travar em teste automatizado as regras aprovadas em 17/08/2026,
// para que nenhum consumidor (Dashboard, Kanban, Relatórios, Saúde Comercial,
// CRM IA, BI) volte a divergir da definição oficial.

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PIPELINE_ABERTO_STATUSES,
  PIPELINE_FECHADO_STATUSES,
  POTENCIAL_ALERTA_EXCEPCIONAL,
  VALOR_FINANCEIRO_MINIMO_REAL,
} from "@/lib/metrics/constants";
import {
  selecionarPropostasVigentes,
  somarPropostasVigentes,
  type PropostaVigenteInput,
} from "@/lib/metrics/proposta-vigente";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    oportunidade: {
      aggregate: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    propostaComercial: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

describe("Contrato dos status oficiais (regra 17/08/2026)", () => {
  it("Pipeline aberto nunca inclui GANHA, PERDIDA ou PRE_QUALIFICADA", () => {
    expect(PIPELINE_ABERTO_STATUSES).toEqual([
      "NOVA",
      "EM_ATENDIMENTO",
      "PROPOSTA_ENVIADA",
      "NEGOCIACAO",
    ]);
    expect(PIPELINE_ABERTO_STATUSES).not.toContain("GANHA");
    expect(PIPELINE_ABERTO_STATUSES).not.toContain("PERDIDA");
    expect(PIPELINE_ABERTO_STATUSES).not.toContain("PRE_QUALIFICADA");
  });

  it("Pipeline fechado é só GANHA e PERDIDA", () => {
    expect(PIPELINE_FECHADO_STATUSES).toEqual(["GANHA", "PERDIDA"]);
  });
});

describe("selecionarPropostasVigentes — regra única de versão vigente", () => {
  function proposta(overrides: Partial<PropostaVigenteInput>): PropostaVigenteInput {
    return {
      numeroProposta: "VILLA-2026-000001",
      versao: 1,
      ativa: false,
      status: "ENVIADA",
      valorTotal: 100_000,
      ...overrides,
    };
  }

  it("prefere a versão marcada como ativa, mesmo que não seja a mais recente", () => {
    const v1 = proposta({ versao: 1, ativa: true, valorTotal: 90_000 });
    const v2 = proposta({ versao: 2, ativa: false, valorTotal: 150_000 });

    const vigentes = selecionarPropostasVigentes([v1, v2]);

    expect(vigentes).toEqual([v1]);
  });

  it("cai para a maior versão quando nenhuma está marcada como ativa", () => {
    const v1 = proposta({ versao: 1, ativa: false, valorTotal: 90_000 });
    const v2 = proposta({ versao: 2, ativa: false, valorTotal: 150_000 });
    const v3 = proposta({ versao: 3, ativa: false, valorTotal: 200_000 });

    const vigentes = selecionarPropostasVigentes([v1, v2, v3]);

    expect(vigentes).toEqual([v3]);
  });

  it("nunca soma duas versões da mesma proposta independente", () => {
    const v1 = proposta({ versao: 1, ativa: true, valorTotal: 90_000 });
    const v2 = proposta({ versao: 2, ativa: false, valorTotal: 150_000 });

    expect(somarPropostasVigentes([v1, v2])).toBe(90_000);
  });

  it("soma propostas independentes (numeroProposta diferente) separadamente", () => {
    const propostaA = proposta({ numeroProposta: "VILLA-2026-000001", ativa: true, valorTotal: 90_000 });
    const propostaB = proposta({ numeroProposta: "VILLA-2026-000002", ativa: true, valorTotal: 200_000 });

    expect(somarPropostasVigentes([propostaA, propostaB])).toBe(290_000);
  });

  it("exclui propostas CANCELADA e REJEITADA da seleção", () => {
    const cancelada = proposta({ status: "CANCELADA", ativa: true, valorTotal: 500_000 });
    const rejeitada = proposta({
      numeroProposta: "VILLA-2026-000002",
      status: "REJEITADA",
      ativa: true,
      valorTotal: 300_000,
    });

    expect(selecionarPropostasVigentes([cancelada, rejeitada])).toEqual([]);
    expect(somarPropostasVigentes([cancelada, rejeitada])).toBe(0);
  });

  it("nunca soma um valor placeholder abaixo do piso de sanidade financeira (ex.: R$ 1)", () => {
    const placeholder = proposta({ ativa: true, valorTotal: 1 });

    expect(Number(placeholder.valorTotal)).toBeLessThan(VALOR_FINANCEIRO_MINIMO_REAL);
    expect(somarPropostasVigentes([placeholder])).toBe(0);
  });
});

describe("getPipelinePotencial — exclui estágios fechados e aguardando revisão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("consulta o banco apenas com os status oficiais de pipeline aberto", async () => {
    prismaMock.oportunidade.aggregate.mockResolvedValue({
      _sum: { potencialOportunidade: 500_000 },
    });
    prismaMock.oportunidade.count.mockResolvedValue(3);

    const { getPipelinePotencial } = await import("@/lib/metrics/comercial");
    const resultado = await getPipelinePotencial();

    expect(resultado).toEqual({ total: 500_000, quantidade: 3 });

    const whereUsado = prismaMock.oportunidade.aggregate.mock.calls[0][0].where;
    expect(whereUsado.status.in).toEqual(PIPELINE_ABERTO_STATUSES);
    expect(whereUsado.status.in).not.toContain("GANHA");
    expect(whereUsado.status.in).not.toContain("PERDIDA");
    expect(whereUsado.status.in).not.toContain("PRE_QUALIFICADA");
  });

  it("restringe COMERCIAL às próprias oportunidades (responsável ou criador)", async () => {
    prismaMock.oportunidade.aggregate.mockResolvedValue({ _sum: { potencialOportunidade: 0 } });
    prismaMock.oportunidade.count.mockResolvedValue(0);

    const { getPipelinePotencial } = await import("@/lib/metrics/comercial");
    await getPipelinePotencial({ user: { id: "user-1", papel: "COMERCIAL" } });

    const whereUsado = prismaMock.oportunidade.aggregate.mock.calls[0][0].where;
    expect(whereUsado.OR).toEqual([{ responsavelId: "user-1" }, { createdById: "user-1" }]);
  });

  it("não restringe ADMIN/GERENTE por responsável", async () => {
    prismaMock.oportunidade.aggregate.mockResolvedValue({ _sum: { potencialOportunidade: 0 } });
    prismaMock.oportunidade.count.mockResolvedValue(0);

    const { getPipelinePotencial } = await import("@/lib/metrics/comercial");
    await getPipelinePotencial({ user: { id: "user-1", papel: "ADMIN" } });

    const whereUsado = prismaMock.oportunidade.aggregate.mock.calls[0][0].where;
    expect(whereUsado.OR).toBeUndefined();
  });
});

describe("getPipelineProposto — nunca soma placeholder nem versão antiga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignora propostas com valorTotal abaixo do piso de sanidade", async () => {
    prismaMock.propostaComercial.findMany.mockResolvedValue([
      { numeroProposta: "VILLA-2026-000001", versao: 1, ativa: true, status: "ENVIADA", valorTotal: 1 },
      { numeroProposta: "VILLA-2026-000002", versao: 1, ativa: true, status: "ENVIADA", valorTotal: 250_000 },
    ]);

    const { getPipelineProposto } = await import("@/lib/metrics/comercial");
    const resultado = await getPipelineProposto();

    expect(resultado).toEqual({ total: 250_000, quantidade: 1 });
  });

  it("não soma duas versões da mesma proposta independente", async () => {
    prismaMock.propostaComercial.findMany.mockResolvedValue([
      { numeroProposta: "VILLA-2026-000001", versao: 1, ativa: false, status: "ENVIADA", valorTotal: 90_000 },
      { numeroProposta: "VILLA-2026-000001", versao: 2, ativa: true, status: "ENVIADA", valorTotal: 150_000 },
    ]);

    const { getPipelineProposto } = await import("@/lib/metrics/comercial");
    const resultado = await getPipelineProposto();

    expect(resultado).toEqual({ total: 150_000, quantidade: 1 });
  });

  it("consulta apenas oportunidades em estágio aberto (BI Executivo, 18/08/2026)", async () => {
    prismaMock.propostaComercial.findMany.mockResolvedValue([]);

    const { getPipelineProposto } = await import("@/lib/metrics/comercial");
    await getPipelineProposto();

    const whereUsado = prismaMock.propostaComercial.findMany.mock.calls[0][0].where;
    expect(whereUsado.oportunidade.is.status.in).toEqual(PIPELINE_ABERTO_STATUSES);
    expect(whereUsado.oportunidade.is.status.in).not.toContain("GANHA");
    expect(whereUsado.oportunidade.is.status.in).not.toContain("PERDIDA");
  });
});

describe("getFunilComercial — contagem de 'com proposta' bate com Pipeline Proposto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("conta oportunidades distintas usando a mesma seleção de vigente (não duplica por versão)", async () => {
    prismaMock.oportunidade.count
      .mockResolvedValueOnce(10) // abertas
      .mockResolvedValueOnce(2) // emNegociacao
      .mockResolvedValueOnce(5); // ganhasNoPeriodo
    prismaMock.propostaComercial.findMany.mockResolvedValue([
      { oportunidadeId: "op-1", numeroProposta: "VILLA-2026-000001", versao: 1, ativa: true, status: "ENVIADA", valorTotal: 90_000 },
      { oportunidadeId: "op-1", numeroProposta: "VILLA-2026-000001", versao: 2, ativa: false, status: "ENVIADA", valorTotal: 150_000 },
      { oportunidadeId: "op-2", numeroProposta: "VILLA-2026-000002", versao: 1, ativa: true, status: "ENVIADA", valorTotal: 80_000 },
    ]);

    const { getFunilComercial } = await import("@/lib/metrics/comercial");
    const resultado = await getFunilComercial();

    // duas propostas vigentes, mas apenas 2 oportunidades distintas (op-1 conta 1x mesmo com 2 versões)
    expect(resultado.comProposta).toBe(2);
    expect(resultado.abertas).toBe(10);
  });
});

describe("getPipelineContratado — apenas GANHA, período por fechadaEm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filtra por fechadaEm (não createdAt) quando um período é informado", async () => {
    prismaMock.oportunidade.aggregate.mockResolvedValue({ _sum: { valorContrato: 300_000 } });
    prismaMock.oportunidade.count.mockResolvedValue(2);

    const inicio = new Date("2026-08-01");
    const fim = new Date("2026-08-31");

    const { getPipelineContratado } = await import("@/lib/metrics/comercial");
    await getPipelineContratado({ dataInicio: inicio, dataFim: fim });

    const whereUsado = prismaMock.oportunidade.aggregate.mock.calls[0][0].where;
    expect(whereUsado.status).toBe("GANHA");
    expect(whereUsado.fechadaEm).toEqual({ gte: inicio, lte: fim });
    expect(whereUsado.createdAt).toBeUndefined();
  });
});

describe("POTENCIAL_ALERTA_EXCEPCIONAL — não é teto, é gatilho de confirmação", () => {
  it("está acima de qualquer negócio real observado na auditoria (~R$ 6 mi)", () => {
    expect(POTENCIAL_ALERTA_EXCEPCIONAL).toBeGreaterThan(6_000_000);
  });
});
