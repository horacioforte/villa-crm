// ARQUIVO: lib/instagram/sync-engine.ts
// Central de Mídias Sociais — Sprint 2 (Instagram Analytics Real), C3.
// Ver Proposta_Tecnica_Sprint2_Instagram_Analytics.docx para o desenho completo.
//
// Motor de sincronização: Meta (via lib/meta/instagram-client) → Postgres.
// A UI (e qualquer rota interna de leitura) nunca chama a Meta diretamente —
// só lê o que este motor já persistiu (item 8 da proposta técnica).
//
// Idempotência:
// - MetricaSocialSnapshot é append-only: cada sync sempre insere uma linha
//   NOVA, nunca sobrescreve um snapshot já existente.
// - ConteudoSocial é upsert por (rede, externalMediaId): nunca duplica um
//   post/reel/carrossel já sincronizado antes, só atualiza as métricas.
//
// Retry/backoff — DESVIO DELIBERADO da proposta técnica original (item 7):
// a proposta descrevia até 3 tentativas com esperas de 1 min / 5 min / 15 min.
// Isso não é viável dentro de uma única execução de função serverless da
// Vercel (que tem limite de poucos segundos a poucos minutos) — dormir 15
// minutosno meio de uma invocação estouraria o timeout muito antes disso.
// Implementado aqui: até 3 tentativas com backoff curto (500ms, 1.5s, 4.5s),
// cabendo dentro de uma única invocação. Um intervalo de retry realmente
// longo (minutos) exigiria uma fila (ex.: Vercel Queue) ou confiar apenas na
// próxima execução agendada do cron — nenhuma das duas está implementada
// nesta etapa. Documentando aqui para revisão explícita, não decidi isso
// silenciosamente.
//
// Erros de autenticação (token inválido/expirado, HTTP 401 ou código Meta
// "190") NUNCA são re-tentados automaticamente — marcam o estado da conexão
// como TOKEN_EXPIRADO imediatamente (item 9 da proposta técnica).

import { prisma } from "@/lib/prisma";
import {
  ContaInstagramInvalidaError,
  InstagramApiError,
  buscarInsightsConta,
  buscarInsightsMedia,
  buscarPerfilInstagram,
  listarMediaInstagram,
  type MediaInstagram,
} from "@/lib/meta/instagram-client";

const MAX_TENTATIVAS = 3;
const BACKOFF_BASE_MS = 500;
const MEDIA_LIMIT_POR_SYNC = 25;

// Métricas de conta que são "valor total" (exigem metric_type=total_value) —
// validado manualmente contra @villapumps em 03/09/2026 (ver instagram-client.ts).
const METRICAS_CONTA_VALOR_TOTAL = [
  "profile_views",
  "accounts_engaged",
  "total_interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "replies",
  "views",
  "profile_links_taps",
  "website_clicks",
] as const;

// Métricas de conta que são série temporal (sem metric_type).
const METRICAS_CONTA_SERIE_TEMPORAL = ["reach", "follower_count"] as const;

const METRICAS_MEDIA_COMUNS = ["reach", "likes", "comments", "saved", "shares", "total_interactions"];
const METRICA_MEDIA_VIEWS = "views"; // só para VIDEO — não validado para IMAGE.

type ErroClassificado = "AUTH" | "TRANSIENTE" | "OUTRO";

function classificarErro(err: unknown): ErroClassificado {
  if (err instanceof InstagramApiError) {
    if (err.httpStatus === 401 || err.errorCode === "190") return "AUTH";
    if (err.httpStatus >= 500 || err.httpStatus === 429 || err.errorCode === "TIMEOUT" || err.errorCode === "NETWORK_ERROR") {
      return "TRANSIENTE";
    }
    return "OUTRO";
  }
  return "OUTRO";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executa `fn`, re-tentando só erros classificados como TRANSIENTE, com
 * backoff exponencial curto. Erros AUTH ou OUTRO propagam na primeira
 * tentativa, sem retry (ver nota de desvio no topo do arquivo).
 */
async function comRetry<T>(fn: () => Promise<T>): Promise<T> {
  let ultimoErro: unknown;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      return await fn();
    } catch (err) {
      ultimoErro = err;
      const tipo = classificarErro(err);
      if (tipo !== "TRANSIENTE" || tentativa === MAX_TENTATIVAS) throw err;
      await delay(BACKOFF_BASE_MS * 3 ** (tentativa - 1));
    }
  }
  throw ultimoErro;
}

function mapearTipoConteudo(mediaType: MediaInstagram["media_type"]): "POST" | "REEL" | "CARROSSEL" {
  switch (mediaType) {
    case "VIDEO":
      return "REEL";
    case "CAROUSEL_ALBUM":
      return "CARROSSEL";
    case "IMAGE":
    default:
      return "POST";
  }
}

