import { describe, expect, it } from "vitest";
import { getConversaPrioridade, ordenarConversasPorPrioridade } from "./prioridade";

describe("getConversaPrioridade", () => {
  it("marca como urgente quando a conversa está sem responsável e sem resposta há mais de 24h", () => {
    const conversa = {
      status: "ABERTA",
      ultimaMensagemEm: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
      atendidoPorId: null,
      mensagens: [{ direcao: "ENTRADA", createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString() }],
    };

    const prioridade = getConversaPrioridade(conversa as any);

    expect(prioridade.prioridade).toBe("urgente");
    expect(prioridade.label).toBe("Urgente");
  });

  it("marca como sem resposta quando a última mensagem veio do cliente e há mais de 24h sem retorno", () => {
    const conversa = {
      status: "ABERTA",
      ultimaMensagemEm: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
      atendidoPorId: "user-1",
      mensagens: [{ direcao: "ENTRADA", createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() }],
    };

    const prioridade = getConversaPrioridade(conversa as any);

    expect(prioridade.prioridade).toBe("sem-resposta");
    expect(prioridade.label).toBe("Sem resposta");
  });
});

describe("ordenarConversasPorPrioridade", () => {
  it("coloca conversas urgentes no topo da lista", () => {
    const conversas = [
      {
        id: "1",
        status: "ABERTA",
        ultimaMensagemEm: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        atendidoPorId: "user-1",
        mensagens: [{ direcao: "ENTRADA", createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }],
      },
      {
        id: "2",
        status: "ABERTA",
        ultimaMensagemEm: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
        atendidoPorId: null,
        mensagens: [{ direcao: "ENTRADA", createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString() }],
      },
    ];

    const ordenadas = ordenarConversasPorPrioridade(conversas as any[]);

    expect(ordenadas[0].id).toBe("2");
    expect(ordenadas[1].id).toBe("1");
  });

  it("com a mesma prioridade, desempata por ultimaMensagemEm DESC (mais recente primeiro) — regra explícita, não depende da ordem de entrada", () => {
    const antiga = {
      id: "antiga",
      status: "ABERTA",
      ultimaMensagemEm: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      atendidoPorId: "user-1",
      mensagens: [{ direcao: "ENTRADA", createdAt: new Date().toISOString() }],
    };
    const recente = {
      id: "recente",
      status: "ABERTA",
      ultimaMensagemEm: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      atendidoPorId: "user-1",
      mensagens: [{ direcao: "ENTRADA", createdAt: new Date().toISOString() }],
    };

    // Entrada deliberadamente na ordem "errada" (antiga antes da recente) — se o
    // desempate dependesse da estabilidade do sort/ordem de entrada, o resultado
    // sairia errado. Com a regra explícita, a mais recente sempre vem primeiro.
    const ordenadas = ordenarConversasPorPrioridade([antiga, recente] as any[]);

    expect(ordenadas[0].id).toBe("recente");
    expect(ordenadas[1].id).toBe("antiga");
  });

  it("conversas sem ultimaMensagemEm (nunca respondida) ficam depois das com data, dentro da mesma prioridade", () => {
    const semData = {
      id: "sem-data",
      status: "ABERTA",
      ultimaMensagemEm: null,
      atendidoPorId: "user-1",
      mensagens: [],
    };
    const comData = {
      id: "com-data",
      status: "ABERTA",
      ultimaMensagemEm: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      atendidoPorId: "user-1",
      mensagens: [{ direcao: "ENTRADA", createdAt: new Date().toISOString() }],
    };

    const ordenadas = ordenarConversasPorPrioridade([semData, comData] as any[]);

    expect(ordenadas[0].id).toBe("com-data");
    expect(ordenadas[1].id).toBe("sem-data");
  });
});
