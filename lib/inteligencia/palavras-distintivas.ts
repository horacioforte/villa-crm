// ARQUIVO: lib/inteligencia/palavras-distintivas.ts
// REGRA: nunca remover. Apenas acrescentar.
// Função pura (sem Prisma) pra poder ser usada tanto por código que usa o Prisma
// (lib/inteligencia/historico-oportunidades.ts) quanto por scripts que falam
// direto com o Postgres via `pg` (scripts/reclassificar-maturidade.ts).

function normalizar(s: string): string {
  return s
    // "[Pilar 1 / Grandes Indústrias]" etc. são rótulos de categoria do radar, não
    // identificam o projeto — sem isso, "Nova Fábrica Nestlé" e "Complexo Industrial
    // Toyota" batem só por compartilhar o colchete, sem nenhuma obra em comum.
    .replace(/\[[^\]]*\]/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Palavras genéricas demais pra servirem de indício de que é a MESMA obra/empresa
// (nome do agente, estrutura do título do radar, categoria/setor, termos de obra em geral).
const PALAVRAS_GENERICAS = new Set([
  "OBRA", "OBRAS", "RADAR", "JOAO", "JOÃO", "PILAR", "PROJETO", "PROJETOS", "FASE", "FASES",
  "EXPANSAO", "EXPANSÃO", "AMPLIACAO", "AMPLIAÇÃO", "COMPLEXO", "CONTRATO", "CONTRATOS",
  "EMPREENDIMENTO", "EMPREENDIMENTOS", "CONSTRUCAO", "CONSTRUÇÃO", "ENGENHARIA", "REFORMA",
  "TREM", "LOTE", "TRECHO", "BLOCO", "ETAPA", "ETAPAS", "MODULO", "MÓDULO", "UNIDADE",
  "LTDA", "LTDA.", "SA", "S.A.", "S/A", "CIA", "COMPANHIA", "PARA", "COM", "DOS", "DAS", "DO", "DA", "DE",
  // Categorias/setores do radar — recorrem em dezenas de obras sem relação entre si.
  "NOVA", "NOVO", "GRANDES", "INDUSTRIA", "INDUSTRIAS", "INDÚSTRIA", "INDÚSTRIAS",
  "INDUSTRIAL", "FABRICA", "FÁBRICA", "FABRICAS", "FÁBRICAS", "AEROPORTO", "AEROPORTOS",
  "PORTO", "PORTOS", "TERMINAL", "TERMINAIS", "SANEAMENTO", "CELULOSE", "PAPEL",
  "MUNICIPIO", "MUNICÍPIO", "MUNICIPIOS", "MUNICÍPIOS", "USINA", "USINAS", "HIDRELETRICA",
  "HIDRELÉTRICA", "HIDRELETRICAS", "HIDRELÉTRICAS", "FERROVIA", "FERROVIAS", "RODOVIA",
  "RODOVIAS", "MINERACAO", "MINERAÇÃO", "ENERGIA", "DATA", "CENTER", "CENTERS", "CAMPUS", "CAIS",
]);

/** Palavras distintivas do título (4+ letras, não genéricas, sem acento, maiúsculas, sem repetição). */
export function palavrasDistintivas(titulo: string): string[] {
  const n = normalizar(titulo);
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const palavra of n.split(" ")) {
    if (palavra.length < 4) continue;
    if (/^\d+$/.test(palavra)) continue; // números soltos (ex.: "2029") não são indício de obra
    if (PALAVRAS_GENERICAS.has(palavra)) continue;
    if (vistas.has(palavra)) continue;
    vistas.add(palavra);
    out.push(palavra);
  }
  return out;
}
