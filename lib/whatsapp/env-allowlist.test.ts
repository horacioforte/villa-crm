import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditLogMock } = vi.hoisted(() => ({ auditLogMock: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/audit", () => ({ auditLog: (...args: unknown[]) => auditLogMock(...args) }));

import {
  EnvVarNaoConfiguradaError,
  EnvVarNaoPermitidaError,
  resolveWhatsappEnvVar,
} from "./env-allowlist";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  auditLogMock.mockClear();
  process.env = { ...ORIGINAL_ENV };
});

describe("resolveWhatsappEnvVar", () => {
  it("resolve o valor de um nome de variável permitido e configurado", async () => {
    process.env.META_JOAO_ACCESS_TOKEN = "valor-secreto-fake";
    const valor = await resolveWhatsappEnvVar("META_JOAO_ACCESS_TOKEN", "access_token");
    expect(valor).toBe("valor-secreto-fake");
  });

  it("rejeita nome de variável fora da allowlist, sem ler process.env e sem revelar valor", async () => {
    process.env.DATABASE_URL = "postgres://nao-deveria-vazar";

    await expect(
      resolveWhatsappEnvVar("DATABASE_URL", "access_token"),
    ).rejects.toBeInstanceOf(EnvVarNaoPermitidaError);
  });

  it("registra auditoria ao rejeitar nome fora da allowlist, sem incluir o valor da variável", async () => {
    process.env.DATABASE_URL = "postgres://nao-deveria-vazar";

    await resolveWhatsappEnvVar("DATABASE_URL", "access_token", { canalId: "canal-1" }).catch(() => {});

    expect(auditLogMock).toHaveBeenCalledTimes(1);
    const chamada = auditLogMock.mock.calls[0][0];
    expect(chamada.action).toBe("WHATSAPP_ENV_VAR_REJEITADA");
    expect(chamada.entityId).toBe("canal-1");
    expect(chamada.metadata.envVarName).toBe("DATABASE_URL");
    // Garante que o valor real da variável nunca é passado para a auditoria.
    expect(JSON.stringify(chamada)).not.toContain("nao-deveria-vazar");
  });

  it("rejeita nome permitido pela categoria errada (ex.: access token pedido como app secret)", async () => {
    process.env.META_JOAO_ACCESS_TOKEN = "valor-secreto-fake";
    await expect(
      resolveWhatsappEnvVar("META_JOAO_ACCESS_TOKEN", "app_secret"),
    ).rejects.toBeInstanceOf(EnvVarNaoPermitidaError);
  });

  it("lança erro controlado quando a variável permitida não está configurada (ausência de token)", async () => {
    delete process.env.META_JOAO_ACCESS_TOKEN;
    await expect(
      resolveWhatsappEnvVar("META_JOAO_ACCESS_TOKEN", "access_token"),
    ).rejects.toBeInstanceOf(EnvVarNaoConfiguradaError);
  });

  it("nunca inclui o valor da variável na mensagem de erro", async () => {
    process.env.META_JOAO_ACCESS_TOKEN = "valor-secreto-fake-12345";
    delete process.env.OUTRO_NOME_QUALQUER;

    try {
      await resolveWhatsappEnvVar("NOME_FORA_DA_ALLOWLIST", "access_token");
    } catch (err) {
      expect((err as Error).message).not.toContain("valor-secreto-fake-12345");
    }
  });
});
