import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const APP_SECRET_FAKE = "app-secret-global-fake-nao-real";

const { prismaMock, resolveWhatsappEnvVarMock, processarValorMetaJoaoMock } = vi.hoisted(() => ({
  prismaMock: {
    canalWhatsapp: { findUnique: vi.fn(), update: vi.fn() },
  },
  resolveWhatsappEnvVarMock: vi.fn(),
  processarValorMetaJoaoMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("./env-allowlist", () => ({
  resolveWhatsappEnvVar: (...args: unknown[]) => resolveWhatsappEnvVarMock(...args),
}));
vi.mock("./agentes/joao", () => ({
  processarValorMetaJoao: (...args: unknown[]) => processarValorMetaJoaoMock(...args),
}));

import { processarRoteadorMetaV2 } from "./meta-router-v2";

const CANAL_JOAO = {
  id: "canal-joao",
  instanceName: "joao-villa",
  ativo: true,
  tipo: "META_CLOUD_API",
  phoneNumberId: "PHONE_JOAO",
  agenteIA: "joao",
};

function assinar(rawBody: string, secret = APP_SECRET_FAKE) {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

function payloadComMensagem({ phoneNumberId = "PHONE_JOAO", messageId = "wamid.ABC" } = {}) {
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
              metadata: { display_phone_number: "5581999999999", phone_number_id: phoneNumberId },
              contacts: [{ profile: { name: "Cliente Teste" }, wa_id: "5581988887777" }],
              messages: [
                { from: "5581988887777", id: messageId, timestamp: "123", type: "text", text: { body: "oi" } },
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
  return new Request("https://villa-crm.vercel.app/api/webhook/whatsapp/meta", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveWhatsappEnvVarMock.mockResolvedValue(APP_SECRET_FAKE);
  prismaMock.canalWhatsapp.findUnique.mockResolvedValue(CANAL_JOAO);
  prismaMock.canalWhatsapp.update.mockResolvedValue(CANAL_JOAO);
});

describe("processarRoteadorMetaV2 — assinatura (App Secret global)", () => {
  it("processa normalmente com assinatura válida", async () => {
    const res = await processarRoteadorMetaV2(criarRequest(payloadComMensagem()));
    expect(res.status).toBe(200);
    expect(processarValorMetaJoaoMock).toHaveBeenCalledTimes(1);
  });

  it("rejeita com 401 quando a assinatura é inválida, sem consultar nenhum canal", async () => {
    const res = await processarRoteadorMetaV2(criarRequest(payloadComMensagem(), { assinarComSecretErrado: true }));
    expect(res.status).toBe(401);
    expect(prismaMock.canalWhatsapp.findUnique).not.toHaveBeenCalled();
    expect(processarValorMetaJoaoMock).not.toHaveBeenCalled();
  });

  it("rejeita quando o header de assinatura está ausente", async () => {
    const res = await processarRoteadorMetaV2(criarRequest(payloadComMensagem(), { semAssinatura: true }));
    expect(res.status).toBe(401);
  });

  it("resolve o App Secret ANTES de fazer parse do payload (ordem segura confirmada por espionagem de chamadas)", async () => {
    const ordem: string[] = [];
    resolveWhatsappEnvVarMock.mockImplementation(async () => {
      ordem.push("resolveu-secret");
      return APP_SECRET_FAKE;
    });
    prismaMock.canalWhatsapp.findUnique.mockImplementation(async () => {
      ordem.push("buscou-canal");
      return CANAL_JOAO;
    });

    await processarRoteadorMetaV2(criarRequest(payloadComMensagem()));

    expect(ordem[0]).toBe("resolveu-secret");
    expect(ordem.indexOf("resolveu-secret")).toBeLessThan(ordem.indexOf("buscou-canal"));
  });
});

describe("processarRoteadorMetaV2 — roteamento por CanalWhatsapp (banco, não hardcode)", () => {
  it("busca o canal por phoneNumberId — nunca por comparação com env var de agente específico", async () => {
    await processarRoteadorMetaV2(criarRequest(payloadComMensagem({ phoneNumberId: "QUALQUER_NUMERO_123" })));
    expect(prismaMock.canalWhatsapp.findUnique).toHaveBeenCalledWith({
      where: { phoneNumberId: "QUALQUER_NUMERO_123" },
    });
  });

  it("canal inexistente: evento ignorado com segurança, sem chamar processador", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue(null);
    const res = await processarRoteadorMetaV2(criarRequest(payloadComMensagem()));
    expect(res.status).toBe(200);
    expect(processarValorMetaJoaoMock).not.toHaveBeenCalled();
  });

  it("canal inativo: evento ignorado com segurança", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue({ ...CANAL_JOAO, ativo: false });
    await processarRoteadorMetaV2(criarRequest(payloadComMensagem()));
    expect(processarValorMetaJoaoMock).not.toHaveBeenCalled();
  });

  it("canal de tipo diferente (EVOLUTION): evento ignorado, nunca processado por este roteador", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue({ ...CANAL_JOAO, tipo: "EVOLUTION" });
    await processarRoteadorMetaV2(criarRequest(payloadComMensagem()));
    expect(processarValorMetaJoaoMock).not.toHaveBeenCalled();
  });

  it("canal de tipo CHATWOOT_MIRROR: evento ignorado", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue({ ...CANAL_JOAO, tipo: "CHATWOOT_MIRROR" });
    await processarRoteadorMetaV2(criarRequest(payloadComMensagem()));
    expect(processarValorMetaJoaoMock).not.toHaveBeenCalled();
  });

  it("agenteIA = joao: chama processarValorMetaJoao com o canal e o value corretos", async () => {
    await processarRoteadorMetaV2(criarRequest(payloadComMensagem()));
    expect(processarValorMetaJoaoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        canal: expect.objectContaining({ id: "canal-joao" }),
        value: expect.objectContaining({ metadata: expect.objectContaining({ phone_number_id: "PHONE_JOAO" }) }),
      }),
    );
  });

  it("agenteIA não implementado (ex.: 'maria'): evento ignorado, SEM fallback para nenhum processador", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue({ ...CANAL_JOAO, agenteIA: "maria" });
    const res = await processarRoteadorMetaV2(criarRequest(payloadComMensagem()));
    expect(res.status).toBe(200);
    expect(processarValorMetaJoaoMock).not.toHaveBeenCalled();
  });

  it("agenteIA nulo: evento ignorado com segurança", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue({ ...CANAL_JOAO, agenteIA: null });
    await processarRoteadorMetaV2(criarRequest(payloadComMensagem()));
    expect(processarValorMetaJoaoMock).not.toHaveBeenCalled();
  });
});

