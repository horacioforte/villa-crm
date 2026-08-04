import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  processarWebhookJoaoV2Mock,
  getContextoJoaoMock,
  analisarMensagemJoaoMock,
  enviarWhatsappJoaoMock,
  processarRespostaJoaoMock,
} = vi.hoisted(() => ({
  processarWebhookJoaoV2Mock: vi.fn().mockResolvedValue(Response.json({ ok: true, via: "v2" })),
  getContextoJoaoMock: vi.fn(),
  analisarMensagemJoaoMock: vi.fn(),
  enviarWhatsappJoaoMock: vi.fn(),
  processarRespostaJoaoMock: vi.fn(),
}));

vi.mock("@/lib/whatsapp/joao-webhook-v2", () => ({
  processarWebhookJoaoV2: (...args: unknown[]) => processarWebhookJoaoV2Mock(...args),
}));
vi.mock("@/lib/agentes/joao/contexto", () => ({ getContextoJoao: (...args: unknown[]) => getContextoJoaoMock(...args) }));
vi.mock("@/lib/agentes/joao/handler", () => ({
  analisarMensagemJoao: (...args: unknown[]) => analisarMensagemJoaoMock(...args),
}));
vi.mock("@/lib/agentes/joao/crm", () => ({
  enviarWhatsappJoao: (...args: unknown[]) => enviarWhatsappJoaoMock(...args),
  processarRespostaJoao: (...args: unknown[]) => processarRespostaJoaoMock(...args),
}));

import { POST } from "./route";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

// Payload que não corresponde a "whatsapp_business_account" — faz o fluxo V1 legado
// retornar imediatamente com { ok: true } sem precisar simular um evento completo.
const payloadNeutro = { object: "outra_coisa", entry: [] };

function criarRequest(body: unknown) {
  return new Request("https://villa-crm.vercel.app/api/webhook/whatsapp/joao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/webhook/whatsapp/joao — branch da feature flag", () => {
  it("com WHATSAPP_JOAO_V2 ausente, executa somente o fluxo V1 (V2 nunca é chamado)", async () => {
    delete process.env.WHATSAPP_JOAO_V2;

    const res = await POST(criarRequest(payloadNeutro));

    expect(res.status).toBe(200);
    expect(processarWebhookJoaoV2Mock).not.toHaveBeenCalled();
  });

  it('com WHATSAPP_JOAO_V2="false", executa somente o fluxo V1', async () => {
    process.env.WHATSAPP_JOAO_V2 = "false";

    await POST(criarRequest(payloadNeutro));

    expect(processarWebhookJoaoV2Mock).not.toHaveBeenCalled();
  });

  it('com WHATSAPP_JOAO_V2="true", executa somente o fluxo V2 (V1 nunca é chamado)', async () => {
    process.env.WHATSAPP_JOAO_V2 = "true";

    const res = await POST(criarRequest(payloadNeutro));

    expect(processarWebhookJoaoV2Mock).toHaveBeenCalledTimes(1);
    const corpo = await res.json();
    expect(corpo.via).toBe("v2");

    // Nenhuma dependência do fluxo V1 foi tocada.
    expect(getContextoJoaoMock).not.toHaveBeenCalled();
    expect(analisarMensagemJoaoMock).not.toHaveBeenCalled();
    expect(enviarWhatsappJoaoMock).not.toHaveBeenCalled();
    expect(processarRespostaJoaoMock).not.toHaveBeenCalled();
  });

  it('com valor inesperado (ex.: "1"), cai no fluxo V1 por segurança (só "true" literal ativa o V2)', async () => {
    process.env.WHATSAPP_JOAO_V2 = "1";

    await POST(criarRequest(payloadNeutro));

    expect(processarWebhookJoaoV2Mock).not.toHaveBeenCalled();
  });
});
