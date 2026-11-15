// ARQUIVO: lib/agentes/joao/__tests__/memoria-runner.mjs
// Runner standalone para os testes de memória do João.
// Executa com: node lib/agentes/joao/__tests__/memoria-runner.mjs
// NÃO requer DB, NÃO requer dependências do projeto.
// Inlineia as funções puras de lib/agentes/joao/contexto.ts para testar sem imports.
// ATUALIZADO (14/11/2026 v2): inclui testes para memória investigativa completa
//   (evidências, movimentações, próxima ação, resumo do dossiê).
// ATUALIZADO (15/11/2026 v3): evidências e movimentações incluem campo `data` opcional;
//   grupos 19-20 testam exibição de datas no contexto.

// ─── Função pura inlinada (cópia fiel de formatarContextoJoao em contexto.ts) ──

const CONFIANCA_LABEL = {
  CONFIRMADA: "CONFIRMADA",
  FORTE: "FORTE",
  PROVAVEL: "PROVÁVEL",
  SINAL: "SINAL",
};

const MOVIMENTACAO_LABEL = {
  NOVA_OBRA: "Nova obra detectada",
  NOVO_EMPREENDIMENTO: "Novo empreendimento",
  MOBILIZACAO_INICIADA: "Mobilização iniciada",
  CONCRETAGEM: "Concretagem em andamento",
  EXPANSAO: "Expansão detectada",
  NOVA_UNIDADE: "Nova unidade",
  CONTRATACAO_EM_ANDAMENTO: "Contratação em andamento",
  MUDANCA_EXECUTIVO: "Mudança de executivo",
  COMPRA_EQUIPAMENTO: "Compra de equipamento",
  VENDA_EQUIPAMENTO: "Venda de equipamento",
  SINAL_DE_MERCADO: "Sinal de mercado",
};

function formatarContextoJoao({ mensagens, dossie }) {
  const linhas = [];

  if (mensagens.length > 0) {
    linhas.push(
      ...mensagens.map(
        (m) => `${m.direcao === "ENTRADA" ? "Cliente" : "João"}: ${m.conteudo}`,
      ),
    );
  }

  if (dossie) {
    linhas.push("");
    linhas.push("── Investigação em andamento ──");
    linhas.push(`Dossiê: ${dossie.titulo}`);

    if (dossie.resumo) linhas.push(`Resumo: ${dossie.resumo}`);
    if (dossie.missaoAtual) linhas.push(`Missão atual: ${dossie.missaoAtual}`);
    if (dossie.proximaAcaoSugerida) linhas.push(`Próxima ação: ${dossie.proximaAcaoSugerida}`);

    if (dossie.score !== null && dossie.score !== undefined ||
        dossie.completude !== null && dossie.completude !== undefined) {
      const partes = [];
      if (dossie.score !== null && dossie.score !== undefined) partes.push(`Score: ${dossie.score}/100`);
      if (dossie.completude !== null && dossie.completude !== undefined) partes.push(`Completude: ${dossie.completude}%`);
      if (partes.length > 0) linhas.push(partes.join(" | "));
    }

    const evidencias = dossie.evidencias ?? [];
    const evidenciasRelevantes = evidencias.filter(
      (e) => e.confianca === "CONFIRMADA" || e.confianca === "FORTE" || e.confianca === "PROVAVEL",
    );
    if (evidenciasRelevantes.length > 0) {
      linhas.push("");
      linhas.push("Informações confirmadas/evidências:");
      for (const ev of evidenciasRelevantes) {
        const fonte = ev.fonteNome ? `(${ev.fonteNome})` : `(${ev.fonteTipo})`;
        const label = CONFIANCA_LABEL[ev.confianca] ?? ev.confianca;
        // [v3] data opcional
        const dataStr = ev.data ? ` — data: ${ev.data.toLocaleDateString("pt-BR")}` : "";
        const desc = ev.descricao ? ` — ${ev.descricao}` : "";
        linhas.push(`- [${label}] ${ev.titulo} ${fonte}${dataStr}${desc}`);
      }
    }

    const sinais = evidencias.filter((e) => e.confianca === "SINAL");
    if (sinais.length > 0) {
      linhas.push("");
      linhas.push("Sinais de mercado:");
      for (const ev of sinais) {
        const fonte = ev.fonteNome ? `(${ev.fonteNome})` : `(${ev.fonteTipo})`;
        // [v3] data opcional
        const dataStr = ev.data ? ` — data: ${ev.data.toLocaleDateString("pt-BR")}` : "";
        const desc = ev.descricao ? ` — ${ev.descricao}` : "";
        linhas.push(`- ${ev.titulo} ${fonte}${dataStr}${desc}`);
      }
    }

    const movimentacoes = dossie.movimentacoes ?? [];
    if (movimentacoes.length > 0) {
      linhas.push("");
      linhas.push("Movimentações recentes:");
      for (const mov of movimentacoes) {
        const tipo = MOVIMENTACAO_LABEL[mov.tipo] ?? mov.tipo;
        // [v3] data opcional
        const dataStr = mov.data ? ` — data: ${mov.data.toLocaleDateString("pt-BR")}` : "";
        const desc = mov.descricao ? ` — ${mov.descricao}` : "";
        linhas.push(`- ${tipo}: ${mov.titulo}${dataStr}${desc}`);
      }
    }
  }

  return linhas.join("\n").trim().slice(0, 5000);
}

