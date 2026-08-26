import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, requireAuthMock } = vi.hoisted(() => ({
  prismaMock: {
    dossieCarteira: { findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    dossieComercial: { findUnique: vi.fn() },
    oportunidade: { create: vi.fn() },
  },
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/session", () => ({ requireAuth: (...args: unknown[]) => requireAuthMock(...args) }));

import { GET } from "./route";
import { PATCH } from "./[dossieId]/route";

const buildDossie = (id: string, empresa = "Empresa Teste") => ({
  id,
  titulo: `Dossiê ${id}`,
  resumo: "Investigações recentes do dossiê.",
  cidade: "Recife",
  estado: "PE",
  segmento: "Infraestrutura",
  score: 85,
  updatedAt: new Date("2026-08-20T10:00:00.000Z"),
  ultimaAtividade: new Date("2026-08-18T12:00:00.000Z"),
  proximaAcaoSugerida: "Confirmar decisão da obra.",
  empresa: { razaoSocial: empresa, cidade: "Recife", estado: "PE", segmento: "Infraestrutura" },
  decisores: [{ nome: "Ana" }, { nome: "Beto" }],
});

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue({ id: "user-1", papel: "ADMIN" });
  prismaMock.oportunidade.create.mockResolvedValue({ id: "opp-1" });
});

describe("Carteiras Estratégicas", () => {
  it("permite que o mesmo dossiê apareça em mais de uma carteira", async () => {
    const rowMcmv = {
      id: "rel-1",
      carteira: "MCMV",
      status: "EM_CAMPANHA",
      score: 88,
      principalSinal: "Sinal claro de compra.",
      proximaAcao: "Seguir com campanha.",
      ultimaInvestigacao: new Date("2026-08-17T09:00:00.000Z"),
      ultimaAtualizacao: new Date("2026-08-19T09:00:00.000Z"),
      decisores: 2,
      dossie: buildDossie("dossie-1", "Construtora Alpha"),
    };

    const rowConcreteiras = {
      ...rowMcmv,
      id: "rel-2",
      carteira: "CONCRETEIRAS",
      status: "MONITORANDO",
      principalSinal: "Acompanhar expansão da planta.",
    };

    prismaMock.dossieCarteira.findMany
      .mockResolvedValueOnce([rowMcmv])
      .mockResolvedValueOnce([rowConcreteiras]);

    const mcmvRes = await GET(new NextRequest("https://localhost/api/inteligencia/carteiras/mcmv"), { params: Promise.resolve({ slug: "mcmv" }) });
    const concreteirasRes = await GET(new NextRequest("https://localhost/api/inteligencia/carteiras/concreteiras"), { params: Promise.resolve({ slug: "concreteiras" }) });

    expect((await mcmvRes.json()).items[0].dossieId).toBe("dossie-1");
    expect((await concreteirasRes.json()).items[0].dossieId).toBe("dossie-1");
  });

  it("aplica filtro por carteira e por status na query do banco", async () => {
    prismaMock.dossieCarteira.findMany.mockResolvedValue([]);

    const res = await GET(new NextRequest("https://localhost/api/inteligencia/carteiras/mcmv?status=EM_CAMPANHA&q=recife"), {
      params: Promise.resolve({ slug: "mcmv" }),
    });

    expect(res.status).toBe(200);
    expect(prismaMock.dossieCarteira.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ carteira: "MCMV", status: "EM_CAMPANHA" }),
    }));
    expect((await res.json()).items).toEqual([]);
  });

  it("ignora filtros de score vazios para não remover todos os registros válidos da carteira", async () => {
    prismaMock.dossieCarteira.findMany.mockResolvedValue([
      {
        id: "rel-1",
        carteira: "CONCRETEIRAS",
        status: "MONITORANDO",
        score: 84,
        decisores: 0,
        emCampanha: false,
        interessado: false,
        principalSinal: null,
        proximaAcao: null,
        ultimaInvestigacao: null,
        ultimaAtualizacao: new Date("2026-08-20T10:00:00.000Z"),
        dossie: buildDossie("dossie-1", "Concreteira Vila"),
      },
    ]);

    const res = await GET(new NextRequest("https://localhost/api/inteligencia/carteiras/concreteiras?scoreMin=&scoreMax="), {
      params: Promise.resolve({ slug: "concreteiras" }),
    });

    expect(res.status).toBe(200);
    expect(prismaMock.dossieCarteira.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ carteira: "CONCRETEIRAS" }),
    }));
    const payload = await res.json();
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].score).toBe(85);
  });

  it("bloqueia escrita em Construtoras, que é somente leitura", async () => {
    const req = new NextRequest("https://localhost/api/inteligencia/carteiras/construtoras-brasil/dossie-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "INTERESSADO" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ slug: "construtoras-brasil", dossieId: "dossie-1" }) });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(expect.objectContaining({ error: "Carteira de Construtoras é somente leitura." }));
    expect(prismaMock.dossieCarteira.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.dossieCarteira.update).not.toHaveBeenCalled();
  });

  it("muda o estágio da carteira sem criar oportunidade automática", async () => {
    prismaMock.dossieCarteira.findUnique.mockResolvedValue({
      id: "rel-1",
      dossieId: "dossie-1",
      carteira: "MCMV",
      status: "EM_CAMPANHA",
      principalSinal: "Sinal claro de compra.",
    });
    prismaMock.dossieCarteira.update.mockResolvedValue({
      id: "rel-1",
      dossieId: "dossie-1",
      carteira: "MCMV",
      status: "INTERESSADO",
      principalSinal: "Sinal claro de compra.",
    });

    const req = new NextRequest("https://localhost/api/inteligencia/carteiras/mcmv/dossie-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "INTERESSADO" }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ slug: "mcmv", dossieId: "dossie-1" }) });

    expect(res.status).toBe(200);
    expect(prismaMock.dossieCarteira.update).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ dossieId_carteira: expect.objectContaining({ dossieId: "dossie-1", carteira: "MCMV" }) }),
      data: expect.objectContaining({ status: "INTERESSADO" }),
    }));
    expect(prismaMock.oportunidade.create).not.toHaveBeenCalled();
  });
});
