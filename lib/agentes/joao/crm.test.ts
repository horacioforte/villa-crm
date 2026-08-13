import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    conversa: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    mensagem: { createMany: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { salvarMensagensJoao } from "./crm";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.mensagem.createMany.mockResolvedValue({ count: 2 });
});

describe("salvarMensagensJoao (V1 legado) — Ciclo de Atendimento, reabertura mínima aprovada", () => {
  it("PENDENTE reabre para ABERTA ao chegar mensagem do cliente", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", status: "PENDENTE" });
    prismaMock.conversa.update.mockResolvedValue({});

    await salvarMensagensJoao({
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      textoCliente: "Ainda preciso de ajuda",
      textoJoao: "Claro, vamos continuar",
    });

    expect(prismaMock.conversa.update).toHaveBeenCalledWith({
      where: { id: "conversa-1" },
      data: { updatedAt: expect.any(Date), nomeContato: "Cliente Teste", status: "ABERTA" },
    });
  });

  it("CONCLUIDA reabre para ABERTA ao chegar mensagem do cliente", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", status: "CONCLUIDA" });
    prismaMock.conversa.update.mockResolvedValue({});

    await salvarMensagensJoao({
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      textoCliente: "oi de novo",
      textoJoao: "resposta",
    });

    expect(prismaMock.conversa.update).toHaveBeenCalledWith({
      where: { id: "conversa-1" },
      data: { updatedAt: expect.any(Date), nomeContato: "Cliente Teste", status: "ABERTA" },
    });
  });

  it("SPAM NUNCA reabre sozinha", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", status: "SPAM" });
    prismaMock.conversa.update.mockResolvedValue({});

    await salvarMensagensJoao({
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      textoCliente: "mensagem indesejada",
      textoJoao: "resposta",
    });

    expect(prismaMock.conversa.update).toHaveBeenCalledWith({
      where: { id: "conversa-1" },
      data: { updatedAt: expect.any(Date), nomeContato: "Cliente Teste" }, // sem "status"
    });
  });

  it("ABERTA não sofre escrita extra de status", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", status: "ABERTA" });
    prismaMock.conversa.update.mockResolvedValue({});

    await salvarMensagensJoao({
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      textoCliente: "oi",
      textoJoao: "resposta",
    });

    expect(prismaMock.conversa.update).toHaveBeenCalledWith({
      where: { id: "conversa-1" },
      data: { updatedAt: expect.any(Date), nomeContato: "Cliente Teste" },
    });
  });

  it("conversa nova (nunca existiu): cria com status padrão, não chama update de reabertura", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue(null);
    prismaMock.conversa.create.mockResolvedValue({ id: "conversa-nova", status: "ABERTA" });

    await salvarMensagensJoao({
      telefone: "558199999999",
      nomeContato: "Cliente Novo",
      textoCliente: "primeira mensagem",
      textoJoao: "resposta",
    });

    expect(prismaMock.conversa.create).toHaveBeenCalled();
    expect(prismaMock.conversa.update).not.toHaveBeenCalled();
  });

  it("anomalia histórica documentada: mensagem do cliente é gravada com autor HUMANO (não CLIENTE) — comportamento preservado nesta sprint, não corrigido", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", status: "ABERTA" });
    prismaMock.conversa.update.mockResolvedValue({});

    await salvarMensagensJoao({
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      textoCliente: "Gostaria de saber o preço",
      textoJoao: "Vou verificar",
    });

    expect(prismaMock.mensagem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ direcao: "ENTRADA", autor: "HUMANO", conteudo: "Gostaria de saber o preço" }),
        expect.objectContaining({ direcao: "SAIDA", autor: "IA", conteudo: "Vou verificar" }),
      ],
    });
  });

  it("erro ao salvar não propaga (comportamento pré-existente preservado)", async () => {
    prismaMock.conversa.findFirst.mockRejectedValue(new Error("falha de banco"));

    await expect(
      salvarMensagensJoao({
        telefone: "558199999999",
        nomeContato: "Cliente Teste",
        textoCliente: "oi",
        textoJoao: "resposta",
      }),
    ).resolves.not.toThrow();
  });
});