// ─── Utilitários de teste ─────────────────────────────────────────────────────

let passou = 0;
let falhou = 0;

function assert(condicao, descricao) {
  if (condicao) {
    console.log(`  ✅ ${descricao}`);
    passou++;
  } else {
    console.error(`  ❌ FALHOU: ${descricao}`);
    falhou++;
  }
}

function grupo(nome) {
  console.log(`\n── ${nome} ──`);
}

// ─── Dados de teste ───────────────────────────────────────────────────────────

const mensagens6 = [
  { direcao: "ENTRADA", conteudo: "Oi João" },
  { direcao: "SAIDA",   conteudo: "Olá! Sou o João da Villa. Posso ajudar?" },
  { direcao: "ENTRADA", conteudo: "Tenho interesse em locação de bomba" },
  { direcao: "SAIDA",   conteudo: "Que tipo de obra? Qual cidade?" },
  { direcao: "ENTRADA", conteudo: "Obra em Recife, prédio de 20 andares" },
  { direcao: "SAIDA",   conteudo: "Entendido. Volume estimado de concreto?" },
];

const mensagens10 = [
  ...mensagens6,
  { direcao: "ENTRADA", conteudo: "Umas 2000 m3 por mês" },
  { direcao: "SAIDA",   conteudo: "Ótimo. Qual o prazo para início?" },
  { direcao: "ENTRADA", conteudo: "Janeiro de 2027" },
  { direcao: "SAIDA",   conteudo: "Perfeito. Vou passar para o comercial." },
];

// Dossiê base (sem evidências nem movimentações — compatibilidade retroativa)
const dossie = {
  titulo: "[João Outbound] Marcos Ferreira — demanda_informada",
  resumo: null,
  missaoAtual: "Confirmar volume e prazo de início da obra",
  proximaAcaoSugerida: null,
  score: 75,
  completude: 40,
  evidencias: [],
  movimentacoes: [],
};

// Dossiê completo com evidências e movimentações (v2)
const dossieCompleto = {
  titulo: "Datacenter AWS — Hortolândia SP",
  resumo: "Grande datacenter em construção, alta demanda de concreto estrutural.",
  missaoAtual: "Confirmar volume de concreto com Diretor de Obras",
  proximaAcaoSugerida: "Ligar para Rafael Souza (Diretor de Engenharia)",
  score: 88,
  completude: 60,
  evidencias: [
    {
      titulo: "Licitação publicada no PNCP",
      descricao: "Volume estimado 15.000m³, início março 2027",
      fonteTipo: "OFICIAL",
      fonteNome: "PNCP",
      confianca: "CONFIRMADA",
    },
    {
      titulo: "Post LinkedIn — Rafael Souza",
      descricao: "Iniciando projeto de infraestrutura digital",
      fonteTipo: "REDE_SOCIAL",
      fonteNome: "LinkedIn",
      confianca: "FORTE",
    },
    {
      titulo: "Notícia InfoMoney — AWS anuncia expansão",
      descricao: null,
      fonteTipo: "MIDIA",
      fonteNome: "InfoMoney",
      confianca: "SINAL",
    },
  ],
  movimentacoes: [
    {
      titulo: "Contrato PNCP assinado — AWS + Andrade Gutierrez",
      descricao: "EPC contratado para datacenter em Hortolândia",
      tipo: "NOVA_OBRA",
    },
    {
      titulo: "Rafael Souza assumiu como Diretor de Engenharia",
      descricao: null,
      tipo: "MUDANCA_EXECUTIVO",
    },
  ],
};

