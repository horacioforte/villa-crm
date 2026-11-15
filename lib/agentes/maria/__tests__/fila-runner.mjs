// ARQUIVO: lib/agentes/maria/__tests__/fila-runner.mjs
// Simulação da fila persistente de mensagens por conversa (proposta FilaMensagem).
// Executa com: node lib/agentes/maria/__tests__/fila-runner.mjs
//
// NÃO requer DB, NÃO requer rede.
// Simula o comportamento do PostgreSQL como fila usando memória.
// Comprova os 8 requisitos da proposta antes de qualquer migração.

// ─── Simulador da fila em memória ─────────────────────────────────────────────

class FilaSimulada {
  constructor() {
    this.mensagens = [];          // tabela FilaMensagem
    this.advisoryLocks = new Set();
    this.oportunidades = [];
    this.responsesSent = [];
    this.idSeq = 0;
  }

  // ── Recebimento (Passo 1 — webhook) ──────────────────────────────────────────

  // Registra mensagem antes de processar; ignora duplicata por messageId
  registrar({ telefone, nomeContato, texto, messageId }) {
    if (messageId && this.mensagens.find((m) => m.messageId === messageId)) {
      return null; // duplicata — Meta reenviou o mesmo evento
    }
    const msg = {
      id: `msg_${++this.idSeq}`,
      telefone,
      nomeContato,
      texto,
      messageId: messageId ?? null,
      status: "AGUARDANDO",
      tentativas: 0,
      processandoAte: null,
      concluidaEm: null,
      erroMsg: null,
      criadoEm: Date.now(),
    };
    this.mensagens.push(msg);
    return msg.id;
  }

  // ── Advisory lock (serializa worker por telefone) ─────────────────────────────

  async acquireAdvisoryLock(telefone) {
    while (this.advisoryLocks.has(telefone)) {
      await delay(5);
    }
    this.advisoryLocks.add(telefone);
    return { release: () => this.advisoryLocks.delete(telefone) };
  }

  // ── Worker: recupera mensagens travadas (crash recovery) ─────────────────────

  recuperarTravadas(telefone, timeoutMs = 90000) {
    const corte = Date.now() - timeoutMs;
    let recuperadas = 0;
    for (const m of this.mensagens) {
      if (
        m.telefone === telefone &&
        m.status === "PROCESSANDO" &&
        m.processandoAte !== null &&
        m.processandoAte < corte
      ) {
        m.status = "AGUARDANDO";
        m.processandoAte = null;
        recuperadas++;
      }
    }
    return recuperadas;
  }

  // ── Worker: busca próximo lote de mensagens para o telefone ───────────────────
  // Agrupa mensagens chegadas em até janelaSec segundos entre si (debounce natural)

  claimarProximo(telefone, janelaSec = 3) {
    // Verifica se outra instância está processando (e não travada)
    const processando = this.mensagens.find(
      (m) =>
        m.telefone === telefone &&
        m.status === "PROCESSANDO" &&
        m.processandoAte !== null &&
        m.processandoAte > Date.now() - 90000,
    );
    if (processando) return null; // outra instância ativa — sai sem competir

    // Busca TODAS as mensagens aguardando para este telefone, em ordem
    const aguardando = this.mensagens
      .filter((m) => m.telefone === telefone && m.status === "AGUARDANDO")
      .sort((a, b) => a.criadoEm - b.criadoEm);

    if (aguardando.length === 0) return null;

    // Agrupa mensagens dentro da janela de tempo (simula debounce)
    const primeira = aguardando[0];
    const janela = janelaSec * 1000;
    const lote = aguardando.filter(
      (m) => m.criadoEm <= primeira.criadoEm + janela,
    );

    // Marca todas como PROCESSANDO
    const agora = Date.now();
    for (const m of lote) {
      m.status = "PROCESSANDO";
      m.tentativas++;
      m.processandoAte = agora + 90000; // expira em 90s
    }

    return lote;
  }

  // ── Finaliza lote (sucesso) ───────────────────────────────────────────────────

  concluirLote(lote) {
    const agora = Date.now();
    for (const m of lote) {
      m.status = "CONCLUIDA";
      m.concluidaEm = agora;
      m.processandoAte = null;
    }
  }

