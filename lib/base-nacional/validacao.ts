// ARQUIVO: lib/base-nacional/validacao.ts
// REGRA: nunca remover. Apenas acrescentar.
// Regras da validação manual da Base Nacional (funções puras, testáveis sem banco).
// Toda alteração gera um plano de gravação que toca SOMENTE tabelas novas e SEMPRE
// inclui um registro de histórico. Nenhuma regra cria Empresa, Dossiê, Carteira ou Oportunidade.
// A gravação em si depende da migration v4 (campos tipoEvento/origem do histórico).
// "statusNovo" é obrigatório no histórico (v3): eventos que não mudam a situação registram a vigente.

import { CONFIANCAS, GRUPO_DESCARTADO, STATUS_VALIDACAO, TIPOS_ATIVIDADE, TIPOS_UNIDADE, type Confianca, type StatusValidacao, type TipoAtividade, type TipoUnidade } from "./rotulos";

export const TABELAS_PERMITIDAS = [
  "ConcreteiraCandidata",
  "ConcreteiraCandidataUnidade",
  "ConcreteiraValidacaoHistorico",
  "ConcreteiraEvidencia",
] as const;
export type TabelaPermitida = (typeof TABELAS_PERMITIDAS)[number];

export const PAPEIS_QUE_VALIDAM = ["ADMIN", "GERENTE", "COMERCIAL"] as const;
export function podeValidar(papel: string | null | undefined): boolean {
  return Boolean(papel) && (PAPEIS_QUE_VALIDAM as readonly string[]).includes(papel as string);
}

export const JUSTIFICATIVA_MINIMA = 10;
const STATUS_QUE_EXIGEM_VALIDADOR: StatusValidacao[] = ["CONFIRMADA"];

export type EstadoValidacao = { status: StatusValidacao; confianca: Confianca | null; tipoAtividade: TipoAtividade | null };
export type PedidoAlteracao = Partial<EstadoValidacao> & {
  justificativa: string;
  unidade?: { id: string; tipoAtual: TipoUnidade; tipoNovo: TipoUnidade };
};

export type Operacao =
  | { tabela: "ConcreteiraCandidata"; acao: "update"; id: string; dados: Record<string, unknown> }
  | { tabela: "ConcreteiraCandidataUnidade"; acao: "update"; id: string; dados: Record<string, unknown> }
  | { tabela: "ConcreteiraValidacaoHistorico"; acao: "create"; dados: Record<string, unknown> }
  | { tabela: "ConcreteiraEvidencia"; acao: "create"; dados: Record<string, unknown> };

export type Resultado = { ok: true; operacoes: Operacao[] } | { ok: false; erros: string[] };

