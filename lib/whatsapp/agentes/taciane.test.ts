import { readFileSync } from "node:fs";
import { join } from "node:path";
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

import { getCanalTaciane, mensagemJaProcessada, persistirMensagemCliente } from "./taciane";

const CANAL = { id: "canal-taciane", instanceName: "taciane-villa", tipo: "META_CLOUD_API", ativo: true } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCanalTaciane", () => {
  it("busca o canal por instanceName 'taciane-villa'", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue(CANAL);
    const canal = await getCanalTaciane();
    expect(canal).toBe(CANAL);
    expect(prismaMock.canalWhatsapp.findUnique).toHaveBeenCalledWith({ where: { instanceName: "taciane-villa" } });
  });
});

describe("mensagemJaProcessada", () => {
  it("true quando já existe mensagem com o mesmo canalWhatsappId + externalMessageId", async () => {
    prismaMock.mensagem.findFirst.mockResolvedValue({ id: "existente" });
    expect(await mensagemJaProcessada({ canal: CANAL, externalMessageId: "id-1" })).toBe(true);
    expect(prismaMock.mensagem.findFirst).toHaveBeenCalledWith({
      where: { canalWhatsappId: "canal-taciane", externalMessageId: "id-1" },
      select: { id: true },
    });
  });

  it("false quando não existe", async () => {
    prismaMock.mensagem.findFirst.mockResolvedValue(null);
    expect(await mensagemJaProcessada({ canal: CANAL, externalMessageId: "id-2" })).toBe(false);
  });
});

