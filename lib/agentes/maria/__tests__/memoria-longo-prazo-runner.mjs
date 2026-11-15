// ARQUIVO: lib/agentes/maria/__tests__/memoria-longo-prazo-runner.mjs
// Runner standalone para testes de memória de longo prazo da Maria.
// Executa com: node lib/agentes/maria/__tests__/memoria-longo-prazo-runner.mjs
// NÃO requer DB, NÃO requer dependências do projeto.
// Inlineia as funções puras de lib/agentes/maria/contexto.ts para testar sem imports.
// ACRESCENTADO (15/11/2026 — Memória de Longo Prazo v1)

// ─── Funções puras inlinadas (cópia fiel de contexto.ts) ───────────────────────

function formatarDataHistorico(dataContato) {
  if (!dataContato) return "";
  const data = dataContato.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const diasAtras = Math.floor(
    (Date.now() - dataContato.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diasAtras === 0) return `[${data} — hoje]`;
  if (diasAtras === 1) return `[${data} — ontem]`;
  if (diasAtras < 7) return `[${data} — ${diasAtras} dias atrás]`;
  if (diasAtras < 30) return `[${data} — ${Math.floor(diasAtras / 7)} semana(s) atrás]`;
  if (diasAtras < 60) return `[${data} — 1 mês atrás]`;
  const meses = Math.floor(diasAtras / 30);
  return `[${data} — ${meses} meses atrás]`;
}

function formatarContextoMaria({ mensagensSessao, oportunidade, historicos }) {
  const linhasSessao =
    mensagensSessao.length > 0
      ? [
          "Histórico recente desta conversa (sessão atual):",
          ...mensagensSessao.map(
            (m) => `${m.direcao === "ENTRADA" ? "Cliente" : "Maria"}: ${m.conteudo}`,
          ),
        ]
      : [];

  const linhasOportunidade = oportunidade
    ? [
        "Oportunidade aberta existente:",
        `- Titulo: ${oportunidade.titulo}`,
        oportunidade.tipoServico ? `- Tipo: ${oportunidade.tipoServico}` : null,
        oportunidade.descricao ? `- Descricao: ${oportunidade.descricao}` : null,
      ].filter(Boolean)
    : [];

  const linhasHistorico = historicos
    .slice()
    .reverse()
    .map((h) => {
      const dataLabel = formatarDataHistorico(h.dataContato);
      const cabecalho = dataLabel ? `${dataLabel} ${h.resumo}` : `- ${h.resumo}`;
      return [cabecalho, h.detalhes ?? null].filter(Boolean).join("\n");
    });

  return [
    ...linhasSessao,
    ...linhasOportunidade,
    ...linhasHistorico,
  ]
    .join("\n")
    .slice(0, 3000);
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

// ─── Utilitários de data ──────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ─── 1. Histórico com data de hoje ───────────────────────────────────────────

grupo("1. Histórico de hoje exibe 'hoje'");
{
  const historicos = [
    {
      resumo: "WhatsApp de Joao Silva (81999990000)",
      detalhes: "=== MEMÓRIA COMERCIAL ===\nEquipamento: bomba lança\nLocalização: Recife",
      dataContato: daysAgo(0),
    },
  ];
  const ctx = formatarContextoMaria({ mensagensSessao: [], oportunidade: null, historicos });
  assert(ctx.includes("hoje"), "Data de hoje exibe 'hoje'");
  assert(ctx.includes("WhatsApp de Joao Silva"), "Resumo do histórico presente");
}

// ─── 2. Histórico de ontem ────────────────────────────────────────────────────

grupo("2. Histórico de ontem exibe 'ontem'");
{
  const historicos = [
    {
      resumo: "WhatsApp de Ana Costa (81988880000)",
      detalhes: "=== MEMÓRIA COMERCIAL ===\nEquipamento: bomba estacionária",
      dataContato: daysAgo(1),
    },
  ];
  const ctx = formatarContextoMaria({ mensagensSessao: [], oportunidade: null, historicos });
  assert(ctx.includes("ontem"), "Data de ontem exibe 'ontem'");
}

// ─── 3. Histórico de 30 dias atrás ───────────────────────────────────────────

grupo("3. Histórico de 30 dias atrás exibe '1 mês atrás'");
{
  const historicos = [
    {
      resumo: "WhatsApp de Carlos Melo (81977770000)",
      detalhes: "=== MEMÓRIA COMERCIAL ===\nEquipamento: betoneira\nLocalização: Olinda",
      dataContato: daysAgo(30),
    },
  ];
  const ctx = formatarContextoMaria({ mensagensSessao: [], oportunidade: null, historicos });
  assert(ctx.includes("1 mês atrás"), "30 dias atrás exibe '1 mês atrás'");
  assert(ctx.includes("Carlos Melo"), "Resumo do histórico presente");
}

// ─── 4. Histórico de 90 dias atrás ───────────────────────────────────────────

grupo("4. Histórico de 90 dias atrás exibe '3 meses atrás'");
{
  const historicos = [
    {
      resumo: "WhatsApp de Fernanda Lima (81966660000)",
      detalhes: "=== MEMÓRIA COMERCIAL ===\nEquipamento: bomba lança\nVolume: 3000m³",
      dataContato: daysAgo(90),
    },
  ];
  const ctx = formatarContextoMaria({ mensagensSessao: [], oportunidade: null, historicos });
  assert(ctx.includes("3 meses atrás"), "90 dias atrás exibe '3 meses atrás'");
}

// ─── 5. Histórico de 180 dias atrás ──────────────────────────────────────────

grupo("5. Histórico de 180 dias atrás exibe '6 meses atrás'");
{
  const historicos = [
    {
      resumo: "WhatsApp de Roberto Alves (81955550000)",
      detalhes: "=== MEMÓRIA COMERCIAL ===\nEquipamento: central in loco\nLocalização: Caruaru",
      dataContato: daysAgo(180),
    },
  ];
  const ctx = formatarContextoMaria({ mensagensSessao: [], oportunidade: null, historicos });
  assert(ctx.includes("6 meses atrás"), "180 dias atrás exibe '6 meses atrás'");
  assert(ctx.includes("Roberto Alves"), "Resumo do histórico presente");
}

// ─── 6. Memória comercial estruturada presente nos detalhes ──────────────────

grupo("6. Bloco de memória comercial estruturada nos detalhes");
{
  const detalhesEstruturado = [
    "=== MEMÓRIA COMERCIAL ===",
    "Empresa/Contato: Construtora ABC",
    "Equipamento: bomba lança",
    "Localização: Recife",
    "Volume: 2000m³",
    "Prazo: março 2027",
    "Temperatura: QUENTE",
    "Próxima ação: Retornar WhatsApp",
    "=== TRANSCRIÇÃO ===",
    "Mensagem: Preciso de bomba",
    "Resposta Maria: Olá! Poderia informar...",
  ].join("\n");

  const historicos = [
    {
      resumo: "WhatsApp de Construtora ABC (81944440000)",
      detalhes: detalhesEstruturado,
      dataContato: daysAgo(45),
    },
  ];
  const ctx = formatarContextoMaria({ mensagensSessao: [], oportunidade: null, historicos });
  assert(ctx.includes("MEMÓRIA COMERCIAL"), "Bloco de memória comercial presente");
  assert(ctx.includes("Empresa/Contato: Construtora ABC"), "Nome da empresa presente");
  assert(ctx.includes("bomba lança"), "Equipamento presente");
  assert(ctx.includes("Recife"), "Localização presente");
  assert(ctx.includes("2000m³"), "Volume presente");
  assert(ctx.includes("março 2027"), "Prazo presente");
  assert(ctx.includes("Próxima ação: Retornar WhatsApp"), "Próxima ação presente");
  assert(ctx.includes("1 mês atrás") || ctx.includes("meses atrás"), "Data relativa presente");
}

// ─── 7. Histórico preserva ordem cronológica (mais antigo primeiro no contexto) ─

grupo("7. Histórico ordenado: mais antigo primeiro no contexto (histórico.reverse())");
{
  const historicos = [
    // Banco retorna: desc por data (mais recente primeiro)
    {
      resumo: "Contato mais recente — 7 dias",
      detalhes: null,
      dataContato: daysAgo(7),
    },
    {
      resumo: "Contato do meio — 30 dias",
      detalhes: null,
      dataContato: daysAgo(30),
    },
    {
      resumo: "Contato mais antigo — 90 dias",
      detalhes: null,
      dataContato: daysAgo(90),
    },
  ];
  const ctx = formatarContextoMaria({ mensagensSessao: [], oportunidade: null, historicos });
  const posAntigo = ctx.indexOf("Contato mais antigo");
  const posMeio = ctx.indexOf("Contato do meio");
  const posRecente = ctx.indexOf("Contato mais recente");
  assert(posAntigo < posMeio, "Mais antigo aparece antes do meio no contexto");
  assert(posMeio < posRecente, "Meio aparece antes do mais recente no contexto");
}

// ─── 8. Contexto completo: sessão atual + oportunidade + histórico datado ─────

grupo("8. Contexto completo com sessão, oportunidade e histórico datado");
{
  const mensagensSessao = [
    { direcao: "ENTRADA", conteudo: "Boa tarde, preciso de bomba" },
    { direcao: "SAIDA", conteudo: "Olá! Em qual cidade?" },
  ];
  const oportunidade = {
    titulo: "WhatsApp - Empresa XYZ / Recife",
    tipoServico: "BOMBA_LANCA",
    descricao: "Lead WhatsApp qualificado.",
  };
  const historicos = [
    {
      resumo: "WhatsApp de Empresa XYZ (81933330000)",
      detalhes: "=== MEMÓRIA COMERCIAL ===\nEquipamento: bomba lança\nLocalização: Recife",
      dataContato: daysAgo(60),
    },
  ];
  const ctx = formatarContextoMaria({ mensagensSessao, oportunidade, historicos });
  assert(ctx.includes("Histórico recente desta conversa"), "Bloco de sessão presente");
  assert(ctx.includes("Oportunidade aberta existente"), "Bloco de oportunidade presente");
  assert(ctx.includes("MEMÓRIA COMERCIAL"), "Bloco de histórico estruturado presente");
  assert(ctx.includes("2 meses atrás"), "Data relativa '2 meses atrás' presente");
  // Verificar ordem: sessão antes de oportunidade antes de histórico
  const posSessao = ctx.indexOf("Histórico recente");
  const posOp = ctx.indexOf("Oportunidade aberta");
  const posHist = ctx.indexOf("MEMÓRIA COMERCIAL");
  assert(posSessao < posOp, "Sessão antes de oportunidade");
  assert(posOp < posHist, "Oportunidade antes de histórico");
}

// ─── 9. Cliente corrigindo informação antiga ──────────────────────────────────

grupo("9. Cliente retorna 90 dias depois — histórico antigo visível + sessão nova");
{
  const sessaoNova = [
    { direcao: "ENTRADA", conteudo: "Boa tarde, voltei. Agora preciso de telebelt" },
    { direcao: "SAIDA", conteudo: "Olá! Lembro de você — antes era bomba, agora telebelt?" },
  ];
  const historicoAntigo = [
    {
      resumo: "WhatsApp anterior — bomba lança",
      detalhes: "=== MEMÓRIA COMERCIAL ===\nEquipamento: bomba lança\nLocalização: João Pessoa",
      dataContato: daysAgo(93),
    },
  ];
  const ctx = formatarContextoMaria({
    mensagensSessao: sessaoNova,
    oportunidade: null,
    historicos: historicoAntigo,
  });
  assert(ctx.includes("telebelt"), "Nova sessão com telebelt presente");
  assert(ctx.includes("bomba lança"), "Histórico antigo com bomba lança presente");
  assert(ctx.includes("3 meses atrás"), "Data relativa do histórico antigo visível");
  assert(ctx.includes("Histórico recente desta conversa"), "Sessão atual aparece primeiro");
}

// ─── 10. Isolamento — dois clientes com históricos separados ──────────────────

grupo("10. Isolamento: dois clientes retornam contextos distintos");
{
  const historicosCliente1 = [
    {
      resumo: "WhatsApp de João da Silva (81911110000)",
      detalhes: "=== MEMÓRIA COMERCIAL ===\nEquipamento: bomba lança\nLocalização: Recife",
      dataContato: daysAgo(45),
    },
  ];
  const historicosCliente2 = [
    {
      resumo: "WhatsApp de Maria Oliveira (81922220000)",
      detalhes: "=== MEMÓRIA COMERCIAL ===\nEquipamento: betoneira\nLocalização: Olinda",
      dataContato: daysAgo(20),
    },
  ];
  const ctx1 = formatarContextoMaria({
    mensagensSessao: [],
    oportunidade: null,
    historicos: historicosCliente1,
  });
  const ctx2 = formatarContextoMaria({
    mensagensSessao: [],
    oportunidade: null,
    historicos: historicosCliente2,
  });
  assert(ctx1.includes("João da Silva"), "Ctx1 tem dados do cliente 1");
  assert(!ctx1.includes("Maria Oliveira"), "Ctx1 NÃO tem dados do cliente 2");
  assert(ctx2.includes("Maria Oliveira"), "Ctx2 tem dados do cliente 2");
  assert(!ctx2.includes("João da Silva"), "Ctx2 NÃO tem dados do cliente 1");
  assert(ctx1.includes("bomba lança"), "Ctx1 tem equipamento do cliente 1");
  assert(ctx2.includes("betoneira"), "Ctx2 tem equipamento do cliente 2");
  assert(!ctx2.includes("bomba lança"), "Ctx2 NÃO tem equipamento do cliente 1");
}

// ─── 11. Histórico sem data (dataContato null) não quebra ─────────────────────

grupo("11. Histórico sem dataContato (null) não exibe data e não quebra");
{
  const historicos = [
    {
      resumo: "Contato antigo sem data",
      detalhes: "Detalhe qualquer",
      dataContato: null,
    },
  ];
  const ctx = formatarContextoMaria({ mensagensSessao: [], oportunidade: null, historicos });
  assert(ctx.includes("Contato antigo sem data"), "Resumo do histórico presente");
  assert(!ctx.includes("undefined"), "Sem 'undefined' no contexto");
  assert(!ctx.includes("null"), "Sem 'null' no contexto");
  // Sem dataContato, o cabeçalho deve usar o formato "- resumo"
  assert(ctx.includes("- Contato antigo sem data"), "Formato de cabeçalho sem data: '- resumo'");
}

// ─── 12. Limite de 3000 chars preservado ──────────────────────────────────────

grupo("12. Contexto com histórico longo não excede 3000 chars");
{
  const historicos = Array.from({ length: 6 }, (_, i) => ({
    resumo: `Histórico ${i} com texto longo`,
    detalhes: "=== MEMÓRIA COMERCIAL ===\n" + "linha de detalhe muito longa ".repeat(20),
    dataContato: daysAgo(i * 30),
  }));
  const ctx = formatarContextoMaria({ mensagensSessao: [], oportunidade: null, historicos });
  assert(ctx.length <= 3000, `Contexto limitado a 3000 chars (tamanho: ${ctx.length})`);
  assert(ctx.length > 0, "Contexto não está vazio");
}

// ─── Resultado final ──────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════");
console.log(`RESULTADO — MARIA MEMÓRIA LONGO PRAZO v1`);
console.log(`  ✅ Passou: ${passou}`);
console.log(`  ❌ Falhou: ${falhou}`);
console.log(`  Total:    ${passou + falhou}`);
console.log("══════════════════════════════════════\n");

if (falhou > 0) process.exit(1);
