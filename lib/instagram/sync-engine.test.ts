import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, clientMock } = vi.hoisted(() => ({
  prismaMock: {
    redeSocialConta: { findUnique: vi.fn(), update: vi.fn() },
    metricaSocialSnapshot: { create: vi.fn() },
    conteudoSocial: { upsert: vi.fn() },
    sincronizacaoSocialLog: { create: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  },
  clientMock: {
    buscarPerfilInstagram: vi.fn(),
    buscarInsightsConta: vi.fn(),
    buscarInsightsMedia: vi.fn(),
    listarMediaInstagram: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/meta/instagram-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/meta/instagram-client")>(
    "@/lib/meta/instagram-client",
  );
  return {
    ...actual,
    buscarPerfilInstagram: (...args: unknown[]) => clientMock.buscarPerfilInstagram(...args),
    buscarInsightsConta: (...args: unknown[]) => clientMock.buscarInsightsConta(...args),
    buscarInsightsMedia: (...args: unknown[]) => clientMock.buscarInsightsMedia(...args),
    listarMediaInstagram: (...args: unknown[]) => clientMock.listarMediaInstagram(...args),
  };
});

import { InstagramApiError } from "@/lib/meta/instagram-client";
import {
  sincronizarConteudos,
  sincronizarInstagram,
  sincronizarPerfilEInsightsConta,
} from "./sync-engine";

const CONTA_ID = "conta-instagram-1";
const CONTA_ROW = { id: CONTA_ID, rede: "INSTAGRAM" };

const MEDIA_IMAGEM = {
  id: "media-1",
  media_type: "IMAGE" as const,
  timestamp: "2026-08-20T15:30:05+0000",
  caption: "legenda",
  permalink: "https://instagram.com/p/x",
  thumbnail_url: undefined,
};

beforeEach(() => {
  vi.resetAllMocks();
  prismaMock.redeSocialConta.findUnique.mockResolvedValue(CONTA_ROW);
  prismaMock.metricaSocialSnapshot.create.mockResolvedValue({ id: "snap-1" });
  prismaMock.conteudoSocial.upsert.mockResolvedValue({ id: "conteudo-1" });
  prismaMock.sincronizacaoSocialLog.create.mockResolvedValue({ id: "log-1" });
  prismaMock.redeSocialConta.update.mockResolvedValue(CONTA_ROW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sincronizarPerfilEInsightsConta", () => {
  it("cria um novo snapshot com os campos mapeados corretamente", async () => {
    clientMock.buscarPerfilInstagram.mockResolvedValue({
      id: CONTA_ID,
      username: "villapumps",
      followers_count: 2900,
      media_count: 470,
    });
    clientMock.buscarInsightsConta.mockImplementation(async (_id: string, opts: { metricType?: string }) => {
      if (opts.metricType === "total_value") {
        return [
          { name: "profile_views", total_value: { value: 22 } },
          { name: "total_interactions", total_value: { value: 87 } },
          { name: "views", total_value: { value: 2002 } },
          { name: "profile_links_taps", total_value: { value: 0 } },
        ];
      }
      return [{ name: "reach", values: [{ value: 285 }, { value: 124 }] }];
    });

    const resultado = await sincronizarPerfilEInsightsConta(CONTA_ID);

    expect(resultado.ok).toBe(true);
    expect(prismaMock.metricaSocialSnapshot.create).toHaveBeenCalledTimes(1);
    const dadosGravados = prismaMock.metricaSocialSnapshot.create.mock.calls[0][0].data;
    expect(dadosGravados.tipo).toBe("CONTA");
    expect(dadosGravados.origem).toBe("API");
    expect(dadosGravados.seguidores).toBe(2900);
    expect(dadosGravados.alcance).toBe(124); // último valor da série temporal
    expect(dadosGravados.visitasPerfil).toBe(22);
    expect(dadosGravados.quantidadePosts).toBe(470);
    expect(dadosGravados.status).toBe("COMPLETO");
  });

  it("retorna ok:false sem lançar exceção quando a API falha (não interrompe o chamador)", async () => {
    clientMock.buscarPerfilInstagram.mockRejectedValue(
      new InstagramApiError("Token de acesso inválido.", "190", 401),
    );
    clientMock.buscarInsightsConta.mockResolvedValue([]);

    const resultado = await sincronizarPerfilEInsightsConta(CONTA_ID);

    expect(resultado.ok).toBe(false);
    expect(resultado.erro).toContain("Token de acesso");
    expect(prismaMock.metricaSocialSnapshot.create).not.toHaveBeenCalled();
  });
});

describe("sincronizarConteudos — idempotência", () => {
  it("primeira sincronização faz upsert (create) de cada mídia nova", async () => {
    clientMock.listarMediaInstagram.mockResolvedValue({ data: [MEDIA_IMAGEM] });
    clientMock.buscarInsightsMedia.mockResolvedValue([
      { name: "reach", values: [{ value: 341 }] },
      { name: "likes", values: [{ value: 25 }] },
    ]);

    const resultado = await sincronizarConteudos(CONTA_ID);

    expect(resultado.totalProcessados).toBe(1);
    expect(resultado.totalComErro).toBe(0);
    expect(prismaMock.conteudoSocial.upsert).toHaveBeenCalledTimes(1);
    const args = prismaMock.conteudoSocial.upsert.mock.calls[0][0];
    expect(args.where.rede_externalMediaId).toEqual({ rede: "INSTAGRAM", externalMediaId: "media-1" });
    expect(args.create.alcance).toBe(341);
  });

  it("segunda sincronização da mesma mídia continua usando upsert (nunca create isolado) — não duplica", async () => {
    clientMock.listarMediaInstagram.mockResolvedValue({ data: [MEDIA_IMAGEM] });
    clientMock.buscarInsightsMedia.mockResolvedValue([{ name: "reach", values: [{ value: 400 }] }]);

    await sincronizarConteudos(CONTA_ID);
    await sincronizarConteudos(CONTA_ID);

    expect(prismaMock.conteudoSocial.upsert).toHaveBeenCalledTimes(2);
    // As duas chamadas usam a MESMA chave (rede, externalMediaId) — é isso
    // que garante, no banco real, que a segunda vira UPDATE e não um
    // segundo registro.
    const chave1 = prismaMock.conteudoSocial.upsert.mock.calls[0][0].where.rede_externalMediaId;
    const chave2 = prismaMock.conteudoSocial.upsert.mock.calls[1][0].where.rede_externalMediaId;
    expect(chave1).toEqual(chave2);
  });

  it("erro em uma mídia não impede o processamento das demais (falha parcial)", async () => {
    const MEDIA_2 = { ...MEDIA_IMAGEM, id: "media-2" };
    clientMock.listarMediaInstagram.mockResolvedValue({ data: [MEDIA_IMAGEM, MEDIA_2] });
    // Erro 400 (não-transiente, ver classificarErro em sync-engine.ts) —
    // propositalmente NÃO re-tentável, para o teste não depender do retry.
    clientMock.buscarInsightsMedia
      .mockRejectedValueOnce(new InstagramApiError("Requisição inválida.", "100", 400))
      .mockResolvedValueOnce([{ name: "reach", values: [{ value: 100 }] }]);

    const resultado = await sincronizarConteudos(CONTA_ID);

    expect(resultado.totalProcessados).toBe(1);
    expect(resultado.totalComErro).toBe(1);
    expect(resultado.erros[0]).toContain("media-1");
    expect(prismaMock.conteudoSocial.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("retry com backoff", () => {
  it("re-tenta erro transiente (5xx) até no máximo 3 vezes e então propaga", async () => {
    vi.useFakeTimers();
    clientMock.listarMediaInstagram.mockRejectedValue(
      new InstagramApiError("Erro interno da Meta.", "1", 503),
    );

    const promise = sincronizarConteudos(CONTA_ID).catch((e) => e);
    await vi.runAllTimersAsync();
    const resultado = await promise;

    expect(resultado).toBeInstanceOf(InstagramApiError);
    expect(clientMock.listarMediaInstagram).toHaveBeenCalledTimes(3);
  });

  it("NÃO re-tenta erro de autenticação (401/190) — propaga na primeira tentativa", async () => {
    clientMock.listarMediaInstagram.mockRejectedValue(
      new InstagramApiError("Token de acesso inválido.", "190", 401),
    );

    await expect(sincronizarConteudos(CONTA_ID)).rejects.toBeInstanceOf(InstagramApiError);
    expect(clientMock.listarMediaInstagram).toHaveBeenCalledTimes(1);
  });
});

describe("sincronizarInstagram — orquestração e status final", () => {
  it("status SUCESSO quando conta e conteúdos sincronizam sem erro", async () => {
    clientMock.buscarPerfilInstagram.mockResolvedValue({ id: CONTA_ID, followers_count: 2900 });
    clientMock.buscarInsightsConta.mockResolvedValue([{ name: "reach", values: [{ value: 100 }] }]);
    clientMock.listarMediaInstagram.mockResolvedValue({ data: [] });

    const resultado = await sincronizarInstagram(CONTA_ID);

    expect(resultado.status).toBe("SUCESSO");
    expect(prismaMock.sincronizacaoSocialLog.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.sincronizacaoSocialLog.create.mock.calls[0][0].data.status).toBe("SUCESSO");
    expect(prismaMock.redeSocialConta.update.mock.calls[0][0].data.statusConexao).toBe("CONECTADO");
  });

  it("status PARCIAL quando a conta sincroniza mas os conteúdos falham totalmente (sem perder o que funcionou)", async () => {
    clientMock.buscarPerfilInstagram.mockResolvedValue({ id: CONTA_ID, followers_count: 2900 });
    clientMock.buscarInsightsConta.mockResolvedValue([{ name: "reach", values: [{ value: 100 }] }]);
    clientMock.listarMediaInstagram.mockRejectedValue(new InstagramApiError("Erro.", "1", 500));

    const resultado = await sincronizarInstagram(CONTA_ID);

    expect(resultado.status).toBe("PARCIAL");
    // O snapshot de conta FOI gravado, mesmo com os conteúdos falhando —
    // nada do que teve sucesso é descartado.
    expect(prismaMock.metricaSocialSnapshot.create).toHaveBeenCalledTimes(1);
    expect(resultado.contagemMetricas).toBe(1);
  });

  it("status ERRO e statusConexao TOKEN_EXPIRADO quando o token está inválido", async () => {
    clientMock.buscarPerfilInstagram.mockRejectedValue(
      new InstagramApiError("Token de acesso inválido.", "190", 401),
    );
    clientMock.buscarInsightsConta.mockRejectedValue(
      new InstagramApiError("Token de acesso inválido.", "190", 401),
    );
    clientMock.listarMediaInstagram.mockRejectedValue(
      new InstagramApiError("Token de acesso inválido.", "190", 401),
    );

    const resultado = await sincronizarInstagram(CONTA_ID);

    expect(resultado.status).toBe("ERRO");
    expect(prismaMock.redeSocialConta.update.mock.calls[0][0].data.statusConexao).toBe(
      "TOKEN_EXPIRADO",
    );
  });
});