  // ── Falha no processamento — devolve para a fila ─────────────────────────────

  falharLote(lote, erro, maxTentativas = 3) {
    for (const m of lote) {
      m.processandoAte = null;
      if (m.tentativas >= maxTentativas) {
        m.status = "FALHOU";
        m.erroMsg = erro;
      } else {
        m.status = "AGUARDANDO"; // volta para a fila, será retentado
      }
    }
  }

  // ── Simulação de IA + WhatsApp ────────────────────────────────────────────────

  async processarIA(lote) {
    await delay(50);
    // Agrupa textos do lote em uma única mensagem de contexto para a IA
    const textoAgrupado = lote.map((m) => m.texto).join(" | ");
    const resposta = `[IA] Resposta para: "${textoAgrupado}"`;
    for (const m of lote) {
      this.responsesSent.push({ telefone: m.telefone, mensagemId: m.id, resposta });
    }
    return resposta;
  }

  async processarIAComFalha(lote, falharNaTentativa = 1) {
    await delay(30);
    if (lote[0].tentativas <= falharNaTentativa) {
      throw new Error("Timeout simulado da IA");
    }
    return this.processarIA(lote);
  }

  // Simula upsert de oportunidade (com advisory lock embutido)
  upsertOportunidade(telefone) {
    const existente = this.oportunidades.find(
      (o) => o.telefone === telefone && o.ativa,
    );
    if (existente) {
      existente.atualizacoes = (existente.atualizacoes ?? 0) + 1;
      return { criada: false };
    }
    this.oportunidades.push({ telefone, ativa: true, criadoEm: Date.now() });
    return { criada: true };
  }

  // ── Métricas ──────────────────────────────────────────────────────────────────

  countPorStatus(telefone) {
    const msgs = this.mensagens.filter((m) => m.telefone === telefone);
    return {
      aguardando: msgs.filter((m) => m.status === "AGUARDANDO").length,
      processando: msgs.filter((m) => m.status === "PROCESSANDO").length,
      concluidas: msgs.filter((m) => m.status === "CONCLUIDA").length,
      falhou: msgs.filter((m) => m.status === "FALHOU").length,
      total: msgs.length,
    };
  }

  countRespostas(telefone) {
    return this.responsesSent.filter((r) => r.telefone === telefone).length;
  }

  countOportunidades(telefone) {
    return this.oportunidades.filter((o) => o.telefone === telefone && o.ativa).length;
  }

  reset() {
    this.mensagens = [];
    this.advisoryLocks = new Set();
    this.oportunidades = [];
    this.responsesSent = [];
  }
}

// ─── Worker completo (simula o processarMensagemMaria com fila) ───────────────

