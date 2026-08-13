import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getCurrentUserMock } = vi.hoisted(() => ({
  prismaMock: { conversa: { findUnique: vi.fn() } },
  getCurrentUserMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args) }));

import { GET } from "./route";

const USER = { id: "user-1" };

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue(USER);
});

function criarRequest() {
  return new Request("https://villa-crm.vercel.app/api/conversas/c1") as never;
}

function contexto(id = "c1") {
  return { params: Promise.resolve({ id }) } as never;
}

describe("GET /api/conversas/[id] — autenticação", () => {
  it("sem usuário logado: 401, nunca consulta o banco", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await GET(criarRequest(), contexto());
    expect(res.status).toBe(401);
    expect(prismaMock.conversa.findUnique).not.toHaveBeenCalled();
  });
});

describe("GET /api/conversas/[id] — conversa não encontrada", () => {
  it("404 quando a conversa não existe", async () => {
    prismaMock.conversa.findUnique.mockResolvedValue(null);
    const res = await GET(criarRequest(), contexto());
    expect(res.status).toBe(404);
  });
});

describe("GET /api/conversas/[id] — aguardandoRespostaDesde calculado", () => {
  it("só mensagem de cliente: aguardando desde essa mensagem", async () => {
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      mensagens: [{ direcao: "ENTRADA", autor: "CLIENTE", createdAt: "2026-01-01T10:00:00.000Z" }],
    });

    const res = await GET(criarRequest(), contexto());
    const body = await res.json();

    expect(body.aguardandoRespostaDesde).toBe("2026-01-01T10:00:00.000Z");
  });

  it("resposta de IA (Maria/João) não encerra a espera por atendimento humano", async () => {
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      mensagens: [
        { direcao: "ENTRADA", autor: "CLIENTE", createdAt: "2026-01-01T10:00:00.000Z" },
        { direcao: "SAIDA", autor: "IA", createdAt: "2026-01-01T10:00:05.000Z" },
      ],
    });

    const res = await GET(criarRequest(), contexto());
    const body = await res.json();

    expect(body.aguardandoRespostaDesde).toBe("2026-01-01T10:00:00.000Z");
  });

  it("resposta humana encerra a espera", async () => {
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      mensagens: [
        { direcao: "ENTRADA", autor: "CLIENTE", createdAt: "2026-01-01T10:00:00.000Z" },
        { direcao: "SAIDA", autor: "HUMANO", createdAt: "2026-01-01T10:12:00.000Z" },
      ],
    });

    const res = await GET(criarRequest(), contexto());
    const body = await res.json();

    expect(body.aguardandoRespostaDesde).toBeNull();
  });

  it("anomalia histórica do João V1 (mensagem do cliente gravada com autor HUMANO): ainda calcula aguardando corretamente", async () => {
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      instanceName: "joao-villa",
      mensagens: [{ direcao: "ENTRADA", autor: "HUMANO", createdAt: "2026-01-01T10:00:00.000Z" }],
    });

    const res = await GET(criarRequest(), contexto());
    const body = await res.json();

    expect(body.aguardandoRespostaDesde).toBe("2026-01-01T10:00:00.000Z");
  });

  it("preserva todos os demais campos da conversa (não remove nada, só acrescenta)", async () => {
    prismaMock.conversa.findUnique.mockResolvedValue({
      id: "c1",
      nomeContato: "Horácio Forte",
      status: "ABERTA",
      mensagens: [],
    });

    const res = await GET(criarRequest(), contexto());
    const body = await res.json();

    expect(body.id).toBe("c1");
    expect(body.nomeContato).toBe("Horácio Forte");
    expect(body.status).toBe("ABERTA");
    expect(body.aguardandoRespostaDesde).toBeNull();
  });
});
