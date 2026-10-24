// ARQUIVO: lib/inteligencia/historico-oportunidades.ts
// REGRA: nunca remover. Apenas acrescentar.
// Antes de deixar um dossiê virar "Pronto para Morgana" (ou só pra mostrar na tela),
// procura Oportunidades já existentes (ativas e inativas) da mesma Empresa, da mesma
// Obra, ou com título parecido — pra não repetir uma obra já perdida ou já em andamento.
// Nunca cria nada: só consulta e devolve para o chamador decidir o que fazer.

import { prisma } from "@/lib/prisma";
import { palavrasDistintivas } from "./palavras-distintivas";

export { palavrasDistintivas };

export type OportunidadeRelacionada = {
  id: string;
  titulo: string;
  status: string; // StatusOportunidade
  motivoPerda: string | null;
  fechadaEm: Date | null;
  updatedAt: Date;
  responsavelNome: string | null;
  motivoMatch: "mesma empresa" | "mesma obra" | "título parecido";
  palavrasEmComum: string[];
  /**
   * "alta" (mesma empresa/obra — IDs batem exatamente — ou 3+ palavras distintivas em
   * comum no título) vs "media" (só 2 palavras em comum). Duas obras completamente
   * diferentes frequentemente compartilham 2 palavras de categoria — ex.: "Data Center
   * Terranova Campinas/SP" e "Data Center Caucaia/CE" batem em "DATA"+"CENTER" sem
   * nenhuma relação real entre si. Por isso o gate que impede "Pronto para Morgana"
   * (lib/inteligencia/maturidade.ts) só bloqueia em confiança "alta" — "media" aparece
   * só como alerta informativo pra revisão humana, nunca bloqueia nada.
   */
  confianca: "alta" | "media";
};

export type DossieParaHistorico = {
  id?: string;
  titulo: string;
  empresaId?: string | null;
  obraId?: string | null;
};

const SELECT_OPORTUNIDADE = {
  id: true, titulo: true, status: true, motivoPerda: true, fechadaEm: true, updatedAt: true,
  responsavel: { select: { nome: true } },
} as const;

type OportunidadeRow = {
  id: string; titulo: string; status: string; motivoPerda: string | null;
  fechadaEm: Date | null; updatedAt: Date; responsavel: { nome: string } | null;
};

// Palavra isolada ("Ponte") ou par genérico de categoria ("Data"+"Center",
// "Porto"+"Terminal") combina sem nenhuma relação real entre obras diferentes —
// só 3+ palavras distintivas em comum (como "RNEST"+"Abreu"+"Lima") é confiança alta.
const MINIMO_PALAVRAS_ALTA_CONFIANCA = 3;
const MINIMO_PALAVRAS_EM_COMUM = 2;

function paraRelacionada(
  o: OportunidadeRow,
  motivoMatch: OportunidadeRelacionada["motivoMatch"],
  palavrasEmComum: string[] = [],
  confianca: OportunidadeRelacionada["confianca"] = "alta",
): OportunidadeRelacionada {
  return {
    id: o.id, titulo: o.titulo, status: o.status, motivoPerda: o.motivoPerda,
    fechadaEm: o.fechadaEm, updatedAt: o.updatedAt, responsavelNome: o.responsavel?.nome ?? null,
    motivoMatch, palavrasEmComum, confianca,
  };
}

/**
 * Procura Oportunidades (qualquer status, ativas e inativas) relacionadas a este dossiê:
 * mesma Empresa, mesma Obra, ou título com pelo menos 2 palavras distintivas em comum
 * (ver MINIMO_PALAVRAS_EM_COMUM). `empresasRelacionadasIds` deixa incluir também as
 * empresas já identificadas como duplicadas da empresa do dossiê (ver
 * lib/empresas/encontrar-existente.ts) — opcional, nunca obrigatório.
 */
export async function buscarOportunidadesRelacionadas(
  dossie: DossieParaHistorico,
  opts: { empresasRelacionadasIds?: string[] } = {},
): Promise<OportunidadeRelacionada[]> {
  const encontradas = new Map<string, OportunidadeRelacionada>();

  const idsEmpresa = [...new Set([dossie.empresaId, ...(opts.empresasRelacionadasIds ?? [])].filter((x): x is string => Boolean(x)))];

  if (idsEmpresa.length > 0) {
    const porEmpresa = await prisma.oportunidade.findMany({
      where: { empresaId: { in: idsEmpresa } },
      select: SELECT_OPORTUNIDADE,
      orderBy: { updatedAt: "desc" },
    });
    // Confiança "media", não "alta": neste CRM a Empresa muitas vezes é a construtora/
    // executora (ex.: "Racional Engenharia", "Afonso França Engenharia"), que atua em
    // várias obras diferentes para clientes diferentes — bater a mesma Empresa não
    // significa a mesma obra/oportunidade. Só "mesma obra" (um site físico específico)
    // é confiável o bastante pra bloquear sozinho.
    for (const o of porEmpresa) encontradas.set(o.id, paraRelacionada(o as OportunidadeRow, "mesma empresa", [], "media"));
  }

  if (dossie.obraId) {
    const porObra = await prisma.oportunidade.findMany({
      where: { obraId: dossie.obraId },
      select: SELECT_OPORTUNIDADE,
      orderBy: { updatedAt: "desc" },
    });
    for (const o of porObra) if (!encontradas.has(o.id)) encontradas.set(o.id, paraRelacionada(o as OportunidadeRow, "mesma obra"));
  }

  const palavras = palavrasDistintivas(dossie.titulo);
  const minimoEmComum = Math.min(MINIMO_PALAVRAS_EM_COMUM, palavras.length);
  if (palavras.length > 0) {
    const candidatas = await prisma.oportunidade.findMany({
      where: { OR: palavras.map(p => ({ titulo: { contains: p, mode: "insensitive" as const } })) },
      select: SELECT_OPORTUNIDADE,
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    for (const o of candidatas) {
      if (encontradas.has(o.id)) continue;
      const palavrasDaOportunidade = new Set(palavrasDistintivas(o.titulo));
      const emComum = palavras.filter(p => palavrasDaOportunidade.has(p));
      if (emComum.length >= minimoEmComum) {
        const confianca = emComum.length >= MINIMO_PALAVRAS_ALTA_CONFIANCA ? "alta" : "media";
        encontradas.set(o.id, paraRelacionada(o as OportunidadeRow, "título parecido", emComum, confianca));
      }
    }
  }

  // Nunca inclui a própria oportunidade já vinculada ao dossiê que está sendo avaliado,
  // nem — por segurança — comparações do dossiê consigo mesmo (dossie.id não existe em Oportunidade).
  return [...encontradas.values()];
}

/** Só as relacionadas que estão PERDIDA — para o gate "não virar Pronto" e para alertas. */
export function oportunidadesPerdidas(relacionadas: OportunidadeRelacionada[]): OportunidadeRelacionada[] {
  return relacionadas.filter(o => o.status === "PERDIDA");
}

/** Só as relacionadas ainda em aberto (não perdidas nem ganhas) — para sugestão de vínculo. */
export function oportunidadesAbertas(relacionadas: OportunidadeRelacionada[]): OportunidadeRelacionada[] {
  return relacionadas.filter(o => o.status !== "PERDIDA" && o.status !== "GANHA");
}
