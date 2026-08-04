import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ACCESS_TOKEN_FAKE = "token-secreto-fake-nao-real-9f8e7d";

const { prismaMock, resolveWhatsappEnvVarMock } = vi.hoisted(() => ({
  prismaMock: {
    canalWhatsapp: { findUnique: vi.fn(), update: vi.fn() },
    conversa: { findUnique: vi.fn() },
    mensagem: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
  },
  resolveWhatsappEnvVarMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("./env-allowlist", () => ({
  resolveWhatsappEnvVar: (...args: unknown[]) => resolveWhatsappEnvVarMock(...args),
}));

import { CanalInvalidoError, EnvioMetaError, enviarTextoMeta } from "./meta-client";

const CANAL_ATIVO = {
  id: "canal-joao",
  tipo: "META_CLOUD_API",
  ativo: true,
  phoneNumberId: "1234567890",
  accessTokenEnvVar: "META_JOAO_ACCESS_TOKEN",
};

const CONVERSA_VINCULADA = { id: "conversa-1", canalWhatsappId: "canal-joao" };

beforeEach(() => {
  vi.clearAllMocks();
  resolveWhatsappEnvVarMock.mockResolvedValue(ACCESS_TOKEN_FAKE);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("enviarTextoMeta — validação de canal", () => {
  it("rejeita quando o canal não existe", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue(null);

    await expect(
      enviarTextoMeta({ canalId: "inexistente", conversaId: "c1", telefone: "5581999999999", texto: "oi" }),
    ).rejects.toBeInstanceOf(CanalInvalidoError);
  });

  it("rejeita quando o canal está inativo", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue({ ...CANAL_ATIVO, ativo: false });

    await expect(
      enviarTextoMeta({ canalId: "canal-joao", conversaId: "c1", telefone: "5581999999999", texto: "oi" }),
    ).rejects.toBeInstanceOf(CanalInvalidoError);
  });

  it("rejeita quando o canal não é META_CLOUD_API (sem tentar outro provedor)", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue({ ...CANAL_ATIVO, tipo: "EVOLUTION" });
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      enviarTextoMeta({ canalId: "canal-joao", conversaId: "c1", telefone: "5581999999999", texto: "oi" }),
    ).rejects.toBeInstanceOf(CanalInvalidoError);

    // Nenhuma chamada de rede foi tentada — não há fallback.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejeita quando o canal não tem accessTokenEnvVar configurado (ausência de token)", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue({ ...CANAL_ATIVO, accessTokenEnvVar: null });

    await expect(
      enviarTextoMeta({ canalId: "canal-joao", conversaId: "c1", telefone: "5581999999999", texto: "oi" }),
    ).rejects.toBeInstanceOf(CanalInvalidoError);
  });

  it("rejeita quando o canalId informado diverge do canalWhatsappId da conversa", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue(CANAL_ATIVO);
    prismaMock.conversa.findUnique.mockResolvedValue({ id: "conversa-1", canalWhatsappId: "OUTRO_CANAL" });

    await expect(
      enviarTextoMeta({ canalId: "canal-joao", conversaId: "conversa-1", telefone: "5581999999999", texto: "oi" }),
    ).rejects.toBeInstanceOf(CanalInvalidoError);

    expect(prismaMock.mensagem.create).not.toHaveBeenCalled();
  });
});

describe("enviarTextoMeta — envio com sucesso", () => {
  it("cria mensagem PENDENTE, envia, e atualiza para ENVIADA salvando externalMessageId", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue(CANAL_ATIVO);
    prismaMock.conversa.findUnique.mockResolvedValue(CONVERSA_VINCULADA);
    prismaMock.mensagem.create.mockResolvedValue({ id: "msg-1", status: "PENDENTE" });
    prismaMock.mensagem.update.mockResolvedValue({ id: "msg-1", status: "ENVIADA", externalMessageId: "wamid.abc" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: "wamid.abc" }] }),
      }),
    );

    const resultado = await enviarTextoMeta({
      canalId: "canal-joao",
      conversaId: "conversa-1",
      telefone: "5581999999999",
      texto: "Olá!",
    });

    expect(prismaMock.mensagem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDENTE", canalWhatsappId: "canal-joao", direcao: "SAIDA" }),
      }),
    );
    expect(prismaMock.mensagem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "msg-1" },
        data: expect.objectContaining({ status: "ENVIADA", externalMessageId: "wamid.abc" }),
      }),
    );
    expect(resultado.status).toBe("ENVIADA");
  });

  it("nunca chama graph.facebook.com com token exposto em texto plano fora do header Authorization", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue(CANAL_ATIVO);
    prismaMock.conversa.findUnique.mockResolvedValue(CONVERSA_VINCULADA);
    prismaMock.mensagem.create.mockResolvedValue({ id: "msg-1", status: "PENDENTE" });
    prismaMock.mensagem.update.mockResolvedValue({ id: "msg-1", status: "ENVIADA" });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: "wamid.x" }] }) });
    vi.stubGlobal("fetch", fetchMock);

    await enviarTextoMeta({ canalId: "canal-joao", conversaId: "conversa-1", telefone: "5581999999999", texto: "oi" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain(ACCESS_TOKEN_FAKE);
    expect(JSON.stringify(init.body)).not.toContain(ACCESS_TOKEN_FAKE);
    expect(init.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN_FAKE}`);
  });
});

describe("enviarTextoMeta — envio com erro", () => {
  it("marca a mensagem como ERRO com código e descrição sanitizada, sem vazar segredo em log", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue(CANAL_ATIVO);
    prismaMock.conversa.findUnique.mockResolvedValue(CONVERSA_VINCULADA);
    prismaMock.mensagem.create.mockResolvedValue({ id: "msg-1", status: "PENDENTE" });
    prismaMock.mensagem.update.mockResolvedValue({ id: "msg-1", status: "ERRO" });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 190, message: "Access token inválido ou expirado." } }),
      }),
    );

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      enviarTextoMeta({ canalId: "canal-joao", conversaId: "conversa-1", telefone: "5581999999999", texto: "oi" }),
    ).rejects.toBeInstanceOf(EnvioMetaError);

    expect(prismaMock.mensagem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "msg-1" },
        data: expect.objectContaining({ status: "ERRO", errorCode: "190", errorMessage: "Access token inválido ou expirado." }),
      }),
    );

    const logsCompletos = consoleSpy.mock.calls.map((c) => JSON.stringify(c)).join("\n");
    expect(logsCompletos).not.toContain(ACCESS_TOKEN_FAKE);

    consoleSpy.mockRestore();
  });
});

describe("enviarTextoMeta — retry sem duplicidade", () => {
  it("reaproveita a mesma linha de Mensagem quando retryMensagemId é informado, em vez de criar outra", async () => {
    prismaMock.canalWhatsapp.findUnique.mockResolvedValue(CANAL_ATIVO);
    prismaMock.conversa.findUnique.mockResolvedValue(CONVERSA_VINCULADA);
    prismaMock.mensagem.findUnique.mockResolvedValue({
      id: "msg-retry",
      conversaId: "conversa-1",
      canalWhatsappId: "canal-joao",
      status: "ERRO",
    });
    prismaMock.mensagem.update.mockResolvedValue({ id: "msg-retry", status: "ENVIADA" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: "wamid.y" }] }) }));

    await enviarTextoMeta({
      canalId: "canal-joao",
      conversaId: "conversa-1",
      telefone: "5581999999999",
      texto: "reenvio",
      retryMensagemId: "msg-retry",
    });

    expect(prismaMock.mensagem.create).not.toHaveBeenCalled();
  });
});
