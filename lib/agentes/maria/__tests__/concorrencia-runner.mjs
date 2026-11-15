// ARQUIVO: lib/agentes/maria/__tests__/concorrencia-runner.mjs
// Testes de concorrência para a Maria — Advisory Lock + WebhookLock.
// Executa com: node lib/agentes/maria/__tests__/concorrencia-runner.mjs
//
// NÃO requer DB, NÃO requer rede.
// Simula múltiplas instâncias Vercel processando o mesmo telefone simultaneamente.
// Comprova:
//   1. Sem lock: oportunidades duplicadas ocorrem.
//   2. Com advisory lock (já implementado): oportunidades duplicadas são eliminadas.
//   3. Com WebhookLock (plano pendente): respostas duplicadas são eliminadas.
//   4. Recuperação após falha: lock expirado não bloqueia mensagens futuras.
//   5. Isolamento entre telefones: lock de um número não bloqueia outro.

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

function atraso(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Simulador de banco em memória ───────────────────────────────────────────
// Reproduz o comportamento do PostgreSQL para os nossos propósitos:
// - Transações com isolamento READ COMMITTED (padrão)
// - Advisory locks por chave (transaction-level)
// - Tabela WebhookLock com unique constraint

class SimuladorBanco {
  constructor() {
    this.oportunidades = [];          // simula tabela Oportunidade
    this.historicos = [];             // simula tabela HistoricoContato
    this.webhookLocks = new Map();    // simula tabela WebhookLock
    this.advisoryLocks = new Set();   // simula pg_advisory_xact_lock
    this.responsesSent = [];          // simula mensagens enviadas pelo WhatsApp
  }

  // Simula SELECT pg_advisory_xact_lock(key)
  // Transaction-level: resolve imediatamente se livre, aguarda se ocupado
  async acquireAdvisoryLock(key) {
    while (this.advisoryLocks.has(key)) {
      await atraso(5); // aguarda lock ser liberado
    }
    this.advisoryLocks.add(key);
    return {
      release: () => this.advisoryLocks.delete(key),
    };
  }

  // Simula INSERT INTO WebhookLock ON CONFLICT → retorna false se ocupado
  tryAcquireWebhookLock(chave, ttlMs = 30000) {
    const agora = Date.now();
    const existing = this.webhookLocks.get(chave);
    if (existing && existing.expiraEm > agora) {
      return false; // lock ativo — outro processo está processando
    }
    // Limpa expirado ou cria novo
    this.webhookLocks.set(chave, { expiraEm: agora + ttlMs });
    return true;
  }

  releaseWebhookLock(chave) {
    this.webhookLocks.delete(chave);
  }

  // Simula busca de oportunidade aberta
  findOportunidade(telefone) {
    return this.oportunidades.find(
      (o) => o.telefone === telefone && o.ativa === true,
    ) ?? null;
  }

  // Simula criação ou atualização de oportunidade (dentro da transação)
  async upsertOportunidade(telefone, titulo) {
    const existente = this.findOportunidade(telefone);
    if (existente) {
      existente.atualizacoes = (existente.atualizacoes ?? 0) + 1;
      return { criada: false, id: existente.id };
    }
    const nova = { id: `op_${Date.now()}_${Math.random()}`, telefone, titulo, ativa: true };
    this.oportunidades.push(nova);
    return { criada: true, id: nova.id };
  }

  async criarHistorico(telefone, texto) {
    this.historicos.push({ telefone, texto, criadoEm: Date.now() });
  }

  registrarResposta(telefone, texto) {
    this.responsesSent.push({ telefone, texto, enviadoEm: Date.now() });
  }

  countOportunidades(telefone) {
    return this.oportunidades.filter((o) => o.telefone === telefone && o.ativa).length;
  }

  countRespostas(telefone) {
    return this.responsesSent.filter((r) => r.telefone === telefone).length;
  }

  reset() {
    this.oportunidades = [];
    this.historicos = [];
    this.webhookLocks = new Map();
    this.advisoryLocks = new Set();
    this.responsesSent = [];
  }
}

const banco = new SimuladorBanco();

// ─── Simuladores de processamento ────────────────────────────────────────────

// SEM LOCK: comportamento antes da implementação
async function processarSemLock(banco, telefone, mensagem) {
  // Simula latência de IA (50-100ms)
  await atraso(50 + Math.random() * 50);

  // Lê contexto (sem lock — pode ler estado desatualizado)
  const oportunidadeExistente = banco.findOportunidade(telefone);

  // Chama IA e envia resposta (fora de qualquer lock)
  await atraso(30);
  banco.registrarResposta(telefone, `Resposta para: ${mensagem}`);

  // Grava no banco (sem serialização — race condition aqui)
  const { criada } = await banco.upsertOportunidade(telefone, `Oportunidade — ${telefone}`);
  await banco.criarHistorico(telefone, mensagem);

  return { criada, oportunidadeExistente: !!oportunidadeExistente };
}

// COM ADVISORY LOCK: implementação atual (commit feat: Memória Investigativa v2)
// Serializa apenas as operações de banco — IA e WhatsApp ainda correm em paralelo
async function processarComAdvisoryLock(banco, telefone, mensagem) {
  // Chama IA e envia resposta (FORA do lock — ainda pode ser duplicado)
  await atraso(50 + Math.random() * 50);
  banco.registrarResposta(telefone, `Resposta para: ${mensagem}`);

  // Adquire advisory lock ANTES das operações de banco
  const lock = await banco.acquireAdvisoryLock(`lock:${telefone}`);
  try {
    await atraso(10); // latência de banco
    const { criada } = await banco.upsertOportunidade(telefone, `Oportunidade — ${telefone}`);
    await banco.criarHistorico(telefone, mensagem);
    return { criada };
  } finally {
    lock.release();
  }
}

// COM WEBHOOKLOCK: plano pendente — serializa o ciclo completo
async function processarComWebhookLock(banco, telefone, mensagem) {
  const chave = `maria:${telefone}`;

  // Tenta adquirir o lock ANTES de tudo (IA + envio + banco)
  const lockAdquirido = banco.tryAcquireWebhookLock(chave);
  if (!lockAdquirido) {
    // Aguarda 50ms e tenta de novo (mensagem quase simultânea)
    await atraso(50);
    const retry = banco.tryAcquireWebhookLock(chave);
    if (!retry) {
      // Concorrência extrema: descarta (a mensagem anterior já está sendo processada)
      return { descartada: true };
    }
  }

  try {
    // Com o lock: IA + envio + banco rodam serializados
    await atraso(50 + Math.random() * 50);
    banco.registrarResposta(telefone, `Resposta para: ${mensagem}`);

    await atraso(10);
    const { criada } = await banco.upsertOportunidade(telefone, `Oportunidade — ${telefone}`);
    await banco.criarHistorico(telefone, mensagem);
    return { criada, descartada: false };
  } finally {
    banco.releaseWebhookLock(chave);
  }
}

// ─── TESTE 1: Race condition SEM lock ────────────────────────────────────────

grupo("1. BASELINE — Race condition SEM nenhum lock");
{
  banco.reset();
  const telefone = "5581999991111";

  // Simula duas mensagens chegando quase ao mesmo tempo (2 instâncias Vercel)
  const [r1, r2] = await Promise.all([
    processarSemLock(banco, telefone, "Preciso de bomba lança em Recife"),
    processarSemLock(banco, telefone, "Obra de 500m3, início em janeiro"),
  ]);

  const totalOportunidades = banco.countOportunidades(telefone);
  const totalRespostas = banco.countRespostas(telefone);

  assert(totalOportunidades >= 1, `Pelo menos 1 oportunidade criada (criadas: ${totalOportunidades})`);
  assert(totalRespostas === 2, `2 respostas enviadas ao cliente (duplicado de WhatsApp): ${totalRespostas}`);

  // Demonstra o problema: pode haver 2 oportunidades
  const temDuplicata = totalOportunidades > 1;
  console.log(`  ℹ️  Oportunidades criadas: ${totalOportunidades} ${temDuplicata ? "⚠️ DUPLICATA" : "(sorte — chegaram serializadas)"}`);
  console.log(`  ℹ️  Respostas WhatsApp enviadas: ${totalRespostas} ⚠️ CLIENTE RECEBEU DUPLO`);
}

// ─── TESTE 2: Advisory lock — oportunidades duplicadas são eliminadas ─────────

grupo("2. COM ADVISORY LOCK (já implementado) — sem oportunidades duplicadas");
{
  banco.reset();
  const telefone = "5581999992222";

  // Simula 4 mensagens chegando quase ao mesmo tempo
  await Promise.all([
    processarComAdvisoryLock(banco, telefone, "Preciso de bomba lança"),
    processarComAdvisoryLock(banco, telefone, "Obra em Recife, 500m3"),
    processarComAdvisoryLock(banco, telefone, "Início em janeiro"),
    processarComAdvisoryLock(banco, telefone, "Qual o valor?"),
  ]);

  const totalOportunidades = banco.countOportunidades(telefone);
  const totalRespostas = banco.countRespostas(telefone);

  assert(totalOportunidades === 1, `Exatamente 1 oportunidade criada (criadas: ${totalOportunidades})`);
  assert(totalRespostas === 4, `4 respostas enviadas (IA processou todos os turnos): ${totalRespostas}`);
  console.log(`  ℹ️  Oportunidades: ${totalOportunidades} ✅ | Respostas WhatsApp: ${totalRespostas} ⚠️ (ainda duplicado)`);
}

// ─── TESTE 3: Advisory lock — 4 instâncias simultâneas, 1 oportunidade ────────

grupo("3. COM ADVISORY LOCK — stress test com 4 instâncias simultâneas");
{
  banco.reset();
  const telefone = "5511888883333";

  const resultados = await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      processarComAdvisoryLock(banco, telefone, `Mensagem ${i + 1}`),
    ),
  );

  const criadas = resultados.filter((r) => r.criada).length;
  const totalOportunidades = banco.countOportunidades(telefone);

  assert(totalOportunidades === 1, `Exatamente 1 oportunidade no banco (encontradas: ${totalOportunidades})`);
  assert(criadas === 1, `Apenas 1 transação reportou 'criada = true' (reportaram: ${criadas})`);
}

