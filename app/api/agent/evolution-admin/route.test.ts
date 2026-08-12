import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditLogMock } = vi.hoisted(() => ({ auditLogMock: vi.fn() }));
vi.mock("@/lib/audit", () => ({ auditLog: auditLogMock }));

import { POST } from "./route";
import { auditLog } from "@/lib/audit";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
  process.env.AGENT_API_KEY = "test-agent-key";
  process.env.EVOLUTION_API_URL = "https://evolution.example.com";
  process.env.EVOLUTION_API_KEY = "default-evolution-key";
  process.env.MORGANA_EVOLUTION_API_KEY = "morgana-evolution-key";
  process.env.NEXTAUTH_URL = "https://villa-crm.vercel.app";
});

function criarRequest(body: unknown, authorization = "Bearer test-agent-key") {
  return new Request("https://villa-crm.vercel.app/api/agent/evolution-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/agent/evolution-admin — action=setWebhook", () => {
  it("envia o corpo no formato novo exigido pela Evolution API (aninhado sob 'webhook', camelCase)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ webhook: { enabled: true } }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ action: "setWebhook", instance: "morgana-villa" }));

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://evolution.example.com/webhook/set/morgana-villa");
    expect(JSON.parse(options.body)).toEqual({
      webhook: {
        url: "https://villa-crm.vercel.app/api/webhook/whatsapp/morgana",
        enabled: true,
        webhookByEvents: false,
        webhookBase64: false,
        events: ["MESSAGES_UPSERT"],
      },
    });
  });

  it("instância joao*: continua apontando para /api/webhook/whatsapp/joao (sem regressão)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchSpy);

    await POST(criarRequest({ action: "setWebhook", instance: "joao-villa" }));

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.webhook.url).toBe("https://villa-crm.vercel.app/api/webhook/whatsapp/joao");
  });

  it("qualquer outra instância: continua apontando para /api/webhook/whatsapp (sem regressão — Maria/legado)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchSpy);

    await POST(criarRequest({ action: "setWebhook", instance: "maria-villa" }));

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.webhook.url).toBe("https://villa-crm.vercel.app/api/webhook/whatsapp");
  });
});

describe("POST /api/agent/evolution-admin — sem regressão nas outras actions", () => {
  it("action=list: mesma URL/headers de antes", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetchSpy);

    await POST(criarRequest({ action: "list" }));

    expect(fetchSpy).toHaveBeenCalledWith("https://evolution.example.com/instance/fetchInstances", {
      headers: { apikey: "default-evolution-key" },
    });
  });

  it("action=status: mesma URL/headers de antes, resolve a key de morgana pelo prefixo", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ status: 200, json: async () => ({ instance: {} }) });
    vi.stubGlobal("fetch", fetchSpy);

    await POST(criarRequest({ action: "status", instance: "morgana-villa" }));

    expect(fetchSpy).toHaveBeenCalledWith("https://evolution.example.com/instance/connectionState/morgana-villa", {
      headers: { apikey: "morgana-evolution-key" },
    });
  });

  it("action=getWebhook: mesma URL/headers de antes", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchSpy);

    await POST(criarRequest({ action: "getWebhook", instance: "morgana-villa" }));

    expect(fetchSpy).toHaveBeenCalledWith("https://evolution.example.com/webhook/find/morgana-villa", {
      headers: { apikey: "morgana-evolution-key" },
    });
  });

  it("action=connect: mesma URL/headers de antes", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchSpy);

    await POST(criarRequest({ action: "connect", instance: "morgana-villa" }));

    expect(fetchSpy).toHaveBeenCalledWith("https://evolution.example.com/instance/connect/morgana-villa", {
      headers: { apikey: "morgana-evolution-key" },
    });
  });

  it("action=create: mesmo corpo/URL de antes (formato inalterado por este bug fix)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ status: 201, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchSpy);

    await POST(criarRequest({ action: "create", instance: "morgana-villa" }));

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://evolution.example.com/instance/create");
    expect(JSON.parse(options.body)).toEqual({
      instanceName: "morgana-villa",
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    });
  });
});

