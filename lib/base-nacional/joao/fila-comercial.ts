// ARQUIVO: lib/base-nacional/joao/fila-comercial.ts
// REGRA: nunca remover. Apenas acrescentar.
// Fila comercial do João (13/10/2026): consulta dos grupos (A/B/C), detalhe com decisores e contatos separados,
// e gravação da decisão humana. Nada aqui envia mensagem, liga ou inicia abordagem.
// Inválidos (situacao INVALIDO ou inativos) ficam fora da tela, mas preservados no banco e no histórico.

import { prisma } from "@/lib/prisma";
import type { Indicadores } from "./categorizar";

import {
  DECISAO_COMERCIAL_LABEL, DECISAO_NAO_E_CONCRETEIRA, DECISOES_COMERCIAIS, MOTIVOS_DESCARTE, MOTIVO_DESCARTE_LABEL, MOTIVO_DESCARTE_TIPO_ATIVIDADE,
  type DecisaoComercial, type MotivoDescarte,
} from "./fila-comercial-rotulos";
export { DECISAO_COMERCIAL_LABEL, DECISOES_COMERCIAIS, type DecisaoComercial };
export const PUBLICOS_JOAO = ["PILOTO_20", "LOTE_206"];

import { lerFiltrosJoao, qsJoao, type FiltrosJoao } from "./fila-comercial-filtros";
export { lerFiltrosJoao, qsJoao, type FiltrosJoao };

/** Lista os grupos com as empresas vinculadas (cada grupo aparece uma única vez). */
export async function listarFilaJoao(f: FiltrosJoao) {
  const grupos = await prisma.joaoEnriquecimentoGrupo.findMany({
    where: { publico: { in: PUBLICOS_JOAO }, categoriaComercial: { not: null } },
    select: { chave: true, nome: true, candidataIds: true, raizes: true, categoriaComercial: true, categoriaMotivo: true, indicadores: true,
      decisaoComercial: true, decisaoEm: true, decisaoObservacao: true, decisaoPor: { select: { nome: true } }, ordem: true },
    orderBy: [{ categoriaComercial: "asc" }, { ordem: "asc" }],
  });
  const ids = grupos.flatMap(g => g.candidataIds);
  const cands = await prisma.concreteiraCandidata.findMany({
    where: { id: { in: ids } },
    select: { id: true, razaoSocial: true, nomeFantasia: true, cnpjMatriz: true, cnpjBasico: true, statusValidacao: true, confianca: true, porte: true, totalUnidadesAtivas: true, ufMatriz: true, municipioMatriz: true },
  });
  const porId = new Map(cands.map(c => [c.id, c]));
  const busca = f.busca?.normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const linhas = grupos.map(g => ({ ...g, ind: (g.indicadores ?? {}) as Partial<Indicadores>, empresas: g.candidataIds.map(id => porId.get(id)).filter((c): c is NonNullable<typeof c> => Boolean(c)) }))
    .filter(g => !f.categoria || g.categoriaComercial === f.categoria)
    .filter(g => !f.uf || (g.ind.ufs ?? []).includes(f.uf))
    .filter(g => !f.porte || (g.ind.portes ?? []).includes(f.porte))
    .filter(g => !f.unidadesMin || (g.ind.unidadesAtivas ?? 0) >= f.unidadesMin)
    .filter(g => !f.unidadesMax || (g.ind.unidadesAtivas ?? 0) <= f.unidadesMax)
    .filter(g => !f.revisao || f.revisao === "TODAS" || (f.revisao === "AGUARDANDO" ? !g.decisaoComercial : g.decisaoComercial === f.revisao))
    .filter(g => !busca || `${g.nome} ${g.raizes.join(" ")} ${g.empresas.map(e => `${e.razaoSocial} ${e.nomeFantasia ?? ""} ${e.cnpjMatriz ?? ""}`).join(" ")}`.normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().includes(busca));
  const resumo = { total: linhas.length, A: 0, B: 0, C: 0, revisados: 0, aguardando: 0 };
  for (const g of linhas) { resumo[g.categoriaComercial as "A" | "B" | "C"]++; if (g.decisaoComercial) resumo.revisados++; else resumo.aguardando++; }
  const ufs = [...new Set(grupos.flatMap(g => ((g.indicadores ?? {}) as Partial<Indicadores>).ufs ?? []))].sort();
  return { linhas, resumo, ufs };
}
export type LinhaJoao = Awaited<ReturnType<typeof listarFilaJoao>>["linhas"][number];

