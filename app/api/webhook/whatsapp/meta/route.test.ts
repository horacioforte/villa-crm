import { beforeEach, describe, expect, it, vi } from "vitest";

const { processarRoteadorMetaV2Mock } = vi.hoisted(() => ({
  processarRoteadorMetaV2Mock: vi.fn().mockResolvedValue(Response.json({ ok: true, via: "v2" })),
}));

vi.mock("@/lib/whatsapp/meta-router-v2", () => ({
  processarRoteadorMetaV2: (...args: unknown[]) => processarRoteadorMetaV2Mock(...args),
}));

import { POST } from "./route";

const ORIGINAL_ENV = { ...process.env };
const payloadNeutro = { object: "outra_coisa", entry: [] };

function criarRequest(body: unknown) {
  return new Request("https://villa-crm.vercel.app/api/webhook/whatsapp/meta", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

describe("POST /api/webhook/whatsapp/meta — branch da feature flag do roteador unificado", () => {
  it("com WHATSAPP_META_ROUTER_V2 ausente, executa somente o fluxo V1 (roteador unificado nunca é chamado)", async () => {
    delete process.env.WHATSAPP_META_ROUTER_V2;
    const res = await POST(criarRequest(payloadNeutro) as never);
    expect(res.status).toBe(200);
    expect(processarRoteadorMetaV2Mock).not.toHaveBeenCalled();
  });

  it('com WHATSAPP_META_ROUTER_V2="false", executa somente o fluxo V1', async () => {
    process.env.WHATSAPP_META_ROUTER_V2 = "false";
    await POST(criarRequest(payloadNeutro) as never);
    expect(processarRoteadorMetaV2Mock).not.toHaveBeenCalled();
  });

  it('com WHATSAPP_META_ROUTER_V2="true", executa somente o roteador unificado', async () => {
    process.env.WHATSAPP_META_ROUTER_V2 = "true";
    const res = await POST(criarRequest(payloadNeutro) as never);
    expect(processarRoteadorMetaV2Mock).toHaveBeenCalledTimes(1);
    const corpo = await res.json();
    expect(corpo.via).toBe("v2");
  });

  it('com valor inesperado (ex.: "1"), cai no fluxo V1 por segurança', async () => {
    process.env.WHATSAPP_META_ROUTER_V2 = "1";
    await POST(criarRequest(payloadNeutro) as never);
    expect(processarRoteadorMetaV2Mock).not.toHaveBeenCalled();
  });
});