// ─── 1. Contexto vazio ────────────────────────────────────────────────────────

grupo("1. Contexto vazio quando não há mensagens nem dossiê");
{
  const ctx = formatarContextoJoao({ mensagens: [], dossie: null });
  assert(ctx === "", "Retorna string vazia");
}

// ─── 2. Apenas mensagens — sem dossiê ────────────────────────────────────────

grupo("2. Apenas mensagens (sem dossiê em andamento)");
{
  const ctx = formatarContextoJoao({ mensagens: mensagens6, dossie: null });
  assert(ctx.includes("Cliente: Oi João"), "Primeira mensagem do cliente presente");
  assert(ctx.includes("João: Olá! Sou o João"), "Primeira resposta do João presente");
  assert(!ctx.includes("Investigação em andamento"), "Bloco de dossiê ausente quando não há dossiê");
}

// ─── 3. Suporta 10 mensagens (não trunca em 6) ───────────────────────────────

grupo("3. Suporta 10 mensagens na sessão (antes era 6)");
{
  const ctx = formatarContextoJoao({ mensagens: mensagens10, dossie: null });
  assert(ctx.includes("Umas 2000 m3 por mês"), "7ª mensagem presente (além do antigo limite de 6)");
  assert(ctx.includes("Janeiro de 2027"),       "9ª mensagem presente");
  assert(ctx.includes("Vou passar para o comercial"), "10ª mensagem presente");
}

// ─── 4. Prefixo correto: "Cliente:" e "João:" ────────────────────────────────

grupo("4. Prefixo correto: 'Cliente:' para ENTRADA, 'João:' para SAIDA");
{
  const msgs = [
    { direcao: "ENTRADA", conteudo: "Mensagem do prospect" },
    { direcao: "SAIDA",   conteudo: "Resposta do João" },
  ];
  const ctx = formatarContextoJoao({ mensagens: msgs, dossie: null });
  assert(ctx.includes("Cliente: Mensagem do prospect"), "Prefixo 'Cliente:' para ENTRADA");
  assert(ctx.includes("João: Resposta do João"),         "Prefixo 'João:' para SAIDA");
  assert(!ctx.includes("Maria:"), "Prefixo 'Maria:' nunca aparece no contexto do João");
}

// ─── 5. Apenas dossiê — sem mensagens de sessão ──────────────────────────────

grupo("5. Apenas dossiê em andamento (sem mensagens de sessão)");
{
  const ctx = formatarContextoJoao({ mensagens: [], dossie });
  assert(ctx.includes("Investigação em andamento"), "Cabeçalho de dossiê presente");
  assert(ctx.includes("[João Outbound] Marcos Ferreira"), "Título do dossiê presente");
  assert(ctx.includes("Confirmar volume e prazo"), "Missão atual presente");
  assert(ctx.includes("75/100"), "Score presente");
  assert(ctx.includes("40%"), "Completude presente");
}

// ─── 6. Mensagens + dossiê — dossiê aparece DEPOIS das mensagens ─────────────

grupo("6. Dossiê aparece depois das mensagens de sessão");
{
  const ctx = formatarContextoJoao({ mensagens: mensagens6, dossie });
  const posMensagem = ctx.indexOf("Cliente: Oi João");
  const posDossie   = ctx.indexOf("Investigação em andamento");
  assert(posMensagem < posDossie, "Mensagens de sessão antes do bloco de dossiê");
}

