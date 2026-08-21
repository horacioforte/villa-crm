import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/app/generated/prisma/client";

const { prismaMock, requirePermissionMock } = vi.hoisted(() => ({
  prismaMock: {
    redeSocialConta: { findMany: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  requirePermissionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/session", () => ({
  requirePermission: (...args: unknown[]) => requirePermissionMock(...args),
}));

import { GET, POST } from "./route";

const ADMIN = { id: "user-1", papel: "ADMIN" as const };

function criarRequest(body?: unknown) {
  return new Request("https://villa-crm.vercel.app/api/midias-sociais/contas", {
    method: body ? "POST" : "GET",
    ...(body
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePermissionMock.mockResolvedValue(ADMIN);
  prismaMock.auditLog.create.mockResolvedValue({});
});

describe("GET /api/midias-sociais/contas", () => {
  it("sem permissão: retorna a resposta de erro de requirePermission, nunca consulta o banco", async () => {
    requirePermissionMock.mockResolvedValue(
      NextResponse.json(
        { message: "Voce nao tem permissao para executar esta acao." },
        { status: 403 },
      ),
    );

    const res = await GET(criarRequest());

    expect(res.status).toBe(403);
    expect(prismaMock.redeSocialConta.findMany).not.toHaveBeenCalled();
  });

  it("lista as contas ordenadas por rede", async () => {
    prismaMock.redeSocialConta.findMany.mockResolvedValue([
      { id: "c1", rede: "INSTAGRAM", nome: "@villapumps" },
    ]);

    const res = await GET(criarRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(prismaMock.redeSocialConta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { rede: "asc" } }),
    );
  });
});

describe("POST /api/midias-sociais/contas", () => {
  it("dados inválidos (nome vazio): 400 e nunca chama o banco", async () => {
    const res = await POST(criarRequest({ rede: "INSTAGRAM", nome: "" }));

    expect(res.status).toBe(400);
    expect(prismaMock.redeSocialConta.create).not.toHaveBeenCalled();
  });

  it("sem permissão de create: retorna a resposta de erro, nunca chama o banco", async () => {
    requirePermissionMock.mockResolvedValue(
      NextResponse.json(
        { message: "Voce nao tem permissao para executar esta acao." },
        { status: 403 },
      ),
    );

    const res = await POST(criarRequest({ rede: "INSTAGRAM", nome: "@villapumps" }));

    expect(res.status).toBe(403);
    expect(prismaMock.redeSocialConta.create).not.toHaveBeenCalled();
  });

  it("cria a conta e registra auditoria", async () => {
    prismaMock.redeSocialConta.create.mockResolvedValue({
      id: "c1",
      rede: "INSTAGRAM",
      nome: "@villapumps",
    });

    const res = await POST(criarRequest({ rede: "INSTAGRAM", nome: "@villapumps" }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe("c1");
    expect(prismaMock.redeSocialConta.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rede: "INSTAGRAM",
          nome: "@villapumps",
          createdById: ADMIN.id,
        }),
      }),
    );
    expect(prismaMock.auditLog.create).toHaveBeenCalled();
  });

  it("rede já cadastrada: 409 (violação da constraint @@unique([rede]))", async () => {
    prismaMock.redeSocialConta.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed on the fields: (`rede`)",
        { code: "P2002", clientVersion: "0.0.0" },
      ),
    );

    const res = await POST(criarRequest({ rede: "INSTAGRAM", nome: "@villapumps" }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.message).toMatch(/INSTAGRAM/);
  });
});
