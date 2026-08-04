// ARQUIVO: lib/agentes/joao/investigador-combinado.ts
// REGRA: nunca remover. Apenas acrescentar.
// Roda Claude Haiku + GPT-4o em paralelo e mescla os resultados.
// Cada fonte gera seus próprios registros no banco (rastreabilidade completa).

import { investigarDossie, type DossieParaInvestigacao, type ResultadoInvestigacao } from "./investigador";
import { investigarDossieOpenAI } from "./investigador-openai";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ResultadoCombinado {
  claude:  ResultadoInvestigacao;
  gpt4o:   ResultadoInvestigacao;
  mesclado: ResultadoInvestigacao;
}

// ─── sanitizarDecimal ─────────────────────────────────────────────────────────

export function sanitizarDecimal(valor: unknown): number | undefined {
  if (valor === undefined || valor === null || valor === "") return undefined;
  if (typeof valor === "number" && !isNaN(valor)) return valor;
  if (typeof valor === "string") {
    const limpo = valor.replace(/[^0-9.,]/g, "").replace(",", ".");
    const num = parseFloat(limpo);
    return isNaN(num) ? undefined : num;
  }
  return undefined;
}

// ─── mesclarResultados ────────────────────────────────────────────────────────
// Combina campos, noticias e decisor dos dois investigadores.
// Preferência: primeiro valor não-nulo encontrado (Claude tem prioridade).

function mesclarResultados(
  dossieId: string,
  claude: ResultadoInvestigacao,
  gpt4o: ResultadoInvestigacao,
): ResultadoInvestigacao {
  // Campos: Claude primeiro, GPT-4o preenche lacunas
  const camposMesclados: Record<string, unknown> = { ...claude.campos };
  for (const [k, v] of Object.entries(gpt4o.campos)) {
    if (v !== undefined && v !== null && v !== "" && !camposMesclados[k]) {
      camposMesclados[k] = v;
    }
  }

  // Notícias: combina, deduplicando por título
  const titulosVistos = new Set<string>();
  const noticiasCombinadas: ResultadoInvestigacao["noticias"] = [];
  for (const n of [...claude.noticias, ...gpt4o.noticias]) {
    const chave = n.titulo.toLowerCase().trim().slice(0, 60);
    if (!titulosVistos.has(chave)) {
      titulosVistos.add(chave);
      noticiasCombinadas.push(n);
    }
  }

  // Decisor: prefere Claude, cai para GPT-4o
  const decisor = claude.decisor ?? gpt4o.decisor;

  return {
    dossieId,
    achou:   claude.achou || gpt4o.achou,
    campos:  camposMesclados,
    decisor,
    noticias: noticiasCombinadas,
    resumoInvestigacao: [
      claude.resumoInvestigacao ? `Claude: ${claude.resumoInvestigacao}` : null,
      gpt4o.resumoInvestigacao  ? `GPT-4o: ${gpt4o.resumoInvestigacao}` : null,
    ].filter(Boolean).join("\n\n"),
  };
}

// ─── investigarDossieCombinado ────────────────────────────────────────────────

export async function investigarDossieCombinado(
  dossie: DossieParaInvestigacao,
): Promise<ResultadoCombinado> {
  console.log(`[investigador-combinado] Iniciando paralelo para: ${dossie.titulo}`);

  const [claude, gpt4o] = await Promise.all([
    investigarDossie(dossie).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[investigador-combinado] Claude falhou:`, msg);
      return {
        dossieId: dossie.id,
        achou: false,
        campos: {},
        decisor: null,
        noticias: [],
        resumoInvestigacao: `Erro Claude: ${msg}`,
        erro: msg,
      } satisfies ResultadoInvestigacao;
    }),
    investigarDossieOpenAI(dossie).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[investigador-combinado] GPT-4o falhou:`, msg);
      return {
        dossieId: dossie.id,
        achou: false,
        campos: {},
        decisor: null,
        noticias: [],
        resumoInvestigacao: `Erro GPT-4o: ${msg}`,
        erro: msg,
      } satisfies ResultadoInvestigacao;
    }),
  ]);

  const mesclado = mesclarResultados(dossie.id, claude, gpt4o);

  console.log(`[investigador-combinado] Concluído — Claude: ${claude.achou}, GPT-4o: ${gpt4o.achou}, Mesclado: ${mesclado.achou}`);

  return { claude, gpt4o, mesclado };
}
