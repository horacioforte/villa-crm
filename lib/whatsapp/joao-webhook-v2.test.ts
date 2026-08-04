import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";

const APP_SECRET_FAKE = "app-secret-fake-nao-real";
const ACCESS_TOKEN_FAKE = "access-token-fake-nao-real";

const {
  prismaMock,
  resolveWhatsappEnvVarMock,
  enviarTextoMetaMock,
  getContextoJoaoMock,
  analisarMensagemJoaoMock,
  processarRespostaJoaoMock,
  adquirirParaProcessamentoMock,
  marcarProcessadaMock,
  marcarErroProcessamentoMock,
} = vi.hoisted(() => ({
  prismaMock: {
    canalWhatsapp: { findUnique: vi.fn(), update: vi.fn() },
    conversa: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    mensagem: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
  resolveWhatsappEnvVarMock: vi.fn(),
  enviarTextoMetaMock: vi.fn(),
  getContextoJoaoMock: vi.fn().mockResolvedValue(""),
  analisarMensagemJoaoMock: vi.fn().mockResolvedValue({
    resposta: "Resposta automática do João.",
    interesse: false,
    confidenceScore: 10,
    gatilho: "nenhum",
  }),
  processarRespostaJoaoMock: vi.fn().mockResolvedValue({}),
  adquirirParaProcessamentoMock: vi.fn(),
  marcarProcessadaMock: vi.fn().mockResolvedValue(undefined),
  marcarErroProcessamentoMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("./env-allowlist", () => ({
  resolveWhatsappEnvVar: (...args: unknown[]) => resolveWhatsappEnvVarMock(...args),
}));
vi.mock("./meta-client", () => ({ enviarTextoMeta: (...args: unknown[]) => enviarTextoMetaMock(...args) }));
vi.mock("./processamento-mensagem", () => ({
  adquirirParaProcessamento: (...args: unknown[]) => adquirirParaProcessamentoMock(...args),
  marcarProcessada: (...args: unknown[]) => marcarProcessadaMock(...args),
  marcarErroProcessamento: (...args: unknown[]) => marcarErroProcessamentoMock(...args),
}));
vi.mock("@/lib/agentes/joao/contexto", () => ({ getContextoJoao: (...args: unknown[]) => getContextoJoaoMock(...args) }));
vi.mock("@/lib/agentes/joao/handler", () => ({
  analisarMensagemJoao: (...args: unknown[]) => analisarMensagemJoaoMock(...args),
}));
vi.mock("@/lib/agentes/joao/crm", () => ({
  processarRespostaJoao: (...args: unknown[]) => processarRespostaJoaoMock(...args),
}));

import { processarWebhookJoaoV2 } from "./joao-webhook-v2";

const CANAL = {
  id: "canal-joao",
  instanceName: "joao-villa",
  ativo: true,
  tipo: "META_CLOUD_API",
  phoneNumberId: "1168722372992684",
  appSecretEnvVar: "META_JOAO_APP_SECRET",
};

function assinar(rawBody: string, secret = APP_SECRET_FAKE) {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

function payloadComMensagem(overrides?: { phoneNumberId?: string; messageId?: string; texto?: string }) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "5581999999999",
                phone_number_id: overrides?.phoneNumberId ?? CANAL.phoneNumberId,
              },
              contacts: [{ profile: { name: "Cliente Teste" }, wa_id: "5581988887777" }],
              messages: [
                {
                  from: "5581988887777",
                  id: overrides?.messageId ?? "wamid.HBgL123",
                  timestamp: "1234567890",
                  type: "text",
                  text: { body: overrides?.texto ?? "Olá, quero saber mais." },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function criarRequest(body: unknown, { assinarComSecretErrado = false, semAssinatura = false } = {}) {
  const rawBody = JSON.stringify(body);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!semAssinatura) {
    headers["x-hub-signature-256"] = assinar(rawBody, assinarComSecretErrado ? "secret-errado" : APP_SECRET_FAKE);
  }
  return new Request("https://villa-crm.vercel.app/api/webhook/whatsapp/joao", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveWhatsappEnvVarMock.mockResolvedValue(APP_SECRET_FAKE);
  prismaMock.canalWhatsapp.findUnique.mockResolvedValue(CANAL);
  prismaMock.canalWhatsapp.update.mockResolvedValue(CANAL);
  prismaMock.mensagem.findFirst.mockResolvedValue(null);
  prismaMock.conversa.findFirst.mockResolvedValue(null);
  prismaMock.conversa.create.mockResolvedValue({ id: "conversa-1", canalWhatsappId: CANAL.id, instanceName: "joao-villa" });
  prismaMock.conversa.update.mockResolvedValue({ id: "conversa-1" });
  prismaMock.mensagem.create.mockResolvedValue({ id: "msg-1" });
  enviarTextoMetaMock.mockResolvedValue({ id: "msg-resposta", status: "ENVIADA" });
  adquirirParaProcessamentoMock.mockResolvedValue({ id: "msg-1", processamentoTentativas: 1 });
});

describe("processarWebhookJoaoV2 — assinatura", () => {
  it("processa normalmente com assinatura válida", async () => {
    const res = await processarWebhookJoaoV2(criarRequest(payloadComMensagem()));
    expect(res.status).toBe(200);
    expect(prismaMock.mensagem.create).toHaveBeenCalledTimes(1);
  });

  it("rejeita com 401 quando a assinatura é inválida, sem processar nada", async () => {
    const res = await processarWebhookJoaoV2(criarRequest(payloadComMensagem(), { assinarComSecretErrado: true }));
    expect(res.status).toBe(401);
    expect(prismaMock.mensagem.create).not.toHaveBeenCalled();
  });

  it("rejeita quando o header de assinatura está ausente", async () => {
    const res = await processarWebhookJoaoV2(criarRequest(payloadComMensagem(), { semAssinatura: true }));
    expect(res.status).toBe(401);
    expect(prismaMock.mensagem.create).not.toHaveBeenCalled();
  });
});

describe("processarWebhookJoaoV2 — canal", () => {
  it("não processa quando o canal não existe", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue(null);
    const res = await processarWebhookJoaoV2(criarRequest(payloadComMensagem()));
    expect(res.status).toBe(200);
    expect(prismaMock.mensagem.create).not.toHaveBeenCalled();
  });

  it("não processa quando o canal está inativo", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue({ ...CANAL, ativo: false });
    const res = await processarWebhookJoaoV2(criarRequest(payloadComMensagem()));
    expect(res.status).toBe(200);
    expect(prismaMock.mensagem.create).not.toHaveBeenCalled();
  });

  it("ignora o evento quando phone_number_id não corresponde ao canal", async () => {
    const res = await processarWebhookJoaoV2(
      criarRequest(payloadComMensagem({ phoneNumberId: "OUTRO_NUMERO_DIFERENTE" })),
    );
    expect(res.status).toBe(200);
    expect(prismaMock.mensagem.create).not.toHaveBeenCalled();
  });
});

describe("processarWebhookJoaoV2 — idempotência", () => {
  it("ignora evento duplicado (externalMessageId já processado)", async () => {
    prismaMock.mensagem.findFirst.mockResolvedValue({ id: "ja-existe" });
    const res = await processarWebhookJoaoV2(criarRequest(payloadComMensagem()));
    expect(res.status).toBe(200);
    expect(prismaMock.mensagem.create).not.toHaveBeenCalled();
  });

  it("trata corrida concorrente (violação de constraint única) como sucesso idempotente, não como erro", async () => {
    prismaMock.mensagem.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const res = await processarWebhookJoaoV2(criarRequest(payloadComMensagem()));
    expect(res.status).toBe(200);
    // Não deve ter tentado enviar resposta automática após a corrida concorrente.
    expect(enviarTextoMetaMock).not.toHaveBeenCalled();
  });

  it("não inventa identificador quando a mensagem não tem id da Meta", async () => {
    const payload = payloadComMensagem();
    // @ts-expect-error -- forçando ausência de id para o teste
    delete payload.entry[0].changes[0].value.messages[0].id;

    const res = await processarWebhookJoaoV2(criarRequest(payload));
    expect(res.status).toBe(200);
    expect(prismaMock.mensagem.create).not.toHaveBeenCalled();
  });
});

describe("processarWebhookJoaoV2 — gravação da mensagem recebida", () => {
  it("grava autor=CLIENTE, status=RECEBIDA, receivedAt, messageType e rawPayload — nunca autor=IA na entrada", async () => {
    await processarWebhookJoaoV2(criarRequest(payloadComMensagem({ texto: "Quero um orçamento" })));

    expect(prismaMock.mensagem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          direcao: "ENTRADA",
          autor: "CLIENTE",
          status: "RECEBIDA",
          canalWhatsappId: CANAL.id,
          externalMessageId: "wamid.HBgL123",
          messageType: "text",
          conteudo: "Quero um orçamento",
          processamentoStatus: "PENDENTE",
        }),
      }),
    );

    const dadosGravados = prismaMock.mensagem.create.mock.calls[0][0].data;
    expect(dadosGravados.receivedAt).toBeInstanceOf(Date);
    expect(dadosGravados.rawPayload).toBeTruthy();
    expect(dadosGravados.autor).not.toBe("IA");
  });

  it("aciona o envio da resposta automática via meta-client (não via fetch direto) e repassa salvarMensagens=false", async () => {
    await processarWebhookJoaoV2(criarRequest(payloadComMensagem()));

    expect(enviarTextoMetaMock).toHaveBeenCalledWith(
      expect.objectContaining({ canalId: CANAL.id, conversaId: "conversa-1" }),
    );
    expect(processarRespostaJoaoMock).toHaveBeenCalledWith(
      expect.objectContaining({ salvarMensagens: false }),
    );
  });
});

