import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveWhatsappEnvVarMock, EnvVarNaoPermitidaErrorFake, EnvVarNaoConfiguradaErrorFake } = vi.hoisted(() => {
  class EnvVarNaoPermitidaErrorFake extends Error {}
  class EnvVarNaoConfiguradaErrorFake extends Error {}
  return {
    resolveWhatsappEnvVarMock: vi.fn(),
    EnvVarNaoPermitidaErrorFake,
    EnvVarNaoConfiguradaErrorFake,
  };
});

vi.mock("@/lib/whatsapp/env-allowlist", () => ({
  resolveWhatsappEnvVar: (...args: unknown[]) => resolveWhatsappEnvVarMock(...args),
  EnvVarNaoPermitidaError: EnvVarNaoPermitidaErrorFake,
  EnvVarNaoConfiguradaError: EnvVarNaoConfiguradaErrorFake,
}));

import { POST } from "./route";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
  process.env.AGENT_API_KEY = "test-agent-key";
});

function criarRequest(body: unknown, authorization = "Bearer test-agent-key") {
  return new Request("https://villa-crm.vercel.app/api/agent/meta-diagnostico", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/agent/meta-diagnostico — autenticação", () => {
  it("sem Authorization: 401, nunca chama a Graph API", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ phoneNumberId: "123", accessTokenEnvVar: "TACIANE_META_ACCESS_TOKEN" }, ""));

    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(resolveWhatsappEnvVarMock).not.toHaveBeenCalled();
  });

  it("Authorization errado: 401", async () => {
    const res = await POST(
      criarRequest({ phoneNumberId: "123", accessTokenEnvVar: "TACIANE_META_ACCESS_TOKEN" }, "Bearer errado"),
    );
    expect(res.status).toBe(401);
  });

  it("AGENT_API_KEY não configurado no servidor: 401 mesmo com header correto", async () => {
    delete process.env.AGENT_API_KEY;
    const res = await POST(criarRequest({ phoneNumberId: "123", accessTokenEnvVar: "TACIANE_META_ACCESS_TOKEN" }));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/agent/meta-diagnostico — validação de entrada", () => {
  it("sem phoneNumberId: 400", async () => {
    const res = await POST(criarRequest({ accessTokenEnvVar: "TACIANE_META_ACCESS_TOKEN" }));
    expect(res.status).toBe(400);
  });

  it("sem accessTokenEnvVar: 400", async () => {
    const res = await POST(criarRequest({ phoneNumberId: "123" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/agent/meta-diagnostico — accessTokenEnvVar restrito à allowlist", () => {
  it("nome fora da allowlist: 400, nunca chama a Graph API, nunca vaza o motivo interno da rejeição", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    resolveWhatsappEnvVarMock.mockRejectedValue(new EnvVarNaoPermitidaErrorFake("fora da allowlist"));

    const res = await POST(criarRequest({ phoneNumberId: "123", accessTokenEnvVar: "DATABASE_URL" }));

    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
  });

  it("nome permitido mas não configurado no servidor: 400", async () => {
    resolveWhatsappEnvVarMock.mockRejectedValue(new EnvVarNaoConfiguradaErrorFake("não configurada"));

    const res = await POST(criarRequest({ phoneNumberId: "123", accessTokenEnvVar: "TACIANE_META_ACCESS_TOKEN" }));

    expect(res.status).toBe(400);
  });
});

describe("POST /api/agent/meta-diagnostico — consulta somente leitura", () => {
  it("chama a Graph API com GET, no phone_number_id informado, com Bearer do token resolvido, e devolve o corpo", async () => {
    resolveWhatsappEnvVarMock.mockResolvedValue("token-secreto-fake");
    const fetchSpy = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        id: "1238399969356190",
        display_phone_number: "+55 81 7401-8568",
        verified_name: "Villa Empreendimentos",
        webhook_configuration: { application: "https://exemplo.com/webhook" },
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(
      criarRequest({ phoneNumberId: "1238399969356190", accessTokenEnvVar: "TACIANE_META_ACCESS_TOKEN" }),
    );

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain("graph.facebook.com");
    expect(url).toContain("1238399969356190");
    expect(url).toContain("webhook_configuration");
    expect(options.method).toBe("GET");
    expect(options.headers.Authorization).toBe("Bearer token-secreto-fake");

    const body = await res.json();
    expect(body.corpo.webhook_configuration).toEqual({ application: "https://exemplo.com/webhook" });
  });

  it("nunca inclui o token resolvido na resposta HTTP", async () => {
    resolveWhatsappEnvVarMock.mockResolvedValue("token-secreto-fake-12345");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 200, json: async () => ({ id: "123" }) }),
    );

    const res = await POST(criarRequest({ phoneNumberId: "123", accessTokenEnvVar: "TACIANE_META_ACCESS_TOKEN" }));
    const texto = JSON.stringify(await res.json());

    expect(texto).not.toContain("token-secreto-fake-12345");
  });

  it("repassa erro da Graph API (ex.: permissão insuficiente) sem quebrar a rota", async () => {
    resolveWhatsappEnvVarMock.mockResolvedValue("token-secreto-fake");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 400,
        json: async () => ({ error: { message: "missing permissions", code: 100 } }),
      }),
    );

    const res = await POST(criarRequest({ phoneNumberId: "123", accessTokenEnvVar: "META_JOAO_ACCESS_TOKEN" }));

    expect(res.status).toBe(200); // a rota em si respondeu; o erro vem dentro de httpStatus/corpo
    const body = await res.json();
    expect(body.httpStatus).toBe(400);
    expect(body.corpo.error.message).toBe("missing permissions");
  });

  it("falha de rede ao chamar a Graph API: 502, sem vazar o token no erro", async () => {
    resolveWhatsappEnvVarMock.mockResolvedValue("token-secreto-fake");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const res = await POST(criarRequest({ phoneNumberId: "123", accessTokenEnvVar: "TACIANE_META_ACCESS_TOKEN" }));

    expect(res.status).toBe(502);
    const texto = JSON.stringify(await res.json());
    expect(texto).not.toContain("token-secreto-fake");
  });
});
