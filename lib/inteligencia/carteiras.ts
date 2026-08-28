export type CarteiraEstrategica =
  | "MCMV"
  | "CONSTRUTORA_BRASIL"
  | "CONCRETEIRAS"
  | "PRE_MOLDADOS"
  | "REVENDAS_CAMINHOES";

export type CarteiraJoaoConfig = {
  carteira: CarteiraEstrategica;
  slug: string;
  label: string;
  title: string;
  description: string;
};

export type CarteiraExtra = {
  label: string;
  value: string;
};

export type DossieCarteiraInput = {
  id?: string;
  titulo?: string | null;
  resumo?: string | null;
  segmento?: string | null;
  cidade?: string | null;
  estado?: string | null;
  clienteFinal?: string | null;
  construtora?: string | null;
  epc?: string | null;
  epcm?: string | null;
  faseObra?: string | null;
  valorEstimado?: number | string | null;
  proximaAcaoSugerida?: string | null;
  equipamentosSugeridos?: string | null;
  concorrentes?: string | null;
  concreteiras?: string | null;
  empresasRelacionadas?: Array<{ razaoSocial?: string | null; papel?: string | null }> | null;
};

const CARTEIRAS: Array<{ carteira: CarteiraEstrategica; slug: string; label: string; title?: string; description?: string }> = [
  { carteira: "CONSTRUTORA_BRASIL", slug: "construtoras-brasil", label: "Construtoras", title: "Construtoras", description: "Carteira de construtoras monitoradas no radar do João." },
  { carteira: "MCMV", slug: "mcmv", label: "Minha Casa Minha Vida", title: "Minha Casa Minha Vida", description: "Monitoramento de construtoras e empreendimentos com foco em MCMV." },
  { carteira: "PRE_MOLDADOS", slug: "pre-moldados", label: "Pré-moldados", title: "Pré-moldados", description: "Foco em fabricantes e expansão de fábricas de elementos pré-moldados." },
  { carteira: "CONCRETEIRAS", slug: "concreteiras", label: "Concreteiras", title: "Concreteiras", description: "Acompanhamento de plantas, compras e expansão de concreteiras." },
  { carteira: "REVENDAS_CAMINHOES", slug: "revendas-caminhoes", label: "Agência de Caminhões", title: "Agência de Caminhões", description: "Monitoramento de revendas, concessionárias e movimentação no mercado de caminhões." },
];

export const CARTEIRAS_JOAO = CARTEIRAS;

export function getCarteiraMetaBySlug(slug: string): { carteira: CarteiraEstrategica; slug: string; label: string; title: string; description: string } | undefined {
  return CARTEIRAS.find((item) => item.slug === slug) as { carteira: CarteiraEstrategica; slug: string; label: string; title: string; description: string } | undefined;
}

