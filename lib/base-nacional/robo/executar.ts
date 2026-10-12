// ARQUIVO: lib/base-nacional/robo/executar.ts
// REGRA: nunca remover. Apenas acrescentar.
// Robô gratuito da Base Nacional — orquestração (08/10/2026).
//   1) triagem v2 (dados da Receita já carregados no banco);
//   2) vínculos por telefone, e-mail, domínio, endereço e raiz de CNPJ;
//   3) leitura do site PRÓPRIO (domínio do e-mail da Receita), respeitando robots.txt, com cache;
//   4) grava triagem, fila, vínculos, evidências (com URL, data, trecho e origem) e histórico.
// Nunca confirma empresa (CONFIRMADA exige pessoa responsável); no máximo marca PROVÁVEL quando o
// site oficial cita concreto. Nunca transforma ausência de resultado em "não é concreteira".
// Só processa candidatas PENDENTES; nunca altera validação humana. Toca SOMENTE tabelas da Base Nacional.
// Não usa Google, Maps, redes sociais, API paga nem Claude.

import { createHash } from "node:crypto";
import type { PrismaClient } from "../../../app/generated/prisma/client";
import { triar, VERSAO_TRIAGEM, CLASSE_TRIAGEM_LABEL, LOCACAO_CNAE, type ResultadoTriagem } from "../triagem";
import { TERMOS_CONCRETO_FORTES, analisarTexto, concluirSite, dominioDeEmail, lerPagina, linksInternosRelevantes, type AnalisePagina, type ConclusaoSite } from "./site";
import { encontrarVinculos, type ContatoReceita, type VinculoEncontrado } from "./vinculos";

export const AGENTE_ROBO = "robo-gratuito";
export const DIAS_CACHE_PADRAO = 30;

export type OpcoesRobo = {
  db: PrismaClient;
  uf: string;
  /** Máximo de candidatas pendentes processadas nesta execução (lote). */
  limite?: number;
  visitarSites?: boolean;
  reprocessar?: boolean;
  diasCache?: number;
  buscar?: typeof fetch;
  agora?: Date;
  log?: (msg: string) => void;
  /** v5.2: só visita sites das empresas que a triagem manda verificar (dispensadas não geram tráfego). */
  sitesSoParaVerificar?: boolean;
  /** v5.2: quantas empresas com site processar em paralelo (padrão 1). */
  paralelo?: number;
  /** v5.2: para de iniciar novas empresas com site depois deste prazo (ms); o que foi feito fica salvo. */
  prazoMs?: number;
};

export type ItemResumo = {
  candidataId: string; razaoSocial: string | null; triagem: string; situacaoFila: string; conclusaoSite: ConclusaoSite | "SEM_DOMINIO" | "NAO_VISITADO";
  site: string | null; virouProvavel: boolean; vinculosFortes: number; potencialCompra: string;
};
export type ResumoRobo = {
  uf: string; versaoTriagem: string; candidatasNaUf: number; pendentesNaUf: number; processadas: number; restantesSemRobo: number;
  vinculos: number; dominiosProprios: number; paginasLidas: number; paginasDoCache: number; paginasBloqueadas: number;
  porTriagem: Record<string, number>; porConclusaoSite: Record<string, number>;
  marcadasProvavel: number; filaHumana: number; dispensadas: number; itens: ItemResumo[];
};

const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);
const conta = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };

type Cand = Awaited<ReturnType<typeof carregar>>[number];
async function carregar(db: PrismaClient, uf: string) {
  return db.concreteiraCandidata.findMany({
    where: { unidades: { some: { uf, ativa: true } } },
    select: {
      id: true, cnpjBasico: true, razaoSocial: true, nomeFantasia: true, porte: true, naturezaJuridica: true, capitalSocial: true,
      statusValidacao: true, confianca: true, tipoAtividade: true, primeiraVerificacaoEm: true,
      unidades: {
        select: {
          cnpj: true, ativa: true, cnaePrincipal: true, cnaesSecundarios: true, cnaeAlvoComoPrincipal: true, nomeFantasia: true,
          municipioNome: true, uf: true, telefone: true, email: true, cep: true, logradouro: true, numero: true, isMatriz: true,
        },
      },
      triagem: { select: { situacaoFila: true, roboExecutadoEm: true } },
    },
    orderBy: { id: "asc" },
  });
}

