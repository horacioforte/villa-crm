import { createHash } from "node:crypto";

type DecimalLike = number | string | { toString(): string };

export type DossieEstruturaInput = {
  clienteFinal?: string | null;
  construtora?: string | null;
  epc?: string | null;
  epcm?: string | null;
  faseObra?: string | null;
  licenciamento?: string | null;
  cronograma?: string | null;
  valorEstimado?: DecimalLike | null;
  volumeConcreto?: DecimalLike | null;
  cidade?: string | null;
  estado?: string | null;
  segmento?: string | null;
  resumo?: string | null;
  equipamentosSugeridos?: string | null;
  campanhasSugerida?: string | null;
  concorrentes?: string | null;
};

export type EvidenciaEstruturaInput = {
  dossieId?: string | null;
  obraId?: string | null;
  tipo?: string | null;
  titulo?: string | null;
  descricao?: string | null;
  url?: string | null;
  dataInformacao?: Date | string | null;
};

export type MovimentacaoEstruturaInput = {
  dossieId?: string | null;
  obraId?: string | null;
  tipo?: string | null;
  titulo?: string | null;
  descricao?: string | null;
  momento?: Date | string | null;
};

export type ScoreJoaoEstrutura = {
  potencialVilla: number;
  momentoVilla: number | null;
  prontidao: number;
  prioridadeJoao: number | null;
  potencialMcmv?: number;
  momentoMcmv?: number;
  prioridadeMcmv?: number;
  motivoPrioridade: string;
};

export function normalizarTexto(value?: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hashTexto(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}

export function normalizarUrlParaHash(url?: string | null): string | null {
  if (!url || !url.trim()) return null;

  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";

    const params = new URLSearchParams();
    for (const [key, value] of parsed.searchParams.entries()) {
      if (!key.toLowerCase().startsWith("utm_")) {
        params.append(key, value);
      }
    }

    parsed.search = params.toString();
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    parsed.pathname = pathname;

    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return normalizarTexto(url);
  }
}

export function normalizarConteudoParaHash(value?: string | null): string | null {
  const normalized = normalizarTexto(value ?? "");
  return normalized.length > 0 ? normalized : null;
}

export function gerarHashEvidencia(input: EvidenciaEstruturaInput): string {
  const normalizedUrl = normalizarUrlParaHash(input.url ?? null);

  if (normalizedUrl) {
    return hashTexto(`url|${normalizedUrl}`);
  }

  const base = [
    input.dossieId ?? "",
    input.obraId ?? "",
    input.tipo ?? "",
    input.dataInformacao ? new Date(input.dataInformacao).toISOString() : "",
    normalizarConteudoParaHash([input.titulo, input.descricao].filter(Boolean).join(" ")) ?? "",
  ].join("|");

  return hashTexto(base);
}

export function gerarHashMovimentacao(input: MovimentacaoEstruturaInput): string {
  const base = [
    input.dossieId ?? "",
    input.obraId ?? "",
    input.tipo ?? "",
    input.momento ? new Date(input.momento).toISOString() : "",
    normalizarConteudoParaHash([input.titulo, input.descricao].filter(Boolean).join(" ")) ?? "",
  ].join("|");

  return hashTexto(base);
}

function mesmaEvidenciaLogica(a: Partial<EvidenciaEstruturaInput>, b: Partial<EvidenciaEstruturaInput>): boolean {
  const dossieIgual = (a.dossieId ?? "") === (b.dossieId ?? "");
  if (!dossieIgual) return false;

  const urlA = normalizarUrlParaHash(a.url ?? null);
  const urlB = normalizarUrlParaHash(b.url ?? null);
  if (urlA && urlB && urlA === urlB) return true;

  const textoA = normalizarConteudoParaHash([a.titulo, a.descricao].filter(Boolean).join(" "));
  const textoB = normalizarConteudoParaHash([b.titulo, b.descricao].filter(Boolean).join(" "));
  if (textoA && textoB && textoA === textoB) {
    const dataA = a.dataInformacao ? new Date(a.dataInformacao).toISOString() : "";
    const dataB = b.dataInformacao ? new Date(b.dataInformacao).toISOString() : "";
    if (dataA && dataB && dataA === dataB) return true;
    if (!dataA || !dataB) return true;
  }

  return false;
}