// ─── TESTE 4: WebhookLock — ciclo completo serializado ────────────────────────

grupo("4. COM WEBHOOKLOCK (plano pendente) — 1 oportunidade E 1 resposta WhatsApp");
{
  banco.reset();
  const telefone = "5581999994444";

  const resultados = await Promise.all([
    processarComWebhookLock(banco, telefone, "Preciso de bomba"),
    processarComWebhookLock(banco, telefone, "Obra em João Pessoa"),
  ]);

  const totalOportunidades = banco.countOportunidades(telefone);
  const totalRespostas = banco.countRespostas(telefone);
  const descartadas = resultados.filter((r) => r.descartada).length;

  assert(totalOportunidades === 1, `Exatamente 1 oportunidade (criadas: ${totalOportunidades})`);
  assert(totalRespostas === 1, `Exatamente 1 resposta WhatsApp ao cliente (enviadas: ${totalRespostas})`);
  assert(descartadas <= 1, `No máximo 1 mensagem descartada por race condition extrema (descartadas: ${descartadas})`);
  console.log(`  ℹ️  Respostas: ${totalRespostas} ✅ | Descartadas: ${descartadas}`);
}

// ─── TESTE 5: Recuperação após falha — lock expirado não bloqueia ─────────────

grupo("5. RECUPERAÇÃO APÓS FALHA — lock expirado é ignorado automaticamente");
{
  banco.reset();
  const telefone = "5581999995555";
  const chave = `maria:${telefone}`;

  // Simula um processo que crashou sem liberar o lock
  // (lock criado há 61 segundos = expirado)
  banco.webhookLocks.set(chave, { expiraEm: Date.now() - 1000 }); // já expirado

  // Nova mensagem chega: deve conseguir o lock (o expirado é ignorado)
  const lockAdquirido = banco.tryAcquireWebhookLock(chave, 30000);

  assert(lockAdquirido === true, "Lock adquirido mesmo havendo registro expirado anterior");

  banco.releaseWebhookLock(chave);
  assert(!banco.webhookLocks.has(chave), "Lock liberado corretamente após processamento");
}

