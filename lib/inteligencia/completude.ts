// ARQUIVO: lib/inteligencia/completude.ts
// REGRA: nunca remover. Apenas acrescentar.
// Calcula completude (0–100) e define missão atual do João para um DossieComercial.

// ─── Tipos mínimos necessários ───────────────────────────────────────────────

interface DossieParaCalculo {
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
}

interface DecisorParaCalculo {
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  linkedin?: string | null;
}

// ─── Pesos de completude ─────────────────────────────────────────────────────
// Total: 100 pontos

const PESOS = {
  localizacao: 5,       // cidade + estado
  clienteFinal: 10,     // cliente final identificado
  construtora: 8,       // construtora identificada
  epcOuEpcm: 7,         // EPC ou EPCM identificado
  valorEstimado: 8,     // valor do investimento estimado
  faseObra: 5,          // fase atual da obra
  volumeConcreto: 5,    // volume de concreto estimado
  cronograma: 5,        // cronograma de execução
  decisorNome: 10,      // pelo menos 1 decisor com nome
  decisorTelefone: 10,  // decisor com telefone
  decisorEmail: 7,      // decisor com e-mail
  decisorLinkedin: 5,   // decisor com LinkedIn
  equipamentos: 5,      // equipamentos Villa sugeridos
  campanha: 5,          // campanha sugerida
  concorrentes: 5,      // concorrentes identificados
} as const;

// ─── calcularCompletude ───────────────────────────────────────────────────────

export function calcularCompletude(
  dossie: DossieParaCalculo,
  decisores: DecisorParaCalculo[],
): number {
  let pontos = 0;

  if (dossie.cidade && dossie.estado) pontos += PESOS.localizacao;
  if (dossie.clienteFinal?.trim())    pontos += PESOS.clienteFinal;
  if (dossie.construtora?.trim())     pontos += PESOS.construtora;
  if (dossie.epc?.trim() || dossie.epcm?.trim()) pontos += PESOS.epcOuEpcm;
  if (dossie.valorEstimado)           pontos += PESOS.valorEstimado;
  if (dossie.faseObra?.trim())        pontos += PESOS.faseObra;
  if (dossie.volumeConcreto)          pontos += PESOS.volumeConcreto;
  if (dossie.cronograma?.trim())      pontos += PESOS.cronograma;
  if (dossie.equipamentosSugeridos?.trim()) pontos += PESOS.equipamentos;
  if (dossie.campanhasSugerida?.trim())     pontos += PESOS.campanha;
  if (dossie.concorrentes?.trim())          pontos += PESOS.concorrentes;

  // Decisores
  const comNome      = decisores.find(d => d.nome?.trim());
  const comTelefone  = decisores.find(d => d.telefone?.trim());
  const comEmail     = decisores.find(d => d.email?.trim());
  const comLinkedin  = decisores.find(d => d.linkedin?.trim());

  if (comNome)     pontos += PESOS.decisorNome;
  if (comTelefone) pontos += PESOS.decisorTelefone;
  if (comEmail)    pontos += PESOS.decisorEmail;
  if (comLinkedin) pontos += PESOS.decisorLinkedin;

  return Math.min(100, Math.round(pontos));
}

// ─── definirMissaoAtual ───────────────────────────────────────────────────────