// ─── 7. Dossiê sem missão atual (campo null) ──────────────────────────────────

grupo("7. Dossiê sem missão atual (campo null) não exibe linha de missão");
{
  const dossieSemMissao = {
    titulo: "Dossiê Sem Missão",
    resumo: null,
    missaoAtual: null,
    proximaAcaoSugerida: null,
    score: 60,
    completude: 20,
    evidencias: [],
    movimentacoes: [],
  };
  const ctx = formatarContextoJoao({ mensagens: [], dossie: dossieSemMissao });
  assert(!ctx.includes("Missão atual: null"), "Linha 'Missão atual: null' não aparece");
  assert(!ctx.includes("Missão atual: undefined"), "Linha 'Missão atual: undefined' não aparece");
  assert(ctx.includes("Dossiê Sem Missão"), "Título do dossiê ainda presente");
}

// ─── 8. Dossiê com score null e completude null ───────────────────────────────

grupo("8. Dossiê com score null e completude null");
{
  const dossieMinimo = {
    titulo: "Dossiê Mínimo",
    resumo: null,
    missaoAtual: "Levantar contatos da empresa",
    proximaAcaoSugerida: null,
    score: null,
    completude: null,
    evidencias: [],
    movimentacoes: [],
  };
  const ctx = formatarContextoJoao({ mensagens: [], dossie: dossieMinimo });
  assert(ctx.includes("Dossiê Mínimo"), "Título presente");
  assert(ctx.includes("Levantar contatos"), "Missão presente");
  assert(!ctx.includes("Score: null"), "Score null não exibido");
  assert(!ctx.includes("Completude: null"), "Completude null não exibida");
}

// ─── 9. Ordem cronológica das mensagens ──────────────────────────────────────

grupo("9. Mensagens em ordem cronológica (antiga → recente)");
{
  const ctx = formatarContextoJoao({ mensagens: mensagens10, dossie: null });
  const posM1  = ctx.indexOf("Oi João");
  const posM5  = ctx.indexOf("prédio de 20 andares");
  const posM10 = ctx.indexOf("Vou passar para o comercial");
  assert(posM1 < posM5,  "Mensagem 1 antes da mensagem 5");
  assert(posM5 < posM10, "Mensagem 5 antes da mensagem 10");
}

// ─── 10. Separador entre sessão e dossiê ─────────────────────────────────────

grupo("10. Separador entre bloco de sessão e bloco de dossiê");
{
  const ctx = formatarContextoJoao({ mensagens: mensagens6, dossie });
  const posUltimaMensagem = ctx.lastIndexOf("Volume estimado de concreto?");
  const posDossie = ctx.indexOf("Investigação em andamento");
  const separador = ctx.slice(posUltimaMensagem, posDossie);
  assert(separador.includes("\n"), "Há quebra de linha entre sessão e dossiê");
}

// ─── 11. Título do dossiê preserva o formato padrão do João Outbound ─────────

grupo("11. Título do dossiê preserva o formato padrão do João Outbound");
{
  const dossieFormato = {
    titulo: "[João Outbound] José da Silva — contato_solicitado",
    resumo: null,
    missaoAtual: "Enviar proposta técnica",
    proximaAcaoSugerida: null,
    score: 92,
    completude: 65,
    evidencias: [],
    movimentacoes: [],
  };
  const ctx = formatarContextoJoao({ mensagens: [], dossie: dossieFormato });
  assert(ctx.includes("[João Outbound] José da Silva — contato_solicitado"), "Título preservado integralmente");
  assert(ctx.includes("92/100"), "Score alto presente");
  assert(ctx.includes("65%"), "Completude presente");
}

// ─── 12. Contexto com 10 mensagens + dossiê permanece em tamanho razoável ────

grupo("12. Contexto com 10 mensagens longas + dossiê permanece em tamanho razoável");
{
  const msgLongas = Array.from({ length: 10 }, (_, i) => ({
    direcao: i % 2 === 0 ? "ENTRADA" : "SAIDA",
    conteudo: `Mensagem longa ${i}: ${"conteúdo de prospecção com detalhes da obra. ".repeat(10)}`,
  }));
  const ctx = formatarContextoJoao({ mensagens: msgLongas, dossie });
  assert(ctx.length > 0, "Contexto não está vazio");
  assert(ctx.length < 20000, `Contexto menor que 20.000 chars (tamanho: ${ctx.length})`);
}