describe("persistirMensagemCliente — inbound de cliente real", () => {
  beforeEach(() => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-taciane" });
    prismaMock.conversa.update.mockResolvedValue({});
  });

  it("cria a mensagem com autor CLIENTE, direcao ENTRADA, status RECEBIDA e todos os campos exigidos", async () => {
    prismaMock.mensagem.create.mockResolvedValue({ id: "m1" });

    await persistirMensagemCliente({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid-cliente-1",
      messageType: "text",
      texto: "Preciso de uma betoneira",
      rawPayload: { id: "wamid-cliente-1" },
    });

    expect(prismaMock.mensagem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversaId: "conversa-1",
        conteudo: "Preciso de uma betoneira",
        direcao: "ENTRADA",
        autor: "CLIENTE",
        status: "RECEBIDA",
        canalWhatsappId: "canal-taciane",
        externalMessageId: "wamid-cliente-1",
        messageType: "text",
        receivedAt: expect.any(Date),
      }),
    });
    expect(prismaMock.conversa.update).toHaveBeenCalledWith({
      where: { id: "conversa-1" },
      data: { ultimaMensagemEm: expect.any(Date) },
    });
  });

  it("Ciclo de Atendimento — conversa PENDENTE reabre para ABERTA ao chegar mensagem do cliente", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-taciane", status: "PENDENTE" });
    prismaMock.mensagem.create.mockResolvedValue({ id: "m1" });

    await persistirMensagemCliente({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid-reabre-1",
      messageType: "text",
      texto: "oi de novo",
      rawPayload: {},
    });

    expect(prismaMock.conversa.update).toHaveBeenCalledWith({
      where: { id: "conversa-1" },
      data: { ultimaMensagemEm: expect.any(Date), status: "ABERTA" },
    });
  });

  it("Ciclo de Atendimento — conversa CONCLUIDA reabre para ABERTA ao chegar mensagem do cliente", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-taciane", status: "CONCLUIDA" });
    prismaMock.mensagem.create.mockResolvedValue({ id: "m1" });

    await persistirMensagemCliente({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid-reabre-2",
      messageType: "text",
      texto: "oi de novo",
      rawPayload: {},
    });

    expect(prismaMock.conversa.update).toHaveBeenCalledWith({
      where: { id: "conversa-1" },
      data: { ultimaMensagemEm: expect.any(Date), status: "ABERTA" },
    });
  });

  it("Ciclo de Atendimento — conversa SPAM NUNCA reabre sozinha ao chegar mensagem do cliente", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-taciane", status: "SPAM" });
    prismaMock.mensagem.create.mockResolvedValue({ id: "m1" });

    await persistirMensagemCliente({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid-spam-1",
      messageType: "text",
      texto: "mensagem indesejada",
      rawPayload: {},
    });

    expect(prismaMock.conversa.update).toHaveBeenCalledWith({
      where: { id: "conversa-1" },
      data: { ultimaMensagemEm: expect.any(Date) }, // sem "status" — continua SPAM
    });
  });

  it("Ciclo de Atendimento — conversa já ABERTA não sofre escrita extra de status", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-taciane", status: "ABERTA" });
    prismaMock.mensagem.create.mockResolvedValue({ id: "m1" });

    await persistirMensagemCliente({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Teste",
      externalMessageId: "wamid-aberta-1",
      messageType: "text",
      texto: "oi",
      rawPayload: {},
    });

    expect(prismaMock.conversa.update).toHaveBeenCalledWith({
      where: { id: "conversa-1" },
      data: { ultimaMensagemEm: expect.any(Date) },
    });
  });

  it("cria a Conversa quando ainda não existe uma para este telefone/instância", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue(null);
    prismaMock.conversa.create.mockResolvedValue({ id: "conversa-nova" });
    prismaMock.mensagem.create.mockResolvedValue({ id: "m1" });

    await persistirMensagemCliente({
      canal: CANAL,
      telefone: "558199999999",
      nomeContato: "Cliente Novo",
      externalMessageId: "wamid-x",
      messageType: "text",
      texto: "oi",
      rawPayload: {},
    });

    expect(prismaMock.conversa.create).toHaveBeenCalledWith({
      data: { instanceName: "taciane-villa", telefone: "558199999999", nomeContato: "Cliente Novo", canalWhatsappId: "canal-taciane" },
    });
  });

  it("corrida concorrente (P2002 — dedupe por canalWhatsappId+externalMessageId) é sucesso idempotente, não erro", async () => {
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

    // Em corrida concorrente, a conversa não é atualizada de novo (a requisição
    // vencedora já atualizou ultimaMensagemEm).
    expect(prismaMock.conversa.update).not.toHaveBeenCalled();
  });

  it("erro de banco diferente de P2002 é propagado (não é engolido como se fosse idempotência)", async () => {
    prismaMock.mensagem.create.mockRejectedValueOnce(new Error("erro de conexão genérico"));

    await expect(
      persistirMensagemCliente({
        canal: CANAL,
        telefone: "558199999999",
        nomeContato: "Cliente Teste",
        externalMessageId: "wamid-cliente-3",
        messageType: "text",
        texto: "oi",
        rawPayload: {},
      }),
    ).rejects.toThrow("erro de conexão genérico");
  });

  it("conversa existente vinculada a OUTRO canal: lança erro em vez de misturar mensagens entre canais", async () => {
    prismaMock.conversa.findFirst.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "canal-outro" });

    await expect(
      persistirMensagemCliente({
        canal: CANAL,
        telefone: "558199999999",
        nomeContato: "Cliente Teste",
        externalMessageId: "wamid-cliente-4",
        messageType: "text",
        texto: "oi",
        rawPayload: {},
      }),
    ).rejects.toThrow(/divergente/);

    expect(prismaMock.mensagem.create).not.toHaveBeenCalled();
  });
});

// Remove comentários de linha (//...) antes de checar código real — este arquivo
// documenta DELIBERADAMENTE, em comentário, que nenhuma função de IA é chamada; a
// checagem estática precisa validar o CÓDIGO, não o texto explicativo sobre ele.
function codigoSemComentarios(conteudo: string): string {
  return conteudo
    .split("\n")
    .map((linha) => linha.replace(/\/\/.*$/, ""))
    .join("\n");
}

describe("Garantia estática — ausência total de IA em lib/whatsapp/agentes/taciane.ts", () => {
  it("não importa nem chama nenhum agente de IA", () => {
    const codigo = codigoSemComentarios(readFileSync(join(process.cwd(), "lib/whatsapp/agentes/taciane.ts"), "utf-8"));
    expect(codigo).not.toMatch(/analisarMensagem/);
    expect(codigo).not.toMatch(/from ["']@\/lib\/agentes/);
  });
});