export function definirMissaoAtual(
  dossie: DossieParaCalculo,
  decisores: DecisorParaCalculo[],
  completude: number,
): string {
  // Dossiê quase completo → aguardar validação
  if (completude >= 80) {
    return "Dossiê maduro. Aguardando validação da Morgana para assumir a oportunidade.";
  }

  const comNome     = decisores.find(d => d.nome?.trim());
  const comTelefone = decisores.find(d => d.telefone?.trim());
  const comEmail    = decisores.find(d => d.email?.trim());

  // Prioridade 1: cliente final
  if (!dossie.clienteFinal?.trim()) {
    return "Descobrir o cliente final da obra ou do investimento.";
  }

  // Prioridade 2: construtora ou EPC
  if (!dossie.construtora?.trim() && !dossie.epc?.trim() && !dossie.epcm?.trim()) {
    return "Descobrir a construtora ou empresa EPC/EPCM responsável pela execução.";
  }

  // Prioridade 3: decisor com nome
  if (!comNome) {
    return "Identificar o Diretor de Obras, Diretor de Engenharia ou Gerente de Suprimentos.";
  }

  // Prioridade 4: telefone do decisor
  if (comNome && !comTelefone) {
    return `Descobrir o telefone de ${comNome.nome ?? "decisor encontrado"}.`;
  }

  // Prioridade 5: e-mail do decisor
  if (comNome && !comEmail) {
    return `Descobrir o e-mail de ${comNome.nome ?? "decisor encontrado"}.`;
  }

  // Prioridade 6: valor lestimado
  if (!dossie.valorEstimado) {
    return "Estimar o valor total do investimento ou do contrato de obras.";
  }

  // Prioridade 7: fase da obra
  if (!dossie.faseObra?.trim()) {
    return "Identificar a fase atual da obra (licenciamento, licitação, execuçã…).";
  }

  // Prioridade 8: cronograma
  if (!dossie.cronograma?.trim()) {
    return "Mapear o cronograma de execução e datas de início.";
  }

  // Prioridade 9: volume de concreto
  if (!dossie.volumeConcreto) {
    return "Estimar o volume de concreto necessário na obra.";
  }

  // Prioridade 10: equipamentos sugeridos
  if (!dossie.equipamentosSugeridos?.trim()) {
    return "Definir quais equipamentos Villa são mais indicados para essa obra.";
  }

  // Prioridade 11: concorrentes
  if (!dossie.concorrentes?.trim()) {
    return "Identificar concorrentes que já estão presentes nessa obra ou empresa.";
  }

  // Dossiê bem preenchido
  return "Aprofundar monitoramento: novas notícias, mudanças de cronograma e novos decisores.";
}

// ─── calcularMaturidadeComercial ──────────────────────────────────────────────
// O quanto faz sentido a Villa agir comercialmente sobre este dossiê.
// Diferente de completude (quanto João conhece), maturidade mede o potencial
// de ação imediata: EPC identificado, sonstrutora mapeada, decisores contatáveis,
// licenciamento avançado, valor estimado conhecido.

export function calcularMaturidadeComercial(
  dossie: DossieParaCalculo,
  decisores: DecisorParaCalculo[],
): number {
  let score = 0;

  // EPC ou EPCM identificado → +30 (maior peso: quem contrata os equipamentos)
  if (dossie.epc?.trim() || dossie.epcm?.trim()) score += 30;

  // Construtora mapeada → +20
  if (dossie.construtora?.trim()) score += 20;

  // Decisores encontrados → +20 (≩2) ou +10 (≩1)
  if (decisores.length >= 2) score += 20;
  else if (decisores.length >= 1) score += 10;

  // Licenciamento registrado → +15 (obra com licença = ação iminente)
  if (dossie.licenciamento?.trim()) score += 15;

  // Valor estimado presente → +15 (sabemos o tamanho do mercado)
  if (dossie.valorEstimado) score += 15;

  return Math.min(100, score);
}

// ─── recalcularEAtualizar ────────────────────────────────────────────────────
// Helper completo: recalcula e retorna os valores para salvar no banco.

export function recalcularDossie(
  dossie: DossieParaCalculo,
  decisores: DecisorParaCalculo[],
): { completude: number; missaoAtual: string; maturidadeComercial: number } {
  const completude = calcularCompletude(dossie, decisores);
  const missaoAtual = definirMissaoAtual(dossie, decisores, completude);
  const maturidadeComercial = calcularMaturidadeComercial(dossie, decisores);
  return { completude, missaoAtual, maturidadeComercial };
}