function valorInsight(lista: Array<{ name: string; total_value?: { value: number }; values?: Array<{ value: number }> }>, nome: string): number | undefined {
  const item = lista.find((i) => i.name === nome);
  if (!item) return undefined;
  if (item.total_value) return item.total_value.value;
  if (item.values?.length) return item.values[item.values.length - 1]?.value;
  return undefined;
}

export type ResultadoSincronizacaoConta = {
  ok: boolean;
  snapshotId?: string;
  erro?: string;
};

/**
 * Sincroniza perfil + insights de conta e grava UM novo MetricaSocialSnapshot
 * (append-only — nunca sobrescreve um snapshot já existente).
 */
export async function sincronizarPerfilEInsightsConta(
  redeSocialContaId: string,
): Promise<ResultadoSincronizacaoConta> {
  try {
    const [perfil, insightsSerie, insightsTotais] = await Promise.all([
      comRetry(() => buscarPerfilInstagram(redeSocialContaId)),
      comRetry(() =>
        buscarInsightsConta(redeSocialContaId, {
          metrics: [...METRICAS_CONTA_SERIE_TEMPORAL],
          period: "day",
        }),
      ),
      comRetry(() =>
        buscarInsightsConta(redeSocialContaId, {
          metrics: [...METRICAS_CONTA_VALOR_TOTAL],
          period: "day",
          metricType: "total_value",
        }),
      ),
    ]);

    const alcance = valorInsight(insightsSerie, "reach");
    const metricasExtra: Record<string, number> = {};
    for (const nome of METRICAS_CONTA_VALOR_TOTAL) {
      const valor = valorInsight(insightsTotais, nome);
      if (valor !== undefined) metricasExtra[nome] = valor;
    }

    const snapshot = await prisma.metricaSocialSnapshot.create({
      data: {
        redeSocialContaId,
        tipo: "CONTA",
        origem: "API",
        capturadoEm: new Date(),
        seguidores: perfil.followers_count ?? undefined,
        alcance,
        visualizacoes: metricasExtra.views,
        interacoes: metricasExtra.total_interactions,
        visitasPerfil: metricasExtra.profile_views,
        // "cliquesBio" mapeado para profile_links_taps (toques em ações do
        // perfil — endereço, ligar, e-mail, texto). website_clicks fica
        // registrado à parte em metricasExtra, por ser uma métrica distinta.
        cliquesBio: metricasExtra.profile_links_taps,
        quantidadePosts: perfil.media_count ?? undefined,
        metricasExtra,
        status: "COMPLETO",
      },
    });

    return { ok: true, snapshotId: snapshot.id };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : "Erro desconhecido." };
  }
}

export type ResultadoSincronizacaoConteudos = {
  totalProcessados: number;
  totalComErro: number;
  erros: string[];
};

/**
 * Sincroniza a lista de mídia mais recente e os insights de cada uma, via
 * upsert por (rede, externalMediaId) — idempotente, nunca duplica. Uma
 * mídia que falhar não interrompe as demais (sincronização parcial).
 */
export async function sincronizarConteudos(
  redeSocialContaId: string,
): Promise<ResultadoSincronizacaoConteudos> {
  const conta = await prisma.redeSocialConta.findUnique({ where: { id: redeSocialContaId } });
  if (!conta) throw new ContaInstagramInvalidaError("Conta não encontrada.");

  const { data: midias } = await comRetry(() =>
    listarMediaInstagram(redeSocialContaId, { limit: MEDIA_LIMIT_POR_SYNC }),
  );

  let totalProcessados = 0;
  let totalComErro = 0;
  const erros: string[] = [];

  for (const media of midias) {
    try {
      const metricas = [
        ...METRICAS_MEDIA_COMUNS,
        ...(media.media_type === "VIDEO" ? [METRICA_MEDIA_VIEWS] : []),
      ];
      const insights = await comRetry(() =>
        buscarInsightsMedia(redeSocialContaId, media.id, metricas),
      );

      await prisma.conteudoSocial.upsert({
        where: { rede_externalMediaId: { rede: conta.rede, externalMediaId: media.id } },
        create: {
          redeSocialContaId,
          rede: conta.rede,
          externalMediaId: media.id,
          tipo: mapearTipoConteudo(media.media_type),
          publicadoEm: new Date(media.timestamp),
          legenda: media.caption,
          url: media.permalink,
          thumbnailUrl: media.thumbnail_url,
          alcance: valorInsight(insights, "reach"),
          interacoes: valorInsight(insights, "total_interactions"),
          curtidas: valorInsight(insights, "likes"),
          comentarios: valorInsight(insights, "comments"),
          // Nível de mídia usa "saved" (singular), diferente de "saves" no
          // nível de conta — divergência real da API da Meta, ver
          // instagram-client.ts.
          salvamentos: valorInsight(insights, "saved"),
          compartilhamentos: valorInsight(insights, "shares"),
          ultimaSincronizacaoEm: new Date(),
        },
        update: {
          alcance: valorInsight(insights, "reach"),
          interacoes: valorInsight(insights, "total_interactions"),
          curtidas: valorInsight(insights, "likes"),
          comentarios: valorInsight(insights, "comments"),
          salvamentos: valorInsight(insights, "saved"),
          compartilhamentos: valorInsight(insights, "shares"),
          ultimaSincronizacaoEm: new Date(),
        },
      });

      totalProcessados++;
    } catch (err) {
      totalComErro++;
      erros.push(
        `Mídia ${media.id}: ${err instanceof Error ? err.message : "erro desconhecido"}`,
      );
    }
  }

  return { totalProcessados, totalComErro, erros };
}