export function planejarAlteracao(args: {
  candidataId: string;
  atual: EstadoValidacao;
  pedido: PedidoAlteracao;
  usuario: { id: string; papel: string } | null;
  agora?: Date;
  primeiraVerificacaoEm?: Date | null;
}): Resultado {
  const erros: string[] = [];
  const { atual, pedido, usuario } = args;
  const agora = args.agora ?? new Date();

  if (!usuario) return { ok: false, erros: ["Usuário não identificado."] };
  if (!podeValidar(usuario.papel)) return { ok: false, erros: ["Seu perfil não pode validar candidatas."] };

  if (pedido.status && !(STATUS_VALIDACAO as readonly string[]).includes(pedido.status)) erros.push("Situação inválida.");
  if (pedido.confianca && !(CONFIANCAS as readonly string[]).includes(pedido.confianca)) erros.push("Confiança inválida.");
  if (pedido.tipoAtividade && !(TIPOS_ATIVIDADE as readonly string[]).includes(pedido.tipoAtividade)) erros.push("Tipo de atividade inválido.");
  if (pedido.unidade && !(TIPOS_UNIDADE as readonly string[]).includes(pedido.unidade.tipoNovo)) erros.push("Tipo de unidade inválido.");

  const justificativa = (pedido.justificativa ?? "").trim();
  if (justificativa.length < JUSTIFICATIVA_MINIMA) erros.push(`A justificativa é obrigatória (mínimo ${JUSTIFICATIVA_MINIMA} caracteres).`);

  const novo: EstadoValidacao = {
    status: pedido.status ?? atual.status,
    confianca: pedido.confianca === undefined ? atual.confianca : pedido.confianca,
    tipoAtividade: pedido.tipoAtividade === undefined ? atual.tipoAtividade : pedido.tipoAtividade,
  };
  const mudouCandidata = novo.status !== atual.status || novo.confianca !== atual.confianca || novo.tipoAtividade !== atual.tipoAtividade;
  const mudouUnidade = Boolean(pedido.unidade && pedido.unidade.tipoNovo !== pedido.unidade.tipoAtual);
  if (!mudouCandidata && !mudouUnidade) erros.push("Nenhuma alteração foi informada.");

  if (novo.status === "CONFIRMADA" && !novo.confianca) erros.push("Para confirmar, informe o nível de confiança.");
  if (erros.length) return { ok: false, erros };

  const operacoes: Operacao[] = [];
  if (mudouCandidata) {
    const dados: Record<string, unknown> = {
      statusValidacao: novo.status,
      confianca: novo.confianca,
      tipoAtividade: novo.tipoAtividade,
      justificativa,
      ultimaVerificacaoEm: agora,
    };
    if (!args.primeiraVerificacaoEm) dados.primeiraVerificacaoEm = agora;
    if (STATUS_QUE_EXIGEM_VALIDADOR.includes(novo.status)) {
      dados.validadoPorId = usuario.id;
      dados.validadoEm = agora;
    }
    operacoes.push({ tabela: "ConcreteiraCandidata", acao: "update", id: args.candidataId, dados });
    operacoes.push({
      tabela: "ConcreteiraValidacaoHistorico", acao: "create",
      dados: {
        candidataId: args.candidataId, tipoEvento: "VALIDACAO", origem: "TELA_BASE_NACIONAL",
        statusAnterior: atual.status, statusNovo: novo.status,
        confiancaAnterior: atual.confianca, confiancaNova: novo.confianca,
        tipoAnterior: atual.tipoAtividade, tipoNovo: novo.tipoAtividade,
        motivo: justificativa, usuarioId: usuario.id, createdAt: agora,
      },
    });
  }
  if (mudouUnidade && pedido.unidade) {
    operacoes.push({ tabela: "ConcreteiraCandidataUnidade", acao: "update", id: pedido.unidade.id, dados: { tipoUnidade: pedido.unidade.tipoNovo } });
    operacoes.push({
      tabela: "ConcreteiraValidacaoHistorico", acao: "create",
      dados: {
        candidataId: args.candidataId, tipoEvento: "TIPO_UNIDADE", origem: "TELA_BASE_NACIONAL",
        statusAnterior: novo.status, statusNovo: novo.status, // statusNovo é obrigatório no histórico
        campo: "tipoUnidade", entidadeId: pedido.unidade.id,
        valorAnterior: pedido.unidade.tipoAtual, valorNovo: pedido.unidade.tipoNovo,
        motivo: justificativa, usuarioId: usuario.id, createdAt: agora,
      },
    });
  }
  return { ok: true, operacoes };
}

/** Justificativa é exigida em todos os casos; estes status também a exigem no banco (CHECK na v4). */
export const STATUS_QUE_EXIGEM_JUSTIFICATIVA: StatusValidacao[] = ["CONFIRMADA", ...GRUPO_DESCARTADO];

