import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    canalWhatsapp: { findUnique: vi.fn() },
    conversa: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    mensagem: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { getCanalMaria, mensagemJaProcessada, persistirConversaMaria } from "./maria";

const CANAL = { id: "canal-maria", instanceName: "maria-villa", tipo: "META_CLOUD_API", ativo: true } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCanalMaria", () => {
  it("busca o canal por instanceName 'maria-villa'", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue(CANAL);
    const canal = await getCanalMaria();
    expect(canal).toBe(CANAL);
    expect(prismaMock.canalWhatsapp.findUnique).toHaveBeenCalledWith({ where: { instanceName: "maria-villa" } });
  });

  it("retorna null se o canal ainda não foi cadastrado", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue(null);
    const canal = await getCanalMaria();
    expect(canal).toBeNull();
  });
});

describe("mensagemJaProcessada", () => {
  it("retorna true quando já existe Mensagem com o mesmo canalWhatsappId + externalMessageId", async () => {
    prismaMock.mensagem.findFirst.mockResolvedValue({ id: "msg-existente" });
    const resultado = await mensagemJaProcessada({ canal: CANAL, externalMessageId: "wamid.abc" });
    expect(resultado).toBe(true);
    expect(prismaMock.mensagem.findFirst).toHaveBeenCalledWith({
      where: { canalWhatsappId: "canal-maria", externalMessageId: "wamid.abc" },
      select: { id: true },
    });
  });

  it("retorna false quando não existe mensagem com esse id", async () => {
    prismaMock.mensagem.findFirst.mockResolvedValue(null);
    const resultado = await mensagemJaProcessada({ canal: CANAL, externalMessageId: "wamid.novo" });
    expect(resultado).toBe(false);
  });
});

describe("persistirConversaMaria — conversa", () => {
  it("cria uma nova Conversa quando não existe nenhuma para o telefone", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue(null);
    prismaMock.conversa.create.mockResolvedValue({ id: "conversa-nova" });
    prismaMock.mensagem.create.mockResolvedValue({ id: "m1" });
    prismaMock.conversa.update.mockResolvedValue({});

    await persistirConversaMaria({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid.1",
      messageType: "text",
      textoCliente: "Preciso de uma bomba",
      rawPayload: { id: "wamid.1" },
      textoResposta: "Claro, qual a cidade da obra?",
    });

    expect(prismaMock.conversa.create).toHaveBeenCalledWith({
      data: {
        instanceName: "maria-villa",
        telefone: "558199999999",
        nomeContato: "Cliente Teste",
        canalWhatsappId: "canal-maria",
      },
    });
  });

  it("reaproveita Conversa existente já vinculada ao canal, sem criar outra", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({
      id: "conversa-existente",
      canalWhatsappId: "canal-maria",
    });
    prismaMock.mensagem.create.mockResolvedValue({ id: "m1" });
    prismaMock.conversa.update.mockResolvedValue({});

    await persistirConversaMaria({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid.2",
      messageType: "text",
      textoCliente: "Recife.",
      rawPayload: { id: "wamid.2" },
      textoResposta: "Qual a previsão de início?",
    });

    expect(prismaMock.conversa.create).not.toHaveBeenCalled();
    // update aqui é só o "ultimaMensagemEm" no fim — não deve gravar canalWhatsappId de novo.
    expect(prismaMock.conversa.update).toHaveBeenCalledWith({
      where: { id: "conversa-existente" },
      data: { ultimaMensagemEm: expect.any(Date) },
    });
  });

  it("vincula canalWhatsappId a uma Conversa existente que ainda não tinha canal", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-sem-canal", canalWhatsappId: null });
    prismaMock.conversa.update.mockResolvedValueOnce({ id: "conversa-sem-canal", canalWhatsappId: "canal-maria" });
    prismaMock.mensagem.create.mockResolvedValue({ id: "m1" });
    prismaMock.conversa.update.mockResolvedValueOnce({});

    await persistirConversaMaria({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid.3",
      messageType: "text",
      textoCliente: "oi",
      rawPayload: {},
      textoResposta: "resposta",
    });

    expect(prismaMock.conversa.update).toHaveBeenNthCalledWith(1, {
      where: { id: "conversa-sem-canal" },
      data: { canalWhatsappId: "canal-maria", nomeContato: "Cliente Teste" },
    });
  });

  it("lança erro se a Conversa existente pertence a outro canal (nunca sobrescreve silenciosamente)", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-x", canalWhatsappId: "outro-canal" });

    await expect(
      persistirConversaMaria({
        canal: CANAL,
        telefone: "558199999999",
        nomeContato: "Cliente Teste",
        externalMessageId: "wamid.4",
        messageType: "text",
        textoCliente: "oi",
        rawPayload: {},
        textoResposta: "resposta",
      }),
    ).rejects.toThrow(/divergente do canal/);

    expect(prismaMock.mensagem.create).not.toHaveBeenCalled();
  });
});

