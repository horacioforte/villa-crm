// ARQUIVO: lib/base-nacional/joao/pesquisa-ia-config.ts
// REGRA: nunca remover. Apenas acrescentar.
// Configuração (variáveis de ambiente) do módulo de pesquisa assistida por IA da fila
// comercial do João — DESLIGADO por padrão. Funções puras, sem I/O.
//
// Variáveis:
//   JOAO_PESQUISA_IA_ATIVA              "true" liga o módulo (botão + rota). Qualquer outro valor, ou ausente, desliga.
//   JOAO_PESQUISA_IA_PROVEDOR           "claude" ou "openai". Sem valor válido = módulo fica desligado mesmo com ATIVA=true.
//   JOAO_PESQUISA_IA_LIMITE_MENSAL_USD  teto de gasto no mês corrente (padrão 50).
//   JOAO_PESQUISA_IA_LIMITE_POR_GRUPO   número máximo de buscas por grupo, para sempre (padrão 1 — nunca repete).

export type ProvedorPesquisaIA = "claude" | "openai";

export function pesquisaIaAtiva(env: Record<string, string | undefined> = process.env): boolean {
  return env.JOAO_PESQUISA_IA_ATIVA === "true" && provedorConfigurado(env) !== null;
}

export function provedorConfigurado(env: Record<string, string | undefined> = process.env): ProvedorPesquisaIA | null {
  const v = env.JOAO_PESQUISA_IA_PROVEDOR;
  return v === "claude" || v === "openai" ? v : null;
}

export function limiteMensalUsd(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.JOAO_PESQUISA_IA_LIMITE_MENSAL_USD);
  return Number.isFinite(n) && n > 0 ? n : 50;
}

export function limiteBuscasPorGrupo(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.JOAO_PESQUISA_IA_LIMITE_POR_GRUPO);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}
