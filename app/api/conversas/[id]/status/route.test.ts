import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getCurrentUserMock, auditLogMock } = vi.hoisted(() => ({
  prismaMock: {
    conversa: { findUnique: vi.fn(), update: vi.fn() },
  },
  getCurrentUserMock: vi.fn(),
  auditLogMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args) }));
vi.mock("@/lib/audit", () => ({ auditLog: (...args: unknown[]) => auditLogMock(...args) }));

import { PATCH } from "./route";

const USER = { id: "user-1" };

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue(USER);
  auditLogMock.mockResolvedValue(undefined);
});

function criarRequest(body: unknown) {
  return new Request("https://villa-crm.vercel.app/api/conversas/c1/status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

function contexto(id = "c1") {
  return { params: Promise.resolve({ id }) } as never;
}

describe("PATCH /api/conversas/[id]/status — autenticação", () => {
  it("sem usuário logado: 401, nunca consulta nem grava", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await PATCH(criarRequest({ status: "PENDENTE" }), contexto());
    expect(res.status).toBe(401);
    expect(prismaMock.conversa.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/conversas/[id]/status — validação", () => {
  it("status ausente: 400, nunca grava", async () => {
    const res = await PATCH(criarRequest({}), contexto());
    expect(res.status).toBe(400);
    expect(prismaMock.conversa.update).not.toHaveBeenCalled();
  });

  it("status inválido (fora do enum): 400, nunca grava", async () => {
    const res = await PATCH(criarRequest({ status: "QUALQUER_COISA" }), contexto());
    expect(res.status).toBe(400);
    expect(prismaMock.conversa.update).not.toHaveBeenCalled();
  });

  it('rejeita tentativa de setar "aguardando resposta" como se fosse um status — não existe esse valor no enum', async () => {
    const res = await PATCH(criarRequest({ status: "AGUARDANDO_RESPOSTA" }), contexto());
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/conversas/[id]/status — conversa não encontrada", () => {
  it("404 quando a conversa não existe", async () => {
    prismaMock.conversa.findUnique.mockResolvedValue(null);
    const res = await PATCH(criarRequest({ status: "PENDENTE" }), contexto());
    expect(res.status).toBe(404);
    expect(prismaMock.conversa.update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/conversas/[id]/status — mudança válida", () => {
  it.each(["ABERTA", "PENDENTE", "CONCLUIDA", "SPAM"] as const)("aceita status=%s e grava", async (status) => {
    prismaMock.conversa.findUnique.mockResolvedValue({ id: "c1", status: "ABERTA" });
    prismaMock.conversa.update.mockResolvedValue({ id: "c1", status });

    const res = await PATCH(criarRequest({ status }), contexto());

    expect(res.status).toBe(200);
    expect(prismaMock.conversa.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "c1" }, data: { status } }),
    );
  });

  it("registra auditoria com before/after e usuário", async () => {
    prismaMock.conversa.findUnique.mockResolvedValue({ id: "c1", status: "ABERTA" });
    prismaMock.conversa.update.mockResolvedValue({ id: "c1", status: "PENDENTE" });

    await PATCH(criarRequest({ status: "PENDENTE" }), contexto());

    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CONVERSA_STATUS_ALTERADO_MANUALMENTE",
        entity: "Conversa",
        entityId: "c1",
        before: { status: "ABERTA" },
        after: { status: "PENDENTE" },
        userId: "user-1",
      }),
    );
  });
});
