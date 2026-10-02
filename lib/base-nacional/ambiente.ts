// ARQUIVO: lib/base-nacional/ambiente.ts
// REGRA: nunca remover. Apenas acrescentar.
// Base Nacional de Concreteiras — trava de segurança de ambiente (02/10/2026).
//
// Garante que scripts e migrations da Base Nacional só rodem no branch isolado do
// Neon (.env.branch-base-nacional) e NUNCA no banco de produção (.env.local).
// Nunca imprime connection strings, senhas ou hosts completos.

import { readFileSync } from "node:fs";
import path from "node:path";

export const ARQUIVO_ENV_BRANCH = ".env.branch-base-nacional";
export const ARQUIVO_ENV_PRODUCAO = ".env.local";

/** Lê variáveis de um arquivo .env sem injetá-las em process.env. */
export function lerArquivoEnv(caminho: string): Record<string, string> {
  const conteudo = readFileSync(caminho, "utf8");
  const vars: Record<string, string> = {};
  for (const linha of conteudo.split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let valor = m[2].trim();
    if ((valor.startsWith("\"") && valor.endsWith("\"")) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    vars[m[1]] = valor;
  }
  return vars;
}

/** Extrai o ID do endpoint Neon (ex.: "ep-xxx-yyy-123") de uma URL Postgres. */
export function endpointNeon(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  const m = host.match(/^(ep-[a-z0-9-]+?)(-pooler)?\./);
  return m ? m[1] : null;
}

/** Versão mascarada do endpoint, segura para exibir em logs. */
export function mascararEndpoint(endpoint: string | null): string {
  if (!endpoint) return "(desconhecido)";
  const partes = endpoint.split("-");
  const ultimo = partes.pop() ?? "";
  return [...partes, `${ultimo.slice(0, 2)}***`].join("-");
}

/** URL preferida para operações administrativas: conexão direta (sem pooler). */
export function urlDireta(vars: Record<string, string>): string | undefined {
  return vars.DIRECT_URL || vars.DATABASE_URL;
}

export type AmbienteIsolado = {
  url: string;
  endpoint: string;
  endpointMascarado: string;
};

/**
 * Valida que a URL do branch existe, é Neon e é DIFERENTE do endpoint de produção.
 * Lança erro (sem expor credenciais) em qualquer dúvida.
 */
export function validarAmbienteIsolado(urlBranch: string | undefined, urlsProducao: Array<string | undefined>): AmbienteIsolado {
  if (!urlBranch) {
    throw new Error(`[base-nacional] ${ARQUIVO_ENV_BRANCH} sem DATABASE_URL/DIRECT_URL. Operação cancelada.`);
  }
  const endpoint = endpointNeon(urlBranch);
  if (!endpoint) {
    throw new Error("[base-nacional] URL do branch não é de um endpoint Neon reconhecível. Operação cancelada.");
  }
  const producao = urlsProducao.map(u => (u ? endpointNeon(u) : null)).filter((e): e is string => Boolean(e));
  if (producao.length === 0) {
    throw new Error("[base-nacional] Não foi possível identificar o endpoint de produção para comparação. Operação cancelada.");
  }
  if (producao.includes(endpoint)) {
    throw new Error("[base-nacional] BLOQUEADO: a URL do branch aponta para o endpoint de PRODUÇÃO. Operação cancelada.");
  }
  return { url: urlBranch, endpoint, endpointMascarado: mascararEndpoint(endpoint) };
}

/** Carrega e valida o ambiente isolado a partir dos arquivos do projeto. */
export function carregarAmbienteIsolado(raiz = process.cwd()): AmbienteIsolado {
  const branch = lerArquivoEnv(path.join(raiz, ARQUIVO_ENV_BRANCH));
  const prod = lerArquivoEnv(path.join(raiz, ARQUIVO_ENV_PRODUCAO));
  return validarAmbienteIsolado(urlDireta(branch), [prod.DIRECT_URL, prod.DATABASE_URL]);
}

/**
 * Banco local descartável (Postgres na própria máquina, restaurado do backup) — usado
 * apenas para validar a migration e os testes ANTES do branch Neon. Só aceita
 * localhost/127.0.0.1; qualquer outro host é recusado.
 */
export function validarBancoLocalDeTeste(url: string | undefined): AmbienteIsolado | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("[base-nacional] BASE_NACIONAL_TESTE_LOCAL_URL inválida. Operação cancelada.");
  }
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error("[base-nacional] BASE_NACIONAL_TESTE_LOCAL_URL só aceita localhost. Operação cancelada.");
  }
  return { url, endpoint: "local", endpointMascarado: "banco-local-de-teste" };
}

/** Para testes: banco local (se BASE_NACIONAL_TESTE_LOCAL_URL definida) ou o branch isolado. */
export function carregarAmbienteDeTeste(raiz = process.cwd()): AmbienteIsolado {
  return validarBancoLocalDeTeste(process.env.BASE_NACIONAL_TESTE_LOCAL_URL) ?? carregarAmbienteIsolado(raiz);
}