// ─── 13. Evidências confirmadas aparecem no contexto [v2] ────────────────────

grupo("13. Evidências confirmadas e fortes aparecem no contexto (v2)");
{
  const ctx = formatarContextoJoao({ mensagens: [], dossie: dossieCompleto });
  assert(ctx.includes("Informações confirmadas/evidências:"), "Seção de evidências presente");
  assert(ctx.includes("[CONFIRMADA] Licitação publicada no PNCP"), "Evidência CONFIRMADA presente");
  assert(ctx.includes("(PNCP)"), "Nome da fonte presente");
  assert(ctx.includes("Volume estimado 15.000m³"), "Descrição da evidência presente");
  assert(ctx.includes("[FORTE] Post LinkedIn"), "Evidência FORTE presente");
}

// ─── 14. Sinais de mercado aparecem separados das confirmadas [v2] ────────────

grupo("14. Sinais de mercado separados das evidências confirmadas (v2)");
{
  const ctx = formatarContextoJoao({ mensagens: [], dossie: dossieCompleto });
  assert(ctx.includes("Sinais de mercado:"), "Seção de sinais presente");
  assert(ctx.includes("Notícia InfoMoney"), "Sinal de mídia presente");
  const posConfirmadas = ctx.indexOf("Informações confirmadas");
  const posSinais = ctx.indexOf("Sinais de mercado:");
  assert(posConfirmadas < posSinais, "Confirmadas aparecem antes dos sinais");
}

// ─── 15. Movimentações recentes aparecem no contexto [v2] ────────────────────

grupo("15. Movimentações recentes aparecem no contexto (v2)");
{
  const ctx = formatarContextoJoao({ mensagens: [], dossie: dossieCompleto });
  assert(ctx.includes("Movimentações recentes:"), "Seção de movimentações presente");
  assert(ctx.includes("Nova obra detectada: Contrato PNCP"), "Movimentação NOVA_OBRA traduzida e presente");
  assert(ctx.includes("Mudança de executivo: Rafael Souza"), "Movimentação MUDANCA_EXECUTIVO traduzida e presente");
}

// ─── 16. Próxima ação e resumo do dossiê aparecem [v2] ───────────────────────

grupo("16. Próxima ação sugerida e resumo do dossiê aparecem (v2)");
{
  const ctx = formatarContextoJoao({ mensagens: [], dossie: dossieCompleto });
  assert(ctx.includes("Próxima ação: Ligar para Rafael Souza"), "Próxima ação presente");
  assert(ctx.includes("Resumo: Grande datacenter em construção"), "Resumo do dossiê presente");
}

// ─── 17. Dossiê sem evidências não exibe seção de evidências [v2] ────────────

grupo("17. Dossiê sem evidências não exibe seções vazias (v2)");
{
  // O dossiê base (dossie) não tem evidências nem movimentações
  const ctx = formatarContextoJoao({ mensagens: [], dossie });
  assert(!ctx.includes("Informações confirmadas"), "Seção de evidências ausente quando vazio");
  assert(!ctx.includes("Sinais de mercado"), "Seção de sinais ausente quando vazio");
  assert(!ctx.includes("Movimentações recentes"), "Seção de movimentações ausente quando vazio");
}

// ─── 18. Limite de 5000 chars é respeitado [v2] ──────────────────────────────