describe("persistirConversaMaria — mensagens", () => {
  beforeEach(() => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-maria" });
    prismaMock.conversa.update.mockResolvedValue({});
  });

  it("grava a mensagem de entrada com autor CLIENTE, status RECEBIDA e os campos de auditoria", async () => {
    prismaMock.mensagem.create.mockResolvedValue({ id: "m-entrada" });

    await persistirConversaMaria({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid.5",
      messageType: "text",
      textoCliente: "Preciso de uma bomba",
      rawPayload: { id: "wamid.5", type: "text" },
      textoResposta: "Claro, qual a cidade da obra?",
    });

    expect(prismaMock.mensagem.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        conversaId: "conversa-1",
        conteudo: "Preciso de uma bomba",
        direcao: "ENTRADA",
        autor: "CLIENTE",
        status: "RECEBIDA",
        canalWhatsappId: "canal-maria",
        externalMessageId: "wamid.5",
        messageType: "text",
        rawPayload: { id: "wamid.5", type: "text" },
        processamentoStatus: "PROCESSADA",
      }),
    });
  });

  it("grava a mensagem de saída com autor IA, direção SAIDA — sem disparar um novo envio", async () => {
    prismaMock.mensagem.create.mockResolvedValue({ id: "m-saida" });

    await persistirConversaMaria({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid.6",
      messageType: "text",
      textoCliente: "Recife",
      rawPayload: {},
      textoResposta: "Qual a previsão de início?",
    });

    expect(prismaMock.mensagem.create).toHaveBeenNthCalledWith(2, {
      data: {
        conversaId: "conversa-1",
        conteudo: "Qual a previsão de início?",
        direcao: "SAIDA",
        autor: "IA",
        status: "ENVIADA",
        canalWhatsappId: "canal-maria",
      },
    });
  });

  it("corrida concorrente (P2002 na mensagem de entrada) é tratada como sucesso idempotente, não como erro", async () => {
    prismaMock.mensagem.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const resultado = await persistirConversaMaria({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid.7",
      messageType: "text",
      textoCliente: "oi",
      rawPayload: {},
      textoResposta: "resposta",
    });

    expect(resultado).toEqual({ id: "conversa-1", canalWhatsappId: "canal-maria" });
    // Não deve tentar gravar a mensagem de saída se a de entrada colidiu.
    expect(prismaMock.mensagem.create).toHaveBeenCalledTimes(1);
  });

  it("relança erros que não são P2002", async () => {
    prismaMock.mensagem.create.mockRejectedValueOnce(new Error("Falha de conexão com o banco"));

    await expect(
      persistirConversaMaria({
        canal: CANAL,
        telefone: "558199999999",
        nomeContato: "Cliente Teste",
        externalMessageId: "wamid.8",
        messageType: "text",
        textoCliente: "oi",
        rawPayload: {},
        textoResposta: "resposta",
      }),
    ).rejects.toThrow("Falha de conexão com o banco");
  });
});
