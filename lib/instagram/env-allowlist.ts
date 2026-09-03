// ARQUIVO: lib/instagram/env-allowlist.ts
// Central de Mídias Sociais — Sprint 2 (Instagram Analytics Real).
//
// RedeSocialConta guarda apenas o NOME da variável de ambiente
// (accessTokenEnvVar) — nunca o valor do segredo. Esta allowlist é o único
// ponto autorizado a transformar um nome em valor: qualquer nome fora da
// lista fixa abaixo é rejeitado, mesmo que exista de fato como variável de
// ambiente no processo. Mesmo padrão de lib/whatsapp/env-allowlist.ts.

import { auditLog } from "@/lib/audit";

// Lista fixa em código — adicionar uma nova conta de rede social (ex.: um
// segundo Instagram, uma página Facebook) exige alterar este arquivo, nunca
// é lido de configuração dinâmica ou do banco.
const ALLOWED_ACCESS_TOKEN_ENV_VARS = new Set<string>(["INSTAGRAM_ACCESS_TOKEN"]);

export class EnvVarNaoPermitidaError extends Error {
  constructor(envVarName: string) {
    super(`Nome de variável de ambiente "${envVarName}" não está na allowlist do Instagram.`);
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
 * Resolve o valor de uma variável de ambiente autorizada para uso no
 * Instagram (access token). Nunca loga nem retorna o nome em texto junto de
 * qualquer valor — o valor só é devolvido ao chamador, nunca persistido ou
 * impresso por esta função.
 */
export async function resolveInstagramEnvVar(
  envVarName: string,
  contexto?: { redeSocialContaId?: string | null },
): Promise<string> {
  if (!ALLOWED_ACCESS_TOKEN_ENV_VARS.has(envVarName)) {
    await auditLog({
      action: "INSTAGRAM_ENV_VAR_REJEITADA",
      entity: "RedeSocialConta",
      entityId: contexto?.redeSocialContaId ?? null,
      metadata: { envVarName },
    }).catch(() => {
      // auditLog já engole erro internamente; catch aqui é só defesa extra —
      // rejeição de env var nunca pode ficar bloqueada por falha de auditoria.
    });

    throw new EnvVarNaoPermitidaError(envVarName);
  }

  const value = process.env[envVarName];
  if (!value) {
    throw new EnvVarNaoConfiguradaError(envVarName);
  }

  return value;
}