describe("processarRoteadorMetaV2 — ausência de hardcode dos números de Maria/João", () => {
  it("o código-fonte do roteador não referencia MARIA_META_PHONE_NUMBER_ID nem META_JOAO_PHONE_NUMBER_ID", () => {
    const codigoFonte = fs.readFileSync(path.resolve(__dirname, "meta-router-v2.ts"), "utf8");
    expect(codigoFonte).not.toContain("MARIA_META_PHONE_NUMBER_ID");
    expect(codigoFonte).not.toContain("META_JOAO_PHONE_NUMBER_ID");
  });
});

describe("processarRoteadorMetaV2 — payload inválido", () => {
  it("retorna 400 quando o corpo não é JSON válido (mas a assinatura ainda é checada antes)", async () => {
    const rawBody = "{ isto não é json";
    const headers = { "x-hub-signature-256": assinar(rawBody), "Content-Type": "application/json" };
    const res = await processarRoteadorMetaV2(
      new Request("https://villa-crm.vercel.app/api/webhook/whatsapp/meta", { method: "POST", headers, body: rawBody }),
    );
    expect(res.status).toBe(400);
  });

  it('objeto diferente de "whatsapp_business_account" retorna 200 sem processar', async () => {
    const res = await processarRoteadorMetaV2(criarRequest({ object: "outra_coisa", entry: [] }));
    expect(res.status).toBe(200);
    expect(processarValorMetaJoaoMock).not.toHaveBeenCalled();
  });
});