export function normalizarTexto(value?: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairPrimeiroNumeroAntes(text: string, palavra: string): string | null {
  const match = new RegExp(`(\\d+(?:[\\.,]\\d+)?)\\s*${palavra}`, "i").exec(text);
  return match ? match[1].replace(",", ".") : null;
}

function extrairTrecho(text: string, palavras: string[]): string | null {
  const normalized = normalizarTexto(text);
  for (const palavra of palavras) {
    const idx = normalized.indexOf(normalizarTexto(palavra));
    if (idx !== -1) {
      const inicio = Math.max(0, idx - 40);
      const fim = Math.min(normalized.length, idx + 120);
      const trecho = normalized.slice(inicio, fim).replace(/\s+/g, " ").trim();
      if (trecho) return trecho;
    }
  }
  return null;
}

export function classificarDossieEmCarteiras(dossie: DossieCarteiraInput): Array<{ carteira: CarteiraEstrategica; evidencias: string[] }> {
  const text = [
    dossie.titulo,
    dossie.resumo,
    dossie.segmento,
    dossie.clienteFinal,
    dossie.construtora,
    dossie.epc,
    dossie.epcm,
    dossie.faseObra,
    dossie.proximaAcaoSugerida,
    dossie.equipamentosSugeridos,
    dossie.concorrentes,
    dossie.concreteiras,
    dossie.empresasRelacionadas?.map((empresa) => empresa.razaoSocial).join(" "),
  ].filter(Boolean).join(" ");

  const normalized = normalizarTexto(text);
  const resultados: Array<{ carteira: CarteiraEstrategica; evidencias: string[] }> = [];

  const add = (carteira: CarteiraEstrategica, evidencias: string[]) => {
    if (!evidencias.length) return;
    resultados.push({ carteira, evidencias: [...new Set(evidencias)] });
  };

  const hasGenericIndustrialNoise = /(porto|aeroporto|terminal|data center|biorrefinaria|automotiva|etanol|saneamento|usina|transportadora|logistica|obras|infraestrutura|pista|fundacao)/.test(normalized);

  const mcmvSignals = /(mcmv|minha casa|minha casa minha vida|habitacao|habita[cç][aã]o|residencial|conjunto habitacional|empreendimento habitacional|unidades de moradia|unidades mcmv)/.test(normalized);
  if (mcmvSignals && !hasGenericIndustrialNoise) {
    add("MCMV", ["mcmv", "minha casa minha vida", "habitação", "residencial"]
      .filter((item) => normalized.includes(normalizarTexto(item))));
  }

  const construtoraBoa = /(incorporadora|incorpora[cç][aã]o|empreendimento|residencial|loteamento|condominio|condom[ií]nio|multifamiliar)/.test(normalized);
  const construtoraAcepta = construtoraBoa && !/(mcmv|minha casa|habitacao|habita[cç][aã]o|porto|aeroporto|automotiva|etanol|biorrefinaria|cargo|terminal|data center|logistica|transportadora)/.test(normalized);
  if (construtoraAcepta) {
    add("CONSTRUTORA_BRASIL", ["incorporadora", "incorporação", "empreendimento", "residencial", "loteamento", "condomínio", "multifamiliar"]
      .filter((item) => normalized.includes(normalizarTexto(item))));
  }

  const concreteiraSignals = /(concreteira|central de concreto|central dosadora|betoneira|dosadora de concreto|concreto usinado|fornecedor de concreto|concreto.*(central|planta|usina)|planta.*concreto)/.test(normalized);
  const concreteiraReject = /(automotiva|f[aá]brica.*(carro|ve[ií]culo)|biorrefinaria|porto|aeroporto|saneamento|etanol|construtora.*(n[aã]o|sem) concreto|data center|pista|terminal|logistica|transportadora)/.test(normalized);
  if (concreteiraSignals && !concreteiraReject) {
    add("CONCRETEIRAS", ["concreteira", "central de concreto", "betoneira", "concreto usinado", "planta de concreto", "dosadora de concreto"]
      .filter((item) => normalized.includes(normalizarTexto(item))));
  }

  const preMoldadoSignals = /(pre[- ]?moldado|pr[eé][- ]?moldado|pre[- ]?fabricado|pr[eé][- ]?fabricado|pilar|viga|laje|painel|bloco)/.test(normalized);
  const preMoldadoReject = /(automotiva|porto|aeroporto|data center|usina|etanol|cimenteira|cimento|construtor|habita[cç][aã]o|mcmv|transportadora|logistica|f[aá]brica industrial)/.test(normalized);
  if (preMoldadoSignals && !preMoldadoReject) {
    add("PRE_MOLDADOS", ["pré-moldado", "pre moldado", "pré-fabricado", "pre fabricado", "pilar", "painel", "viga", "laje", "bloco"]
      .filter((item) => normalized.includes(normalizarTexto(item))));
  }

  const agenciaSignals = /(concession[aá]ria|revenda|revendedora|multimarcas|ve[ií]culo pesado|caminh[aã]o|caminh[oõ]es|frota|truck|trucks|distribuidora.*caminh[aã]o|ve[ií]culos pesados)/.test(normalized);
  const agenciaReject = /(porto|aeroporto|logistica|transportadora|obra|construtora|data center|hidro|automotiva|industrial|terminal|pista|biorrefinaria|etanol)/.test(normalized);
  if (agenciaSignals && !agenciaReject) {
    add("REVENDAS_CAMINHOES", ["revenda", "concessionária", "caminhão", "veículo pesado", "frota", "truck"]
      .filter((item) => normalized.includes(normalizarTexto(item))));
  }

  return resultados.filter((item) => item.evidencias.length > 0);
}

export function buildCarteiraExtras(dossie: DossieCarteiraInput, carteira: CarteiraEstrategica): CarteiraExtra[] {
  const extras: CarteiraExtra[] = [];

  const add = (label: string, value?: string | null) => {
    if (!value || !String(value).trim() || String(value).trim() === "-") return;
    extras.push({ label, value: String(value).trim() });
  };

  const empresaBase = dossie.clienteFinal || dossie.construtora || dossie.titulo || "";
  const baseText = normalizarTexto([
    dossie.titulo,
    dossie.resumo,
    dossie.faseObra,
    dossie.proximaAcaoSugerida,
    dossie.equipamentosSugeridos,
  ].join(" "));

  switch (carteira) {
    case "MCMV": {
      add("Empreendimento", dossie.clienteFinal || dossie.construtora || dossie.titulo);
      add("Fase da obra", dossie.faseObra);
      const unidades = extrairPrimeiroNumeroAntes(baseText, "unidades");
      if (unidades) add("Unidades", `${unidades} unidades`);
      break;
    }
    case "CONSTRUTORA_BRASIL": {
      add("Obras detectadas", dossie.titulo || dossie.clienteFinal);
      add("Movimentação relevante", dossie.proximaAcaoSugerida || dossie.resumo);
      break;
    }
    case "CONCRETEIRAS": {
      add("Unidade / planta", dossie.clienteFinal || dossie.construtora || dossie.titulo);
      add("Expansão", extrairTrecho([dossie.resumo, dossie.titulo].join(" "), ["expansao", "expansão", "nova unidade", "nova planta", "filial"]) || undefined);
      add("Frota", dossie.equipamentosSugeridos || dossie.concreteiras);
      break;
    }
    case "PRE_MOLDADOS": {
      add("Fábrica / unidade", dossie.clienteFinal || dossie.construtora || dossie.titulo);
      add("Expansão", extrairTrecho([dossie.resumo, dossie.titulo].join(" "), ["expansao", "expansão", "nova linha", "ampliacao", "ampliação"]) || undefined);
      add("Equipamentos", dossie.equipamentosSugeridos);
      break;
    }
    case "REVENDAS_CAMINHOES": {
      const regiao = [dossie.cidade, dossie.estado].filter(Boolean).join(" / ");
      add("Região de atuação", regiao || empresaBase);
      add("Marcas / perfil", dossie.segmento || dossie.construtora || dossie.titulo);
      add("Potencial de parceria", dossie.proximaAcaoSugerida || dossie.resumo);
      break;
    }
    default:
      break;
  }

  return extras.filter((extra) => extra.value && extra.value.length > 0);
}

export const CARTEIRAS_DISPONIVEIS = CARTEIRAS;