export function planejarVinculo(args: {
  candidataId: string;
  statusAtual: StatusValidacao;
  empresaId: string;
  candidataJaVinculadaA: string | null;
  empresaJaVinculadaACandidata: string | null;
  empresaExiste: boolean;
  confirmado: boolean;
  justificativa: string;
  usuario: { id: string; papel: string } | null;
  agora?: Date;
}): Resultado {
  const erros: string[] = [];
  const agora = args.agora ?? new Date();
  if (!args.usuario) return { ok: false, erros: ["Usuário não identificado."] };
  if (!podeValidar(args.usuario.papel)) return { ok: false, erros: ["Seu perfil não pode vincular candidatas."] };
  if (!args.empresaExiste) erros.push("Empresa não encontrada. Nesta etapa não é possível criar Empresa nova.");
  if (!args.confirmado) erros.push("Confirme o vínculo antes de gravar.");
  if (args.candidataJaVinculadaA) erros.push("Esta candidata já está vinculada a uma Empresa.");
  if (args.empresaJaVinculadaACandidata && args.empresaJaVinculadaACandidata !== args.candidataId) erros.push("Esta Empresa já está vinculada a outra candidata.");
  if ((args.justificativa ?? "").trim().length < JUSTIFICATIVA_MINIMA) erros.push(`A justificativa é obrigatória (mínimo ${JUSTIFICATIVA_MINIMA} caracteres).`);
  if (erros.length) return { ok: false, erros };
  return {
    ok: true,
    operacoes: [
      { tabela: "ConcreteiraCandidata", acao: "update", id: args.candidataId, dados: { empresaId: args.empresaId, vinculadoEm: agora, vinculadoPorId: args.usuario.id } },
      {
        tabela: "ConcreteiraValidacaoHistorico", acao: "create",
        dados: {
          candidataId: args.candidataId, tipoEvento: "VINCULO_EMPRESA", origem: "TELA_BASE_NACIONAL",
          statusAnterior: args.statusAtual, statusNovo: args.statusAtual,
          campo: "empresaId", valorAnterior: null, valorNovo: args.empresaId, entidadeId: args.empresaId,
          motivo: args.justificativa.trim(), usuarioId: args.usuario.id, createdAt: agora,
        },
      },
    ],
  };
}

export type PedidoEvidencia = {
  tipoFonte: string; titulo: string; url?: string | null; dataEvidencia?: Date | null;
  trecho?: string | null; confianca?: string | null; observacao?: string | null;
};
const FONTES = ["RECEITA_FEDERAL", "SITE_EMPRESA", "GOOGLE_MAPS", "REDE_SOCIAL", "LINKEDIN", "NOTICIA", "VAGA_EMPREGO", "LICENCA_AMBIENTAL", "DIARIO_OFICIAL", "ASSOCIACAO_SETORIAL", "CONTATO_DIRETO", "OUTRA"];

export function planejarEvidencia(args: { candidataId: string; statusAtual: StatusValidacao; pedido: PedidoEvidencia; usuario: { id: string; papel: string } | null; agora?: Date }): Resultado {
  const erros: string[] = [];
  const agora = args.agora ?? new Date();
  const p = args.pedido;
  if (!args.usuario) return { ok: false, erros: ["Usuário não identificado."] };
  if (!podeValidar(args.usuario.papel)) return { ok: false, erros: ["Seu perfil não pode registrar evidências."] };
  if (!FONTES.includes(p.tipoFonte)) erros.push("Tipo de fonte inválido.");
  if (!p.titulo || p.titulo.trim().length < 3) erros.push("Informe um título.");
  if (p.url) {
    try { const u = new URL(p.url); if (!["http:", "https:"].includes(u.protocol)) erros.push("A URL deve começar com http:// ou https://."); }
    catch { erros.push("URL inválida."); }
  }
  if (p.dataEvidencia && p.dataEvidencia.getTime() > agora.getTime() + 60_000) erros.push("A data da evidência não pode estar no futuro.");
  if (p.confianca && !(CONFIANCAS as readonly string[]).includes(p.confianca)) erros.push("Confiança inválida.");
  if (!p.url && !(p.trecho ?? "").trim()) erros.push("Informe a URL ou o trecho comprobatório.");
  if (erros.length) return { ok: false, erros };
  return {
    ok: true,
    operacoes: [
      {
        tabela: "ConcreteiraEvidencia", acao: "create",
        dados: {
          candidataId: args.candidataId, tipoFonte: p.tipoFonte, titulo: p.titulo.trim(), url: p.url || null,
          coletadoEm: p.dataEvidencia ?? agora, trecho: p.trecho?.trim() || null, confianca: p.confianca || null,
          observacao: p.observacao?.trim() || null, registradoPorId: args.usuario.id, createdAt: agora,
        },
      },
      {
        tabela: "ConcreteiraValidacaoHistorico", acao: "create",
        dados: {
          candidataId: args.candidataId, tipoEvento: "EVIDENCIA", origem: "TELA_BASE_NACIONAL",
          statusAnterior: args.statusAtual, statusNovo: args.statusAtual,
          campo: "evidencia", valorNovo: p.titulo.trim(), motivo: `Evidência registrada: ${p.titulo.trim()}`,
          usuarioId: args.usuario.id, createdAt: agora,
        },
      },
    ],
  };
}
