// ARQUIVO: lib/base-nacional/validacao.ts
// REGRA: nunca remover. Apenas acrescentar.
// Regras da validação manual da Base Nacional (funções puras, testáveis sem banco).
// Toda alteração gera um plano de gravação que toca SOMENTE tabelas novas e SEMPRE
// inclui um registro de histórico. Nenhuma regra cria Empresa, Dossiê, Carteira ou Oportunidade.
// A gravação em si depende da migration v4 (campos tipoEvento/origem do histórico).
// "statusNovo" é obrigatório no histórico (v3): eventos que não mudam a situação registram a vigente.

import { CONFIANCAS, GRUPO_DESCARTADO, STATUS_VALIDACAO, TIPOS_ATIVIDADE, TIPOS_UNIDADE, type Confianca, type StatusValidacao, type TipoAtividade, type TipoUnidade } from "./rotulos";
import {
  EQUIPAMENTOS, EQUIPAMENTO_LABEL, NIVEIS_POTENCIAL, NIVEL_LABEL, PAPEIS_PESSOA, PAPEL_PESSOA_LABEL, PRIORIDADES, PRIORIDADE_LABEL,
  SITUACOES_VERIFICACAO, TIPOS_CONTATO, TIPO_CONTATO_LABEL,
  type Equipamento, type NivelPotencial, type PapelPessoa, type Prioridade, type SituacaoVerificacao, type TipoContato,
} from "./rotulos";
import { mascararEmail, mascararTelefone, normalizarContato, normalizarEmail, normalizarTelefone, validarContato, valorParaHistorico } from "./contatos";

