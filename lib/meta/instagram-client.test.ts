import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, resolveInstagramEnvVarMock } = vi.hoisted(() => ({
  prismaMock: {
    redeSocialConta: { findUnique: vi.fn() },
  },
  resolveInstagramEnvVarMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/instagram/env-allowlist", () => ({
  resolveInstagramEnvVar: (...args: unknown[]) => resolveInstagramEnvVarMock(...args),
}));

import {
  ContaInstagramInvalidaError,
  InstagramApiError,
  buscarInsightsConta,
  buscarInsightsMedia,
  buscarPerfilInstagram,
  listarMediaInstagram,
} from "./instagram-client";

const ACCESS_TOKEN_FAKE = "token-secreto-fake-nao-real-9f8e7d";

const CONTA_ATIVA = {
  id: "conta-instagram-1",
  rede: "INSTAGRAM",
  ativo: true,
  instagramBusinessAccountId: "17841402587852701",
  accessTokenEnvVar: "INSTAGRAM_ACCESS_TOKEN",
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveInstagramEnvVarMock.mockResolvedValue(ACCESS_TOKEN_FAKE);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validação de conta", () => {
  it("rejeita quando a conta não existe", async () => {
    prismaMock.redeSocialConta.findUnique.mockResolvedValue(null);

    await expect(buscarPerfilInstagram("inexistente")).rejects.toBeInstanceOf(
      ContaInstagramInvalidaError,
    );
  });

  it("rejeita quando a conta não é do tipo INSTAGRAM", async () => {
    prismaMock.redeSocialConta.findUnique.mockResolvedValue({ ...CONTA_ATIVA, rede: "FACEBOOK" });

    await expect(buscarPerfilInstagram("conta-instagram-1")).rejects.toBeInstanceOf(
      ContaInstagramInvalidaError,
    );
  });

  it("rejeita quando a conta está inativa, sem tentar chamar a API (sem fallback)", async () => {
    prismaMock.redeSocialConta.findUnique.mockResolvedValue({ ...CONTA_ATIVA, ativo: false });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(buscarPerfilInstagram("conta-instagram-1")).rejects.toBeInstanceOf(
      ContaInstagramInvalidaError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejeita quando falta instagramBusinessAccountId", async () => {
    prismaMock.redeSocialConta.findUnique.mockResolvedValue({
      ...CONTA_ATIVA,
      instagramBusinessAccountId: null,
    });

    await expect(buscarPerfilInstagram("conta-instagram-1")).rejects.toBeInstanceOf(
      ContaInstagramInvalidaError,
    );
  });

  it("rejeita quando falta accessTokenEnvVar", async () => {
    prismaMock.redeSocialConta.findUnique.mockResolvedValue({
      ...CONTA_ATIVA,
      accessTokenEnvVar: null,
    });

    await expect(buscarPerfilInstagram("conta-instagram-1")).rejects.toBeInstanceOf(
      ContaInstagramInvalidaError,
    );
  });
});

