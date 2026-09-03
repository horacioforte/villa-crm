import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, requirePermissionMock } = vi.hoisted(() => ({
  prismaMock: {
    redeSocialConta: { findFirst: vi.fn() },
    conteudoSocial: { findMany: vi.fn() },
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
  return new Request(`https://villa-crm.vercel.app/api/midias-sociais/instagram/conteudos${query}`) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePermissionMock.mockResolvedValue(ADMIN);
});

describe("GET /api/midias-sociais/instagram/conteudos", () => {
  it("sem permissão: retorna a resposta de erro de requirePermission, nunca consulta o banco", async () => {
    requirePermissionMock.mockResolvedValue(
      NextResponse.json({ message: "Voce nao tem permissao para executar esta acao." }, { status: 403 }),
    );

    const res = await GET(criarRequest());

    expect(res.status).toBe(403);
    expect(prismaMock.redeSocialConta.findFirst).not.toHaveBeenCalled();
  });

  it("tipo inválido: 400, nunca consulta o banco", async () => {
    const res = await GET(criarRequest("?tipo=VIDEO"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toMatch(/tipo inválido/i);
    expect(prismaMock.redeSocialConta.findFirst).not.toHaveBeenCalled();
  });

  it("nenhuma conta Instagram cadastrada: data vazio, nextCursor null", async () => {
    prismaMock.redeSocialConta.findFirst.mockResolvedValue(null);

    const res = await GET(criarRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ data: [], nextCursor: null });
    expect(prismaMock.conteudoSocial.findMany).not.toHaveBeenCalled();
  });

  it("lista os conteúdos sem filtro de tipo, aplicando o limite padrão (12)", async () => {
    prismaMock.redeSocialConta.findFirst.mockResolvedValue({ id: "conta-1" });
    prismaMock.conteudoSocial.findMany.mockResolvedValue([{ id: "post-1" }, { id: "post-2" }]);

    const res = await GET(criarRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.nextCursor).toBeNull();
    expect(prismaMock.conteudoSocial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { redeSocialContaId: "conta-1" },
        take: 13,
      }),
    );
  });

  it("filtra por tipo quando informado", async () => {
    prismaMock.redeSocialConta.findFirst.mockResolvedValue({ id: "conta-1" });
    prismaMock.conteudoSocial.findMany.mockResolvedValue([{ id: "reel-1", tipo: "REEL" }]);

    const res = await GET(criarRequest("?tipo=REEL"));

    expect(res.status).toBe(200);
    expect(prismaMock.conteudoSocial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { redeSocialContaId: "conta-1", tipo: "REEL" },
      }),
    );
  });

  it("respeita o parâmetro limit (dentro do máximo de 50)", async () => {
    prismaMock.redeSocialConta.findFirst.mockResolvedValue({ id: "conta-1" });
    prismaMock.conteudoSocial.findMany.mockResolvedValue([]);

    await GET(criarRequest("?limit=5"));

    expect(prismaMock.conteudoSocial.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 6 }));
  });

  it("limit acima do máximo é limitado a 50", async () => {
    prismaMock.redeSocialConta.findFirst.mockResolvedValue({ id: "conta-1" });
    prismaMock.conteudoSocial.findMany.mockResolvedValue([]);

    await GET(criarRequest("?limit=500"));

    expect(prismaMock.conteudoSocial.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51 }));
  });

  it("quando há mais itens que o limite, devolve nextCursor com o id do último item da página", async () => {
    prismaMock.redeSocialConta.findFirst.mockResolvedValue({ id: "conta-1" });
    prismaMock.conteudoSocial.findMany.mockResolvedValue([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);

    const res = await GET(criarRequest("?limit=2"));
    const body = await res.json();

    expect(body.data).toHaveLength(2);
    expect(body.nextCursor).toBe("b");
  });

  it("passa o cursor recebido para a query, com skip: 1", async () => {
    prismaMock.redeSocialConta.findFirst.mockResolvedValue({ id: "conta-1" });
    prismaMock.conteudoSocial.findMany.mockResolvedValue([]);

    await GET(criarRequest("?cursor=cursor-abc"));

    expect(prismaMock.conteudoSocial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "cursor-abc" }, skip: 1 }),
    );
  });
});
