import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  auditLogMock,
  getCanalMorganaMock,
  mensagemJaProcessadaMock,
  persistirMensagemClienteMock,
  reconciliarOuCriarMensagemHumanaMock,
} = vi.hoisted(() => ({
  auditLogMock: vi.fn(),
  getCanalMorganaMock: vi.fn(),
  mensagemJaProcessadaMock: vi.fn(),
  persistirMensagemClienteMock: vi.fn(),
  reconciliarOuCriarMensagemHumanaMock: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({ auditLog: (...args: unknown[]) => auditLogMock(...args) }));
vi.mock("@/lib/whatsapp/agentes/morgana", () => ({
  getCanalMorgana: (...args: unknown[]) => getCanalMorganaMock(...args),
  mensagemJaProcessada: (...args: unknown[]) => mensagemJaProcessadaMock(...args),
  persistirMensagemCliente: (...args: unknown[]) => persistirMensagemClienteMock(...args),
  reconciliarOuCriarMensagemHumana: (...args: unknown[]) => reconciliarOuCriarMensagemHumanaMock(...args),
}));

import { POST } from "./route";

const ORIGINAL_ENV = { ...process.env };
const CANAL = { id: "canal-morgana", instanceName: "morgana-villa", tipo: "EVOLUTION", ativo: true };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  process.env.WHATSAPP_MORGANA_CONVERSAS_V2 = "true";
  getCanalMorganaMock.mockResolvedValue(CANAL);
  mensagemJaProcessadaMock.mockResolvedValue(false);
  persistirMensagemClienteMock.mockResolvedValue({});
  reconciliarOuCriarMensagemHumanaMock.mockResolvedValue({ criouNova: true, reconciliouExistente: false });
});

function payloadCliente(overrides: { id?: string; texto?: string } = {}) {
  return {
    event: "messages.upsert",
    instance: "morgana-villa",
    data: {
      key: { fromMe: false, remoteJid: "558199999999@s.whatsapp.net", id: overrides.id ?? "wamid-cliente-1" },
      message: { conversation: overrides.texto ?? "Preciso de uma betoneira" },
      pushName: "Cliente Teste",
      messageType: "conversation",
    },
  };
}

function payloadFromMe(overrides: { id?: string; texto?: string } = {}) {
  return {
    event: "messages.upsert",
    instance: "morgana-villa",
    data: {
      key: { fromMe: true, remoteJid: "558199999999@s.whatsapp.net", id: overrides.id ?? "wamid-echo-1" },
      message: { conversation: overrides.texto ?? "Pode ser, te mando os detalhes" },
      pushName: "Cliente Teste",
      messageType: "conversation",
    },
  };
}

