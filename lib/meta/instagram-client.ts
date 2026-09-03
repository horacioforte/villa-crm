// ARQUIVO: lib/meta/instagram-client.ts
// Central de Mídias Sociais — Sprint 2 (Instagram Analytics Real), C2.
// Ver Proposta_Tecnica_Sprint2_Instagram_Analytics.docx para o desenho completo.
//
// Único ponto de comunicação com a Instagram Graph API (graph.instagram.com).
// Nenhuma outra rota ou serviço deve chamar graph.instagram.com diretamente.
//
// Regras de desenho (mesmo padrão de lib/whatsapp/meta-client.ts):
// - Recebe redeSocialContaId, nunca token/segredo diretamente. Resolve
//   credenciais só aqui, só no servidor, só via lib/instagram/env-allowlist.
// - Timeout de 10s por chamada, erro classificado a partir do corpo de erro
//   da própria Meta (nunca inclui o token na mensagem/log/erro).
// - Camada pura de leitura — nenhuma escrita na Instagram Graph API aqui
//   (Sprint 2 é só Insights orgânicos, sem publicação de conteúdo).
// - Nomes de métrica e a exigência de metric_type=total_value para métricas
//   de "valor total" (tudo exceto reach/follower_count, que são séries
//   temporais) foram validados manualmente contra a conta real @villapumps
//   no Graph API Explorer em 03/09/2026 — não são suposição.

import { prisma } from "@/lib/prisma";
import { resolveInstagramEnvVar } from "@/lib/instagram/env-allowlist";

const GRAPH_API_VERSION = "v26.0";
const BASE_URL = `https://graph.instagram.com/${GRAPH_API_VERSION}`;
const TIMEOUT_MS = 10_000;

export class ContaInstagramInvalidaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContaInstagramInvalidaError";
  }
}

export class InstagramApiError extends Error {
  readonly errorCode: string;
  readonly httpStatus: number;
  constructor(message: string, errorCode: string, httpStatus: number) {
    super(message);
    this.name = "InstagramApiError";
    this.errorCode = errorCode;
    this.httpStatus = httpStatus;
  }
}

type ContaInstagramAtiva = Awaited<ReturnType<typeof buscarContaInstagramAtiva>>;

async function buscarContaInstagramAtiva(redeSocialContaId: string) {
  const conta = await prisma.redeSocialConta.findUnique({ where: { id: redeSocialContaId } });

  if (!conta) throw new ContaInstagramInvalidaError("Conta não encontrada.");
  if (conta.rede !== "INSTAGRAM") {
    throw new ContaInstagramInvalidaError("Conta não é do tipo INSTAGRAM.");
  }
  if (!conta.ativo) throw new ContaInstagramInvalidaError("Conta está desativada.");
  if (!conta.instagramBusinessAccountId) {
    throw new ContaInstagramInvalidaError("Conta sem instagramBusinessAccountId configurado.");
  }
  if (!conta.accessTokenEnvVar) {
    throw new ContaInstagramInvalidaError("Conta sem accessTokenEnvVar configurado.");
  }

  return conta;
}

function classificarErroGraphApi(status: number, corpo: unknown): { code: string; message: string } {
  const erro = (corpo as { error?: { code?: number | string; message?: string } } | null)?.error;
  return {
    code: erro?.code !== undefined ? String(erro.code) : String(status),
    // A mensagem de erro da própria Meta nunca contém nosso access token — é
    // seguro persistir/logar. Não incluímos aqui nenhum header ou corpo bruto
    // da requisição.
    message: erro?.message ?? "Erro desconhecido da Instagram Graph API.",
  };
}

/**
 * Chamada GET genérica à Instagram Graph API para um node (conta ou mídia),
 * já resolvendo o token via allowlist e nunca expondo o valor além desta
 * função (nem em erro, nem em log).
 */
