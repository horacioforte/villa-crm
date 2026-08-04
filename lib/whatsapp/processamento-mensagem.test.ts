import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    mensagem: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import {
  adquirirParaProcessamento,
  marcarErroProcessamento,
  marcarProcessada,
  LimiteDeTentativasExcedidoError,
  PROCESSAMENTO_MAX_TENTATIVAS,
} from "./processamento-mensagem";
import { CanalInvalidoError, EnvioMetaError } from "./meta-client";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adquirirParaProcessamento", () => {
  it("retorna null quando a mensagem não existe", async () => {
    prismaMock.mensagem.findUnique.mockResolvedValue(null);
    const resultado = await adquirirParaProcessamento("inexistente");
    expect(resultado).toBeNull();
    expect(prismaMock.mensagem.updateMany).not.toHaveBeenCalled();
  });

  it("lança LimiteDeTentativasExcedidoError quando o limite já foi atingido, sem tentar adquirir", async () => {
    prismaMock.mensagem.findUnique.mockResolvedValue({ processamentoTentativas: PROCESSAMENTO_MAX_TENTATIVAS });

    await expect(adquirirParaProcessamento("msg-1")).rejects.toBeInstanceOf(LimiteDeTentativasExcedidoError);
    expect(prismaMock.mensagem.updateMany).not.toHaveBeenCalled();
  });

  it("adquire com sucesso via UPDATE condicional atômico e incrementa tentativas", async () => {
    prismaMock.mensagem.findUnique.mockResolvedValue({ processamentoTentativas: 0 });
    prismaMock.mensagem.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.mensagem.findUniqueOrThrow.mockResolvedValue({ id: "msg-1", processamentoStatus: "PROCESSANDO" });

    const resultado = await adquirirParaProcessamento("msg-1");

    expect(prismaMock.mensagem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "msg-1", processamentoStatus: { in: ["PENDENTE"] } },
        data: expect.objectContaining({
          processamentoStatus: "PROCESSANDO",
          processamentoTentativas: { increment: 1 },
        }),
      }),
    );
    expect(resultado).toEqual({ id: "msg-1", processamentoStatus: "PROCESSANDO" });
  });

  it("retorna null quando perde a corrida (outra execução já adquiriu — count 0)", async () => {
    prismaMock.mensagem.findUnique.mockResolvedValue({ processamentoTentativas: 0 });
    prismaMock.mensagem.updateMany.mockResolvedValue({ count: 0 });

    const resultado = await adquirirParaProcessamento("msg-1");

    expect(resultado).toBeNull();
    expect(prismaMock.mensagem.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("aceita lista customizada de status elegíveis (reprocessamento a partir de ERRO_PROCESSAMENTO)", async () => {
    prismaMock.mensagem.findUnique.mockResolvedValue({ processamentoTentativas: 1 });
    prismaMock.mensagem.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.mensagem.findUniqueOrThrow.mockResolvedValue({ id: "msg-1" });

    await adquirirParaProcessamento("msg-1", { statusElegiveis: ["ERRO_PROCESSAMENTO" as never, "PROCESSANDO" as never] });

    expect(prismaMock.mensagem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "msg-1", processamentoStatus: { in: ["ERRO_PROCESSAMENTO", "PROCESSANDO"] } } }),
    );
  });
});

describe("marcarProcessada", () => {
  it("grava PROCESSADA, processadaEm, e limpa erro anterior", async () => {
    await marcarProcessada("msg-1");
    expect(prismaMock.mensagem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "msg-1" },
        data: expect.objectContaining({
          processamentoStatus: "PROCESSADA",
          processamentoErroCodigo: null,
          processamentoErro: null,
        }),
      }),
    );
    const dados = prismaMock.mensagem.update.mock.calls[0][0].data;
    expect(dados.processadaEm).toBeInstanceOf(Date);
  });
});

describe("marcarErroProcessamento", () => {
  it("usa errorCode/message de EnvioMetaError", async () => {
    await marcarErroProcessamento("msg-1", new EnvioMetaError("Token inválido.", "190"));
    expect(prismaMock.mensagem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          processamentoStatus: "ERRO_PROCESSAMENTO",
          processamentoErroCodigo: "190",
          processamentoErro: "Token inválido.",
        }),
      }),
    );
  });

  it("usa código CANAL_INVALIDO para CanalInvalidoError", async () => {
    await marcarErroProcessamento("msg-1", new CanalInvalidoError("Canal desativado."));
    const dados = prismaMock.mensagem.update.mock.calls[0][0].data;
    expect(dados.processamentoErroCodigo).toBe("CANAL_INVALIDO");
  });

  it("redige Bearer token, chave da Anthropic e hex longo antes de persistir — nunca segredo em texto plano", async () => {
    const err = new Error(
      "Falha ao chamar API: Authorization: Bearer abc123tokenReal — key sk-ant-api03-xyz789 — hash 0123456789abcdef0123456789abcdef",
    );
    await marcarErroProcessamento("msg-1", err);

    const dados = prismaMock.mensagem.update.mock.calls[0][0].data;
    expect(dados.processamentoErroCodigo).toBe("ERRO_INTERNO");
    expect(dados.processamentoErro).not.toContain("abc123tokenReal");
    expect(dados.processamentoErro).not.toContain("sk-ant-api03-xyz789");
    expect(dados.processamentoErro).not.toContain("0123456789abcdef0123456789abcdef");
    expect(dados.processamentoErro).toContain("[REDACTED]");
  });

  it("usa ERRO_DESCONHECIDO para valores que não são instância de Error", async () => {
    await marcarErroProcessamento("msg-1", "string qualquer lançada");
    const dados = prismaMock.mensagem.update.mock.calls[0][0].data;
    expect(dados.processamentoErroCodigo).toBe("ERRO_DESCONHECIDO");
  });
});
