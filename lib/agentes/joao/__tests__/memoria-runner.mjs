// ARQUIVO: lib/agentes/joao/__tests__/memoria-runner.mjs
// Runner standalone para os testes de memória do João.
// Executa com: node lib/agentes/joao/__tests__/memoria-runner.mjs
// NÃO requer DB, NÃO requer dependências do projeto.
// Inlineia as funções puras de lib/agentes/joao/contexto.ts para testar sem imports.

// ─── Função pura inlinada (cópia fiel de formatarContextoJoao em contexto.ts) ──

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
    if (dossie.missaoAtual) linhas.push(`Missão atual: ${dossie.missaoAtual}`);
    if (dossie.score !== null && dossie.score !== undefined) linhas.push(`Score: ${dossie.score}/100`);
    if (dossie.completude !== null && dossie.completude !== undefined) linhas.push(`Completude: ${dossie.completude}%`);
  }

  return linhas.join("\n").trim();
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

const dossie = {
  titulo: "[João Outbound] Marcos Ferreira — demanda_informada",
  missaoAtual: "Confirmar volume e prazo de início da obra",
  score: 75,
  completude: 40,
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
    missaoAtual: null,
    score: 60,
    completude: 20,
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
    missaoAtual: "Levantar contatos da empresa",
    score: null,
    completude: null,
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
    missaoAtual: "Enviar proposta técnica",
    score: 92,
    completude: 65,
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

// ─── Resultado final ──────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════");
console.log(`RESULTADO — JOÃO MEMÓRIA`);
console.log(`  ✅ Passou: ${passou}`);
console.log(`  ❌ Falhou: ${falhou}`);
console.log(`  Total:    ${passou + falhou}`);
console.log("══════════════════════════════════════\n");

if (falhou > 0) process.exit(1);
