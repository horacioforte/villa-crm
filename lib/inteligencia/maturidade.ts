// ARQUIVO: lib/inteligencia/maturidade.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Função central de maturidade da investigação do João.
// UMA ÚNICA FONTE DE VERDADE — consumida pelo Kanban, API, página individual
// e script de reclassificação.
//
// Mapeamento StatusDossie → Nível visual (sem migration):
//   INVESTIGANDO         → 🔎 Investigação A (início)
//   AGUARDANDO_VALIDACAO → 🧠 Investigação B (estruturada)
//   EM_ANALISE           → 🎯 Investigação C (avançada / reta final)
//   PRONTO_PARA_ASSUMIR  → 🟢 Pronto para Morgana
//   ASSUMIDO             → 🟣 Oportunidade Gerada
//   ARQUIVADO            → (oculto no Kanban principal)
//
// Thresholds (baseados em análise da fórmula de completude):
//   A:      completude   0–19%
//   B:      completude  20–44%
//   C:      completude  45–69%
//   Pronto: completude ≥ 70% + gates obrigatórios

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type NivelStatusDossie =
  | "INVESTIGANDO"        // Nível A
  | "AGUARDANDO_VALIDACAO" // Nível B
  | "EM_ANALISE"          // Nível C
  | "PRONTO_PARA_ASSUMIR" // Pronto para Morgana
  | "ASSUMIDO"            // Oportunidade Gerada
  | "ARQUIVADO";

export type NivelLabel = "A" | "B" | "C" | "PRONTO" | "OPORTUNIDADE" | "ARQUIVADO";

export interface DossieParaMaturidade {
  clienteFinal?: string | null;
  construtora?: string | null;
  epc?: string | null;
  epcm?: string | null;
  faseObra?: string | null;
  cronograma?: string | null;
  licenciamento?: string | null;
  valorEstimado?: unknown;
  volumeConcreto?: unknown;
  equipamentosSugeridos?: string | null;
  campanhasSugerida?: string | null;
  concorrentes?: string | null;
  cidade?: string | null;
  estado?: string | null;
  completude?: number | null;
  totalDecisores?: number | null;
  score?: number | null;
  potencialVilla?: number | null;
  momentoVilla?: number | null;
  prontidao?: number | null;
}

export interface DecisorParaMaturidade {
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  linkedin?: string | null;
}