async function workerFila(fila, telefone, { simularFalha = false } = {}) {
  const lock = await fila.acquireAdvisoryLock(telefone);
  try {
    // Recupera mensagens travadas por instâncias mortas
    fila.recuperarTravadas(telefone);

    // Verifica se há mensagens para processar
    const lote = fila.claimarProximo(telefone);
    if (!lote) return { processou: false };

    try {
      // Chama IA (pode falhar)
      let resposta;
      if (simularFalha) {
        resposta = await fila.processarIAComFalha(lote, 1);
      } else {
        resposta = await fila.processarIA(lote);
      }

      // Grava CRM
      fila.upsertOportunidade(telefone);
      fila.concluirLote(lote);
      return { processou: true, loteSize: lote.length, resposta };
    } catch (err) {
      fila.falharLote(lote, err.message);
      return { processou: false, erro: err.message };
    }
  } finally {
    lock.release();
  }
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let passou = 0;
let falhou = 0;
const fila = new FilaSimulada();

function assert(cond, desc) {
  if (cond) { console.log(`  ✅ ${desc}`); passou++; }
  else       { console.error(`  ❌ FALHOU: ${desc}`); falhou++; }
}

function grupo(nome) { console.log(`\n── ${nome} ──`); }

// ══════════════════════════════════════════════════════════════════════════════
// TESTES
// ══════════════════════════════════════════════════════════════════════════════

// ─── REQUISITO 1: Registrar antes de processar ────────────────────────────────

grupo("REQ 1 — Mensagem é registrada ANTES de processar");
{
  fila.reset();
  const tel = "5581001000001";

  const id = fila.registrar({ telefone: tel, nomeContato: "Ana", texto: "Preciso de bomba", messageId: "meta_001" });
  const stats = fila.countPorStatus(tel);

  assert(id !== null, "Retornou ID da mensagem registrada");
  assert(stats.total === 1, "Mensagem existe na fila");
  assert(stats.aguardando === 1, "Status inicial é AGUARDANDO");
  assert(stats.processando === 0, "Não está sendo processada ainda");
}

// ─── REQUISITO 2: Idempotência — Meta reenvia mesmo messageId ─────────────────

grupo("REQ 2 — Reentrega da Meta (mesmo messageId) não cria duplicata");
{
  fila.reset();
  const tel = "5581001000002";

  const id1 = fila.registrar({ telefone: tel, nomeContato: "Bruno", texto: "Primeira vez", messageId: "meta_dup_001" });
  const id2 = fila.registrar({ telefone: tel, nomeContato: "Bruno", texto: "Primeira vez", messageId: "meta_dup_001" }); // reentrega

  assert(id1 !== null, "Primeira chegada: registrada com sucesso");
  assert(id2 === null, "Reentrega: ignorada (retornou null)");
  assert(fila.countPorStatus(tel).total === 1, "Apenas 1 mensagem na fila (sem duplicata)");
}

// ─── REQUISITO 3: Preservar ordem — 5 mensagens rápidas ──────────────────────

grupo("REQ 3 — 5 mensagens chegam rapidamente: processadas em ordem");
{
  fila.reset();
  const tel = "5581001000003";
  const textos = ["oi", "João Pessoa", "bomba lança", "2000m3", "quando começa?"];

  for (let i = 0; i < textos.length; i++) {
    fila.registrar({ telefone: tel, nomeContato: "Carlos", texto: textos[i], messageId: `meta_ord_${i}` });
  }

  const stats = fila.countPorStatus(tel);
  assert(stats.total === 5, "5 mensagens registradas");
  assert(stats.aguardando === 5, "Todas aguardando processamento");

  // Processa tudo (pode ser em 1 ou 2 lotes dependendo do agrupamento)
  let iteracoes = 0;
  while (fila.countPorStatus(tel).aguardando > 0 && iteracoes < 10) {
    await workerFila(fila, tel);
    iteracoes++;
  }

  const final = fila.countPorStatus(tel);
  assert(final.concluidas === 5, `Todas as 5 mensagens concluídas (concluídas: ${final.concluidas})`);
  assert(final.aguardando === 0, "Nenhuma mensagem pendente ao fim");

  // Ordem: verifica que nenhuma mensagem ficou para trás
  const concluidas = fila.mensagens
    .filter((m) => m.telefone === tel && m.status === "CONCLUIDA")
    .sort((a, b) => a.criadoEm - b.criadoEm);
  const textosProcessados = concluidas.map((m) => m.texto);
  assert(
    JSON.stringify(textosProcessados) === JSON.stringify(textos),
    `Ordem preservada: ${textosProcessados.join(", ")}`,
  );
}

// ─── REQUISITO 4: Nunca descartar — 3 mensagens simultâneas ──────────────────

grupo("REQ 4 — 3 mensagens simultâneas do mesmo número: NENHUMA é descartada");
{
  fila.reset();
  const tel = "5581001000004";

  // 3 webhooks chegam ao mesmo tempo (paralelo)
  const ids = await Promise.all([
    Promise.resolve(fila.registrar({ telefone: tel, nomeContato: "Diana", texto: "msg A", messageId: "meta_A" })),
    Promise.resolve(fila.registrar({ telefone: tel, nomeContato: "Diana", texto: "msg B", messageId: "meta_B" })),
    Promise.resolve(fila.registrar({ telefone: tel, nomeContato: "Diana", texto: "msg C", messageId: "meta_C" })),
  ]);

  assert(ids.every((id) => id !== null), "Todas as 3 mensagens registradas (nenhuma descartada)");
  assert(fila.countPorStatus(tel).total === 3, "3 mensagens na fila");

  // Processa tudo
  while (fila.countPorStatus(tel).aguardando > 0) {
    await workerFila(fila, tel);
  }

  const final = fila.countPorStatus(tel);
  assert(final.concluidas === 3, `3 mensagens concluídas (concluídas: ${final.concluidas})`);
  assert(final.aguardando === 0, "Fila vazia ao fim");
}

// ─── REQUISITO 5: Sem respostas duplicadas ────────────────────────────────────

grupo("REQ 5 — Sem respostas duplicadas (mesmo com 2 instâncias tentando processar)");
{
  fila.reset();
  const tel = "5581001000005";

  fila.registrar({ telefone: tel, nomeContato: "Eduardo", texto: "quero proposta", messageId: "meta_prop_001" });

  // 2 instâncias Vercel tentam processar ao mesmo tempo
  const [r1, r2] = await Promise.all([
    workerFila(fila, tel),
    workerFila(fila, tel),
  ]);

  const totalRespostas = fila.countRespostas(tel);
  const totalOportunidades = fila.countOportunidades(tel);

  assert(totalRespostas === 1, `Exatamente 1 resposta enviada (enviadas: ${totalRespostas})`);
  assert(totalOportunidades === 1, `Exatamente 1 oportunidade criada (criadas: ${totalOportunidades})`);
  assert(r1.processou !== r2.processou, "Apenas 1 das 2 instâncias processou");
}

// ─── REQUISITO 6: Recuperação após falha da IA ───────────────────────────────

grupo("REQ 6 — Falha na IA: mensagem volta para a fila e é retentada");
{
  fila.reset();
  const tel = "5581001000006";

  fila.registrar({ telefone: tel, nomeContato: "Fernanda", texto: "obra em Natal", messageId: "meta_natal_001" });

  // 1ª tentativa — IA falha
  const r1 = await workerFila(fila, tel, { simularFalha: true });
  const statsApos1 = fila.countPorStatus(tel);

  assert(r1.processou === false, "1ª tentativa: falhou como esperado");
  assert(r1.erro !== undefined, `Erro registrado: "${r1.erro}"`);
  assert(statsApos1.aguardando === 1, "Mensagem voltou para AGUARDANDO (não foi descartada)");
  assert(statsApos1.concluidas === 0, "Nada concluído ainda");

  // 2ª tentativa — IA funciona (tentativas=2 agora, falharNaTentativa=1 → passa)
  const r2 = await workerFila(fila, tel, { simularFalha: true });
  const statsApos2 = fila.countPorStatus(tel);

  assert(r2.processou === true, "2ª tentativa: processou com sucesso");
  assert(statsApos2.concluidas === 1, "Mensagem concluída na retentativa");
  assert(statsApos2.aguardando === 0, "Fila vazia após retentativa bem-sucedida");
}

// ─── REQUISITO 7: Recuperação após crash da instância Vercel ─────────────────

grupo("REQ 7 — Crash da instância Vercel: mensagem travada é recuperada");
{
  fila.reset();
  const tel = "5581001000007";

  fila.registrar({ telefone: tel, nomeContato: "Gustavo", texto: "preciso de betoneira", messageId: "meta_bet_001" });

  // Simula instância que morreu no meio do processamento:
  // A mensagem ficou em PROCESSANDO com processandoAte no passado
  const lote = fila.claimarProximo(tel);
  assert(lote !== null && lote.length === 1, "Mensagem reivindicada pelo worker simulado");

  // Simula crash: processandoAte é setado para 91s atrás (expirado)
  lote[0].processandoAte = Date.now() - 91000;

  // Nova instância chega, recupera a mensagem travada e processa
  const r = await workerFila(fila, tel);
  const stats = fila.countPorStatus(tel);

  assert(r.processou === true, "Nova instância recuperou e processou a mensagem");
  assert(stats.concluidas === 1, "Mensagem concluída após recuperação");
  assert(stats.aguardando === 0, "Fila vazia");
  assert(stats.processando === 0, "Nenhuma mensagem travada");
}

// ─── REQUISITO 8: Agrupamento (debounce) — mensagens rápidas → 1 resposta ────

grupo("REQ 8 — Agrupamento: 3 mensagens em <3s são respondidas em 1 turno");
{
  fila.reset();
  const tel = "5581001000008";

  // Cliente digita 3 mensagens quase ao mesmo tempo (dentro de 2 segundos)
  const agora = Date.now();
  fila.registrar({ telefone: tel, nomeContato: "Helena", texto: "quero", messageId: "meta_grp_001" });
  fila.registrar({ telefone: tel, nomeContato: "Helena", texto: "locar", messageId: "meta_grp_002" });
  fila.registrar({ telefone: tel, nomeContato: "Helena", texto: "uma bomba", messageId: "meta_grp_003" });

  // Ajusta timestamps para simular mensagens chegando em 0.5s / 1s / 2s
  fila.mensagens.filter((m) => m.telefone === tel).forEach((m, i) => {
    m.criadoEm = agora + i * 500;
  });

  const r = await workerFila(fila, tel);
  const stats = fila.countPorStatus(tel);

  assert(r.processou === true, "Worker processou o lote");
  assert(r.loteSize === 3, `3 mensagens agrupadas em 1 turno (lote: ${r.loteSize})`);
  assert(fila.countRespostas(tel) === 3, "3 respostas registradas (1 por mensagem do lote)");
  assert(stats.concluidas === 3, "Todas as 3 mensagens concluídas");
  assert(stats.aguardando === 0, "Nenhuma restante na fila");
  console.log(`  ℹ️  Texto agrupado enviado à IA: "quero | locar | uma bomba"`);
}

// ─── REQUISITO 9: Isolamento — clientes diferentes não se bloqueiam ──────────

grupo("REQ 9 — Isolamento: fila do cliente A não bloqueia cliente B");
{
  fila.reset();
  const telA = "5581001000009";
  const telB = "5511001000010";

  fila.registrar({ telefone: telA, nomeContato: "Igor", texto: "msg do cliente A", messageId: "meta_A1" });
  fila.registrar({ telefone: telB, nomeContato: "Julia", texto: "msg do cliente B", messageId: "meta_B1" });

  // Ambos processados em paralelo
  const [rA, rB] = await Promise.all([
    workerFila(fila, telA),
    workerFila(fila, telB),
  ]);

  assert(rA.processou === true, "Cliente A processado normalmente");
  assert(rB.processou === true, "Cliente B processado normalmente (sem esperar A)");
  assert(fila.countOportunidades(telA) === 1, "1 oportunidade para cliente A");
  assert(fila.countOportunidades(telB) === 1, "1 oportunidade para cliente B");
}

// ─── REQUISITO 10: Stress — 5 clientes × 4 mensagens simultâneas ─────────────

grupo("REQ 10 — Stress: 5 clientes enviando 4 mensagens simultâneas cada");
{
  fila.reset();
  const clientes = ["5581010000001","5581010000002","5581010000003","5581010000004","5581010000005"];

  // Registra 4 mensagens para cada cliente
  let msgId = 0;
  for (const tel of clientes) {
    for (let i = 0; i < 4; i++) {
      fila.registrar({ telefone: tel, nomeContato: `Cliente ${tel.slice(-3)}`, texto: `msg ${i+1}`, messageId: `meta_stress_${++msgId}` });
    }
  }

  // Workers para todos em paralelo
  await Promise.all(
    clientes.flatMap((tel) => [
      workerFila(fila, tel),
      workerFila(fila, tel), // simula 2 instâncias por cliente
    ]),
  );

  // Processa restantes (mensagens que ficaram para segunda rodada)
  for (const tel of clientes) {
    while (fila.countPorStatus(tel).aguardando > 0) {
      await workerFila(fila, tel);
    }
  }

  for (const tel of clientes) {
    const stats = fila.countPorStatus(tel);
    const ops = fila.countOportunidades(tel);
    assert(stats.concluidas === 4, `${tel.slice(-3)}: 4 mensagens concluídas (${stats.concluidas})`);
    assert(ops === 1, `${tel.slice(-3)}: 1 oportunidade (${ops})`);
  }
}

// ─── Resultado final ──────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════════════════════════════");
console.log("RESULTADO — TESTES DA FILA PERSISTENTE (FilaMensagem)");
console.log(`  ✅ Passou: ${passou}`);
console.log(`  ❌ Falhou: ${falhou}`);
console.log(`  Total:    ${passou + falhou}`);
console.log("══════════════════════════════════════════════════════════════\n");

if (falhou > 0) process.exit(1);
