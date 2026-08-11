import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/app/generated/prisma/client";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    canalWhatsapp: { findUnique: vi.fn() },
    conversa: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    mensagem: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { getCanalMorgana, mensagemJaProcessada, persistirMensagemCliente, reconciliarOuCriarMensagemHumana } from "./morgana";

const CANAL = { id: "canal-morgana", instanceName: "morgana-villa", tipo: "EVOLUTION", ativo: true } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCanalMorgana", () => {
  it("busca o canal por instanceName 'morgana-villa'", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue(CANAL);
    const canal = await getCanalMorgana();
    expect(canal).toBe(CANAL);
    expect(prismaMock.canalWhatsapp.findUnique).toHaveBeenCalledWith({ where: { instanceName: "morgana-villa" } });
  });
});

describe("mensagemJaProcessada", () => {
  it("true quando já existe mensagem com o mesmo canalWhatsappId + externalMessageId", async () => {
    prismaMock.mensagem.findFirst.mockResolvedValue({ id: "existente" });
    expect(await mensagemJaProcessada({ canal: CANAL, externalMessageId: "id-1" })).toBe(true);
  });

  it("false quando não existe", async () => {
    prismaMock.mensagem.findFirst.mockResolvedValue(null);
    expect(await mensagemJaProcessada({ canal: CANAL, externalMessageId: "id-2" })).toBe(false);
  });
});

describe("persistirMensagemCliente — inbound de cliente real", () => {
  beforeEach(() => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-morgana" });
    prismaMock.conversa.update.mockResolvedValue({});
  });

  it("cria a mensagem com autor CLIENTE, direcao ENTRADA, status RECEBIDA", async () => {
    prismaMock.mensagem.create.mockResolvedValue({ id: "m1" });

    await persistirMensagemCliente({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid-cliente-1",
      messageType: "text",
      texto: "Preciso de uma betoneira",
      rawPayload: { key: { id: "wamid-cliente-1" } },
    });

    expect(prismaMock.mensagem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversaId: "conversa-1",
        conteudo: "Preciso de uma betoneira",
        direcao: "ENTRADA",
        autor: "CLIENTE",
        status: "RECEBIDA",
        canalWhatsappId: "canal-morgana",
        externalMessageId: "wamid-cliente-1",
        messageType: "text",
      }),
    });
  });

  it("corrida concorrente (P2002) é sucesso idempotente, não erro", async () => {
    prismaMock.mensagem.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" }),
    );

    await expect(
      persistirMensagemCliente({
        canal: CANAL,
        telefone: "558199999999",
        nomeContato: "Cliente Teste",
        externalMessageId: "wamid-cliente-2",
        messageType: "text",
        texto: "oi",
        rawPayload: {},
      }),
    ).resolves.not.toThrow();
  });
});