export interface ResultadoMaturidade {
  /** Status do banco que representa este nível */
  statusDb: NivelStatusDossie;
  /** Label curto do nível */
  nivel: NivelLabel;
  /** Completude usada para o cálculo */
  completude: number;
  /** Gates obrigatórios para Pronto que foram atendidos */
  gatesAtendidos: string[];
  /** Gates obrigatórios para Pronto que faltam */
  gatesFaltantes: string[];
  /** Critérios necessários para avançar ao próximo nível */
  criteriosParaProximo: string[];
  /** Motivo do nível atual em texto curto */
  motivo: string;
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

export const THRESHOLDS = {
  B: 20,    // completude ≥ 20% → Nível B
  C: 45,    // completude ≥ 45% → Nível C
  PRONTO: 70, // completude ≥ 70% → candidato a Pronto (+ gates)
} as const;

// ─── Gates do Pronto para Morgana ─────────────────────────────────────────────
// Cada gate é um requisito obrigatório.
// Completude ≥ THRESHOLDS.PRONTO é condição necessária mas não suficiente.

function avaliarGates(dossie: DossieParaMaturidade, decisores: DecisorParaMaturidade[]): {
  atendidos: string[];
  faltantes: string[];
} {
  const atendidos: string[] = [];
  const faltantes: string[] = [];

  const add = (ok: boolean, label: string) => {
    if (ok) atendidos.push(label);
    else faltantes.push(label);
  };

  add(
    Boolean(dossie.cidade && dossie.estado),
    "Localização (cidade + estado)"
  );
  add(
    Boolean(dossie.clienteFinal?.trim()),
    "Cliente final identificado"
  );
  add(
    Boolean(dossie.construtora?.trim() || dossie.epc?.trim() || dossie.epcm?.trim()),
    "Construtora ou EPC/EPCM mapeado"
  );
  add(
    decisores.some(d => d.nome?.trim()) || (dossie.totalDecisores ?? 0) >= 1,
    "Pelo menos 1 decisor com nome"
  );

  return { atendidos, faltantes };
}

// ─── Critérios para avançar ────────────────────────────────────────────────────

function criteriosParaAvançarDeA(dossie: DossieParaMaturidade): string[] {
  const falta: string[] = [];
  if (!dossie.clienteFinal?.trim()) falta.push("Identificar o cliente final da obra ou investimento");
  if (!dossie.cidade || !dossie.estado) falta.push("Confirmar cidade e estado");
  if (falta.length === 0) falta.push("Atingir completude ≥ 20% com dados estruturais básicos");
  return falta.slice(0, 3);
}

function criteriosParaAvançarDeB(dossie: DossieParaMaturidade): string[] {
  const falta: string[] = [];
  if (!dossie.construtora?.trim() && !dossie.epc?.trim() && !dossie.epcm?.trim()) {
    falta.push("Identificar construtora ou empresa EPC/EPCM responsável");
  }
  if (!dossie.valorEstimado) falta.push("Estimar valor total do investimento");
  if (!dossie.faseObra?.trim()) falta.push("Confirmar fase atual da obra");
  if (falta.length === 0) falta.push("Atingir completude ≥ 45% com dados comerciais estruturados");
  return falta.slice(0, 3);
}

function criteriosParaAvançarDeC(
  dossie: DossieParaMaturidade,
  decisores: DecisorParaMaturidade[],
): string[] {
  const falta: string[] = [];
  const comNome = decisores.find(d => d.nome?.trim());
  const comTelefone = decisores.find(d => d.telefone?.trim());

  if (!comNome && (dossie.totalDecisores ?? 0) === 0) {
    falta.push("Identificar Diretor de Obras, Diretor de Engenharia ou Gerente de Suprimentos");
  }
  if (comNome && !comTelefone) {
    falta.push(`Descobrir telefone de ${comNome.nome ?? "decisor encontrado"}`);
  }
  if (!dossie.construtora?.trim() && !dossie.epc?.trim() && !dossie.epcm?.trim()) {
    falta.push("Identificar construtora ou EPC/EPCM");
  }
  if (falta.length === 0) falta.push("Atingir completude ≥ 70% com todos os gates obrigatórios atendidos");
  return falta.slice(0, 3);
}

// ─── calcularNivelInvestigacao ─────────────────────────────────────────────────

export function calcularNivelInvestigacao(
  dossie: DossieParaMaturidade,
  decisores: DecisorParaMaturidade[] = [],
): ResultadoMaturidade {
  const completude = typeof dossie.completude === "number" ? dossie.completude : 0;

  // Casos especiais: Oportunidade e Arquivado não são reclassificados
  // (esses statuses vêm de fora do cálculo — ação de Morgana ou descarte)
  // Quando chamada de dentro do script de reclassificação,
  // ASSUMIDO e ARQUIVADO são passados diretamente.

  // Nível A: completude < THRESHOLDS.B
  if (completude < THRESHOLDS.B) {
    return {
      statusDb: "INVESTIGANDO",
      nivel: "A",
      completude,
      gatesAtendidos: [],
      gatesFaltantes: [],
      criteriosParaProximo: criteriosParaAvançarDeA(dossie),
      motivo: `Completude ${completude}% — João ainda está formando o dossiê. Dados básicos insuficientes para investigação estruturada.`,
    };
  }

  // Nível B: completude 20–44%
  if (completude < THRESHOLDS.C) {
    return {
      statusDb: "AGUARDANDO_VALIDACAO",
      nivel: "B",
      completude,
      gatesAtendidos: [],
      gatesFaltantes: [],
      criteriosParaProximo: criteriosParaAvançarDeB(dossie),
      motivo: `Completude ${completude}% — João sabe quem é o alvo e começa a entender o caso comercialmente.`,
    };
  }

  // Nível C: completude 45–69%
  if (completude < THRESHOLDS.PRONTO) {
    return {
      statusDb: "EM_ANALISE",
      nivel: "C",
      completude,
      gatesAtendidos: [],
      gatesFaltantes: [],
      criteriosParaProximo: criteriosParaAvançarDeC(dossie, decisores),
      motivo: `Completude ${completude}% — Dossiê comercialmente relevante. João trabalha nos elementos finais para entregar à Morgana.`,
    };
  }

  // Candidato a Pronto: completude ≥ 70% → verifica gates
  const { atendidos, faltantes } = avaliarGates(dossie, decisores);

  if (faltantes.length > 0) {
    // Gates faltando: fica em C com indicação dos gates
    return {
      statusDb: "EM_ANALISE",
      nivel: "C",
      completude,
      gatesAtendidos: atendidos,
      gatesFaltantes: faltantes,
      criteriosParaProximo: faltantes,
      motivo: `Completude ${completude}% atingida, mas ${faltantes.length} gate(s) obrigatório(s) faltam para Morgana.`,
    };
  }

  // Todos os gates satisfeitos → Pronto para Morgana
  return {
    statusDb: "PRONTO_PARA_ASSUMIR",
    nivel: "PRONTO",
    completude,
    gatesAtendidos: atendidos,
    gatesFaltantes: [],
    criteriosParaProximo: [],
    motivo: `Completude ${completude}% + todos os gates atendidos. Dossiê pronto para Morgana avaliar e assumir.`,
  };
}

// ─── Labels visuais do Kanban ──────────────────────────────────────────────────

export const NIVEL_CFG: Record<NivelLabel, {
  label: string;
  descricao: string;
  emoji: string;
  textCor: string;
  bgBorder: string;
}> = {
  A: {
    label: "Investigação A",
    descricao: "João descobriu o alvo. Formando o dossiê: entidade, localização, segmento e dados básicos.",
    emoji: "🔎",
    textCor: "text-blue-700",
    bgBorder: "bg-blue-50 border-blue-200",
  },
  B: {
    label: "Investigação B",
    descricao: "João já sabe quem é o alvo. Entende o caso: cliente, construtora, EPC, valor, fase e cronograma.",
    emoji: "🧠",
    textCor: "text-amber-700",
    bgBorder: "bg-amber-50 border-amber-200",
  },
  C: {
    label: "Investigação C",
    descricao: "Dossiê relevante. João trabalha nos elementos finais: decisor, contatos, momento e evidências.",
    emoji: "🎯",
    textCor: "text-purple-700",
    bgBorder: "bg-purple-50 border-purple-200",
  },
  PRONTO: {
    label: "Pronto para Morgana",
    descricao: "Todos os gates satisfeitos. Morgana pode avaliar e transformar em oportunidade.",
    emoji: "🟢",
    textCor: "text-emerald-700",
    bgBorder: "bg-emerald-50 border-emerald-200",
  },
  OPORTUNIDADE: {
    label: "Oportunidade Gerada",
    descricao: "Morgana gerou oportunidade no pipeline comercial. Não criada automaticamente — exige ação real.",
    emoji: "🟣",
    textCor: "text-indigo-600",
    bgBorder: "bg-indigo-50 border-indigo-200",
  },
  ARQUIVADO: {
    label: "Arquivado",
    descricao: "Descartado ou fora do momento comercial.",
    emoji: "📁",
    textCor: "text-slate-400",
    bgBorder: "bg-slate-50 border-slate-100",
  },
};

/** Converte StatusDossie (DB) → NivelLabel (visual) */
export function statusParaNivel(status: string): NivelLabel {
  switch (status) {
    case "INVESTIGANDO":          return "A";
    case "AGUARDANDO_VALIDACAO":  return "B";
    case "EM_ANALISE":            return "C";
    case "PRONTO_PARA_ASSUMIR":   return "PRONTO";
    case "ASSUMIDO":              return "OPORTUNIDADE";
    case "ARQUIVADO":             return "ARQUIVADO";
    // PEDIR_MAIS_PESQUISA nunca deveria aparecer no Kanban novo
    // (reclassificado no script). Exibe como C temporariamente.
    case "PEDIR_MAIS_PESQUISA":   return "C";
    default:                      return "A";
  }
}

/** Retorna o StatusDossie para um NivelLabel */
export function nivelParaStatus(nivel: NivelLabel): string {
  switch (nivel) {
    case "A":           return "INVESTIGANDO";
    case "B":           return "AGUARDANDO_VALIDACAO";
    case "C":           return "EM_ANALISE";
    case "PRONTO":      return "PRONTO_PARA_ASSUMIR";
    case "OPORTUNIDADE": return "ASSUMIDO";
    case "ARQUIVADO":   return "ARQUIVADO";
  }
}
