import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getCurrentUserMock } = vi.hoisted(() => ({
  prismaMock: {
    conversa: { findMany: vi.fn() },
    mensagem: { groupBy: vi.fn() },
    tarefa: { findMany: vi.fn() },
  },
  getCurrentUserMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args) }));

import { GET } from "./route";

const USER = { id: "user-1" };
const AGORA = new Date("2026-01-15T12:00:00.000Z");

function conversaDb(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    nomeContato: "Cliente Teste",
    telefone: "5581999999999",
    instanceName: "taciane-villa",
    atendidoPorId: "usuario-1",
    tarefaAtualId: null,
    ultimaMensagemEm: new Date("2026-01-15T11:00:00.000Z"),
    canalWhatsapp: { agenteIA: null }, // canal humano
    atendidoPor: { nome: "Taciane" },
    empresa: null,
    oportunidade: null,
    mensagens: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue(USER);
  prismaMock.tarefa.findMany.mockResolvedValue([]);
  prismaMock.mensagem.groupBy.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/conversas/alertas — autenticação", () => {
  it("sem usuário logado: 401, nunca consulta o banco", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await GET();

    expect(res.status).toBe(401);
    expect(prismaMock.conversa.findMany).not.toHaveBeenCalled();
    expect(prismaMock.tarefa.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/conversas/alertas — universo filtrado antes de varrer mensagens (performance)", () => {
  it("consulta conversas só com status ABERTA/PENDENTE", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([]);

    await GET();

    const chamada = prismaMock.conversa.findMany.mock.calls[0][0];
    expect(chamada.where.status).toEqual({ in: ["ABERTA", "PENDENTE"] });
  });

  it("nenhuma conversa retornada: não chama groupBy de mensagens (evita IN vazio)", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([]);

    await GET();

    expect(prismaMock.mensagem.groupBy).not.toHaveBeenCalled();
  });

  it("filtra tarefas por tipo WHATSAPP, status ativo e dataVencimento antes de hoje (mesmos valores de statusAtivos)", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([]);

    await GET();

    const chamada = prismaMock.tarefa.findMany.mock.calls[0][0];
    expect(chamada.where.tipo).toBe("WHATSAPP");
    expect(chamada.where.status).toEqual({ in: ["PENDENTE", "EM_ANDAMENTO"] });
    expect(chamada.where.dataVencimento.lt.toISOString().slice(0, 10)).toBe("2026-01-15");
  });
});

describe("GET /api/conversas/alertas — classificação combinada", () => {
  it("conversa sem nenhum motivo não aparece na fila", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([conversaDb()]);
    prismaMock.mensagem.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual([]);
  });

  it("conversa aguardando >4h sem responsável: um único item com os dois motivos", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([
      conversaDb({ atendidoPorId: null, atendidoPor: null }),
    ]);
    prismaMock.mensagem.groupBy
      .mockResolvedValueOnce([{ conversaId: "c1", _max: { createdAt: new Date("2026-01-15T06:00:00.000Z") } }])
      .mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].tipo).toBe("conversa");
    expect(body[0].motivos.sort()).toEqual(["aguardando_urgente", "sem_responsavel"].sort());
    expect(body[0].severidade).toBe("aguardando_urgente");
    expect(body[0].canalTipo).toBe("HUMANO");
  });

  it("canal de IA (agenteIA preenchido, ex.: João/Maria): canalTipo = IA e entra na fila normalmente", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([
      conversaDb({
        instanceName: "joao-villa",
        canalWhatsapp: { agenteIA: "joao" },
        atendidoPorId: null,
        atendidoPor: null,
      }),
    ]);
    prismaMock.mensagem.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].canalTipo).toBe("IA");
    expect(body[0].motivos).toEqual(["sem_responsavel"]);
  });

  it("tarefa WhatsApp vencida vinculada via tarefaAtualId: aparece como motivo da conversa, não como item solto", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([conversaDb({ tarefaAtualId: "t1" })]);
    prismaMock.mensagem.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prismaMock.tarefa.findMany.mockResolvedValue([
      { id: "t1", titulo: "Follow-up", status: "PENDENTE", dataVencimento: new Date("2026-01-13T00:00:00.000Z"), responsavelId: "usuario-1" },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].tipo).toBe("conversa");
    expect(body[0].motivos).toContain("tarefa_whatsapp_vencida");
  });

  it("tarefa WhatsApp vencida sem conversa vinculada: aparece como item solto tipo 'tarefa'", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([conversaDb()]); // conversa sem alerta próprio
    prismaMock.mensagem.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prismaMock.tarefa.findMany.mockResolvedValue([
      { id: "t-solta", titulo: "Follow-up", status: "PENDENTE", dataVencimento: new Date("2026-01-13T00:00:00.000Z"), responsavelId: "usuario-1" },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body).toEqual([
      expect.objectContaining({ tipo: "tarefa", tarefaId: "t-solta" }),
    ]);
  });

  it("ordenação: urgente vem antes de sem_responsavel", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([
      conversaDb({ id: "c-sem-resp", atendidoPorId: null, atendidoPor: null }),
      conversaDb({ id: "c-urgente" }),
    ]);
    prismaMock.mensagem.groupBy
      .mockResolvedValueOnce([
        { conversaId: "c-urgente", _max: { createdAt: new Date("2026-01-15T06:00:00.000Z") } },
      ])
      .mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();

    expect(body.map((item: { conversaId: string }) => item.conversaId)).toEqual(["c-urgente", "c-sem-resp"]);
  });

  it("repassa empresa, oportunidade/valor, responsável e última mensagem quando a conversa já tem esses vínculos", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([
      conversaDb({
        atendidoPorId: null,
        atendidoPor: null,
        empresa: { razaoSocial: "Betoneiras Alfa Ltda", nomeFantasia: "Alfa Betoneiras" },
        oportunidade: { id: "op-1", titulo: "Locação de betoneira", valorContrato: "15000.00" },
        mensagens: [{ conteudo: "Ainda aguardo retorno", direcao: "ENTRADA", createdAt: new Date("2026-01-15T10:00:00.000Z") }],
      }),
    ]);
    prismaMock.mensagem.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].empresaNome).toBe("Betoneiras Alfa Ltda");
    expect(body[0].oportunidade).toEqual({ id: "op-1", titulo: "Locação de betoneira", valor: 15000 });
    expect(body[0].ultimaMensagem).toEqual({
      conteudo: "Ainda aguardo retorno",
      direcao: "ENTRADA",
      createdAt: "2026-01-15T10:00:00.000Z",
    });
    expect(body[0].atendidoPorNome).toBeNull();
  });

  it("responsável: repassa o nome de atendidoPor quando a conversa tem responsável", async () => {
    prismaMock.conversa.findMany.mockResolvedValue([conversaDb({ atendidoPor: { nome: "Morgana" } })]);
    prismaMock.mensagem.groupBy
      .mockResolvedValueOnce([{ conversaId: "c1", _max: { createdAt: new Date("2026-01-15T06:00:00.000Z") } }])
      .mockResolvedValueOnce([]);

    const res = await GET();
    const body = await res.json();

    expect(body[0].atendidoPorNome).toBe("Morgana");
  });
});

describe("GET /api/conversas/alertas — regressão", () => {
  it("continua retornando 401 sem tocar em nenhuma tabela quando não há sessão (mesmo padrão de /api/conversas)", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    await GET();
    expect(prismaMock.mensagem.groupBy).not.toHaveBeenCalled();
  });
});