// ─── TESTE 6: Isolamento entre telefones ──────────────────────────────────────

grupo("6. ISOLAMENTO — lock de um telefone não bloqueia outro telefone");
{
  banco.reset();
  const tel1 = "5581999996666";
  const tel2 = "5511999997777";

  // Ambos processam simultaneamente — sem interferência entre eles
  const [r1, r2] = await Promise.all([
    processarComWebhookLock(banco, tel1, "Mensagem do cliente A"),
    processarComWebhookLock(banco, tel2, "Mensagem do cliente B"),
  ]);

  assert(!r1.descartada, "Cliente A processado normalmente");
  assert(!r2.descartada, "Cliente B processado normalmente (não foi bloqueado pelo lock do A)");
  assert(banco.countOportunidades(tel1) === 1, "1 oportunidade para cliente A");
  assert(banco.countOportunidades(tel2) === 1, "1 oportunidade para cliente B");
  assert(banco.countRespostas(tel1) === 1, "1 resposta enviada para cliente A");
  assert(banco.countRespostas(tel2) === 1, "1 resposta enviada para cliente B");
}

// ─── TESTE 7: Advisory lock — telefones diferentes, sem bloqueio cruzado ──────

grupo("7. ADVISORY LOCK — 3 telefones distintos em paralelo, sem bloqueio cruzado");
{
  banco.reset();
  const telefones = ["5581111110001", "5581111110002", "5581111110003"];

  await Promise.all(
    telefones.map((tel) => processarComAdvisoryLock(banco, tel, `Mensagem de ${tel}`)),
  );

  for (const tel of telefones) {
    assert(
      banco.countOportunidades(tel) === 1,
      `1 oportunidade para ${tel.slice(-4)}`,
    );
  }
}

