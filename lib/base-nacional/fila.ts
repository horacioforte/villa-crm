// ARQUIVO: lib/base-nacional/fila.ts
// REGRA: nunca remover. Apenas acrescentar.
// Fila de verificação humana da Base Nacional (08/10/2026) — regras puras (testáveis sem banco).
// A pessoa abre buscas prontas (Google, Maps, site, Instagram, Facebook, LinkedIn, CNPJ) em NOVAS ABAS
// e decide. Nada aqui raspa essas plataformas, envia mensagem ou cria Empresa/Pessoa/Dossiê/Carteira/
// Oportunidade/Tarefa. Toda decisão grava histórico e registra responsável e data.

import { planejarAlteracao, planejarEvidencia, planejarPotencial, planejarQualificacao, JUSTIFICATIVA_MINIMA, podeValidar, type Operacao, type Resultado } from "./validacao";
import {
  CONFIANCAS, EQUIPAMENTOS, NIVEIS_POTENCIAL, PRIORIDADES, TIPOS_ATIVIDADE,
  type Confianca, type Equipamento, type NivelPotencial, type Prioridade, type StatusValidacao, type TipoAtividade,
} from "./rotulos";

export const RESERVA_MINUTOS = 20;

export const DECISOES = ["CONFIRMADA", "PROVAVEL", "EM_VERIFICACAO", "NAO_E_CONCRETEIRA", "SEM_EVIDENCIA"] as const;
export type Decisao = (typeof DECISOES)[number];
export const DECISAO_LABEL: Record<Decisao, string> = {
  CONFIRMADA: "Confirmada como concreteira",
  PROVAVEL: "Provável concreteira",
  EM_VERIFICACAO: "Em verificação",
  NAO_E_CONCRETEIRA: "Não é concreteira",
  SEM_EVIDENCIA: "Sem evidência suficiente",
};
export const DECISAO_STATUS: Record<Decisao, StatusValidacao> = {
  CONFIRMADA: "CONFIRMADA", PROVAVEL: "PROVAVEL", EM_VERIFICACAO: "EM_VERIFICACAO",
  NAO_E_CONCRETEIRA: "NAO_E_CONCRETEIRA", SEM_EVIDENCIA: "NAO_LOCALIZADA",
};
/** O que cada decisão exige (além da justificativa, sempre obrigatória). */
export const EXIGENCIAS: Record<Decisao, { confianca: boolean; link: boolean; dica: string }> = {
  CONFIRMADA: { confianca: true, link: true, dica: "Exige confiança, justificativa e o link da prova (site, Maps, rede social, notícia)." },
  PROVAVEL: { confianca: true, link: true, dica: "Exige confiança, justificativa e o link do indício encontrado." },
  EM_VERIFICACAO: { confianca: false, link: false, dica: "Exige justificativa: diga o que falta verificar." },
  NAO_E_CONCRETEIRA: { confianca: true, link: true, dica: "Exige link que mostre a OUTRA atividade. Ausência de resultado não é prova — use \"Sem evidência\"." },
  SEM_EVIDENCIA: { confianca: false, link: false, dica: "Exige justificativa: diga onde procurou (ex.: Google, Maps, Instagram)." },
};

export const FONTES_FILA = ["SITE_EMPRESA", "GOOGLE_MAPS", "REDE_SOCIAL", "LINKEDIN", "NOTICIA", "DIARIO_OFICIAL", "RECEITA_FEDERAL", "OUTRA"] as const;

/** Sugere o tipo de fonte pelo link (a pessoa pode trocar). */
export function fontePorLink(url: string | null | undefined): (typeof FONTES_FILA)[number] {
  const u = (url ?? "").toLowerCase();
  if (/instagram\.com|facebook\.com|fb\.com|tiktok\.com|youtube\.com/.test(u)) return "REDE_SOCIAL";
  if (/linkedin\.com/.test(u)) return "LINKEDIN";
  if (/google\.[a-z.]+\/maps|maps\.app\.goo|goo\.gl\/maps/.test(u)) return "GOOGLE_MAPS";
  if (/\.gov\.br|diariooficial|diario-oficial/.test(u)) return "DIARIO_OFICIAL";
  if (/receita\.fazenda|cnpj/.test(u)) return "RECEITA_FEDERAL";
  return u ? "SITE_EMPRESA" : "OUTRA";
}