function criarRequest(body: unknown) {
  return new Request("https://villa-crm.vercel.app/api/webhook/whatsapp/morgana", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/webhook/whatsapp/morgana — guarda de instance", () => {
  it("instance divergente: ignora, registra auditoria sanitizada, nunca persiste", async () => {
    const res = await POST(criarRequest({ ...payloadCliente(), instance: "taciane-villa" }));

    expect(res.status).toBe(200);
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "WHATSAPP_MORGANA_INSTANCE_DIVERGENTE" }),
    );
    expect(getCanalMorganaMock).not.toHaveBeenCalled();
    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
    expect(reconciliarOuCriarMensagemHumanaMock).not.toHaveBeenCalled();
  });

  it("instance ausente: ignora e audita, nunca cai para outro agente (sem fallback para Maria)", async () => {
    const res = await POST(criarRequest({ event: "messages.upsert" }));

    expect(res.status).toBe(200);
    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "WHATSAPP_MORGANA_INSTANCE_DIVERGENTE", metadata: { instanceRecebida: null } }),
    );
    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhook/whatsapp/morgana — flag desligada", () => {
  it("evento válido, flag OFF: responde 200 mas não persiste nada", async () => {
    delete process.env.WHATSAPP_MORGANA_CONVERSAS_V2;

    const res = await POST(criarRequest(payloadCliente()));

    expect(res.status).toBe(200);
    expect(getCanalMorganaMock).not.toHaveBeenCalled();
    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
    expect(reconciliarOuCriarMensagemHumanaMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhook/whatsapp/morgana — flag ligada, inbound de cliente", () => {
  it("mensagem nova de cliente: persiste via persistirMensagemCliente", async () => {
    const res = await POST(criarRequest(payloadCliente({ id: "wamid-cliente-novo" })));

    expect(res.status).toBe(200);
    expect(mensagemJaProcessadaMock).toHaveBeenCalledWith({ canal: CANAL, externalMessageId: "wamid-cliente-novo" });
    expect(persistirMensagemClienteMock).toHaveBeenCalledWith(
      expect.objectContaining({ canal: CANAL, externalMessageId: "wamid-cliente-novo", telefone: "558199999999" }),
    );
    expect(reconciliarOuCriarMensagemHumanaMock).not.toHaveBeenCalled();
  });

  it("evento de cliente duplicado: não persiste de novo", async () => {
    mensagemJaProcessadaMock.mockResolvedValue(true);

    await POST(criarRequest(payloadCliente({ id: "wamid-repetido" })));

    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
  });

  it("canal ausente: ignora sem persistir", async () => {
    getCanalMorganaMock.mockResolvedValue(null);

    const res = await POST(criarRequest(payloadCliente()));

    expect(res.status).toBe(200);
    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
  });

  it("canal inativo: ignora sem persistir", async () => {
    getCanalMorganaMock.mockResolvedValue({ ...CANAL, ativo: false });

    await POST(criarRequest(payloadCliente()));

    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhook/whatsapp/morgana — flag ligada, eco fromMe", () => {
  it("evento fromMe=true: delega para reconciliarOuCriarMensagemHumana, nunca para persistirMensagemCliente", async () => {
    const res = await POST(criarRequest(payloadFromMe({ id: "wamid-echo-novo" })));

    expect(res.status).toBe(200);
    expect(reconciliarOuCriarMensagemHumanaMock).toHaveBeenCalledWith(
      expect.objectContaining({ canal: CANAL, externalMessageId: "wamid-echo-novo" }),
    );
    expect(persistirMensagemClienteMock).not.toHaveBeenCalled();
    // fromMe nunca passa pela checagem de duplicado de cliente — a idempotência do
    // eco é responsabilidade interna de reconciliarOuCriarMensagemHumana.
  });
});

describe("POST /api/webhook/whatsapp/morgana — falha ao persistir não derruba a rota", () => {
  it("erro em persistirMensagemCliente: rota ainda responde 200", async () => {
    persistirMensagemClienteMock.mockRejectedValue(new Error("falha de banco"));

    const res = await POST(criarRequest(payloadCliente()));

    expect(res.status).toBe(200);
  });
});

// Remove comentários de linha (//...) antes de checar código real — os arquivos
// documentam DELIBERADAMENTE, em comentário, que essas funções nunca são chamadas;
// a checagem estática precisa validar o CÓDIGO, não o texto explicativo sobre ele.
function codigoSemComentarios(conteudo: string): string {
  return conteudo
    .split("\n")
    .map((linha) => linha.replace(/\/\/.*$/, ""))
    .join("\n");
}

describe("Garantia estática — ausência total de IA nesta rota e no módulo da Morgana", () => {
  it("route.ts não importa nem chama nenhum agente de IA", () => {
    const codigo = codigoSemComentarios(readFileSync(join(__dirname, "route.ts"), "utf-8"));
    expect(codigo).not.toMatch(/analisarMensagem/);
    expect(codigo).not.toMatch(/from ["']@\/lib\/agentes/);
  });

  it("lib/whatsapp/agentes/morgana.ts não importa nem chama nenhum agente de IA", () => {
    const codigo = codigoSemComentarios(readFileSync(join(process.cwd(), "lib/whatsapp/agentes/morgana.ts"), "utf-8"));
    expect(codigo).not.toMatch(/analisarMensagem/);
    expect(codigo).not.toMatch(/from ["']@\/lib\/agentes/);
  });
});
