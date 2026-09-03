import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditLogMock } = vi.hoisted(() => ({ auditLogMock: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/audit", () => ({ auditLog: (...args: unknown[]) => auditLogMock(...args) }));

import {
  EnvVarNaoConfiguradaError,
  EnvVarNaoPermitidaError,
  resolveInstagramEnvVar,
} from "./env-allowlist";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  auditLogMock.mockClear();
  process.env = { ...ORIGINAL_ENV };
});

describe("resolveInstagramEnvVar", () => {
  it("resolve o valor de INSTAGRAM_ACCESS_TOKEN quando configurado", async () => {
    process.env.INSTAGRAM_ACCESS_TOKEN = "valor-secreto-fake";
    const valor = await resolveInstagramEnvVar("INSTAGRAM_ACCESS_TOKEN");
    expect(valor).toBe("valor-secreto-fake");
  });

  it("rejeita nome de variável fora da allowlist, sem ler process.env e sem revelar valor", async () => {
    process.env.DATABASE_URL = "postgres://nao-deveria-vazar";

    await expect(resolveInstagramEnvVar("DATABASE_URL")).rejects.toBeInstanceOf(
      EnvVarNaoPermitidaError,
    );
  });

  it("registra auditoria ao rejeitar nome fora da allowlist, sem incluir o valor da variável", async () => {
    process.env.DATABASE_URL = "postgres://nao-deveria-vazar";

    await resolveInstagramEnvVar("DATABASE_URL", { redeSocialContaId: "conta-1" }).catch(() => {});

    expect(auditLogMock).toHaveBeenCalledTimes(1);
    const chamada = auditLogMock.mock.calls[0][0];
    expect(chamada.action).toBe("INSTAGRAM_ENV_VAR_REJEITADA");
    expect(chamada.entityId).toBe("conta-1");
    expect(chamada.metadata.envVarName).toBe("DATABASE_URL");
    expect(JSON.stringify(chamada)).not.toContain("nao-deveria-vazar");
  });

  it("rejeita nome que parece válido mas não está na allowlist exata (ex.: variável de outro canal)", async () => {
    process.env.META_JOAO_ACCESS_TOKEN = "outro-token-fake";
    await expect(resolveInstagramEnvVar("META_JOAO_ACCESS_TOKEN")).rejects.toBeInstanceOf(
      EnvVarNaoPermitidaError,
    );
  });

  it("lança erro controlado quando a variável permitida não está configurada (ausência de token)", async () => {
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    await expect(resolveInstagramEnvVar("INSTAGRAM_ACCESS_TOKEN")).rejects.toBeInstanceOf(
      EnvVarNaoConfiguradaError,
    );
  });

  it("nunca inclui o valor da variável na mensagem de erro", async () => {
    process.env.INSTAGRAM_ACCESS_TOKEN = "valor-secreto-fake-12345";

    try {
      await resolveInstagramEnvVar("NOME_FORA_DA_ALLOWLIST");
    } catch (err) {
      expect((err as Error).message).not.toContain("valor-secreto-fake-12345");
    }
  });
});