grupo("18. Contexto total respeita o limite de 5000 chars (v2)");
{
  const dossieLongo = {
    ...dossieCompleto,
    resumo: "R".repeat(500),
    evidencias: Array.from({ length: 5 }, (_, i) => ({
      titulo: `Evidência longa ${i}: ${"conteúdo ".repeat(30)}`,
      descricao: `Descrição longa ${i}: ${"detalhe ".repeat(20)}`,
      fonteTipo: "OFICIAL",
      fonteNome: "Fonte Oficial",
      confianca: "CONFIRMADA",
    })),
    movimentacoes: Array.from({ length: 5 }, (_, i) => ({
      titulo: `Movimentação longa ${i}: ${"detalhe ".repeat(20)}`,
      descricao: `Descrição da movimentação ${i}: ${"info ".repeat(15)}`,
      tipo: "NOVA_OBRA",
    })),
  };
  const ctx = formatarContextoJoao({ mensagens: mensagens10, dossie: dossieLongo });
  assert(ctx.length <= 5000, `Contexto limitado a 5000 chars (tamanho: ${ctx.length})`);
  assert(ctx.length > 0, "Contexto não está vazio");
}

// ─── 19. Evidências com data aparecem no contexto ──────────────────────────────
// [ACRESCENTADO 15/11/2026 v3]

grupo("19. Evidências com campo `data` exibem data no contexto");
{
  const dataEvidencia = new Date("2026-08-10T12:00:00Z");
  const dossieComData = {
    ...dossieCompleto,
    evidencias: [
      {
        titulo: "Licitação publicada",
        descricao: "Volume 5000m³",
        fonteTipo: "OFICIAL",
        fonteNome: "PNCP",
        confianca: "CONFIRMADA",
        data: dataEvidencia,
      },
      {
        titulo: "Sinal de mercado",
        descricao: null,
        fonteTipo: "MIDIA",
        fonteNome: "InfoConstru",
        confianca: "SINAL",
        data: new Date("2026-09-05T12:00:00Z"),
      },
    ],
    movimentacoes: [],
  };
  const ctx = formatarContextoJoao({ mensagens: [], dossie: dossieComData });
  assert(ctx.includes("data: "), "Campo data aparece no contexto");
  assert(ctx.includes("Licitação publicada"), "Título da evidência presente");
  assert(ctx.includes("(PNCP)"), "Fonte da evidência presente");
  assert(ctx.includes("CONFIRMADA"), "Nível de confiança presente");
  // Data deve aparecer para a evidência confirmada
  const parteData = dataEvidencia.toLocaleDateString("pt-BR");
  assert(ctx.includes(parteData), `Data da evidência ${parteData} presente no contexto`);
}

// ─── 20. Movimentações com data aparecem no contexto ───────────────────────────
// [ACRESCENTADO 15/11/2026 v3]

grupo("20. Movimentações com campo `data` exibem data no contexto");
{
  const dataMovimentacao = new Date("2026-10-20T12:00:00Z");
  const dossieComData = {
    ...dossieCompleto,
    evidencias: [],
    movimentacoes: [
      {
        titulo: "Contrato PNCP assinado",
        descricao: "EPC contratado",
        tipo: "NOVA_OBRA",
        data: dataMovimentacao,
      },
      {
        titulo: "Novo Diretor de Engenharia",
        descricao: null,
        tipo: "MUDANCA_EXECUTIVO",
        data: null,
      },
    ],
  };
  const ctx = formatarContextoJoao({ mensagens: [], dossie: dossieComData });
  assert(ctx.includes("Movimentações recentes:"), "Bloco de movimentações presente");
  assert(ctx.includes("Nova obra detectada"), "Label de movimentação traduzido");
  const parteData = dataMovimentacao.toLocaleDateString("pt-BR");
  assert(ctx.includes(parteData), `Data da movimentação ${parteData} presente no contexto`);
  // Segunda movimentação sem data não deve exibir "data: "
  const posMovSemData = ctx.indexOf("Novo Diretor de Engenharia");
  assert(posMovSemData !== -1, "Movimentação sem data também aparece");
  const linhaMovSemData = ctx.slice(posMovSemData, posMovSemData + 60);
  assert(!linhaMovSemData.includes("data: "), "Movimentação sem data não exibe 'data: '");
}

// ─── Resultado final ──────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════");
console.log(`RESULTADO — JOÃO MEMÓRIA v3`);
console.log(`  ✅ Passou: ${passou}`);
console.log(`  ❌ Falhou: ${falhou}`);
console.log(`  Total:    ${passou + falhou}`);
console.log("══════════════════════════════════════\n");

if (falhou > 0) process.exit(1);
