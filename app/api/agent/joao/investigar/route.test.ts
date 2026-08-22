import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, investigarDossieMock } = vi.hoisted(() => ({
  prismaMock: {
    dossieComercial: {
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    atualizacaoDossie: {
      create: vi.fn(),
    },
    decisorDossie: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (ops) => ops),
  },
  investigarDossieMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/agentes/joao/investigador", () => ({ investigarDossie: investigarDossieMock }));

import { POST } from "./route";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
  process.env.AGENT_API_KEY = "test-agent-key";
});

function criarRequest(body: unknown, authorization = "Bearer test-agent-key") {
  return new Request("https://villa-crm.vercel.app/api/agent/joao/investigar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify(body),
  }) as never;
}

function baseDossie(id: string, titulo: string) {
  return {
    id,
    titulo,
    resumo: "Resumo",
    segmento: "Infraestrutura",
    cidade: "Recife",
    estado: "PE",
    status: "INVESTIGANDO",
    clienteFinal: "Cliente Teste",
    construtora: "Construtora Teste",
    epc: "EPC Teste",
    epcm: "EPCM Teste",
    faseObra: "Mobilização",
    cronograma: "Cronograma em andamento",
    valorEstimado: 1200000,
    volumeConcreto: 3000,
    concorrentes: "Concorrente X",
    missaoAtual: "Validar cronograma",
    fonteInformacao: "Portal oficial",
    completude: 40,
    decisores: [],
    ultimaAtividade: new Date("2024-01-01T00:00:00.000Z"),
  };
}

describe("POST /api/agent/joao/investigar", () => {
  it("processa somente os dossiês explicitamente selecionados por dossieIds", async () => {
    const dossieA = baseDossie("A", "Noronha");
    const dossieB = baseDossie("B", "Recife");
    const dossieC = baseDossie("C", "Outro");

    prismaMock.dossieComercial.findMany.mockResolvedValue([dossieA, dossieB]);
    investigarDossieMock.mockImplementation(async (dossie) => ({
      achou: false,
      campos: {},
      decisor: null,
      noticias: [],
      resumoInvestigacao: `Resumo de ${dossie.titulo}`,
      erro: null,
    }));

    const res = await POST(criarRequest({ dossieIds: ["A", "B"] }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processados).toBe(2);
    expect(body.detalhes.map((item: { dossieId: string }) => item.dossieId)).toEqual(["A", "B"]);
    expect(prismaMock.dossieComercial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["A", "B"] },
        }),
      }),
    );
    expect(prismaMock.dossieComercial.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ["A", "B", "C"] },
        }),
      }),
    );
  });

  it("mantém o comportamento automático quando somente limite é informado", async () => {
    const dossieA = baseDossie("A", "A");
    const dossieB = baseDossie("B", "B");

    prismaMock.dossieComercial.findMany.mockResolvedValue([dossieA, dossieB]);
    investigarDossieMock.mockResolvedValue({
      achou: false,
      campos: {},
      decisor: null,
      noticias: [],
      resumoInvestigacao: "Sem achados",
      erro: null,
    });

    const res = await POST(criarRequest({ limite: 2 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.processados).toBe(2);
    expect(prismaMock.dossieComercial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] },
        }),
        take: 2,
      }),
    );
  });

  it("rejeita ID inexistente de forma explícita e segura", async () => {
    prismaMock.dossieComercial.findMany.mockResolvedValue([]);

    const res = await POST(criarRequest({ dossieIds: ["ID_INEXISTENTE"] }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/inexistente|inválido|não existem|não encontrado/i);
  });
});