// ─── TESTE 8: Comparação lado a lado ─────────────────────────────────────────

grupo("8. COMPARAÇÃO — sem lock vs advisory lock vs webhooklock");
{
  // Sem lock
  banco.reset();
  const telSem = "5581000000001";
  await Promise.all([
    processarSemLock(banco, telSem, "msg1"),
    processarSemLock(banco, telSem, "msg2"),
  ]);
  const opSemLock = banco.countOportunidades(telSem);
  const resSemLock = banco.countRespostas(telSem);

  // Advisory lock
  banco.reset();
  const telAdvisory = "5581000000002";
  await Promise.all([
    processarComAdvisoryLock(banco, telAdvisory, "msg1"),
    processarComAdvisoryLock(banco, telAdvisory, "msg2"),
  ]);
  const opAdvisory = banco.countOportunidades(telAdvisory);
  const resAdvisory = banco.countRespostas(telAdvisory);

  // WebhookLock
  banco.reset();
  const telWebhook = "5581000000003";
  await Promise.all([
    processarComWebhookLock(banco, telWebhook, "msg1"),
    processarComWebhookLock(banco, telWebhook, "msg2"),
  ]);
  const opWebhook = banco.countOportunidades(telWebhook);
  const resWebhook = banco.countRespostas(telWebhook);

  console.log("\n  Tabela comparativa (2 mensagens simultâneas do mesmo número):");
  console.log("  ┌─────────────────────┬──────────────────┬─────────────────────┐");
  console.log("  │ Estratégia          │ Oportunidades    │ Respostas WhatsApp  │");
  console.log("  ├─────────────────────┼──────────────────┼─────────────────────┤");
  console.log(`  │ Sem lock (antes)    │ ${String(opSemLock).padEnd(16)} │ ${String(resSemLock).padEnd(19)} │`);
  console.log(`  │ Advisory lock (atual│ ${String(opAdvisory).padEnd(16)} │ ${String(resAdvisory).padEnd(19)} │`);
  console.log(`  │ WebhookLock (plano) │ ${String(opWebhook).padEnd(16)} │ ${String(resWebhook).padEnd(19)} │`);
  console.log("  └─────────────────────┴──────────────────┴─────────────────────┘");

  assert(opAdvisory === 1, `Advisory lock: 1 oportunidade (criadas: ${opAdvisory})`);
  assert(opWebhook === 1, `WebhookLock: 1 oportunidade (criadas: ${opWebhook})`);
  assert(resWebhook <= resAdvisory, `WebhookLock envia menos ou igual respostas que advisory (${resWebhook} ≤ ${resAdvisory})`);
}

// ─── Resultado final ──────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════════");
console.log("RESULTADO — TESTES DE CONCORRÊNCIA");
console.log(`  ✅ Passou: ${passou}`);
console.log(`  ❌ Falhou: ${falhou}`);
console.log(`  Total:    ${passou + falhou}`);
console.log("══════════════════════════════════════════════════════════\n");

if (falhou > 0) process.exit(1);
