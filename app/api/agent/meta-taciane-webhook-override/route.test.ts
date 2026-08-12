import { readFileSync } from "node:fs";
import { join } from "node:path";
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
const CONFIRMACAO = "taciane-override-1238399969356190";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL_ENV };
  process.env.AGENT_API_KEY = "test-agent-key";
  resolveWhatsappEnvVarMock.mockImplementation(async (nome: string) => {
    if (nome === "TACIANE_META_ACCESS_TOKEN") return "taciane-access-fake";
    if (nome === "TACIANE_META_VERIFY_TOKEN") return "taciane-verify-fake";
    throw new Error(`nome inesperado em teste: ${nome}`);
  });
});

function criarRequest(body: unknown, authorization = "Bearer test-agent-key") {
  return new Request("https://villa-crm.vercel.app/api/agent/meta-taciane-webhook-override", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: authorization },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/agent/meta-taciane-webhook-override — autenticação", () => {
  it("sem Authorization: 401, nunca chama a Graph API", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ confirmar: CONFIRMACAO }, ""));

    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(resolveWhatsappEnvVarMock).not.toHaveBeenCalled();
  });

  it("Authorization errado: 401", async () => {
    const res = await POST(criarRequest({ confirmar: CONFIRMACAO }, "Bearer errado"));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/agent/meta-taciane-webhook-override — confirmação obrigatória", () => {
  it("sem campo confirmar: 400, nunca chama a Graph API", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({}));

    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("confirmar com valor errado: 400, nunca chama a Graph API", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ confirmar: "valor-errado" }));

    expect(res.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("POST /api/agent/meta-taciane-webhook-override — chamada à Graph API", () => {
  it("com confirmação correta: POST no phone_number_id da Taciane, com override_callback_uri e verify_token corretos", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ status: 200, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ confirmar: CONFIRMACAO }));

    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain("graph.facebook.com");
    expect(url).toContain("1238399969356190");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer taciane-access-fake");
    expect(JSON.parse(options.body)).toEqual({
      webhook_configuration: {
        override_callback_uri: "https://villa-crm.vercel.app/api/webhook/whatsapp/taciane",
        verify_token: "taciane-verify-fake",
      },
    });

    const respBody = await res.json();
    expect(respBody).toEqual({ httpStatus: 200, corpo: { success: true } });
  });

  it("resolve access token e verify token EXCLUSIVAMENTE via TACIANE_META_ACCESS_TOKEN/TACIANE_META_VERIFY_TOKEN", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, json: async () => ({}) }));

    await POST(criarRequest({ confirmar: CONFIRMACAO }));

    expect(resolveWhatsappEnvVarMock).toHaveBeenCalledWith(
      "TACIANE_META_ACCESS_TOKEN",
      "access_token",
      expect.anything(),
    );
    expect(resolveWhatsappEnvVarMock).toHaveBeenCalledWith(
      "TACIANE_META_VERIFY_TOKEN",
      "verify_token",
      expect.anything(),
    );
  });

  it("repassa erro da Graph API (ex.: permissão insuficiente) sem quebrar a rota, sem tentar alternativa", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 400,
        json: async () => ({ error: { message: "missing permissions", code: 100 } }),
      }),
    );

    const res = await POST(criarRequest({ confirmar: CONFIRMACAO }));

    expect(res.status).toBe(200); // a rota respondeu; o erro real vem dentro de httpStatus/corpo
    const body = await res.json();
    expect(body.httpStatus).toBe(400);
    expect(body.corpo.error.message).toBe("missing permissions");
  });

  it("credencial não permitida/configurada: 500, nunca chama a Graph API", async () => {
    resolveWhatsappEnvVarMock.mockRejectedValue(new EnvVarNaoConfiguradaErrorFake("ausente"));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const res = await POST(criarRequest({ confirmar: CONFIRMACAO }));

    expect(res.status).toBe(500);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falha de rede: 502, sem vazar token/segredo no erro", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const res = await POST(criarRequest({ confirmar: CONFIRMACAO }));

    expect(res.status).toBe(502);
    const texto = JSON.stringify(await res.json());
    expect(texto).not.toContain("taciane-access-fake");
    expect(texto).not.toContain("taciane-verify-fake");
  });

  it("nunca inclui accessToken/verifyToken na resposta HTTP", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, json: async () => ({ ok: true }) }));

    const res = await POST(criarRequest({ confirmar: CONFIRMACAO }));
    const texto = JSON.stringify(await res.json());

    expect(texto).not.toContain("taciane-access-fake");
    expect(texto).not.toContain("taciane-verify-fake");
  });
});

// Remove comentários de linha (//...) antes de checar código real.
function codigoSemComentarios(conteudo: string): string {
  return conteudo
    .split("\n")
    .map((linha) => linha.replace(/\/\/.*$/, ""))
    .join("\n");
}

describe("Garantia estática — escopo travado exclusivamente ao número da Taciane", () => {
  it("route.ts nunca recebe phoneNumberId, callbackUrl ou accessTokenEnvVar do chamador (tudo hardcoded)", () => {
    const codigo = codigoSemComentarios(readFileSync(join(__dirname, "route.ts"), "utf-8"));
    expect(codigo).not.toMatch(/body\.phoneNumberId/);
    expect(codigo).not.toMatch(/body\.accessTokenEnvVar/);
    expect(codigo).not.toMatch(/body\.callbackUrl/);
  });

  it("route.ts não referencia nenhum outro phone_number_id (Maria/João) nem outro env var de token", () => {
    const codigo = codigoSemComentarios(readFileSync(join(__dirname, "route.ts"), "utf-8"));
    expect(codigo).not.toMatch(/MARIA_META_ACCESS_TOKEN/);
    expect(codigo).not.toMatch(/META_JOAO_ACCESS_TOKEN/);
    expect(codigo).not.toMatch(/MORGANA_EVOLUTION_API_KEY/);
    expect(codigo).not.toMatch(/1201162359737695|1168722372992684/); // phone_number_id de Maria/João
  });

  it("route.ts nunca chama endpoint de App (subscriptions) — só o phone_number_id específico", () => {
    const codigo = codigoSemComentarios(readFileSync(join(__dirname, "route.ts"), "utf-8"));
    expect(codigo).not.toMatch(/\/subscriptions/);
  });
});