export type ResultadoSincronizacaoInstagram = {
  status: "SUCESSO" | "PARCIAL" | "ERRO";
  contagemMetricas: number;
  contagemConteudos: number;
  duracaoMs: number;
  erro?: string;
};

/**
 * Orquestra a sincronização completa de uma conta Instagram (conta + mídia).
 * Sempre grava um SincronizacaoSocialLog ao final, sucesso ou falha, e
 * atualiza RedeSocialConta.statusConexao/ultimaSincronizacaoEm/ultimoErro.
 * Nunca lança exceção — o resultado (inclusive falha) vem sempre no retorno,
 * para o chamador (rota/cron) decidir o código de resposta HTTP.
 */
export async function sincronizarInstagram(
  redeSocialContaId: string,
): Promise<ResultadoSincronizacaoInstagram> {
  const iniciadoEm = new Date();
  const inicioMs = Date.now();

  const conta = await prisma.redeSocialConta.findUnique({ where: { id: redeSocialContaId } });
  if (!conta || conta.rede !== "INSTAGRAM") {
    throw new ContaInstagramInvalidaError("Conta Instagram não encontrada.");
  }

  const resultadoConta = await sincronizarPerfilEInsightsConta(redeSocialContaId);

  let resultadoConteudos: ResultadoSincronizacaoConteudos = {
    totalProcessados: 0,
    totalComErro: 0,
    erros: [],
  };
  let erroConteudos: string | undefined;

  try {
    resultadoConteudos = await sincronizarConteudos(redeSocialContaId);
  } catch (err) {
    erroConteudos = err instanceof Error ? err.message : "Erro desconhecido.";
  }

  const duracaoMs = Date.now() - inicioMs;
  const finalizadoEm = new Date();

  const contaFalhouTotalmente = !resultadoConta.ok;
  const conteudosFalharamTotalmente = erroConteudos !== undefined;
  const houveAlgumErroParcial =
    resultadoConteudos.totalComErro > 0 || (!resultadoConta.ok && !conteudosFalharamTotalmente);

  let status: "SUCESSO" | "PARCIAL" | "ERRO";
  if (contaFalhouTotalmente && conteudosFalharamTotalmente) {
    status = "ERRO";
  } else if (houveAlgumErroParcial || !resultadoConta.ok || conteudosFalharamTotalmente) {
    status = "PARCIAL";
  } else {
    status = "SUCESSO";
  }

  const erroConsolidado = [resultadoConta.erro, erroConteudos, ...resultadoConteudos.erros]
    .filter(Boolean)
    .join(" | ") || undefined;

  // Determina o erro "mais grave" só entre as chamadas de conta/conteúdo (não
  // entre os erros por-mídia individuais) para decidir se é AUTH — evita que
  // um erro AUTH transitório em um item de mídia isolado marque a conta
  // inteira como TOKEN_EXPIRADO indevidamente.
  const algumErroDeAuth =
    (!resultadoConta.ok && resultadoConta.erro?.includes("Token de acesso")) ?? false;

  await prisma.$transaction([
    prisma.sincronizacaoSocialLog.create({
      data: {
        redeSocialContaId,
        iniciadoEm,
        finalizadoEm,
        status,
        contagemMetricas: resultadoConta.ok ? 1 : 0,
        contagemConteudos: resultadoConteudos.totalProcessados,
        duracaoMs,
        erro: erroConsolidado,
      },
    }),
    prisma.redeSocialConta.update({
      where: { id: redeSocialContaId },
      data: {
        statusConexao: algumErroDeAuth ? "TOKEN_EXPIRADO" : status === "ERRO" ? "ERRO" : "CONECTADO",
        ultimaSincronizacaoEm: finalizadoEm,
        ultimoErro: erroConsolidado ?? null,
      },
    }),
  ]);

  return {
    status,
    contagemMetricas: resultadoConta.ok ? 1 : 0,
    contagemConteudos: resultadoConteudos.totalProcessados,
    duracaoMs,
    erro: erroConsolidado,
  };
}
