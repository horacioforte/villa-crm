// ARQUIVO: scripts/guarda-script-legado.ts
// REGRA: nunca remover. Apenas acrescentar.
// TRAVA (02/10/2026 — Base Nacional de Concreteiras): scripts legados de carga que
// gravam em DossieComercial e/ou DossieCarteira só rodam com autorização explícita.
//
// Deve ser o PRIMEIRO import de cada script legado. Como os módulos são avaliados na
// ordem dos imports, esta verificação roda antes de "./env", de "pg" e de
// "@/lib/prisma" — ou seja, antes de carregar credenciais ou abrir qualquer conexão.
//
// Para liberar conscientemente:  PERMITIR_SCRIPT_LEGADO=SIM-AUTORIZADO-HORACIO npx tsx scripts/<script>.ts

export const VALOR_AUTORIZACAO_SCRIPT_LEGADO = "SIM-AUTORIZADO-HORACIO";

export function scriptLegadoAutorizado(env: Record<string, string | undefined>): boolean {
  return env.PERMITIR_SCRIPT_LEGADO === VALOR_AUTORIZACAO_SCRIPT_LEGADO;
}

export function mensagemBloqueioScriptLegado(script: string): string {
  return [
    `[BLOQUEADO] ${script} é um script legado que GRAVA em Dossiê Comercial (DossieComercial) e/ou Carteira (DossieCarteira).`,
    "Ele foi travado em 02/10/2026 para evitar cargas acidentais que misturam Radar João, Carteiras e Empresas.",
    "Execução exige autorização explícita do Horácio (variável PERMITIR_SCRIPT_LEGADO). Nada foi lido, conectado ou gravado.",
  ].join("\n");
}

if (!scriptLegadoAutorizado(process.env)) {
  const script = (process.argv[1] ?? "script legado").split(/[\\/]/).pop() ?? "script legado";
  console.error(mensagemBloqueioScriptLegado(script));
  process.exit(1);
}