describe("reconciliarOuCriarMensagemHumana — envio pela Central, eco fromMe correspondente", () => {
  it("com externalMessageId já reconciliado (reentrega do mesmo evento): não cria nem atualiza nada", async () => {
    prismaMock.mensagem.findFirst.mockResolvedValueOnce({ id: "ja-existe" }); // mensagemJaProcessada

    const resultado = await reconciliarOuCriarMensagemHumana({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid-echo-1",
      messageType: "text",
      texto: "Pode ser, te mando os detalhes",
      rawPayload: {},
    });

    expect(resultado).toEqual({ criouNova: false, reconciliouExistente: false });
    expect(prismaMock.conversa.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.mensagem.create).not.toHaveBeenCalled();
    expect(prismaMock.mensagem.update).not.toHaveBeenCalled();
  });

  it("acha o envio pendente da Central (mesmo conteúdo, sem externalMessageId, dentro da janela) e reconcilia — resultado final é exatamente 1 Mensagem", async () => {
    prismaMock.mensagem.findFirst
      .mockResolvedValueOnce(null) // mensagemJaProcessada: ainda não reconciliada
      .mockResolvedValueOnce({ id: "msg-pendente-central", conteudo: "Pode ser, te mando os detalhes" }); // candidata a reconciliar
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-morgana" });
    prismaMock.mensagem.update.mockResolvedValue({});
    prismaMock.conversa.update.mockResolvedValue({});

    const resultado = await reconciliarOuCriarMensagemHumana({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid-echo-2",
      messageType: "text",
      texto: "Pode ser, te mando os detalhes",
      rawPayload: {},
    });

    expect(resultado).toEqual({ criouNova: false, reconciliouExistente: true });
    expect(prismaMock.mensagem.update).toHaveBeenCalledWith({
      where: { id: "msg-pendente-central" },
      data: { externalMessageId: "wamid-echo-2" },
    });
    // Nenhuma segunda Mensagem foi criada — só a atualização da existente.
    expect(prismaMock.mensagem.create).not.toHaveBeenCalled();
  });

  it("autor HUMANO e direção SAIDA são preservados na mensagem reconciliada (já gravados no envio original, não reescritos aqui)", async () => {
    // A reconciliação só faz UPDATE do externalMessageId — autor/direcao já foram
    // gravados corretamente por app/api/mensagens/route.ts no momento do envio.
    prismaMock.mensagem.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "msg-pendente", conteudo: "oi" });
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-morgana" });
    prismaMock.mensagem.update.mockResolvedValue({});
    prismaMock.conversa.update.mockResolvedValue({});

    await reconciliarOuCriarMensagemHumana({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid-echo-3",
      messageType: "text",
      texto: "oi",
      rawPayload: {},
    });

    const dadosDoUpdate = prismaMock.mensagem.update.mock.calls[0][0].data;
    expect(Object.keys(dadosDoUpdate)).toEqual(["externalMessageId"]);
  });
});

describe("reconciliarOuCriarMensagemHumana — Morgana responde direto pelo celular (sem mensagem local anterior)", () => {
  it("nenhuma candidata para reconciliar: cria exatamente 1 Mensagem HUMANO/SAIDA", async () => {
    prismaMock.mensagem.findFirst
      .mockResolvedValueOnce(null) // mensagemJaProcessada
      .mockResolvedValueOnce(null); // nenhuma candidata de reconciliação
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-morgana" });
    prismaMock.mensagem.create.mockResolvedValue({ id: "m-nova" });
    prismaMock.conversa.update.mockResolvedValue({});

    const resultado = await reconciliarOuCriarMensagemHumana({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid-celular-1",
      messageType: "text",
      texto: "Combinado, te ligo amanhã",
      rawPayload: { key: { fromMe: true } },
    });

    expect(resultado).toEqual({ criouNova: true, reconciliouExistente: false });
    expect(prismaMock.mensagem.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.mensagem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        direcao: "SAIDA",
        autor: "HUMANO",
        status: "ENVIADA",
        externalMessageId: "wamid-celular-1",
        canalWhatsappId: "canal-morgana",
      }),
    });
    expect(prismaMock.mensagem.update).not.toHaveBeenCalled();
  });

  it("corrida concorrente na criação (P2002) é sucesso idempotente", async () => {
    prismaMock.mensagem.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-morgana" });
    prismaMock.mensagem.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" }),
    );

    const resultado = await reconciliarOuCriarMensagemHumana({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid-celular-2",
      messageType: "text",
      texto: "oi",
      rawPayload: {},
    });

    expect(resultado).toEqual({ criouNova: false, reconciliouExistente: false });
  });

  it("corrida concorrente na reconciliação (P2002 no update) é sucesso idempotente", async () => {
    prismaMock.mensagem.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "msg-pendente", conteudo: "oi" });
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-morgana" });
    prismaMock.mensagem.update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" }),
    );

    const resultado = await reconciliarOuCriarMensagemHumana({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid-celular-3",
      messageType: "text",
      texto: "oi",
      rawPayload: {},
    });

    expect(resultado).toEqual({ criouNova: false, reconciliouExistente: false });
    expect(prismaMock.mensagem.create).not.toHaveBeenCalled();
  });
});