describe("POST /api/agent/evolution-admin — action=logout (restrito a morgana-villa)", () => {
  it("faz DELETE /instance/logout/morgana-villa e devolve o resultado", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ status: 200, json: async () => ({ status: "SUCCESS" }) });
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ action: "logout", instance: "morgana-villa" }));

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith("https://evolution.example.com/instance/logout/morgana-villa", {
      method: "DELETE",
      headers: { apikey: "morgana-evolution-key" },
    });
  });

  it("rejeita maria-villa, sem chamar a Evolution", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ action: "logout", instance: "maria-villa" }));

    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejeita joao-villa, sem chamar a Evolution", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ action: "logout", instance: "joao-villa" }));

    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejeita taciane-villa, sem chamar a Evolution", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ action: "logout", instance: "taciane-villa" }));

    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/evolution-admin — action=getChatwoot (só leitura)", () => {
  it("consulta GET /chatwoot/find/{instance}, mesma resolução de apikey por prefixo", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ enabled: true, url: "https://app.chatwoot.com", accountId: "171792" }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ action: "getChatwoot", instance: "morgana-villa" }));
    const body = await res.json();

    expect(fetchSpy).toHaveBeenCalledWith("https://evolution.example.com/chatwoot/find/morgana-villa", {
      headers: { apikey: "morgana-evolution-key" },
    });
    expect(body).toEqual({ enabled: true, url: "https://app.chatwoot.com", accountId: "171792" });
  });

  it("é puramente leitura: não faz nenhuma segunda chamada (não habilita/desabilita/altera nada)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ status: 200, json: async () => ({ enabled: false }) });
    vi.stubGlobal("fetch", fetchSpy);

    await POST(criarRequest({ action: "getChatwoot", instance: "morgana-villa" }));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/agent/evolution-admin — action=setChatwoot (restrito a morgana-villa, enabled:false)", () => {
  const configAtual = {
    enabled: true,
    accountId: "171792",
    token: "mkYuFYeVMDx5nsqcWkrmAGM6",
    url: "https://app.chatwoot.com",
    nameInbox: "Morgana",
    signMsg: false,
    reopenConversation: true,
  };

  it("desativa morgana-villa reutilizando exatamente os valores atuais, só 'enabled' muda", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/chatwoot/find/morgana-villa")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => configAtual });
      }
      if (url.endsWith("/chatwoot/set/morgana-villa")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ...configAtual, enabled: false }) });
      }
      throw new Error(`URL inesperada: ${url}`);
    });
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ action: "setChatwoot", instance: "morgana-villa", enabled: false }));

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const setCall = fetchSpy.mock.calls.find(([url]) => url.endsWith("/chatwoot/set/morgana-villa"));
    const bodyEnviado = JSON.parse(setCall![1].body);
    expect(bodyEnviado).toEqual({ ...configAtual, enabled: false });
  });

  it("nenhum campo além de 'enabled' é alterado (accountId, url, nameInbox, token idênticos ao find)", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/chatwoot/find/morgana-villa")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => configAtual });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    vi.stubGlobal("fetch", fetchSpy);

    await POST(criarRequest({ action: "setChatwoot", instance: "morgana-villa", enabled: false }));

    const setCall = fetchSpy.mock.calls.find(([url]) => url.endsWith("/chatwoot/set/morgana-villa"));
    const enviado = JSON.parse(setCall![1].body);
    expect(enviado.accountId).toBe(configAtual.accountId);
    expect(enviado.url).toBe(configAtual.url);
    expect(enviado.nameInbox).toBe(configAtual.nameInbox);
    expect(enviado.token).toBe(configAtual.token);
    expect(enviado.enabled).toBe(false);
  });

  it("rejeita qualquer instância diferente de morgana-villa (maria-villa), sem chamar a Evolution", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ action: "setChatwoot", instance: "maria-villa", enabled: false }));

    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejeita joao-villa, sem chamar a Evolution", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ action: "setChatwoot", instance: "joao-villa", enabled: false }));

    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejeita taciane-villa, sem chamar a Evolution", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ action: "setChatwoot", instance: "taciane-villa", enabled: false }));

    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejeita enabled:true (nunca reativa por esta rota nesta etapa), sem chamar a Evolution", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ action: "setChatwoot", instance: "morgana-villa", enabled: true }));

    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejeita enabled ausente, sem chamar a Evolution", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ action: "setChatwoot", instance: "morgana-villa" }));

    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("grava auditoria (before mascarado) antes do write, nunca com o token completo", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/chatwoot/find/morgana-villa")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => configAtual });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });
    vi.stubGlobal("fetch", fetchSpy);

    await POST(criarRequest({ action: "setChatwoot", instance: "morgana-villa", enabled: false }));

    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "EVOLUTION_CHATWOOT_DESATIVADO",
        before: expect.objectContaining({ token: expect.not.stringContaining(configAtual.token) }),
      }),
    );
    const chamada = vi.mocked(auditLog).mock.calls[0][0];
    expect(JSON.stringify(chamada)).not.toContain(configAtual.token);
  });

  it("resposta da rota também mascara o token (nunca aparece completo em nenhum output)", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/chatwoot/find/morgana-villa")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => configAtual });
      }
      if (url.endsWith("/chatwoot/set/morgana-villa")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ...configAtual, enabled: false }) });
      }
      throw new Error("URL inesperada");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ action: "setChatwoot", instance: "morgana-villa", enabled: false }));
    const body = await res.json();

    expect(JSON.stringify(body)).not.toContain(configAtual.token);
  });

  it("se a leitura prévia (find) falhar, cancela o write e não chama /chatwoot/set", async () => {
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/chatwoot/find/morgana-villa")) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({ error: "falha" }) });
      }
      throw new Error("Não deveria chamar /chatwoot/set após find falhar");
    });
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ action: "setChatwoot", instance: "morgana-villa", enabled: false }));

    expect(res.status).toBe(502);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/agent/evolution-admin — autenticação", () => {
  it("sem AGENT_API_KEY correta: 401, nenhuma chamada à Evolution", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ action: "list" }, "Bearer errada"));

    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
