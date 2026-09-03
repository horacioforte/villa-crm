import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, requirePermissionMock } = vi.hoisted(() => ({
  prismaMock: {
    redeSocialConta: { findFirst: vi.fn() },
    metricaSocialSnapshot: { findFirst: vi.fn() },
  },
  requirePermissionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
}));

import { GET } from "./route";

const ADMIN = { id: "user-1", papel: "ADMIN" as const };

function criarRequest(query = "") {
  return new Request(`https://villa-crm.vercel.app/api/midias-sociais/instagram/resumo${query}`) as never;
}

const CONTA = {
  id: "conta-1",
  nome: "@villapumps",
  instagramBusinessAccountId: "17841402587852701",
  statusConexao: "CONECTADO",
  ultimaSincronizacaoEm: new Date("2026-09-01T00:00:00Z"),
  ultimoErro: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  requirePermissionMock.mockResolvedValue(ADMIN);
});

describe("GET /api/midias-sociais/instagram/resumo", () => {
  it("sem permissão: retorna a resposta de erro de requirePermission, nunca consulta o banco", async () => {
    requirePermissionMock.mockResolvedValue(
      NextResponse.json({ message: "Voce nao tem permissao para executar esta acao." }, { status: 403 }),
    );

    const res = await GET(criarRequest());

    expect(res.status).toBe(403);
    expect(prismaMock.redeSocialConta.findFirst).not.toHaveBeenCalled();
  });

  it("período inválido: 400, nunca consulta o banco", async () => {
    const res = await GET(criarRequest("?periodo=1000d"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toMatch(/período inválido/i);
    expect(prismaMock.redeSocialConta.findFirst).not.toHaveBeenCalled();
  });

  it("nenhuma conta Instagram cadastrada: conectado false, tudo mais null", async () => {
    prismaMock.redeSocialConta.findFirst.mockResolvedValue(null);

    const res = await GET(criarRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ conectado: false, conta: null, snapshotAtual: null, comparacao: null });
    expect(prismaMock.metricaSocialSnapshot.findFirst).not.toHaveBeenCalled();
  });

  it("conta cadastrada mas sem nenhum snapshot ainda: dados vazios com a conta preenchida", async () => {
    prismaMock.redeSocialConta.findFirst.mockResolvedValue(CONTA);
    prismaMock.metricaSocialSnapshot.findFirst.mockResolvedValue(null);

    const res = await GET(criarRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.conectado).toBe(true);
    expect(body.conta.id).toBe("conta-1");
    expect(body.snapshotAtual).toBeNull();
    expect(body.comparacao).toBeNull();
  });

  it("com snapshot atual mas sem snapshot anterior cobrindo o período: comparacao.disponivel false (histórico insuficiente)", async () => {
    prismaMock.redeSocialConta.findFirst.mockResolvedValue(CONTA);
    prismaMock.metricaSocialSnapshot.findFirst
      .mockResolvedValueOnce({
        id: "snap-1",
        capturadoEm: new Date("2026-09-01T00:00:00Z"),
        seguidores: 3000,
        alcance: 500,
        visualizacoes: 1000,
        interacoes: 200,
        visitasPerfil: 150,
        cliquesBio: 10,
        quantidadePosts: 470,
        origem: "API",
      })
      .mockResolvedValueOnce(null);

    const res = await GET(criarRequest("?periodo=30d"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.snapshotAtual.id).toBe("snap-1");
    expect(body.comparacao.disponivel).toBe(false);
    expect(body.comparacao.origemComparacao).toBeNull();
    expect(body.comparacao.porMetrica.seguidores.variacaoPercentual).toBeNull();
  });

  it("com snapshot atual e anterior: calcula variação absoluta e percentual por métrica, rotulando a origem do anterior", async () => {
    prismaMock.redeSocialConta.findFirst.mockResolvedValue(CONTA);
    prismaMock.metricaSocialSnapshot.findFirst
      .mockResolvedValueOnce({
        id: "snap-atual",
        capturadoEm: new Date("2026-09-01T00:00:00Z"),
        seguidores: 3000,
        alcance: 600,
        visualizacoes: 1200,
        interacoes: 250,
        visitasPerfil: 200,
        cliquesBio: 12,
        quantidadePosts: 470,
        origem: "API",
      })
      .mockResolvedValueOnce({
        id: "snap-anterior",
        capturadoEm: new Date("2026-08-01T00:00:00Z"),
        seguidores: 2894,
        alcance: 400,
        visualizacoes: 900,
        interacoes: 200,
        visitasPerfil: 192,
        cliquesBio: 8,
        quantidadePosts: 467,
        origem: "MANUAL",
      });

    const res = await GET(criarRequest("?periodo=30d"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.comparacao.disponivel).toBe(true);
    expect(body.comparacao.origemComparacao).toBe("MANUAL");
    expect(body.comparacao.porMetrica.seguidores.valorAtual).toBe(3000);
    expect(body.comparacao.porMetrica.seguidores.valorAnterior).toBe(2894);
    expect(body.comparacao.porMetrica.seguidores.variacaoAbsoluta).toBe(106);
    expect(body.comparacao.porMetrica.seguidores.variacaoPercentual).toBeCloseTo((106 / 2894) * 100, 5);
  });
});