function mesmaMovimentacaoLogica(a: Partial<MovimentacaoEstruturaInput>, b: Partial<MovimentacaoEstruturaInput>): boolean {
  const dossieIgual = (a.dossieId ?? "") === (b.dossieId ?? "");
  if (!dossieIgual) return false;

  const momentoA = a.momento ? new Date(a.momento).toISOString() : "";
  const momentoB = b.momento ? new Date(b.momento).toISOString() : "";
  const tipoA = (a.tipo ?? "").trim();
  const tipoB = (b.tipo ?? "").trim();

  const tituloA = normalizarConteudoParaHash(a.titulo ?? "");
  const tituloB = normalizarConteudoParaHash(b.titulo ?? "");

  if (tituloA && tituloB && tituloA === tituloB) {
    if (momentoA && momentoB && momentoA === momentoB) return true;
    if (!momentoA || !momentoB) return true;
    if (tipoA && tipoB && tipoA === tipoB && (!momentoA || !momentoB)) return true;
  }

  const textoA = normalizarConteudoParaHash([a.titulo, a.descricao].filter(Boolean).join(" "));
  const textoB = normalizarConteudoParaHash([b.titulo, b.descricao].filter(Boolean).join(" "));
  if (textoA && textoB && textoA === textoB) {
    if (momentoA && momentoB && momentoA === momentoB) return true;
    if (!momentoA || !momentoB) return true;
  }

  return false;
}

export function deduplicarEvidencias<T extends EvidenciaEstruturaInput>(items: T[]): T[] {
  const vistos = new Set<string>();
  return items.filter((item) => {
    const hash = gerarHashEvidencia(item);
    if (vistos.has(hash)) return false;
    vistos.add(hash);
    return true;
  });
}

export function deduplicarMovimentacoes<T extends MovimentacaoEstruturaInput>(items: T[]): T[] {
  const vistos = new Set<string>();
  return items.filter((item) => {
    const hash = gerarHashMovimentacao(item);
    if (vistos.has(hash)) return false;
    vistos.add(hash);
    return true;
  });
}

export function upsertDossieEvidencia<T extends EvidenciaEstruturaInput>(
  registros: T[],
  item: T,
): T[] {
  const hash = gerarHashEvidencia(item);
  const dossieId = item.dossieId ?? "";
  const index = registros.findIndex((registro) => {
    const mesmoDossie = (registro.dossieId ?? "") === dossieId;
    if (!mesmoDossie) return false;
    return gerarHashEvidencia(registro) === hash;
  });

  if (index >= 0) {
    const clone = [...registros];
    clone[index] = { ...registros[index], ...item } as T;
    return clone;
  }

  return [...registros, item];
}

export function upsertAtualizacaoDossie<T extends {
  dossieId?: string | null;
  tipo?: string | null;
  titulo?: string | null;
  conteudo?: string | null;
  agente?: string | null;
  fonte?: string | null;
  link?: string | null;
}>(
  registros: T[],
  item: T,
): T[] {
  const chave = [
    item.dossieId ?? "",
    item.tipo ?? "",
    item.titulo ?? "",
    item.conteudo ?? "",
    item.agente ?? "",
    item.fonte ?? "",
    item.link ?? "",
  ].join("::");

  const index = registros.findIndex((registro) => {
    const registroChave = [
      registro.dossieId ?? "",
      registro.tipo ?? "",
      registro.titulo ?? "",
      registro.conteudo ?? "",
      registro.agente ?? "",
      registro.fonte ?? "",
      registro.link ?? "",
    ].join("::");
    return registroChave === chave;
  });

  if (index >= 0) {
    const clone = [...registros];
    clone[index] = item;
    return clone;
  }

  return [...registros, item];
}

