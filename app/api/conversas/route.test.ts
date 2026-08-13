import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getCurrentUserMock } = vi.hoisted(() => ({
  prismaMock: {
    conversa: { findMany: vi.fn() },
    mensagem: { groupBy: vi.fn() },
  },
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

function criarRequest(qs = "") {
  return new Request(`https://villa-crm.vercel.app/api/conversas${qs}`) as never;
}

describe("GET /api/conversas — autenticação", () => {
  it("sem usuário logado: 401, nunca consulta o banco", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await GET(criarRequest());
    expect(res.status).toBe(401);
    expect(prismaMock.conversa.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/conversas — aguardandoRespostaDesde calculado por conversa", () => {
  it("conversa só com mensagem de cliente: aguardandoRespostaDesde = timestamp dessa mensagem", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([{ id: "c1" }]);
    prismaMock.mensagem.groupBy
      .mockResolvedValueOnce([{ conversaId: "c1", _max: { createdAt: new Date("2026-01-01T10:00:00.000Z") } }]) // ENTRADA
      .mockResolvedValueOnce([]); // SAIDA/HUMANO

    const res = await GET(criarRequest());
    const body = await res.json();

    expect(body[0].aguardandoRespostaDesde).toBe("2026-01-01T10:00:00.000Z");
  });

  it("conversa com resposta humana depois da mensagem do cliente: aguardandoRespostaDesde = null", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([{ id: "c1" }]);
    prismaMock.mensagem.groupBy
      .mockResolvedValueOnce([{ conversaId: "c1", _max: { createdAt: new Date("2026-01-01T10:00:00.000Z") } }])
      .mockResolvedValueOnce([{ conversaId: "c1", _max: { createdAt: new Date("2026-01-01T10:12:00.000Z") } }]);

    const res = await GET(criarRequest());
    const body = await res.json();

    expect(body[0].aguardandoRespostaDesde).toBeNull();
  });

  it("resposta de IA (não aparece no groupBy de SAIDA/HUMANO) não encerra a espera", async () => {
    // O groupBy de SAIDA/HUMANO já filtra autor=HUMANO na query — uma resposta de IA
    // nunca aparece nesse resultado, então o mock vazio simula exatamente esse caso.
    prismaMock.conversa.findMany.mockResolvedValue([{ id: "c1" }]);
    prismaMock.mensagem.groupBy
      .mockResolvedValueOnce([{ conversaId: "c1", _max: { createdAt: new Date("2026-01-01T10:00:00.000Z") } }])
      .mockResolvedValueOnce([]);

    const res = await GET(criarRequest());
    const body = await res.json();

    expect(body[0].aguardandoRespostaDesde).toBe("2026-01-01T10:00:00.000Z");
  });

  it("conversa sem nenhuma mensagem ENTRADA: aguardandoRespostaDesde = null", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([{ id: "c1" }]);
    prismaMock.mensagem.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const res = await GET(criarRequest());
    const body = await res.json();

    expect(body[0].aguardandoRespostaDesde).toBeNull();
  });

  it("múltiplas conversas: cada uma recebe seu próprio aguardandoRespostaDesde (sem cruzar dados entre conversas)", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    prismaMock.mensagem.groupBy
      .mockResolvedValueOnce([
        { conversaId: "c1", _max: { createdAt: new Date("2026-01-01T10:00:00.000Z") } },
        { conversaId: "c2", _max: { createdAt: new Date("2026-01-01T09:00:00.000Z") } },
      ])
      .mockResolvedValueOnce([{ conversaId: "c2", _max: { createdAt: new Date("2026-01-01T09:30:00.000Z") } }]);

    const res = await GET(criarRequest());
    const body = await res.json();

    const c1 = body.find((c: { id: string }) => c.id === "c1");
    const c2 = body.find((c: { id: string }) => c.id === "c2");
    expect(c1.aguardandoRespostaDesde).toBe("2026-01-01T10:00:00.000Z");
    expect(c2.aguardandoRespostaDesde).toBeNull(); // humano (09:30) depois do cliente (09:00)
  });

  it("nenhuma conversa retornada: não chama groupBy (evita query com IN vazio)", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([]);

    const res = await GET(criarRequest());
    const body = await res.json();

    expect(body).toEqual([]);
    expect(prismaMock.mensagem.groupBy).not.toHaveBeenCalled();
  });
});

describe("GET /api/conversas — filtros existentes continuam funcionando (regressão)", () => {
  it("repassa status, instance, busca etc. para o where do Prisma", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([]);

    await GET(criarRequest("?status=ABERTA&instance=taciane-villa&busca=Horacio"));

    const chamada = prismaMock.conversa.findMany.mock.calls[0][0];
    expect(chamada.where.status).toBe("ABERTA");
    expect(chamada.where.instanceName).toBe("taciane-villa");
    expect(chamada.where.OR).toEqual([
      { nomeContato: { contains: "Horacio", mode: "insensitive" } },
      { telefone: { contains: "Horacio" } },
    ]);
  });
});