describe("buscarPerfilInstagram", () => {
  it("retorna o perfil em caso de sucesso e nunca inclui o token na URL exposta ao chamador", async () => {
    prismaMock.redeSocialConta.findUnique.mockResolvedValue(CONTA_ATIVA);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "17841402587852701", username: "villapumps", followers_count: 2900 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const perfil = await buscarPerfilInstagram("conta-instagram-1");

    expect(perfil.username).toBe("villapumps");
    expect(perfil.followers_count).toBe(2900);
    const urlChamada = fetchMock.mock.calls[0][0] as string;
    expect(urlChamada).toContain("graph.instagram.com");
    expect(urlChamada).toContain(`access_token=${ACCESS_TOKEN_FAKE}`);
  });

  it("propaga InstagramApiError com o código de erro da Meta em caso de token inválido", async () => {
    prismaMock.redeSocialConta.findUnique.mockResolvedValue(CONTA_ATIVA);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 190, message: "Token de acesso inválido." } }),
      }),
    );

    const promise = buscarPerfilInstagram("conta-instagram-1");
    await expect(promise).rejects.toBeInstanceOf(InstagramApiError);
    await expect(promise).rejects.toMatchObject({ errorCode: "190" });
  });

  it("classifica timeout como InstagramApiError com code TIMEOUT", async () => {
    prismaMock.redeSocialConta.findUnique.mockResolvedValue(CONTA_ATIVA);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: { signal?: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }),
    );

    const promise = buscarPerfilInstagram("conta-instagram-1");
    await expect(promise).rejects.toBeInstanceOf(InstagramApiError);
    await expect(promise).rejects.toMatchObject({ errorCode: "TIMEOUT" });
  }, 15_000);

  it("trata corpo de resposta não-JSON (resposta parcial/malformada) como erro classificado, sem lançar exceção não tratada", async () => {
    prismaMock.redeSocialConta.findUnique.mockResolvedValue(CONTA_ATIVA);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("corpo não é JSON válido");
        },
      }),
    );

    const promise = buscarPerfilInstagram("conta-instagram-1");
    await expect(promise).rejects.toBeInstanceOf(InstagramApiError);
    await expect(promise).rejects.toMatchObject({ errorCode: "500" });
  });
});

describe("buscarInsightsConta", () => {
  it("inclui metric_type=total_value quando informado (métricas de valor total)", async () => {
    prismaMock.redeSocialConta.findUnique.mockResolvedValue(CONTA_ATIVA);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ name: "profile_views", period: "day", total_value: { value: 22 } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await buscarInsightsConta("conta-instagram-1", {
      metrics: ["profile_views"],
      metricType: "total_value",
    });

    expect(resultado[0].total_value?.value).toBe(22);
    const urlChamada = fetchMock.mock.calls[0][0] as string;
    expect(urlChamada).toContain("metric_type=total_value");
    expect(urlChamada).toContain("insights");
  });

  it("não inclui metric_type quando não informado (métricas de série temporal, ex.: reach)", async () => {
    prismaMock.redeSocialConta.findUnique.mockResolvedValue(CONTA_ATIVA);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ name: "reach", period: "day", values: [{ value: 285, end_time: "2026-09-01" }] }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await buscarInsightsConta("conta-instagram-1", { metrics: ["reach"] });

    const urlChamada = fetchMock.mock.calls[0][0] as string;
    expect(urlChamada).not.toContain("metric_type");
  });

  it("retorna array vazio quando a API responde data: [] (ausência real de dado, não erro)", async () => {
    prismaMock.redeSocialConta.findUnique.mockResolvedValue(CONTA_ATIVA);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }));

    const resultado = await buscarInsightsConta("conta-instagram-1", {
      metrics: ["content_views"],
      metricType: "total_value",
    });

    expect(resultado).toEqual([]);
  });
});

describe("listarMediaInstagram", () => {
  it("retorna dados e o cursor de paginação quando presente", async () => {
    prismaMock.redeSocialConta.findUnique.mockResolvedValue(CONTA_ATIVA);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "media-1", media_type: "IMAGE", timestamp: "2026-08-20T15:30:05+0000" }],
          paging: { cursors: { after: "cursor-abc" } },
        }),
      }),
    );

    const resultado = await listarMediaInstagram("conta-instagram-1", { limit: 3 });

    expect(resultado.data).toHaveLength(1);
    expect(resultado.nextCursor).toBe("cursor-abc");
  });
});

describe("buscarInsightsMedia", () => {
  it("busca insights de uma mídia específica sem exigir metricType", async () => {
    prismaMock.redeSocialConta.findUnique.mockResolvedValue(CONTA_ATIVA);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { name: "reach", period: "lifetime", values: [{ value: 717 }] },
          { name: "views", period: "lifetime", values: [{ value: 1140 }] },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await buscarInsightsMedia("conta-instagram-1", "18213301978356782", [
      "reach",
      "views",
    ]);

    expect(resultado).toHaveLength(2);
    const urlChamada = fetchMock.mock.calls[0][0] as string;
    expect(urlChamada).toContain("18213301978356782/insights");
    expect(urlChamada).not.toContain("metric_type");
  });
});