describe("processarWebhookJoaoV2 — estado persistente de processamento", () => {
  it("adquire a mensagem para processamento antes de acionar a IA", async () => {
    await processarWebhookJoaoV2(criarRequest(payloadComMensagem()));
    expect(adquirirParaProcessamentoMock).toHaveBeenCalledWith("msg-1");
  });

  it("quando a aquisição falha (corrida/limite), não aciona IA nem envia resposta, e não marca PROCESSADA", async () => {
    adquirirParaProcessamentoMock.mockResolvedValue(null);

    const res = await processarWebhookJoaoV2(criarRequest(payloadComMensagem()));

    expect(res.status).toBe(200);
    expect(analisarMensagemJoaoMock).not.toHaveBeenCalled();
    expect(enviarTextoMetaMock).not.toHaveBeenCalled();
    expect(marcarProcessadaMock).not.toHaveBeenCalled();
  });

  it("em sucesso completo (IA + envio + CRM), marca PROCESSADA", async () => {
    await processarWebhookJoaoV2(criarRequest(payloadComMensagem()));
    expect(marcarProcessadaMock).toHaveBeenCalledWith("msg-1");
    expect(marcarErroProcessamentoMock).not.toHaveBeenCalled();
  });

  it("mensagem não-texto marca PROCESSADA imediatamente, sem acionar a IA", async () => {
    const payload = payloadComMensagem();
    payload.entry[0].changes[0].value.messages[0].type = "image";
    // @ts-expect-error -- mensagem de imagem não tem campo text
    delete payload.entry[0].changes[0].value.messages[0].text;

    await processarWebhookJoaoV2(criarRequest(payload));

    expect(analisarMensagemJoaoMock).not.toHaveBeenCalled();
    expect(enviarTextoMetaMock).not.toHaveBeenCalled();
    expect(marcarProcessadaMock).toHaveBeenCalledWith("msg-1");
  });

  it("quando o envio à Meta falha, marca ERRO_PROCESSAMENTO e não derruba a resposta HTTP do webhook", async () => {
    enviarTextoMetaMock.mockRejectedValue(new Error("Falha simulada no envio."));

    const res = await processarWebhookJoaoV2(criarRequest(payloadComMensagem()));

    expect(res.status).toBe(200); // Meta sempre recebe 200 — erro fica registrado no banco, não na resposta.
    expect(marcarErroProcessamentoMock).toHaveBeenCalledWith("msg-1", expect.any(Error));
    expect(marcarProcessadaMock).not.toHaveBeenCalled();
  });

  it("quando a atualização do CRM (processarRespostaJoao) falha, marca ERRO_PROCESSAMENTO (não fica mais em .catch silencioso)", async () => {
    processarRespostaJoaoMock.mockRejectedValue(new Error("Falha simulada ao registrar dossiê."));

    await processarWebhookJoaoV2(criarRequest(payloadComMensagem()));

    expect(marcarErroProcessamentoMock).toHaveBeenCalledWith("msg-1", expect.any(Error));
    expect(marcarProcessadaMock).not.toHaveBeenCalled();
  });
});

describe("processarWebhookJoaoV2 — segurança de logs", () => {
  it("nunca imprime o App Secret nem o access token em nenhum log", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Cenário de erro (assinatura inválida) e cenário de sucesso, para cobrir os dois caminhos de log.
    await processarWebhookJoaoV2(criarRequest(payloadComMensagem(), { assinarComSecretErrado: true }));
    await processarWebhookJoaoV2(criarRequest(payloadComMensagem()));

    const todosOsLogs = [...consoleSpy.mock.calls, ...infoSpy.mock.calls, ...warnSpy.mock.calls]
      .map((c) => JSON.stringify(c))
      .join("\n");

    expect(todosOsLogs).not.toContain(APP_SECRET_FAKE);
    expect(todosOsLogs).not.toContain(ACCESS_TOKEN_FAKE);

    consoleSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