// ---------------------------------------------------------------------------------------------
// Buscas prontas (apenas abrem uma nova aba para a pessoa analisar)
// ---------------------------------------------------------------------------------------------
export type LinkBusca = { chave: string; rotulo: string; url: string };
export function linksDeBusca(c: { razaoSocial?: string | null; nomeFantasia?: string | null; cidade?: string | null; uf?: string | null; cnpj?: string | null; site?: string | null }): LinkBusca[] {
  const limpa = (s: string | null | undefined) => (s ?? "").replace(/\b(LTDA|EIRELI|ME|EPP|S\/?A)\b\.?/gi, "").replace(/\s+/g, " ").trim();
  const nome = limpa(c.nomeFantasia) || limpa(c.razaoSocial);
  const local = [c.cidade, c.uf].filter(Boolean).join(" ");
  const q = (s: string) => encodeURIComponent(s);
  const g = (s: string) => `https://www.google.com/search?q=${q(s)}`;
  const out: LinkBusca[] = [
    { chave: "google", rotulo: "Google", url: g(`"${nome}" ${local} concreto`) },
    { chave: "maps", rotulo: "Google Maps", url: `https://www.google.com/maps/search/?api=1&query=${q(`${nome} ${local}`)}` },
  ];
  // "site" aqui é sempre um PALPITE (domínio do e-mail cadastrado na Receita) — nunca confirmado
  // só por existir. O selo ao lado (ver rotulos-site.ts, na tela) mostra o que o robô achou de fato.
  if (c.site) out.push({ chave: "site", rotulo: "Site provável (domínio do e-mail da Receita)", url: /^https?:\/\//.test(c.site) ? c.site : `https://${c.site}` });
  out.push(
    { chave: "instagram", rotulo: "Instagram", url: g(`site:instagram.com "${nome}" ${c.cidade ?? ""}`) },
    { chave: "facebook", rotulo: "Facebook", url: g(`site:facebook.com "${nome}" ${c.cidade ?? ""}`) },
    { chave: "linkedin", rotulo: "LinkedIn", url: g(`site:linkedin.com "${nome}"`) },
  );
  const cnpj = (c.cnpj ?? "").replace(/\D/g, "");
  if (cnpj.length === 14) {
    out.push({ chave: "cnpj", rotulo: "Consulta CNPJ (Receita)", url: `https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp?cnpj=${cnpj}` });
    out.push({ chave: "cnpj-google", rotulo: "CNPJ no Google", url: g(`"${cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}"`) });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Reserva (impede dupla revisão simultânea)
// ---------------------------------------------------------------------------------------------
export function reservaAtiva(r: { emRevisaoPorId: string | null; emRevisaoDesde: Date | null }, agora = new Date()): boolean {
  return Boolean(r.emRevisaoPorId && r.emRevisaoDesde && agora.getTime() - r.emRevisaoDesde.getTime() < RESERVA_MINUTOS * 60_000);
}
export function podeRevisar(r: { emRevisaoPorId: string | null; emRevisaoDesde: Date | null }, usuarioId: string, agora = new Date()): boolean {
  return !reservaAtiva(r, agora) || r.emRevisaoPorId === usuarioId;
}

// ---------------------------------------------------------------------------------------------
// Decisão
// ---------------------------------------------------------------------------------------------
export type PedidoDecisao = {
  decisao: string;
  confianca?: string | null;
  tipoAtividade?: string | null;
  justificativa: string;
  url?: string | null;
  tipoFonte?: string | null;
  tituloEvidencia?: string | null;
  trecho?: string | null;
  dataEvidencia?: Date | null;
  potencialCompra: string;
  equipamentos?: string[];
  observacaoComercial?: string | null;
  prioridade?: string | null;
};

export function planejarDecisao(args: {
  candidataId: string;
  usuario: { id: string; papel: string } | null;
  agora?: Date;
  reserva: { emRevisaoPorId: string | null; emRevisaoDesde: Date | null };
  situacaoFila: string;
  atual: {
    status: StatusValidacao; confianca: Confianca | null; tipoAtividade: TipoAtividade | null; primeiraVerificacaoEm: Date | null;
    prioridade: Prioridade | null; observacaoComercial: string | null;
  };
  equipamentosExistentes: string[];
  unidades: string[];
  evidencias: string[];
  novosIds: { evidencia?: string; potencial: (eq: string) => string };
  pedido: PedidoDecisao;
}): Resultado {
  const agora = args.agora ?? new Date();
  const u = args.usuario;
  const p = args.pedido;
  if (!u) return { ok: false, erros: ["Usuário não identificado."] };
  if (!podeValidar(u.papel)) return { ok: false, erros: ["Seu perfil não pode decidir na fila de verificação."] };
  const erros: string[] = [];
  if (!podeRevisar(args.reserva, u.id, agora)) erros.push("Outra pessoa está revisando esta empresa agora. Avance para a próxima.");
  if (args.situacaoFila === "CONCLUIDA") erros.push("Esta empresa já foi verificada na fila.");
  if (!(DECISOES as readonly string[]).includes(p.decisao)) return { ok: false, erros: [...erros, "Escolha uma decisão."] };
  const decisao = p.decisao as Decisao;
  const ex = EXIGENCIAS[decisao];
  const just = (p.justificativa ?? "").trim();
  if (just.length < JUSTIFICATIVA_MINIMA) erros.push(`A justificativa é obrigatória (mínimo ${JUSTIFICATIVA_MINIMA} caracteres).`);
  const confianca = (p.confianca || null) as Confianca | null;
  if (confianca && !(CONFIANCAS as readonly string[]).includes(confianca)) erros.push("Confiança inválida.");
  if (ex.confianca && !confianca) erros.push("Informe a confiança.");
  const url = (p.url ?? "").trim() || null;
  if (ex.link && !url) erros.push("Informe o link da evidência.");
  if (url) { try { const x = new URL(url); if (!/^https?:$/.test(x.protocol)) erros.push("O link deve começar com http:// ou https://."); } catch { erros.push("Link inválido."); } }
  if (p.dataEvidencia && p.dataEvidencia.getTime() > agora.getTime() + 60_000) erros.push("A data da evidência não pode estar no futuro.");
  if (!(NIVEIS_POTENCIAL as readonly string[]).includes(p.potencialCompra)) erros.push("Informe o potencial para compra de equipamentos usados.");
  const equipamentos = [...new Set(p.equipamentos ?? [])];
  if (equipamentos.some(e => !(EQUIPAMENTOS as readonly string[]).includes(e) || e === "OUTRO")) erros.push("Equipamento inválido.");
  if (p.prioridade && !(PRIORIDADES as readonly string[]).includes(p.prioridade)) erros.push("Prioridade inválida.");
  if (p.tipoAtividade && !(TIPOS_ATIVIDADE as readonly string[]).includes(p.tipoAtividade)) erros.push("Tipo de atividade inválido.");
  // Classificação já confirmada só muda com evidência nova.
  if (args.atual.status === "CONFIRMADA" && decisao !== "CONFIRMADA" && !url) erros.push("Esta empresa está confirmada: para mudar, informe o link da nova evidência.");
  if (erros.length) return { ok: false, erros };

  const statusNovo = DECISAO_STATUS[decisao];
  const tipoPadrao: TipoAtividade | null =
    decisao === "CONFIRMADA" || decisao === "PROVAVEL" ? (args.atual.tipoAtividade ?? "CONCRETO_USINADO")
      : decisao === "NAO_E_CONCRETEIRA" ? (args.atual.tipoAtividade && args.atual.tipoAtividade !== "CONCRETO_USINADO" ? args.atual.tipoAtividade : "OUTRA_ATIVIDADE")
        : args.atual.tipoAtividade;
  const tipoNovo = (p.tipoAtividade as TipoAtividade | null) || tipoPadrao;
  const ops: Operacao[] = [];

  // 1) situação de validação (se mudou)
  const confNova = confianca ?? args.atual.confianca;
  const mudou = statusNovo !== args.atual.status || confNova !== args.atual.confianca || tipoNovo !== args.atual.tipoAtividade;
  if (mudou) {
    const r = planejarAlteracao({
      candidataId: args.candidataId, usuario: u, agora, primeiraVerificacaoEm: args.atual.primeiraVerificacaoEm,
      atual: { status: args.atual.status, confianca: args.atual.confianca, tipoAtividade: args.atual.tipoAtividade },
      pedido: { status: statusNovo, confianca: confNova, tipoAtividade: tipoNovo, justificativa: `[Fila de verificação] ${just}` },
    });
    if (!r.ok) return r;
    ops.push(...r.operacoes);
  }
  // 2) evidência (link)
  if (url) {
    const r = planejarEvidencia({
      candidataId: args.candidataId, statusAtual: statusNovo, usuario: u, agora,
      pedido: { tipoFonte: p.tipoFonte && (FONTES_FILA as readonly string[]).includes(p.tipoFonte) ? p.tipoFonte : fontePorLink(url),
        titulo: (p.tituloEvidencia ?? "").trim() || `Fila de verificação — ${DECISAO_LABEL[decisao]}`, url,
        trecho: (p.trecho ?? "").trim() || null, confianca: confianca ?? null, observacao: `Decisão na fila: ${DECISAO_LABEL[decisao]}.`,
        dataEvidencia: p.dataEvidencia ?? agora },
    });
    if (!r.ok) return r;
    ops.push(...r.operacoes);
  }
  // 3) qualificação comercial (se mudou)
  const obs = (p.observacaoComercial ?? "").trim() || null;
  const prio = (p.prioridade || null) as Prioridade | null;
  const mudouQ = (prio !== null && prio !== args.atual.prioridade) || (obs !== null && obs !== args.atual.observacaoComercial);
  if (mudouQ) {
    const r = planejarQualificacao({
      candidataId: args.candidataId, statusAtual: statusNovo, usuario: u, agora,
      atual: { prioridade: args.atual.prioridade, observacao: args.atual.observacaoComercial },
      pedido: { prioridade: prio ?? args.atual.prioridade, observacao: obs ?? args.atual.observacaoComercial, justificativa: just },
    });
    if (!r.ok) return r;
    ops.push(...r.operacoes);
  }
  // 4) equipamentos de interesse provável (só os ainda não cadastrados)
  for (const eq of equipamentos.filter(e => !args.equipamentosExistentes.includes(e))) {
    const r = planejarPotencial({
      candidataId: args.candidataId, statusAtual: statusNovo, novoId: args.novosIds.potencial(eq), usuario: u, agora,
      unidadesDaCandidata: args.unidades, evidenciasDaCandidata: args.evidencias, existente: null,
      pedido: { equipamento: eq as Equipamento, unidadeId: null, descricaoOutro: null, potencialVenda: p.potencialCompra as NivelPotencial,
        interesseLocacao: "DESCONHECIDO", quantidadeEstimada: null, evidenciaId: null, observacao: "Interesse provável registrado na fila de verificação." },
    });
    if (!r.ok) return r;
    ops.push(...r.operacoes);
  }
  // 5) fila: concluída, com responsável e data
  ops.push({
    tabela: "ConcreteiraTriagem", acao: "update", id: args.candidataId,
    dados: { situacaoFila: "CONCLUIDA", concluidaPorId: u.id, concluidaEm: agora, emRevisaoPorId: null, emRevisaoDesde: null, potencialCompra: p.potencialCompra },
  });
  ops.push({
    tabela: "ConcreteiraValidacaoHistorico", acao: "create",
    dados: {
      candidataId: args.candidataId, tipoEvento: "FILA_VERIFICACAO", origem: "FILA_VERIFICACAO",
      statusAnterior: args.atual.status, statusNovo,
      campo: "decisaoFila", valorAnterior: args.situacaoFila, valorNovo: `${decisao}; potencial de compra: ${p.potencialCompra}${equipamentos.length ? `; equipamentos: ${equipamentos.join(", ")}` : ""}`,
      motivo: just, usuarioId: u.id, createdAt: agora,
    },
  });
  return { ok: true, operacoes: ops };
}