export type DossieEvidenciaPersistida = {
  id?: string;
  dossieId: string;
  obraId?: string | null;
  tipo: string;
  titulo: string;
  descricao?: string | null;
  fonteTipo?: string | null;
  fonteNome?: string | null;
  url?: string | null;
  dataInformacao?: Date | string | null;
  confianca?: string | null;
  estado?: string | null;
  hashConteudo?: string | null;
  hashUrl?: string | null;
  conteudoBruto?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

function montarWhereEvidenciaCanonica(dossieId: string, hashUrl: string | null, hashConteudo: string | null) {
  const candidatos: Array<Record<string, unknown>> = [];

  if (hashUrl) {
    candidatos.push({ dossieId, hashUrl });
  }
  if (hashConteudo) {
    candidatos.push({ dossieId, hashConteudo });
  }

  if (candidatos.length === 0) {
    return {
      dossieId,
      titulo: { equals: "", mode: "insensitive" as const },
    };
  }

  return {
    dossieId,
    OR: candidatos,
  };
}

export async function upsertDossieEvidenciaPersistida(
  dossieId: string,
  input: {
    obraId?: string | null;
    tipo: string;
    titulo: string;
    descricao?: string | null;
    fonteTipo?: string | null;
    fonteNome?: string | null;
    url?: string | null;
    dataInformacao?: Date | string | null;
    confianca?: string | null;
    estado?: string | null;
  },
  prismaClient: {
    dossieEvidencia: {
      findFirst: (args: any) => Promise<any | null>;
      findMany?: (args: any) => Promise<any[]>;
      upsert: (args: any) => Promise<any>;
      create: (args: any) => Promise<any>;
    };
  },
): Promise<any> {
  if (!dossieId?.trim()) {
    throw new Error("dossieId obrigatório");
  }

  const urlNormalizada = normalizarUrlParaHash(input.url ?? null);
  const textoNormalizado = normalizarConteudoParaHash([input.titulo, input.descricao].filter(Boolean).join(" "));
  const hashConteudo = textoNormalizado ? hashTexto(textoNormalizado) : null;
  const hashUrl = urlNormalizada ? hashTexto(urlNormalizada) : null;

  const buscaCanonica = await prismaClient.dossieEvidencia.findFirst({
    where: montarWhereEvidenciaCanonica(dossieId, hashUrl, hashConteudo),
    orderBy: { createdAt: "desc" },
  });

  const candidatosLegados = prismaClient.dossieEvidencia.findMany
    ? await prismaClient.dossieEvidencia.findMany({
        where: { dossieId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const existente = buscaCanonica ?? candidatosLegados.find((registro) =>
    mesmaEvidenciaLogica(
      {
        dossieId: registro.dossieId,
        titulo: registro.titulo,
        descricao: registro.descricao,
        url: registro.url,
        dataInformacao: registro.dataInformacao,
      },
      {
        dossieId,
        titulo: input.titulo,
        descricao: input.descricao,
        url: input.url,
        dataInformacao: input.dataInformacao,
      },
    )
  ) ?? null;

  const dadosComuns = {
    dossieId,
    obraId: input.obraId ?? null,
    tipo: input.tipo,
    titulo: input.titulo,
    descricao: input.descricao ?? null,
    fonteTipo: input.fonteTipo ?? "OUTRA",
    fonteNome: input.fonteNome ?? null,
    url: input.url ?? null,
    dataInformacao: input.dataInformacao ? new Date(input.dataInformacao) : null,
    confianca: input.confianca ?? "SINAL",
    estado: input.estado ?? "ATIVA",
    hashConteudo,
    hashUrl,
    conteudoBruto: input.descricao ?? null,
  };

  if (existente) {
    const updates: Record<string, unknown> = {};
    for (const [campo, valor] of Object.entries(dadosComuns)) {
      if (valor == null) continue;
      if ((existente as Record<string, unknown>)[campo] !== valor) {
        updates[campo] = valor;
      }
    }

    if (Object.keys(updates).length === 0) {
      return existente;
    }

    return prismaClient.dossieEvidencia.upsert({
      where: { id: existente.id },
      update: updates,
      create: { ...dadosComuns, id: existente.id },
    });
  }

  return prismaClient.dossieEvidencia.create({
    data: dadosComuns,
  });
}

export function gerarHashMovimentacaoPersistida(input: {
  dossieId?: string | null;
  obraId?: string | null;
  tipo?: string | null;
  titulo?: string | null;
  descricao?: string | null;
  momento?: Date | string | null;
}): string {
  return hashTexto([
    input.dossieId ?? "",
    input.obraId ?? "",
    input.tipo ?? "",
    input.momento ? new Date(input.momento).toISOString() : "",
    normalizarConteudoParaHash([input.titulo, input.descricao].filter(Boolean).join(" ")) ?? "",
  ].join("|"));
}

export async function upsertDossieMovimentacaoPersistida(
  input: {
    dossieId: string;
    obraId?: string | null;
    tipo: string;
    titulo: string;
    descricao?: string | null;
    momento?: Date | string | null;
    relevancia?: number;
    status?: string;
  },
  prismaClient: {
    dossieMovimentacao: {
      findFirst: (args: any) => Promise<any | null>;
      findMany?: (args: any) => Promise<any[]>;
      upsert: (args: any) => Promise<any>;
      create: (args: any) => Promise<any>;
    };
  },
): Promise<any> {
  if (!input.dossieId?.trim()) {
    throw new Error("dossieId obrigatório");
  }

  const hashUnico = gerarHashMovimentacaoPersistida(input);
  const buscaCanonica = await prismaClient.dossieMovimentacao.findFirst({
    where: {
      dossieId: input.dossieId,
      hashUnico,
    },
  });

  const candidatosLegados = prismaClient.dossieMovimentacao.findMany
    ? await prismaClient.dossieMovimentacao.findMany({
        where: { dossieId: input.dossieId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const existente = buscaCanonica ?? candidatosLegados.find((registro) =>
    mesmaMovimentacaoLogica(
      {
        dossieId: registro.dossieId,
        titulo: registro.titulo,
        descricao: registro.descricao,
        momento: registro.momento,
      },
      {
        dossieId: input.dossieId,
        titulo: input.titulo,
        descricao: input.descricao,
        momento: input.momento,
      },
    )
  ) ?? null;

  const dadosComuns = {
    dossieId: input.dossieId,
    obraId: input.obraId ?? null,
    tipo: input.tipo,
    titulo: input.titulo,
    descricao: input.descricao ?? null,
    momento: input.momento ? new Date(input.momento) : null,
    relevancia: input.relevancia ?? 0,
    status: input.status ?? "ATIVA",
    hashUnico,
  };

  if (existente) {
    const updates: Record<string, unknown> = {};
    for (const [campo, valor] of Object.entries(dadosComuns)) {
      if (valor == null) continue;
      if ((existente as Record<string, unknown>)[campo] !== valor) {
        updates[campo] = valor;
      }
    }

    if (Object.keys(updates).length === 0) {
      return existente;
    }

    return prismaClient.dossieMovimentacao.upsert({
      where: { id: existente.id },
      update: updates,
      create: { ...dadosComuns, id: existente.id },
    });
  }

  return prismaClient.dossieMovimentacao.create({
    data: dadosComuns,
  });
}

export async function upsertAtualizacaoDossiePersistida(
  prismaClient: {
    atualizacaoDossie: {
      findFirst: (args: any) => Promise<any | null>;
      upsert: (args: any) => Promise<any>;
      create: (args: any) => Promise<any>;
    };
  },
  item: {
    dossieId: string;
    tipo: string;
    titulo: string;
    conteudo: string;
    agente?: string | null;
    fonte?: string | null;
    link?: string | null;
  },
): Promise<any> {
  const normalized = {
    dossieId: item.dossieId,
    tipo: item.tipo,
    titulo: item.titulo.trim(),
    conteudo: item.conteudo.trim(),
    agente: item.agente ?? null,
    fonte: item.fonte ?? null,
    link: item.link ?? null,
  };

  const existente = await prismaClient.atualizacaoDossie.findFirst({
    where: {
      dossieId: normalized.dossieId,
      tipo: normalized.tipo,
      titulo: normalized.titulo,
      conteudo: normalized.conteudo,
      agente: normalized.agente,
      fonte: normalized.fonte,
      link: normalized.link,
    },
  });

  if (existente) return existente;

  return prismaClient.atualizacaoDossie.create({
    data: normalized,
  });
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function toNumericValue(value: DecimalLike | null | undefined): number | null {
  if (value == null || value === "") return null;
  const raw = typeof value === "string" || typeof value === "number" ? String(value) : value.toString();
  const num = Number(raw.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(num) ? num : null;
}

export function calcularPotencialVilla(dossie: DossieEstruturaInput): number {
  let score = 0;

  if (dossie.clienteFinal?.trim()) score += 20;
  if (dossie.construtora?.trim()) score += 20;
  if (dossie.epc?.trim() || dossie.epcm?.trim()) score += 20;
  if (toNumericValue(dossie.valorEstimado) != null) score += 15;
  if (toNumericValue(dossie.volumeConcreto) != null) score += 10;
  if (dossie.cidade && dossie.estado) score += 10;
  if (dossie.segmento && /mcmv|habitacao|residencial|habita[cç][aã]o/.test(normalizarTexto(dossie.segmento))) score += 5;

  return clamp(score);
}

export function calcularMomentoVilla(dossie: DossieEstruturaInput): number | null {
  const fase = normalizarTexto(dossie.faseObra);
  const temEvidenciaTemporal = Boolean(
    fase && /(licenciamento|mobilizacao|terraplenagem|fundacao|concretagem|estrutura|execucao|obra|inicio|iniciada|conclusao)/.test(fase)
      || dossie.licenciamento?.trim()
      || dossie.cronograma?.trim()
  );

  if (!temEvidenciaTemporal) {
    return null;
  }

  let score = 0;
  if (/(licenciamento|mobilizacao|terraplenagem|fundacao|concretagem|estrutura|execucao|inicio|iniciada|conclusao)/.test(fase)) score += 30;
  if (dossie.licenciamento?.trim()) score += 25;
  if (dossie.cronograma?.trim()) score += 25;
  if (dossie.equipamentosSugeridos?.trim()) score += 10;
  if (dossie.campanhasSugerida?.trim()) score += 5;
  if (dossie.concorrentes?.trim()) score += 5;

  return clamp(score);
}

export function calcularProntidao(dossie: DossieEstruturaInput): number {
  let score = 0;
  const checks = [
    !!dossie.clienteFinal?.trim(),
    !!dossie.construtora?.trim(),
    !!(dossie.epc?.trim() || dossie.epcm?.trim()),
    !!(dossie.cidade && dossie.estado),
    !!dossie.valorEstimado,
    !!dossie.faseObra?.trim(),
    !!dossie.licenciamento?.trim(),
    !!dossie.equipamentosSugeridos?.trim(),
  ];

  score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  return clamp(score);
}

export function calcularPotencialMcmv(dossie: DossieEstruturaInput): number {
  const text = normalizarTexto([
    dossie.segmento,
    dossie.resumo,
    dossie.clienteFinal,
    dossie.construtora,
    dossie.cidade,
    dossie.estado,
  ].join(" "));

  let score = 0;
  if (/(mcmv|minha casa minha vida|habitacao|residencial)/.test(text)) score += 45;
  if (dossie.clienteFinal?.trim()) score += 20;
  if (dossie.construtora?.trim()) score += 15;
  if (toNumericValue(dossie.valorEstimado) != null) score += 15;
  if (dossie.faseObra && /licenciamento|lancamento|mobilizacao|concretagem/.test(normalizarTexto(dossie.faseObra))) score += 5;
  return clamp(score);
}

export function calcularMomentoMcmv(dossie: DossieEstruturaInput): number {
  let score = 0;
  const fase = normalizarTexto(dossie.faseObra);
  if (/(licenciamento|lancamento|mobilizacao|concretagem)/.test(fase)) score += 50;
  if (dossie.licenciamento?.trim()) score += 20;
  if (dossie.cronograma?.trim()) score += 15;
  if (toNumericValue(dossie.volumeConcreto) != null) score += 15;
  return clamp(score);
}

export function calcularPrioridadeJoao(input: DossieEstruturaInput): ScoreJoaoEstrutura {
  const potencialVilla = calcularPotencialVilla(input);
  const momentoVilla = calcularMomentoVilla(input);
  const prontidao = calcularProntidao(input);
  const potencialMcmv = calcularPotencialMcmv(input);
  const momentoMcmv = calcularMomentoMcmv(input);
  const prioridadeMcmv = clamp(Math.round(potencialMcmv * 0.55 + momentoMcmv * 0.45));

  let prioridadeJoao: number | null = null;
  let motivoPrioridade = "Potencial relevante, mas sem evidência temporal suficiente para indicar momento real de compra ou obra em andamento.";

  if (momentoVilla !== null) {
    prioridadeJoao = clamp(Math.round(potencialVilla * 0.45 + momentoVilla * 0.3 + prontidao * 0.25));

    if (prioridadeJoao >= 75) motivoPrioridade = "A obra já tem sinal claro de oportunidade e merece acompanhamento ativo.";
    else if (prioridadeJoao >= 50) motivoPrioridade = "Há um conjunto útil de sinais, mas ainda falta validação do decisor e do cronograma.";
    else if (prioridadeJoao >= 25) motivoPrioridade = "Há interesse inicial, porém a obra ainda precisa de consolidação de dados.";
    else motivoPrioridade = "Baixa evidência comercial para atuação imediata.";
  }

  return {
    potencialVilla,
    momentoVilla,
    prontidao,
    prioridadeJoao,
    potencialMcmv,
    momentoMcmv,
    prioridadeMcmv,
    motivoPrioridade,
  };
}

export function exportarScoresJoaoParaPersistencia(dossie: DossieEstruturaInput): {
  potencialVilla: number;
  momentoVilla: number | null;
  prontidao: number;
  prioridadeJoao: number | null;
  motivoPrioridade: string;
} {
  const resultado = calcularPrioridadeJoao(dossie);
  return {
    potencialVilla: resultado.potencialVilla,
    momentoVilla: resultado.momentoVilla,
    prontidao: resultado.prontidao,
    prioridadeJoao: resultado.prioridadeJoao,
    motivoPrioridade: resultado.motivoPrioridade,
  };
}

export function montarPayloadAtualizacaoJoao(
  dossie: DossieEstruturaInput,
  camposExtras: Record<string, unknown> = {},
  metadados: Record<string, unknown> = {},
): Record<string, unknown> {
  const scores = exportarScoresJoaoParaPersistencia(dossie);
  const payload: Record<string, unknown> = {
    ...camposExtras,
    ...scores,
    ...metadados,
  };

  const whitelist = new Set([
    "id",
    "titulo",
    "resumo",
    "origem",
    "tipo",
    "status",
    "segmento",
    "cidade",
    "estado",
    "clienteFinal",
    "construtora",
    "epc",
    "epcm",
    "consorcio",
    "faseObra",
    "cronograma",
    "licenciamento",
    "valorEstimado",
    "volumeConcreto",
    "equipamentosSugeridos",
    "campanhasSugerida",
    "proximaAcaoSugerida",
    "concorrentes",
    "fornecedores",
    "concreteiras",
    "fonteInformacao",
    "linkFonte",
    "score",
    "completude",
    "maturidadeComercial",
    "prioridade",
    "potencialVilla",
    "momentoVilla",
    "prontidao",
    "prioridadeJoao",
    "motivoPrioridade",
    "missaoAtual",
    "totalDecisores",
    "totalEmpresas",
    "totalNoticias",
    "totalAtualizacoes",
    "empresaId",
    "obraId",
    "oportunidadeId",
    "assumidoPorId",
    "assumidaEm",
    "motivoDescarte",
    "criadoPorAgente",
    "ultimaAtividade",
    "createdAt",
    "updatedAt",
  ]);

  for (const key of Object.keys(payload)) {
    if (!whitelist.has(key)) {
      delete payload[key];
    }
  }

  return payload;
}

export function analisarDossieEstrutura(dossie: DossieEstruturaInput): ScoreJoaoEstrutura {
  return calcularPrioridadeJoao(dossie);
}