/** Contatos públicos da Receita (última competência de cada CNPJ). */
async function contatosReceita(db: PrismaClient, cnpjs: string[]) {
  const mapa = new Map<string, { tels: string[]; email: string | null; cep: string | null; logradouro: string | null; numero: string | null }>();
  for (let i = 0; i < cnpjs.length; i += 1000) {
    const linhas = await db.receitaEstabelecimento.findMany({
      where: { cnpj: { in: cnpjs.slice(i, i + 1000) } },
      select: { cnpj: true, ddd1: true, telefone1: true, ddd2: true, telefone2: true, email: true, cep: true, logradouro: true, numero: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    for (const l of linhas) {
      const tels = [l.ddd1 && l.telefone1 ? `${l.ddd1}${l.telefone1}` : null, l.ddd2 && l.telefone2 ? `${l.ddd2}${l.telefone2}` : null].filter((x): x is string => Boolean(x));
      mapa.set(l.cnpj, { tels, email: l.email, cep: l.cep, logradouro: l.logradouro, numero: l.numero }); // a mais recente sobrescreve
    }
  }
  return mapa;
}

function estimarPotencial(t: ResultadoTriagem, c: Cand, conclusao: ConclusaoSite | "SEM_DOMINIO"): "ALTO" | "MEDIO" | "BAIXO" | "DESCONHECIDO" {
  const ativas = c.unidades.filter(u => u.ativa).length;
  const locacao = c.unidades.some(u => LOCACAO_CNAE.has(u.cnaePrincipal) || (u.cnaesSecundarios ?? []).some(s => LOCACAO_CNAE.has(s)));
  if (conclusao === "CONCRETO_NO_SITE") return ativas >= 2 || c.porte === "05" ? "ALTO" : "MEDIO";
  if (t.classificacao === "FORTE_INDICIO_CONCRETEIRA") return "MEDIO";
  if (t.classificacao === "POSSIVEL_CONCRETEIRA" && (locacao || t.sinais.some(s => s.includes("mineração")))) return "MEDIO";
  if (!t.paraVerificar) return "BAIXO";
  return "DESCONHECIDO";
}

export async function executarRobo(o: OpcoesRobo): Promise<ResumoRobo> {
  const db = o.db;
  const uf = o.uf.toUpperCase();
  const agora = o.agora ?? new Date();
  const log = o.log ?? (() => {});
  const buscar = o.buscar ?? fetch;
  const diasCache = o.diasCache ?? DIAS_CACHE_PADRAO;
  const limiteCache = new Date(agora.getTime() - diasCache * 86_400_000);

  const todas = await carregar(db, uf);
  const receita = await contatosReceita(db, todas.flatMap(c => c.unidades.map(u => u.cnpj)));

  // ---- 2) vínculos (todas as candidatas da UF, inclusive já validadas, para achar relação com concreteiras conhecidas)
  const contatos: ContatoReceita[] = todas.map(c => {
    const tels: string[] = [], emails: string[] = [], ends: ContatoReceita["enderecos"] = [];
    for (const u of c.unidades) {
      const r = receita.get(u.cnpj);
      if (r) { tels.push(...r.tels); if (r.email) emails.push(r.email); ends.push({ cep: r.cep, logradouro: r.logradouro, numero: r.numero }); }
      if (u.telefone) tels.push(u.telefone);
      if (u.email) emails.push(u.email);
      ends.push({ cep: u.cep, logradouro: u.logradouro, numero: u.numero });
    }
    return { candidataId: c.id, cnpjBasico: c.cnpjBasico, telefones: [...new Set(tels)], emails: [...new Set(emails.map(e => e.toLowerCase()))], enderecos: ends };
  });
  const vinculos = encontrarVinculos(contatos);
  if (vinculos.length) {
    for (let i = 0; i < vinculos.length; i += 500) {
      await db.concreteiraVinculo.createMany({
        data: vinculos.slice(i, i + 500).map(v => ({
          id: `vin-${hash(`${v.a}|${v.b}|${v.tipo}`)}`, candidataId: v.a, candidataRelacionadaId: v.b, tipo: v.tipo,
          chaveMascarada: v.chaveMascarada, forca: v.forca, agente: AGENTE_ROBO, createdAt: agora,
        })),
        skipDuplicates: true,
      });
    }
  }
  const porId = new Map(todas.map(c => [c.id, c]));
  const vinculosDe = new Map<string, VinculoEncontrado[]>();
  for (const v of vinculos) { if (!vinculosDe.has(v.a)) vinculosDe.set(v.a, []); vinculosDe.get(v.a)!.push(v); }

  // ---- seleção do lote: pendentes ainda não processadas pelo robô (cache por empresa), maior pontuação primeiro
  const pendentes = todas.filter(c => c.statusValidacao === "PENDENTE");
  const triagens = new Map(pendentes.map(c => [c.id, triar({ ...c, capitalSocial: c.capitalSocial === null ? null : Number(c.capitalSocial) }, uf)]));
  const fila = pendentes
    .filter(c => o.reprocessar || !c.triagem?.roboExecutadoEm)
    .sort((a, b) => triagens.get(b.id)!.pontuacao - triagens.get(a.id)!.pontuacao || a.id.localeCompare(b.id));
  const lote = fila.slice(0, o.limite ?? fila.length);

  const resumo: ResumoRobo = {
    uf, versaoTriagem: VERSAO_TRIAGEM, candidatasNaUf: todas.length, pendentesNaUf: pendentes.length, processadas: 0,
    restantesSemRobo: fila.length - lote.length, vinculos: vinculos.length, dominiosProprios: 0, paginasLidas: 0, paginasDoCache: 0,
    paginasBloqueadas: 0, porTriagem: {}, porConclusaoSite: {}, marcadasProvavel: 0, filaHumana: 0, dispensadas: 0, itens: [],
  };

  // v5.2 (nacional): empresas que não precisam de site (dispensadas pela triagem quando
  // sitesSoParaVerificar=true, ou sem domínio próprio) são gravadas EM LOTE — mesma decisão,
  // menos idas ao banco. As demais passam pelo caminho completo, com até `paralelo` em paralelo.
  const dominiosDe = (c: Cand) => [...new Set(c.unidades.flatMap(u => [receita.get(u.cnpj)?.email, u.email]).map(dominioDeEmail).filter((d): d is string => Boolean(d)))].slice(0, 2);
  const precisaSite = (c: Cand) => o.visitarSites !== false && dominiosDe(c).length > 0 && (!o.sitesSoParaVerificar || triagens.get(c.id)!.paraVerificar);
  const rapidos = lote.filter(c => !precisaSite(c) && !c.triagem);
  const completos = lote.filter(c => precisaSite(c) || c.triagem);

  for (let i = 0; i < rapidos.length; i += 200) {
    const parte = rapidos.slice(i, i + 200);
    const linhasTriagem: Record<string, unknown>[] = [];
    const linhasHist: Record<string, unknown>[] = [];
    for (const c of parte) {
      const t = triagens.get(c.id)!;
      const dominios = dominiosDe(c);
      const conclusao = dominios.length ? "NAO_VISITADO" : "SEM_DOMINIO";
      if (dominios.length) resumo.dominiosProprios++;
      const fortes = (vinculosDe.get(c.id) ?? []).filter(v => v.forca !== "BAIXA" && ["CONFIRMADA", "PROVAVEL"].includes(porId.get(v.b)?.statusValidacao ?? ""));
      let situacaoFila: "AGUARDANDO" | "DISPENSADA_TRIAGEM"; let motivo: string;
      if (fortes.length) { situacaoFila = "AGUARDANDO"; motivo = `Vínculo (${fortes.map(v => v.tipo.toLowerCase()).join(", ")}) com concreteira já classificada: ${fortes.map(v => porId.get(v.b)?.razaoSocial ?? v.b).slice(0, 2).join("; ")}.`; }
      else if (t.paraVerificar) { situacaoFila = "AGUARDANDO"; motivo = `Triagem: ${CLASSE_TRIAGEM_LABEL[t.classificacao]}.`; }
      else { situacaoFila = "DISPENSADA_TRIAGEM"; motivo = `Triagem: ${CLASSE_TRIAGEM_LABEL[t.classificacao]}.`; }
      const potencial = estimarPotencial(t, c, "SEM_DOMINIO");
      const ativa = c.unidades.find(u => u.ativa && u.uf === uf) ?? c.unidades.find(u => u.ativa);
      linhasTriagem.push({
        candidataId: c.id, versaoRegra: VERSAO_TRIAGEM, classificacao: t.classificacao, sinais: t.sinais, pontuacao: t.pontuacao,
        uf: ativa?.uf ?? uf, municipio: ativa?.municipioNome ?? null, interior: t.unidadesInterior > 0, prioridadeReceita: t.prioridadeReceita,
        sugestaoRobo: null, roboExecutadoEm: agora, situacaoFila, motivoFila: motivo, potencialCompra: potencial,
        roboResumo: { conclusaoSite: conclusao, cnpjConfere: false, dominios, paginas: [], vinculosFortes: fortes.length },
      });
      linhasHist.push({
        candidataId: c.id, tipoEvento: "TRIAGEM", origem: "ROBO_GRATUITO", agente: AGENTE_ROBO, statusAnterior: c.statusValidacao, statusNovo: c.statusValidacao,
        campo: "triagem", valorNovo: `${t.classificacao} → ${situacaoFila}`, motivo: `${motivo} Site: ${conclusao}. Vínculos fortes: ${fortes.length}.`.slice(0, 1000), createdAt: agora,
      });
      resumo.processadas++;
      conta(resumo.porTriagem, t.classificacao);
      conta(resumo.porConclusaoSite, conclusao);
      if (situacaoFila === "AGUARDANDO") resumo.filaHumana++; else resumo.dispensadas++;
      resumo.itens.push({ candidataId: c.id, razaoSocial: c.razaoSocial, triagem: t.classificacao, situacaoFila, conclusaoSite: conclusao,
        site: dominios[0] ?? null, virouProvavel: false, vinculosFortes: fortes.length, potencialCompra: potencial });
    }
    await db.$transaction([
      db.concreteiraTriagem.createMany({ data: linhasTriagem as never, skipDuplicates: true }),
      db.concreteiraValidacaoHistorico.createMany({ data: linhasHist as never }),
    ]);
    log(`lote rápido ${Math.min(i + 200, rapidos.length)}/${rapidos.length}`);
  }

  const processarUma = async (c: Cand) => {
    const t = triagens.get(c.id)!;
    // ---- 3) site próprio
    const dominios = [...new Set(c.unidades.flatMap(u => [receita.get(u.cnpj)?.email, u.email]).map(dominioDeEmail).filter((d): d is string => Boolean(d)))].slice(0, 2);
    if (dominios.length) resumo.dominiosProprios++;
    const analises: AnalisePagina[] = [];
    const urlsLidas: Array<{ url: string; analise: AnalisePagina; titulo: string | null }> = [];
    let algumaLida = false;
    if (o.visitarSites !== false) {
      for (const dom of dominios) {
        const fila: string[] = [`https://${dom}/`];
        const vistas = new Set<string>();
        while (fila.length && vistas.size < 4) {
          const url = fila.shift()!;
          if (vistas.has(url)) continue;
          vistas.add(url);
          const cache = await db.concreteiraRoboCache.findUnique({ where: { url } });
          let analise: AnalisePagina | null = null; let titulo: string | null = null; let links: Array<{ href: string; texto: string }> = []; let urlBase = url;
          if (cache && cache.buscadoEm >= limiteCache) {
            resumo.paginasDoCache++;
            if (cache.permitidoRobots && !cache.erro) {
              const j = (cache.trechos ?? {}) as { trechos?: Array<{ termo: string; trecho: string }>; links?: Array<{ href: string; texto: string }> };
              analise = { termosConcreto: cache.termosConcreto, termosOutros: cache.termosOutros, cnpjs: cache.cnpjsEncontrados, trechos: j.trechos ?? [] };
              titulo = cache.titulo;
              links = j.links ?? [];
            }
          } else {
            const p = await lerPagina(url, buscar);
            if (!p.permitidoRobots || p.erro) resumo.paginasBloqueadas++; else resumo.paginasLidas++;
            analise = p.analise; titulo = p.titulo; links = p.links; urlBase = p.urlFinal;
            await db.concreteiraRoboCache.upsert({
              where: { url },
              create: { url, dominio: dom, permitidoRobots: p.permitidoRobots, statusHttp: p.statusHttp, erro: p.erro,
                termosConcreto: analise?.termosConcreto ?? [], termosOutros: analise?.termosOutros ?? [], cnpjsEncontrados: analise?.cnpjs ?? [],
                trechos: { trechos: analise?.trechos ?? [], links: p.links.slice(0, 60) } as never, titulo, buscadoEm: agora },
              update: { permitidoRobots: p.permitidoRobots, statusHttp: p.statusHttp, erro: p.erro,
                termosConcreto: analise?.termosConcreto ?? [], termosOutros: analise?.termosOutros ?? [], cnpjsEncontrados: analise?.cnpjs ?? [],
                trechos: { trechos: analise?.trechos ?? [], links: p.links.slice(0, 60) } as never, titulo, buscadoEm: agora },
            });
            // https falhou por conexão? tenta http uma vez (sem contornar nenhum bloqueio)
            if (p.erro === "falha de conexão" && url === `https://${dom}/`) fila.push(`http://${dom}/`);
          }
          if (analise) {
            algumaLida = true;
            analises.push(analise);
            urlsLidas.push({ url, analise, titulo });
            if (url.endsWith(`${dom}/`)) { try { fila.push(...linksInternosRelevantes(new URL(urlBase), links)); } catch { /* url inválida */ } }
          }
        }
      }
    }
    const { conclusao, cnpjConfere } = dominios.length ? concluirSite({ raiz: c.cnpjBasico, paginas: analises, algumaLida }) : { conclusao: "SEM_DOMINIO" as const, cnpjConfere: false };

    // ---- vínculos fortes com concreteiras já classificadas (só indício; não copia classificação)
    const fortes = (vinculosDe.get(c.id) ?? []).filter(v => v.forca !== "BAIXA" && ["CONFIRMADA", "PROVAVEL"].includes(porId.get(v.b)?.statusValidacao ?? ""));

    // ---- decisão do robô
    const virouProvavel = conclusao === "CONCRETO_NO_SITE";
    let situacaoFila: "AGUARDANDO" | "DISPENSADA_TRIAGEM";
    let motivo: string;
    if (virouProvavel) { situacaoFila = "AGUARDANDO"; motivo = "Confirmar evidência do robô: site oficial cita concreto."; }
    else if (fortes.length) {
      situacaoFila = "AGUARDANDO";
      motivo = `Vínculo (${fortes.map(v => v.tipo.toLowerCase()).join(", ")}) com concreteira já classificada: ${fortes.map(v => porId.get(v.b)?.razaoSocial ?? v.b).slice(0, 2).join("; ")}.`;
    } else if (t.paraVerificar) { situacaoFila = "AGUARDANDO"; motivo = `Triagem: ${CLASSE_TRIAGEM_LABEL[t.classificacao]}.`; }
    else { situacaoFila = "DISPENSADA_TRIAGEM"; motivo = `Triagem: ${CLASSE_TRIAGEM_LABEL[t.classificacao]}${conclusao === "OUTRA_ATIVIDADE_NO_SITE" ? "; site indica outra atividade" : ""}.`; }
    const sugestao = conclusao === "CONCRETO_NO_SITE" ? "PROVAVEL_PELO_SITE" : conclusao === "CONCRETO_FRACO_NO_SITE" ? "INDICIO_FRACO_PELO_SITE"
      : conclusao === "OUTRA_ATIVIDADE_NO_SITE" ? "OUTRA_ATIVIDADE_PELO_SITE"
      : conclusao === "SITE_DE_TERCEIRO" ? "DOMINIO_DE_TERCEIRO" : null;
    const potencial = estimarPotencial(t, c, conclusao);
    const ativa = c.unidades.find(u => u.ativa && u.uf === uf) ?? c.unidades.find(u => u.ativa);

    await db.$transaction(async tx => {
      const existente = await tx.concreteiraTriagem.findUnique({ where: { candidataId: c.id }, select: { situacaoFila: true } });
      const dadosRobo = {
        versaoRegra: VERSAO_TRIAGEM, classificacao: t.classificacao, sinais: t.sinais, pontuacao: t.pontuacao,
        uf: ativa?.uf ?? uf, municipio: ativa?.municipioNome ?? null, interior: t.unidadesInterior > 0, prioridadeReceita: t.prioridadeReceita,
        sugestaoRobo: sugestao, roboExecutadoEm: agora,
        roboResumo: { conclusaoSite: conclusao, cnpjConfere, dominios, paginas: urlsLidas.map(u => u.url), vinculosFortes: fortes.length } as never,
      };
      if (!existente) {
        await tx.concreteiraTriagem.create({ data: { candidataId: c.id, ...dadosRobo, situacaoFila, motivoFila: motivo, potencialCompra: potencial } });
      } else if (existente.situacaoFila === "CONCLUIDA") {
        await tx.concreteiraTriagem.update({ where: { candidataId: c.id }, data: dadosRobo }); // decisão humana preservada
      } else {
        await tx.concreteiraTriagem.update({ where: { candidataId: c.id }, data: { ...dadosRobo, situacaoFila, motivoFila: motivo } });
      }

      // evidências do site (URL, data, trecho curto, origem)
      for (const u of urlsLidas) {
        const temConcreto = u.analise.termosConcreto.length > 0;
        const forte = u.analise.termosConcreto.some(t => TERMOS_CONCRETO_FORTES.has(t));
        if (!temConcreto && u.analise.termosOutros.length === 0) continue;
        const trecho = temConcreto
          ? u.analise.trechos.map(x => x.trecho).join(" … ").slice(0, 400)
          : `Termos encontrados: ${u.analise.termosOutros.slice(0, 6).join(", ")}. Nenhum termo de concreto.`;
        await tx.concreteiraEvidencia.createMany({
          data: [{
            id: `robo-${hash(`${c.id}|${u.url}`)}`, candidataId: c.id, tipoFonte: "SITE_EMPRESA",
            titulo: `${forte ? "Site próprio cita concreto" : temConcreto ? "Site próprio — termo genérico de concreto (indício fraco)" : "Site próprio — outra atividade"}: ${u.titulo ?? new URL(u.url).hostname}`.slice(0, 200),
            url: u.url, trecho, coletadoEm: agora, confianca: forte ? (cnpjConfere ? "ALTA" : "MEDIA") : "BAIXA", agente: AGENTE_ROBO,
            observacao: `Robô gratuito (${VERSAO_TRIAGEM}). Domínio do e-mail da Receita; robots.txt respeitado.${cnpjConfere ? " CNPJ da empresa aparece na página." : ""}`,
          }],
          skipDuplicates: true,
        });
      }

      if (virouProvavel && c.statusValidacao === "PENDENTE") {
        const conf = cnpjConfere ? "ALTA" : "MEDIA";
        const just = `Robô gratuito: o site oficial (domínio do e-mail da Receita) cita ${analises.flatMap(a => a.termosConcreto).filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 3).join(", ")}${cnpjConfere ? " e mostra o CNPJ da empresa" : ""}. Falta confirmação humana. ${urlsLidas.find(x => x.analise.termosConcreto.length)?.url ?? ""}`.trim();
        await tx.concreteiraCandidata.update({
          where: { id: c.id },
          data: { statusValidacao: "PROVAVEL", confianca: conf, tipoAtividade: c.tipoAtividade ?? "CONCRETO_USINADO", justificativa: just,
            ultimaVerificacaoEm: agora, ...(c.primeiraVerificacaoEm ? {} : { primeiraVerificacaoEm: agora }) },
        });
        await tx.concreteiraValidacaoHistorico.create({
          data: { candidataId: c.id, tipoEvento: "VALIDACAO", origem: "ROBO_GRATUITO", agente: AGENTE_ROBO,
            statusAnterior: "PENDENTE", statusNovo: "PROVAVEL", confiancaAnterior: c.confianca, confiancaNova: conf,
            tipoAnterior: c.tipoAtividade, tipoNovo: c.tipoAtividade ?? "CONCRETO_USINADO", motivo: just, createdAt: agora },
        });
      }
      await tx.concreteiraValidacaoHistorico.create({
        data: { candidataId: c.id, tipoEvento: "TRIAGEM", origem: "ROBO_GRATUITO", agente: AGENTE_ROBO,
          statusAnterior: virouProvavel ? "PROVAVEL" : c.statusValidacao, statusNovo: virouProvavel ? "PROVAVEL" : c.statusValidacao,
          campo: "triagem", valorNovo: `${t.classificacao} → ${situacaoFila}${sugestao ? ` (${sugestao})` : ""}`.slice(0, 300),
          motivo: `${motivo} Site: ${conclusao}. Vínculos fortes: ${fortes.length}.`.slice(0, 1000), createdAt: agora },
      });
    });

    resumo.processadas++;
    conta(resumo.porTriagem, t.classificacao);
    conta(resumo.porConclusaoSite, conclusao);
    if (virouProvavel) resumo.marcadasProvavel++;
    if (situacaoFila === "AGUARDANDO") resumo.filaHumana++; else resumo.dispensadas++;
    resumo.itens.push({ candidataId: c.id, razaoSocial: c.razaoSocial, triagem: t.classificacao, situacaoFila, conclusaoSite: conclusao,
      site: dominios[0] ?? null, virouProvavel, vinculosFortes: fortes.length, potencialCompra: potencial });
    log(`${resumo.processadas}/${lote.length} ${c.razaoSocial ?? c.id} → ${t.classificacao} · ${conclusao} · ${situacaoFila}`);
    };
  const paralelo = Math.max(1, o.paralelo ?? 1);
  const limiteTempo = o.prazoMs ? Date.now() + o.prazoMs : Infinity;
  for (let i = 0; i < completos.length; i += paralelo) {
    if (Date.now() > limiteTempo) { resumo.restantesSemRobo += completos.length - i; break; }
    await Promise.all(completos.slice(i, i + paralelo).map(processarUma));
  }
  return resumo;
}

// Reexporta para quem só precisa analisar texto (testes).
export { analisarTexto };
