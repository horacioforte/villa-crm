// ARQUIVO: lib/whatsapp/env-allowlist.ts
// Fase 2 — Central de Atendimento WhatsApp.
//
// CanalWhatsapp guarda apenas NOMES de variáveis de ambiente (accessTokenEnvVar,
// verifyTokenEnvVar, appSecretEnvVar) — nunca o valor do segredo. Esta allowlist é o
// único ponto autorizado a transformar um nome em valor: qualquer nome fora da lista
// fixa abaixo é rejeitado, mesmo que exista de fato como variável de ambiente no
// processo. Isso impede que um registro de canal malformado ou comprometido no banco
// (ex.: accessTokenEnvVar = "DATABASE_URL") vaze um segredo não relacionado ao WhatsApp.

import { auditLog } from "@/lib/audit";

export type WhatsappEnvVarKind = "access_token" | "verify_token" | "app_secret";

// Lista fixa em código — adicionar um novo canal (Maria, Morgana, Taciane em Meta Cloud
// API) exige alterar este arquivo, nunca é lido de configuração dinâmica ou do banco.
const ALLOWED_ACCESS_TOKEN_ENV_VARS = new Set<string>([
  "MARIA_META_ACCESS_TOKEN",
  "META_JOAO_ACCESS_TOKEN",
  "MORGANA_EVOLUTION_API_KEY",
  "TACIANE_META_ACCESS_TOKEN",
]);

const ALLOWED_VERIFY_TOKEN_ENV_VARS = new Set<string>([
  "MARIA_META_VERIFY_TOKEN",
  "META_WEBHOOK_VERIFY_TOKEN",
  "TACIANE_META_VERIFY_TOKEN",
]);

// App Secret ainda não configurado para nenhum canal (nenhuma dessas variáveis existe
// hoje em .env.local) — os nomes já ficam reservados na allowlist para quando forem
// criadas, sem exigir alteração de código nesse momento.
//
// META_APP_SECRET (Etapa 4 — roteador unificado): App Secret GLOBAL, por aplicativo
// Meta — não por canal. Hoje Maria e João estão confirmados (via Graph API, auditoria
// de leitura) sob o MESMO App Meta (id 937150279352653), e a assinatura
// X-Hub-Signature-256 é calculada pela Meta usando o App Secret do aplicativo dono do
// webhook, não um segredo por número/canal. Duplicar o mesmo valor em
// MARIA_META_APP_SECRET/META_JOAO_APP_SECRET por canal seria redundante e arriscado
// (múltiplas cópias do mesmo segredo). O roteador unificado (meta-router-v2.ts) usa
// só este nome para validar a assinatura, antes mesmo de identificar o canal — ver
// lib/whatsapp/meta-router-v2.ts para a ordem segura de validação.
// Os nomes por canal (MARIA_META_APP_SECRET/META_JOAO_APP_SECRET) continuam
// reservados e em uso pelo adaptador legado (joao-webhook-v2.ts), que resolve o App
// Secret via canal.appSecretEnvVar — mantido por compatibilidade, não removido.
const ALLOWED_APP_SECRET_ENV_VARS = new Set<string>([
  "MARIA_META_APP_SECRET",
  "META_JOAO_APP_SECRET",
  "META_APP_SECRET",
]);

function allowlistPara(kind: WhatsappEnvVarKind): Set<string> {
  switch (kind) {
    case "access_token":
      return ALLOWED_ACCESS_TOKEN_ENV_VARS;
    case "verify_token":
      return ALLOWED_VERIFY_TOKEN_ENV_VARS;
    case "app_secret":
      return ALLOWED_APP_SECRET_ENV_VARS;
  }
}

export class EnvVarNaoPermitidaError extends Error {
  constructor(envVarName: string, kind: WhatsappEnvVarKind) {
    super(`Nome de variável de ambiente "${envVarName}" não está na allowlist para ${kind}.`);
    this.name = "EnvVarNaoPermitidaError";
  }
}

export class EnvVarNaoConfiguradaError extends Error {
  constructor(envVarName: string) {
    super(`Variável de ambiente "${envVarName}" não está configurada no servidor.`);
    this.name = "EnvVarNaoConfiguradaError";
  }
}

/**
 * Resolve o valor de uma variável de ambiente autorizada para uso em WhatsApp
 * (access token, verify token ou app secret). Nunca loga nem retorna o nome em texto
 * junto de qualquer valor — o valor só é devolvido ao chamador, nunca persistido ou
 * impresso por esta função.
 */
export async function resolveWhatsappEnvVar(
  envVarName: string,
  kind: WhatsappEnvVarKind,
  contexto?: { canalId?: string | null },
): Promise<string> {
  const allowlist = allowlistPara(kind);

  if (!allowlist.has(envVarName)) {
    await auditLog({
      action: "WHATSAPP_ENV_VAR_REJEITADA",
      entity: "CanalWhatsapp",
      entityId: contexto?.canalId ?? null,
      metadata: { envVarName, kind },
    }).catch(() => {
      // auditLog já engole erro internamente; catch aqui é só defesa extra —
      // rejeição de env var nunca pode ficar bloqueada por falha de auditoria.
    });

    throw new EnvVarNaoPermitidaError(envVarName, kind);
  }

  const value = process.env[envVarName];
  if (!value) {
    throw new EnvVarNaoConfiguradaError(envVarName);
  }

  return value;
}
