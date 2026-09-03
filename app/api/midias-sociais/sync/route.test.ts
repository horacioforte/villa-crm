import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, requirePermissionMock, sincronizarInstagramMock } = vi.hoisted(() => ({
  prismaMock: {
    redeSocialConta: { findMany: vi.fn() },
  },
  requirePermissionMock: vi.fn(),
  sincronizarInstagramMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
}));
vi.mock("@/lib/instagram/sync-engine", () => ({
  sincronizarInstagram: (...args: unknown[]) => sincronizarInstagramMock(...args),
}));

import { POST } from "./route";

const ADMIN = { id: "user-1", papel: "ADMIN" as const };
const ORIGINAL_ENV = { ...process.env };

function criarRequest(opts: { body?: unknown; authorization?: string } = {}) {
  return new NextRequest("https://villa-crm.vercel.app/api/midias-sociais/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.authorization ? { authorization: opts.authorization } : {}),
    },
    body: JSON.stringify(opts.body ?? {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV, CRON_SECRET: "segredo-cron-fake", AGENT_API_KEY: "agent-key-fake" };
  requirePermissionMock.mockResolvedValue(ADMIN);
});

describe("autenticação", () => {
  it("aceita Authorization: Bearer <CRON_SECRET> sem exigir sessão de usuário", async () => {
    sincronizarInstagramMock.mockResolvedValue({ status: "SUCESSO", contagemMetricas: 1, contagemConteudos: 3, duracaoMs: 100 });

    const res = await POST(
      criarRequest({ body: { redeSocialContaId: "conta-1" }, authorization: "Bearer segredo-cron-fake" }),
    );

    expect(res.status).toBe(200);
    expect(requirePermissionMock).not.toHaveBeenCalled();
  });

  it("aceita Authorization: Bearer <AGENT_API_KEY> (teste manual)", async () => {
    sincronizarInstagramMock.mockResolvedValue({ status: "SUCESSO", contagemMetricas: 1, contagemConteudos: 0, duracaoMs: 50 });

    const res = await POST(
      criarRequest({ body: { redeSocialContaId: "conta-1" }, authorization: "Bearer agent-key-fake" }),
    );

    expect(res.status).toBe(200);
    expect(requirePermissionMock).not.toHaveBeenCalled();
  });

  it("sem Bearer válido, exige sessão via requirePermission (midias_sociais/create)", async () => {
    sincronizarInstagramMock.mockResolvedValue({ status: "SUCESSO", contagemMetricas: 1, contagemConteudos: 0, duracaoMs: 50 });

    await POST(criarRequest({ body: { redeSocialContaId: "conta-1" } }));

    expect(requirePermissionMock).toHaveBeenCalledWith("midias_sociais", "create", expect.anything());
  });

  it("sem permissão (papel sem acesso a create): retorna a resposta de erro, nunca sincroniza", async () => {
    requirePermissionMock.mockResolvedValue(
      NextResponse.json({ message: "Voce nao tem permissao para executar esta acao." }, { status: 403 }),
    );

    const res = await POST(criarRequest({ body: { redeSocialContaId: "conta-1" } }));

    expect(res.status).toBe(403);
    expect(sincronizarInstagramMock).not.toHaveBeenCalled();
  });

  it("Bearer com valor errado não autentica por sistema — cai para requirePermission", async () => {
    sincronizarInstagramMock.mockResolvedValue({ status: "SUCESSO", contagemMetricas: 1, contagemConteudos: 0, duracaoMs: 50 });

    await POST(criarRequest({ body: { redeSocialContaId: "conta-1" }, authorization: "Bearer valor-errado" }));

    expect(requirePermissionMock).toHaveBeenCalled();
  });
});

describe("resposta", () => {
  it("com redeSocialContaId: sincroniza só essa conta e devolve o resultado", async () => {
    sincronizarInstagramMock.mockResolvedValue({
      status: "PARCIAL",
      contagemMetricas: 1,
      contagemConteudos: 2,
      duracaoMs: 300,
      erro: "Mídia x: erro y",
    });

    const res = await POST(criarRequest({ body: { redeSocialContaId: "conta-1" } }));
    const json = await res.json();

    expect(sincronizarInstagramMock).toHaveBeenCalledWith("conta-1");
    expect(json.status).toBe("PARCIAL");
    expect(json.redeSocialContaId).toBe("conta-1");
  });

  it("sem redeSocialContaId e sem nenhuma conta ativa: 404 sem tentar sincronizar", async () => {
    prismaMock.redeSocialConta.findMany.mockResolvedValue([]);

    const res = await POST(criarRequest({}));

    expect(res.status).toBe(404);
    expect(sincronizarInstagramMock).not.toHaveBeenCalled();
  });

  it("sem redeSocialContaId: sincroniza todas as contas Instagram ativas e agrega os resultados", async () => {
    prismaMock.redeSocialConta.findMany.mockResolvedValue([{ id: "conta-1" }, { id: "conta-2" }]);
    sincronizarInstagramMock
      .mockResolvedValueOnce({ status: "SUCESSO", contagemMetricas: 1, contagemConteudos: 1, duracaoMs: 10 })
      .mockResolvedValueOnce({ status: "ERRO", contagemMetricas: 0, contagemConteudos: 0, duracaoMs: 5, erro: "falhou" });

    const res = await POST(criarRequest({}));
    const json = await res.json();

    expect(json.resultados).toHaveLength(2);
    expect(json.resultados[0].status).toBe("SUCESSO");
    expect(json.resultados[1].status).toBe("ERRO");
  });
});