export const TABELAS_PERMITIDAS = [
  "ConcreteiraCandidata",
  "ConcreteiraCandidataUnidade",
  "ConcreteiraValidacaoHistorico",
  "ConcreteiraEvidencia",
  // v4 (05/10/2026)
  "ConcreteiraCandidataContato",
  "ConcreteiraCandidataPessoa",
  "ConcreteiraPotencialEquipamento",
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

// v4: tipo genérico — qualquer operação só pode mirar uma tabela de TABELAS_PERMITIDAS
// (o executor recusa o resto). Nunca há "delete".
export type Operacao =
  | { tabela: TabelaPermitida; acao: "update"; id: string; dados: Record<string, unknown> }
  | { tabela: TabelaPermitida; acao: "create"; dados: Record<string, unknown> };

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
  empresaJaVinculadaACandidata?: string | null;
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
  // Decisão aprovada em 05/10/2026: uma Empresa do CRM PODE estar ligada a várias candidatas.
  // (empresaJaVinculadaACandidata continua aceito como parâmetro, apenas informativo.)
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


// ═══════════════════════════════════════════════════════════════════════════
// v4 (05/10/2026) — contatos, pessoas, potencial por equipamento, qualificação.
// Telefone e e-mail completos NUNCA vão para o histórico (valorParaHistorico).
// ═══════════════════════════════════════════════════════════════════════════


type Usuario = { id: string; papel: string } | null;

function checarUsuario(usuario: Usuario): string | null {
  if (!usuario) return "Usuário não identificado.";
  if (!podeValidar(usuario.papel)) return "Seu perfil não pode alterar a Base Nacional.";
  return null;
}

function hist(args: {
  candidataId: string; statusAtual: StatusValidacao; tipoEvento: string; usuarioId: string; agora: Date;
  campo?: string; entidadeId?: string | null; valorAnterior?: string | null; valorNovo?: string | null; motivo: string;
}): Operacao {
  return {
    tabela: "ConcreteiraValidacaoHistorico", acao: "create",
    dados: {
      candidataId: args.candidataId, tipoEvento: args.tipoEvento, origem: "TELA_BASE_NACIONAL",
      statusAnterior: args.statusAtual, statusNovo: args.statusAtual,
      campo: args.campo ?? null, entidadeId: args.entidadeId ?? null,
      valorAnterior: args.valorAnterior ?? null, valorNovo: args.valorNovo ?? null,
      motivo: args.motivo, usuarioId: args.usuarioId, createdAt: args.agora,
    },
  };
}

const FONTES_VALIDAS = ["RECEITA_FEDERAL", "SITE_EMPRESA", "GOOGLE_MAPS", "REDE_SOCIAL", "LINKEDIN", "NOTICIA", "VAGA_EMPREGO", "LICENCA_AMBIENTAL", "DIARIO_OFICIAL", "ASSOCIACAO_SETORIAL", "CONTATO_DIRETO", "OUTRA"];

function validarUrlOpcional(url: string | null | undefined, erros: string[], rotulo = "URL da fonte") {
  if (!url) return;
  try { const u = new URL(url); if (!["http:", "https:"].includes(u.protocol)) erros.push(`${rotulo} deve começar com http:// ou https://.`); }
  catch { erros.push(`${rotulo} inválida.`); }
}

// ─── Desvínculo ──────────────────────────────────────────────────────────────
export function planejarDesvinculo(args: {
  candidataId: string; statusAtual: StatusValidacao; empresaAtualId: string | null; justificativa: string; usuario: Usuario; agora?: Date;
}): Resultado {
  const e = checarUsuario(args.usuario); if (e) return { ok: false, erros: [e] };
  const erros: string[] = [];
  if (!args.empresaAtualId) erros.push("Esta candidata não está vinculada.");
  if ((args.justificativa ?? "").trim().length < JUSTIFICATIVA_MINIMA) erros.push(`A justificativa é obrigatória (mínimo ${JUSTIFICATIVA_MINIMA} caracteres).`);
  if (erros.length) return { ok: false, erros };
  const agora = args.agora ?? new Date();
  return { ok: true, operacoes: [
    { tabela: "ConcreteiraCandidata", acao: "update", id: args.candidataId, dados: { empresaId: null, vinculadoEm: null, vinculadoPorId: null } },
    hist({ candidataId: args.candidataId, statusAtual: args.statusAtual, tipoEvento: "VINCULO_EMPRESA", usuarioId: args.usuario!.id, agora,
      campo: "empresaId", entidadeId: args.empresaAtualId, valorAnterior: args.empresaAtualId, valorNovo: null, motivo: args.justificativa.trim() }),
  ] };
}

// ─── Qualificação comercial ──────────────────────────────────────────────────
export function planejarQualificacao(args: {
  candidataId: string; statusAtual: StatusValidacao;
  atual: { prioridade: Prioridade | null; observacao: string | null };
  pedido: { prioridade: Prioridade | null; observacao: string | null; justificativa: string };
  usuario: Usuario; agora?: Date;
}): Resultado {
  const e = checarUsuario(args.usuario); if (e) return { ok: false, erros: [e] };
  const erros: string[] = [];
  const { pedido, atual } = args;
  if (pedido.prioridade && !(PRIORIDADES as readonly string[]).includes(pedido.prioridade)) erros.push("Prioridade inválida.");
  const obs = pedido.observacao?.trim() || null;
  if (obs && obs.length > 4000) erros.push("Observação muito longa.");
  const mudouP = (pedido.prioridade ?? null) !== (atual.prioridade ?? null);
  const mudouO = obs !== (atual.observacao?.trim() || null);
  if (!mudouP && !mudouO) erros.push("Nenhuma alteração foi informada.");
  if ((pedido.justificativa ?? "").trim().length < JUSTIFICATIVA_MINIMA) erros.push(`A justificativa é obrigatória (mínimo ${JUSTIFICATIVA_MINIMA} caracteres).`);
  if (erros.length) return { ok: false, erros };
  const agora = args.agora ?? new Date();
  const ops: Operacao[] = [{ tabela: "ConcreteiraCandidata", acao: "update", id: args.candidataId,
    dados: { prioridadeComercial: pedido.prioridade ?? null, observacaoComercial: obs, qualificadoEm: agora, qualificadoPorId: args.usuario!.id } }];
  if (mudouP) ops.push(hist({ candidataId: args.candidataId, statusAtual: args.statusAtual, tipoEvento: "QUALIFICACAO", usuarioId: args.usuario!.id, agora,
    campo: "prioridadeComercial", valorAnterior: atual.prioridade ? PRIORIDADE_LABEL[atual.prioridade] : null,
    valorNovo: pedido.prioridade ? PRIORIDADE_LABEL[pedido.prioridade] : null, motivo: pedido.justificativa.trim() }));
  if (mudouO) ops.push(hist({ candidataId: args.candidataId, statusAtual: args.statusAtual, tipoEvento: "QUALIFICACAO", usuarioId: args.usuario!.id, agora,
    campo: "observacaoComercial", valorAnterior: atual.observacao ? "(texto anterior)" : null, valorNovo: obs ? "(texto atualizado)" : null, motivo: pedido.justificativa.trim() }));
  return { ok: true, operacoes: ops };
}

// ─── Contatos ────────────────────────────────────────────────────────────────
export type PedidoContato = {
  tipo: TipoContato; valor: string; descricao?: string | null; unidadeId?: string | null; principal?: boolean;
  situacao?: SituacaoVerificacao; fonte?: string | null; fonteUrl?: string | null;
};

export function planejarContato(args: {
  candidataId: string; statusAtual: StatusValidacao; novoId: string; pedido: PedidoContato;
  unidadesDaCandidata: string[]; chavesAtivas: string[]; usuario: Usuario; agora?: Date;
}): Resultado {
  const e = checarUsuario(args.usuario); if (e) return { ok: false, erros: [e] };
  const erros: string[] = [];
  const p = args.pedido;
  if (!(TIPOS_CONTATO as readonly string[]).includes(p.tipo)) return { ok: false, erros: ["Tipo de contato inválido."] };
  const erro = validarContato(p.tipo, p.valor); if (erro) erros.push(erro);
  if (p.unidadeId && !args.unidadesDaCandidata.includes(p.unidadeId)) erros.push("A unidade escolhida não pertence a esta candidata.");
  if (p.situacao && !(SITUACOES_VERIFICACAO as readonly string[]).includes(p.situacao)) erros.push("Situação de verificação inválida.");
  if (p.fonte && !FONTES_VALIDAS.includes(p.fonte)) erros.push("Fonte inválida.");
  validarUrlOpcional(p.fonteUrl, erros);
  const norm = erro ? "" : normalizarContato(p.tipo, p.valor);
  if (norm && args.chavesAtivas.includes(`${p.tipo}:${norm}`)) erros.push("Este contato já está cadastrado e ativo.");
  if (erros.length) return { ok: false, erros };
  const agora = args.agora ?? new Date();
  const verificado = p.situacao === "VERIFICADO";
  return { ok: true, operacoes: [
    { tabela: "ConcreteiraCandidataContato", acao: "create", dados: {
      id: args.novoId, candidataId: args.candidataId, unidadeId: p.unidadeId || null, tipo: p.tipo, valor: p.valor.trim(), valorNormalizado: norm,
      descricao: p.descricao?.trim() || null, principal: Boolean(p.principal), situacao: p.situacao ?? "NAO_VERIFICADO",
      fonte: p.fonte || null, fonteUrl: p.fonteUrl || null, verificadoEm: verificado ? agora : null, verificadoPorId: verificado ? args.usuario!.id : null,
      registradoPorId: args.usuario!.id, createdAt: agora, updatedAt: agora } },
    hist({ candidataId: args.candidataId, statusAtual: args.statusAtual, tipoEvento: "CONTATO", usuarioId: args.usuario!.id, agora,
      campo: `contato:${p.tipo}`, entidadeId: args.novoId, valorNovo: valorParaHistorico(p.tipo, p.valor), motivo: `${TIPO_CONTATO_LABEL[p.tipo]} registrado` }),
  ] };
}

export function planejarSituacaoContato(args: {
  candidataId: string; statusAtual: StatusValidacao; contato: { id: string; tipo: TipoContato; valor: string; situacao: SituacaoVerificacao; ativo: boolean };
  situacao: SituacaoVerificacao; usuario: Usuario; agora?: Date;
}): Resultado {
  const e = checarUsuario(args.usuario); if (e) return { ok: false, erros: [e] };
  if (!(SITUACOES_VERIFICACAO as readonly string[]).includes(args.situacao)) return { ok: false, erros: ["Situação inválida."] };
  if (!args.contato.ativo) return { ok: false, erros: ["Contato inativo não pode ser alterado."] };
  if (args.contato.situacao === args.situacao) return { ok: false, erros: ["Nenhuma alteração foi informada."] };
  const agora = args.agora ?? new Date();
  const v = args.situacao === "VERIFICADO";
  return { ok: true, operacoes: [
    { tabela: "ConcreteiraCandidataContato", acao: "update", id: args.contato.id, dados: { situacao: args.situacao, verificadoEm: v ? agora : null, verificadoPorId: v ? args.usuario!.id : null } },
    hist({ candidataId: args.candidataId, statusAtual: args.statusAtual, tipoEvento: "CONTATO", usuarioId: args.usuario!.id, agora,
      campo: `situacao:${args.contato.tipo}`, entidadeId: args.contato.id, valorAnterior: args.contato.situacao, valorNovo: args.situacao,
      motivo: `Situação do contato ${valorParaHistorico(args.contato.tipo, args.contato.valor)} alterada` }),
  ] };
}

export function planejarInativacaoContato(args: {
  candidataId: string; statusAtual: StatusValidacao; contato: { id: string; tipo: TipoContato; valor: string; ativo: boolean };
  motivo: string; usuario: Usuario; agora?: Date;
}): Resultado {
  const e = checarUsuario(args.usuario); if (e) return { ok: false, erros: [e] };
  const erros: string[] = [];
  if (!args.contato.ativo) erros.push("Este contato já está inativo.");
  if ((args.motivo ?? "").trim().length < JUSTIFICATIVA_MINIMA) erros.push(`O motivo é obrigatório (mínimo ${JUSTIFICATIVA_MINIMA} caracteres).`);
  if (erros.length) return { ok: false, erros };
  const agora = args.agora ?? new Date();
  return { ok: true, operacoes: [
    { tabela: "ConcreteiraCandidataContato", acao: "update", id: args.contato.id, dados: { ativo: false, inativadoEm: agora, inativadoPorId: args.usuario!.id, motivoInativacao: args.motivo.trim(), principal: false } },
    hist({ candidataId: args.candidataId, statusAtual: args.statusAtual, tipoEvento: "CONTATO", usuarioId: args.usuario!.id, agora,
      campo: `inativacao:${args.contato.tipo}`, entidadeId: args.contato.id, valorAnterior: valorParaHistorico(args.contato.tipo, args.contato.valor), valorNovo: "inativo",
      motivo: args.motivo.trim() }),
  ] };
}

// ─── Pessoas ─────────────────────────────────────────────────────────────────
export type PedidoPessoa = {
  nome: string; funcao?: string | null; papeis: PapelPessoa[]; telefone?: string | null; whatsapp?: string | null; email?: string | null;
  linkedinUrl?: string | null; fonte?: string | null; fonteUrl?: string | null; situacao?: SituacaoVerificacao; observacao?: string | null;
};

export function planejarPessoa(args: {
  candidataId: string; statusAtual: StatusValidacao; novoId: string; pedido: PedidoPessoa;
  emailsAtivos: string[]; whatsappsAtivos: string[]; usuario: Usuario; agora?: Date;
}): Resultado {
  const e = checarUsuario(args.usuario); if (e) return { ok: false, erros: [e] };
  const erros: string[] = [];
  const p = args.pedido;
  const nome = (p.nome ?? "").trim();
  if (nome.length < 3) erros.push("Informe o nome (mínimo 3 caracteres).");
  if (nome.length > 200) erros.push("Nome muito longo.");
  const papeis = [...new Set(p.papeis ?? [])];
  if (papeis.length === 0) erros.push("Escolha ao menos um papel.");
  if (papeis.some(x => !(PAPEIS_PESSOA as readonly string[]).includes(x))) erros.push("Papel inválido.");
  for (const [tipo, v] of [["TELEFONE", p.telefone], ["WHATSAPP", p.whatsapp], ["EMAIL", p.email]] as const) {
    if (v && v.trim()) { const er = validarContato(tipo, v); if (er) erros.push(`${TIPO_CONTATO_LABEL[tipo]}: ${er}`); }
  }
  validarUrlOpcional(p.linkedinUrl, erros, "LinkedIn");
  validarUrlOpcional(p.fonteUrl, erros);
  if (p.fonte && !FONTES_VALIDAS.includes(p.fonte)) erros.push("Fonte inválida.");
  if (p.situacao && !(SITUACOES_VERIFICACAO as readonly string[]).includes(p.situacao)) erros.push("Situação de verificação inválida.");
  const emailN = p.email?.trim() ? normalizarEmail(p.email) : null;
  const zapN = p.whatsapp?.trim() ? normalizarTelefone(p.whatsapp) : null;
  if (emailN && args.emailsAtivos.includes(emailN)) erros.push("Já existe uma pessoa ativa com este e-mail nesta candidata.");
  if (zapN && args.whatsappsAtivos.includes(zapN)) erros.push("Já existe uma pessoa ativa com este WhatsApp nesta candidata.");
  if (erros.length) return { ok: false, erros };
  const agora = args.agora ?? new Date();
  const verificado = p.situacao === "VERIFICADO";
  const contatosMascarados = [mascararTelefone(p.telefone), mascararTelefone(p.whatsapp), mascararEmail(p.email)].filter(Boolean).join(" · ");
  return { ok: true, operacoes: [
    { tabela: "ConcreteiraCandidataPessoa", acao: "create", dados: {
      id: args.novoId, candidataId: args.candidataId, nome, funcao: p.funcao?.trim() || null, papeis,
      telefone: p.telefone?.trim() || null, telefoneNormalizado: p.telefone?.trim() ? normalizarTelefone(p.telefone) : null,
      whatsapp: p.whatsapp?.trim() || null, whatsappNormalizado: zapN, email: p.email?.trim() || null, emailNormalizado: emailN,
      linkedinUrl: p.linkedinUrl?.trim() || null, fonte: p.fonte || null, fonteUrl: p.fonteUrl || null,
      situacao: p.situacao ?? "NAO_VERIFICADO", verificadoEm: verificado ? agora : null, verificadoPorId: verificado ? args.usuario!.id : null,
      observacao: p.observacao?.trim() || null, registradoPorId: args.usuario!.id, createdAt: agora, updatedAt: agora } },
    hist({ candidataId: args.candidataId, statusAtual: args.statusAtual, tipoEvento: "PESSOA", usuarioId: args.usuario!.id, agora,
      campo: "pessoa", entidadeId: args.novoId,
      valorNovo: `${nome} — ${papeis.map(x => PAPEL_PESSOA_LABEL[x]).join(", ")}${contatosMascarados ? ` (${contatosMascarados})` : ""}`,
      motivo: "Pessoa registrada" }),
  ] };
}

export function planejarInativacaoPessoa(args: {
  candidataId: string; statusAtual: StatusValidacao; pessoa: { id: string; nome: string; ativo: boolean }; motivo: string; usuario: Usuario; agora?: Date;
}): Resultado {
  const e = checarUsuario(args.usuario); if (e) return { ok: false, erros: [e] };
  const erros: string[] = [];
  if (!args.pessoa.ativo) erros.push("Esta pessoa já está inativa.");
  if ((args.motivo ?? "").trim().length < JUSTIFICATIVA_MINIMA) erros.push(`O motivo é obrigatório (mínimo ${JUSTIFICATIVA_MINIMA} caracteres).`);
  if (erros.length) return { ok: false, erros };
  const agora = args.agora ?? new Date();
  return { ok: true, operacoes: [
    { tabela: "ConcreteiraCandidataPessoa", acao: "update", id: args.pessoa.id, dados: { ativo: false, inativadoEm: agora, inativadoPorId: args.usuario!.id, motivoInativacao: args.motivo.trim() } },
    hist({ candidataId: args.candidataId, statusAtual: args.statusAtual, tipoEvento: "PESSOA", usuarioId: args.usuario!.id, agora,
      campo: "inativacao:pessoa", entidadeId: args.pessoa.id, valorAnterior: args.pessoa.nome, valorNovo: "inativa", motivo: args.motivo.trim() }),
  ] };
}

// ─── Potencial por equipamento (foco: venda de usados; locação secundária) ───
export type PedidoPotencial = {
  equipamento: Equipamento; unidadeId?: string | null; descricaoOutro?: string | null;
  potencialVenda: NivelPotencial; interesseLocacao: NivelPotencial; quantidadeEstimada?: number | null;
  evidenciaId?: string | null; observacao?: string | null;
};

const resumoPotencial = (v: NivelPotencial, l: NivelPotencial, q?: number | null) =>
  `Venda: ${NIVEL_LABEL[v]} · Locação: ${NIVEL_LABEL[l]}${q != null ? ` · Qtd.: ${q}` : ""}`;

export function planejarPotencial(args: {
  candidataId: string; statusAtual: StatusValidacao; novoId: string; pedido: PedidoPotencial;
  existente: { id: string; potencialVenda: NivelPotencial; interesseLocacao: NivelPotencial; quantidadeEstimada: number | null } | null;
  unidadesDaCandidata: string[]; evidenciasDaCandidata: string[]; usuario: Usuario; agora?: Date;
}): Resultado {
  const e = checarUsuario(args.usuario); if (e) return { ok: false, erros: [e] };
  const erros: string[] = [];
  const p = args.pedido;
  if (!(EQUIPAMENTOS as readonly string[]).includes(p.equipamento)) erros.push("Equipamento inválido.");
  if (!(NIVEIS_POTENCIAL as readonly string[]).includes(p.potencialVenda)) erros.push("Potencial de venda inválido.");
  if (!(NIVEIS_POTENCIAL as readonly string[]).includes(p.interesseLocacao)) erros.push("Interesse em locação inválido.");
  if (p.equipamento === "OUTRO" && !(p.descricaoOutro ?? "").trim()) erros.push("Descreva o equipamento em \"Outro\".");
  if (p.unidadeId && !args.unidadesDaCandidata.includes(p.unidadeId)) erros.push("A unidade escolhida não pertence a esta candidata.");
  if (p.evidenciaId && !args.evidenciasDaCandidata.includes(p.evidenciaId)) erros.push("A evidência escolhida não pertence a esta candidata.");
  if (p.quantidadeEstimada != null && (!Number.isInteger(p.quantidadeEstimada) || p.quantidadeEstimada < 0 || p.quantidadeEstimada > 10_000)) erros.push("Quantidade estimada deve ser um número inteiro entre 0 e 10.000.");
  const ex = args.existente;
  if (ex && ex.potencialVenda === p.potencialVenda && ex.interesseLocacao === p.interesseLocacao && (ex.quantidadeEstimada ?? null) === (p.quantidadeEstimada ?? null) && !p.observacao && !p.evidenciaId) {
    erros.push("Nenhuma alteração foi informada.");
  }
  if (erros.length) return { ok: false, erros };
  const agora = args.agora ?? new Date();
  const dados = {
    potencialVenda: p.potencialVenda, interesseLocacao: p.interesseLocacao, quantidadeEstimada: p.quantidadeEstimada ?? null,
    descricaoOutro: p.equipamento === "OUTRO" ? p.descricaoOutro!.trim() : null, evidenciaId: p.evidenciaId || null,
    observacao: p.observacao?.trim() || null, avaliadoPorId: args.usuario!.id, avaliadoEm: agora,
  };
  const id = ex?.id ?? args.novoId;
  const op: Operacao = ex
    ? { tabela: "ConcreteiraPotencialEquipamento", acao: "update", id: ex.id, dados }
    : { tabela: "ConcreteiraPotencialEquipamento", acao: "create", dados: { id, candidataId: args.candidataId, unidadeId: p.unidadeId || null, equipamento: p.equipamento, ...dados, createdAt: agora, updatedAt: agora } };
  return { ok: true, operacoes: [op,
    hist({ candidataId: args.candidataId, statusAtual: args.statusAtual, tipoEvento: "POTENCIAL_EQUIPAMENTO", usuarioId: args.usuario!.id, agora,
      campo: `${EQUIPAMENTO_LABEL[p.equipamento]}${p.unidadeId ? " (unidade)" : " (geral)"}`, entidadeId: id,
      valorAnterior: ex ? resumoPotencial(ex.potencialVenda, ex.interesseLocacao, ex.quantidadeEstimada) : null,
      valorNovo: resumoPotencial(p.potencialVenda, p.interesseLocacao, p.quantidadeEstimada), motivo: p.observacao?.trim() || "Avaliação de potencial" }),
  ] };
}