/** Detalhe do grupo: empresas, unidades, decisores e contatos comerciais (separados), sem inválidos. */
export async function detalheGrupoJoao(chave: string) {
  const g = await prisma.joaoEnriquecimentoGrupo.findUnique({ where: { chave }, include: { decisaoPor: { select: { nome: true } } } });
  if (!g || !PUBLICOS_JOAO.includes(g.publico)) return null;
  const ids = g.candidataIds;
  const [empresas, unidades, pessoas, contatos, historico, sites] = await Promise.all([
    prisma.concreteiraCandidata.findMany({ where: { id: { in: ids } }, select: { id: true, razaoSocial: true, nomeFantasia: true, cnpjMatriz: true, cnpjBasico: true, statusValidacao: true, confianca: true, porte: true, capitalSocial: true, totalUnidadesAtivas: true, ufMatriz: true, municipioMatriz: true } }),
    prisma.concreteiraCandidataUnidade.findMany({ where: { candidataId: { in: ids }, ativa: true }, select: { id: true, candidataId: true, cnpj: true, isMatriz: true, municipioNome: true, uf: true }, orderBy: [{ isMatriz: "desc" }, { uf: "asc" }, { municipioNome: "asc" }] }),
    prisma.concreteiraCandidataPessoa.findMany({ where: { candidataId: { in: ids }, ativo: true, situacao: { not: "INVALIDO" } }, select: { id: true, candidataId: true, nome: true, funcao: true, papeis: true, fonte: true, fonteUrl: true, confianca: true, linkedinUrl: true, observacao: true, pesquisadoEm: true, createdAt: true }, orderBy: [{ fonte: "desc" }, { nome: "asc" }] }),
    prisma.concreteiraCandidataContato.findMany({ where: { candidataId: { in: ids }, ativo: true, situacao: { not: "INVALIDO" }, tipo: { in: ["TELEFONE", "WHATSAPP", "EMAIL", "LINKEDIN"] } }, select: { id: true, candidataId: true, unidadeId: true, tipo: true, valor: true, descricao: true, fonte: true, fonteUrl: true, confianca: true, situacao: true, observacao: true, pessoaId: true, pesquisadoEm: true, createdAt: true }, orderBy: [{ tipo: "asc" }, { confianca: "asc" }] }),
    prisma.concreteiraValidacaoHistorico.findMany({ where: { candidataId: { in: ids }, tipoEvento: "DECISAO_COMERCIAL" as never }, select: { id: true, createdAt: true, valorAnterior: true, valorNovo: true, motivo: true, usuario: { select: { nome: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
    // Sites ficam fora da tabela de contatos comerciais; entram só nos botões de conferência rápida.
    prisma.concreteiraCandidataContato.findMany({ where: { candidataId: { in: ids }, ativo: true, situacao: { not: "INVALIDO" }, tipo: "SITE" }, select: { id: true, candidataId: true, tipo: true, valor: true, fonteUrl: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return { grupo: g, ind: (g.indicadores ?? {}) as Partial<Indicadores>, empresas, unidades, pessoas, contatos, historico, sites };
}

/**
 * Validação pura da decisão (sem banco) — extraída para ser testável sozinha.
 * "Aprovado para abordagem" não exige observação; as demais decisões exigem (mínimo 5
 * caracteres, depois de aparar espaços). contatosInvalidos só é aplicado quando a decisão
 * é "Contato inválido", e é truncado em 50 itens por chamada.
 */
export function validarDecisaoJoao(args: { decisao: DecisaoComercial | typeof DECISAO_NAO_E_CONCRETEIRA; observacao: string | null; contatosInvalidos: string[]; motivoDescarte?: string | null }): { ok: true; obs: string; invalidos: string[]; descarte?: { motivo: MotivoDescarte; label: string; tipoAtividade: string } } | { ok: false; erros: string[] } {
  const obs = (args.observacao ?? "").trim();
  // "Não é concreteira": o motivo escolhido basta — a observação é opcional.
  if (args.decisao === DECISAO_NAO_E_CONCRETEIRA) {
    const motivo = (MOTIVOS_DESCARTE as readonly string[]).includes(args.motivoDescarte ?? "") ? (args.motivoDescarte as MotivoDescarte) : null;
    if (!motivo) return { ok: false, erros: ["Escolha o motivo: por que não é concreteira?"] };
    return { ok: true, obs, invalidos: [], descarte: { motivo, label: MOTIVO_DESCARTE_LABEL[motivo], tipoAtividade: MOTIVO_DESCARTE_TIPO_ATIVIDADE[motivo] } };
  }
  if (args.decisao !== "APROVADO_ABORDAGEM" && obs.length < 5) return { ok: false, erros: ["Escreva uma observação curta (mínimo 5 caracteres)."] };
  const invalidos = args.decisao === "CONTATO_INVALIDO" ? args.contatosInvalidos.slice(0, 50) : [];
  return { ok: true, obs, invalidos };
}

const dataBr = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife" }).format(d);
/** Texto gravado em decisaoObservacao do grupo quando não é concreteira. */
export const observacaoDescarteGrupo = (label: string, obs: string) => `Não é concreteira — ${label}${obs ? `: ${obs}` : ""}`;
/** Justificativa gravada em cada candidata descartada (o CHECK do banco exige texto não vazio). */
export const justificativaDescarte = (label: string, usuarioNome: string, data: Date, obs: string) =>
  `Não é concreteira (${label}) — decisão na Fila do João por ${usuarioNome} em ${dataBr(data)}${obs ? `: ${obs}` : ""}`;

/** Grava a decisão humana (com histórico em cada empresa do grupo). "Contato inválido" pode marcar contatos específicos como inválidos (preservados). */
export async function decidirGrupoJoao(args: { chave: string; decisao: DecisaoComercial | typeof DECISAO_NAO_E_CONCRETEIRA; observacao: string | null; contatosInvalidos: string[]; usuarioId: string; motivoDescarte?: string | null; usuarioNome?: string | null }) {
  const g = await prisma.joaoEnriquecimentoGrupo.findUnique({ where: { chave: args.chave }, select: { chave: true, publico: true, candidataIds: true, decisaoComercial: true } });
  if (!g || !PUBLICOS_JOAO.includes(g.publico)) return { ok: false as const, erros: ["Grupo não encontrado."] };
  const validacao = validarDecisaoJoao(args);
  if (!validacao.ok) return { ok: false as const, erros: validacao.erros };
  const { obs, invalidos, descarte } = validacao;
  const agora = new Date();
  // Descarte grava o grupo como "não prioritária"; o histórico da decisão guarda o valor efetivamente gravado.
  const decisaoGrupo: DecisaoComercial = descarte ? "NAO_PRIORITARIA" : (args.decisao as DecisaoComercial);
  const obsGrupo = descarte ? observacaoDescarteGrupo(descarte.label, obs) : obs;
  await prisma.$transaction(async tx => {
    await tx.joaoEnriquecimentoGrupo.update({ where: { chave: g.chave }, data: { decisaoComercial: decisaoGrupo as never, decisaoObservacao: obsGrupo || null, decisaoPorId: args.usuarioId, decisaoEm: agora } });
    if (invalidos.length) {
      await tx.concreteiraCandidataContato.updateMany({
        where: { id: { in: invalidos }, candidataId: { in: g.candidataIds } },
        data: { situacao: "INVALIDO", verificadoEm: agora, verificadoPorId: args.usuarioId },
      });
    }
    const cands = await tx.concreteiraCandidata.findMany({ where: { id: { in: g.candidataIds } }, select: { id: true, statusValidacao: true, tipoAtividade: true, confianca: true, primeiraVerificacaoEm: true } });
    for (const c of cands) {
      // Descarte: a candidata vira NAO_E_CONCRETEIRA (nada é apagado) e a mudança entra no histórico de VALIDACAO.
      if (descarte) {
        const justificativa = justificativaDescarte(descarte.label, args.usuarioNome?.trim() || "usuário", agora, obs);
        await tx.concreteiraCandidata.update({ where: { id: c.id }, data: {
          statusValidacao: "NAO_E_CONCRETEIRA" as never, tipoAtividade: descarte.tipoAtividade as never, justificativa,
          validadoPorId: args.usuarioId, validadoEm: agora, ultimaVerificacaoEm: agora, ...(c.primeiraVerificacaoEm ? {} : { primeiraVerificacaoEm: agora }),
        } });
        await tx.concreteiraValidacaoHistorico.create({ data: {
          candidataId: c.id, tipoEvento: "VALIDACAO" as never, origem: "TELA_BASE_NACIONAL", agente: "fila-comercial-joao", usuarioId: args.usuarioId,
          statusAnterior: c.statusValidacao, statusNovo: "NAO_E_CONCRETEIRA" as never, tipoAnterior: c.tipoAtividade, tipoNovo: descarte.tipoAtividade as never,
          confiancaAnterior: c.confianca, confiancaNova: c.confianca, motivo: justificativa, createdAt: agora,
        } });
      }
      await tx.concreteiraValidacaoHistorico.create({ data: {
        candidataId: c.id, tipoEvento: "DECISAO_COMERCIAL" as never, origem: "TELA_BASE_NACIONAL", agente: "fila-comercial-joao", usuarioId: args.usuarioId,
        statusAnterior: descarte ? ("NAO_E_CONCRETEIRA" as never) : c.statusValidacao, statusNovo: descarte ? ("NAO_E_CONCRETEIRA" as never) : c.statusValidacao,
        campo: "decisaoComercial", valorAnterior: g.decisaoComercial ?? null, valorNovo: decisaoGrupo,
        motivo: `${descarte ? obsGrupo : `${DECISAO_COMERCIAL_LABEL[decisaoGrupo]}${obs ? `: ${obs}` : ""}`}${invalidos.length ? ` (${invalidos.length} contato(s) marcado(s) como inválido)` : ""}. Nenhum contato foi feito pelo sistema.`,
        createdAt: agora,
      } });
    }
  });
  return { ok: true as const };
}

/**
 * Escolhe, na ordem recebida, o próximo grupo "Aguardando revisão" (decisaoComercial vazio) depois do atual.
 * Se não houver adiante, volta ao início da lista. O próprio grupo atual nunca é devolvido. Sem pendentes: null.
 * Função pura (sem banco) — a ordem é a mesma de listarFilaJoao.
 */
export function escolherProximoPendente(linhas: Array<{ chave: string; decisaoComercial: string | null }>, chaveAtual: string): string | null {
  const pendentes = (l: typeof linhas) => l.find(g => !g.decisaoComercial && g.chave !== chaveAtual)?.chave ?? null;
  const i = linhas.findIndex(g => g.chave === chaveAtual);
  return pendentes(linhas.slice(i + 1)) ?? pendentes(linhas.slice(0, Math.max(i, 0)));
}

/** Próximo grupo pendente com os mesmos filtros e a mesma ordem da lista (ver escolherProximoPendente). */
export async function proximoGrupoPendente(chaveAtual: string, filtros: FiltrosJoao): Promise<string | null> {
  const { linhas } = await listarFilaJoao(filtros);
  return escolherProximoPendente(linhas, chaveAtual);
}