async function chamarGraphApiGet(
  conta: ContaInstagramAtiva,
  path: string,
  params: Record<string, string>,
): Promise<unknown> {
  const accessToken = await resolveInstagramEnvVar(conta.accessTokenEnvVar as string, {
    redeSocialContaId: conta.id,
  });

  const url = new URL(`${BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("access_token", accessToken);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), { method: "GET", signal: controller.signal });
    const corpo = await response.json().catch(() => null);

    if (!response.ok) {
      const { code, message } = classificarErroGraphApi(response.status, corpo);
      throw new InstagramApiError(message, code, response.status);
    }

    return corpo;
  } catch (err) {
    if (err instanceof InstagramApiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new InstagramApiError("Timeout ao chamar a Instagram Graph API.", "TIMEOUT", 0);
    }
    throw new InstagramApiError(
      err instanceof Error ? err.message : "Erro desconhecido.",
      "NETWORK_ERROR",
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Tipos de resposta ──────────────────────────────────────────────────────

export type PerfilInstagram = {
  id: string;
  username?: string;
  name?: string;
  biography?: string;
  website?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
};

export type InsightRespostaItem = {
  name: string;
  period: string;
  title?: string;
  description?: string;
  total_value?: { value: number };
  values?: Array<{ value: number; end_time?: string }>;
  id?: string;
};

export type MediaInstagram = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
  timestamp: string;
};

// ─── API pública ────────────────────────────────────────────────────────────

/**
 * Dados básicos do perfil (username, nome, seguidores, contagem de posts,
 * bio). Ver item 3 ("Conta") da proposta técnica.
 */
export async function buscarPerfilInstagram(redeSocialContaId: string): Promise<PerfilInstagram> {
  const conta = await buscarContaInstagramAtiva(redeSocialContaId);
  const fields = "id,username,name,biography,website,profile_picture_url,followers_count,media_count";
  const corpo = await chamarGraphApiGet(conta, conta.instagramBusinessAccountId as string, { fields });
  return corpo as PerfilInstagram;
}

/**
 * Insights de conta. `reach` e `follower_count` são métricas de série
 * temporal (não usam metricType); as demais métricas de valor total
 * (profile_views, accounts_engaged, total_interactions, likes, comments,
 * shares, saves, replies, views, profile_links_taps, website_clicks) exigem
 * metricType: "total_value" — sem isso a API responde com `data: []`, sem
 * erro, e nenhum valor real fica disponível.
 */
export async function buscarInsightsConta(
  redeSocialContaId: string,
  opts: { metrics: string[]; period?: string; metricType?: "total_value" },
): Promise<InsightRespostaItem[]> {
  const conta = await buscarContaInstagramAtiva(redeSocialContaId);
  const params: Record<string, string> = {
    metric: opts.metrics.join(","),
    period: opts.period ?? "day",
  };
  if (opts.metricType) params.metric_type = opts.metricType;

  const corpo = (await chamarGraphApiGet(
    conta,
    `${conta.instagramBusinessAccountId}/insights`,
    params,
  )) as { data?: InsightRespostaItem[] };
  return corpo.data ?? [];
}

/**
 * Lista de mídia publicada (posts/reels/carrosséis), mais recente primeiro.
 */
export async function listarMediaInstagram(
  redeSocialContaId: string,
  opts: { limit?: number; after?: string } = {},
): Promise<{ data: MediaInstagram[]; nextCursor?: string }> {
  const conta = await buscarContaInstagramAtiva(redeSocialContaId);
  const params: Record<string, string> = {
    fields: "id,caption,media_type,media_url,permalink,thumbnail_url,timestamp",
    limit: String(opts.limit ?? 25),
  };
  if (opts.after) params.after = opts.after;

  const corpo = (await chamarGraphApiGet(conta, `${conta.instagramBusinessAccountId}/media`, params)) as {
    data?: MediaInstagram[];
    paging?: { cursors?: { after?: string } };
  };

  return { data: corpo.data ?? [], nextCursor: corpo.paging?.cursors?.after };
}

/**
 * Insights de uma mídia específica. Diferente da conta, não precisa de
 * metricType — validado manualmente contra posts reais (imagem e reel) de
 * @villapumps em 03/09/2026. Atenção: o nome do campo de salvamentos é
 * "saved" aqui (nível de mídia), mas "saves" no nível de conta — divergência
 * real da própria API da Meta, não erro de digitação.
 */
export async function buscarInsightsMedia(
  redeSocialContaId: string,
  mediaId: string,
  metrics: string[],
): Promise<InsightRespostaItem[]> {
  const conta = await buscarContaInstagramAtiva(redeSocialContaId);
  const corpo = (await chamarGraphApiGet(conta, `${mediaId}/insights`, {
    metric: metrics.join(","),
  })) as { data?: InsightRespostaItem[] };
  return corpo.data ?? [];
}
