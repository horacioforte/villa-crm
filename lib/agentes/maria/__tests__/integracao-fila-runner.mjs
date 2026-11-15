#!/usr/bin/env node
// ARQUIVO: lib/agentes/maria/__tests__/integracao-fila-runner.mjs
// Testes integrados da FilaMensagem + handler-fila + route.ts (simulados).
// Não acessa banco real. Simula o fluxo completo do webhook com after().
// ACRESCENTADO (15/11/2026 — Fila Persistente Maria v1)
//
// Uso: node lib/agentes/maria/__tests__/integracao-fila-runner.mjs

// ─── Simulação da infraestrutura ─────────────────────────────────────────────

class BancoDados {
  constructor() {
    this.mensagens = new Map(); // id → registro
    this.idSeq = 0;
  }

  inserir(payload) {
    if (payload.messageId) {
      for (const m of this.mensagens.values()) {
        if (m.messageId === payload.messageId) return null; // duplicata
      }
    }
    const id = `msg_${++this.idSeq}`;
    this.mensagens.set(id, {
      id,
      telefone: payload.telefone,
      nomeContato: payload.nomeContato,
      texto: payload.texto,
      messageId: payload.messageId ?? null,
      messageType: payload.messageType ?? "text",
      status: "AGUARDANDO",
      tentativas: 0,
      processandoAte: null,
      concluidaEm: null,
      erroMsg: null,
      criadoEm: new Date(),
    });
    return id;
  }

  findPorTelefoneStatus(telefone, status) {
    return [...this.mensagens.values()]
      .filter((m) => m.telefone === telefone && m.status === status)
      .sort((a, b) => a.criadoEm - b.criadoEm);
  }

  countStatus(status) {
    return [...this.mensagens.values()].filter((m) => m.status === status).length;
  }

  update(id, patch) {
    const m = this.mensagens.get(id);
    if (m) this.mensagens.set(id, { ...m, ...patch });
  }

  todos() {
    return [...this.mensagens.values()];
  }
}

// ─── Simulação da FilaMensagem (sem banco real) ───────────────────────────────

class FilaSimulada {
  constructor(banco) {
    this.banco = banco;
    this.LOCK_TTL_MS = 90_000;
    this.MAX_TENTATIVAS = 3;
    this.JANELA_MS = 4_000;
    this.advisoryLocks = new Set(); // simula pg_advisory_xact_lock
  }

  async registrarNaFila(payload) {
    return this.banco.inserir(payload);
  }

  async acquireAdvisoryLock(telefone) {
    if (this.advisoryLocks.has(telefone)) return false;
    this.advisoryLocks.add(telefone);
    return true;
  }

  releaseAdvisoryLock(telefone) {
    this.advisoryLocks.delete(telefone);
  }

  async claimarProximoLote(telefone) {
    // Verifica lock ativo
    const agora = Date.now();
    const processandoAtivo = this.banco
      .findPorTelefoneStatus(telefone, "PROCESSANDO")
      .some((m) => m.processandoAte && m.processandoAte.getTime() > agora);
    if (processandoAtivo) return null;

    const aguardando = this.banco.findPorTelefoneStatus(telefone, "AGUARDANDO");
    if (aguardando.length === 0) return null;

    const primeira = aguardando[0];
    const janelaFim = new Date(primeira.criadoEm.getTime() + this.JANELA_MS);
    const lote = aguardando.filter((m) => m.criadoEm <= janelaFim);

    const expiraEm = new Date(agora + this.LOCK_TTL_MS);
    for (const m of lote) {
      this.banco.update(m.id, {
        status: "PROCESSANDO",
        tentativas: m.tentativas + 1,
        processandoAte: expiraEm,
      });
    }

    return lote.map((m) => ({
      ...m,
      status: "PROCESSANDO",
      tentativas: m.tentativas + 1,
    }));
  }

  async concluirLote(ids) {
    for (const id of ids) {
      this.banco.update(id, {
        status: "CONCLUIDA",
        concluidaEm: new Date(),
        processandoAte: null,
      });
    }
  }

  async falharLote(ids, erro) {
    for (const id of ids) {
      const m = [...this.banco.mensagens.values()].find((x) => x.id === id);
      if (!m) continue;
      if (m.tentativas >= this.MAX_TENTATIVAS) {
        this.banco.update(id, { status: "FALHOU", erroMsg: erro, processandoAte: null });
      } else {
        this.banco.update(id, { status: "AGUARDANDO", processandoAte: null });
      }
    }
  }

  async recuperarTravadas(telefone) {
    const corte = new Date(Date.now() - this.LOCK_TTL_MS);
    const travadas = this.banco
      .findPorTelefoneStatus(telefone, "PROCESSANDO")
      .filter((m) => m.processandoAte && m.processandoAte < corte);
    for (const m of travadas) {
      this.banco.update(m.id, { status: "AGUARDANDO", processandoAte: null });
    }
    return travadas.length;
  }

  async processarFilaParaTelefone(telefone, processarLote) {
    let lotesProcessados = 0;
    let erros = 0;

    // Advisory lock simula pg_advisory_xact_lock
    const acquired = await this.acquireAdvisoryLock(telefone);
    if (!acquired) return { lotesProcessados: 0, erros: 0, bloqueado: true };

    try {
      for (let rodada = 0; rodada < 20; rodada++) {
        await this.recuperarTravadas(telefone);
        const loteAtual = await this.claimarProximoLote(telefone);
        if (!loteAtual) break;

        try {
          await processarLote(loteAtual);
          await this.concluirLote(loteAtual.map((m) => m.id));
          lotesProcessados++;
        } catch (err) {
          await this.falharLote(loteAtual.map((m) => m.id), err.message);
          erros++;
        }
      }
    } finally {
      this.releaseAdvisoryLock(telefone);
    }

    return { lotesProcessados, erros };
  }
}

// ─── Framework de teste ───────────────────────────────────────────────────────

let pass = 0;
let fail = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.error(`  ✗ ${label}`);
    fail++;
  }
}

async function grupo(nome, fn) {
  console.log(`\n${nome}`);
  try {
    await fn();
  } catch (e) {
    console.error(`  ✗ EXCEÇÃO: ${e.message}`);
    fail++;
  }
}

// ─── Simulação do fluxo do webhook ───────────────────────────────────────────

function simularWebhook(fila, { telefone, nomeContato, texto, messageId }) {
  return fila.registrarNaFila({ telefone, nomeContato, texto, messageId, messageType: "text" });
}

function simularAfter(fn) {
  // after() real executa depois do return. Aqui simulamos como Promise resolvida.
  return Promise.resolve().then(fn);
}

// ─── Testes ───────────────────────────────────────────────────────────────────

await grupo("T1 — Fluxo completo do webhook: registro → after() → conclusão", async () => {
  const banco = new BancoDados();
  const fila = new FilaSimulada(banco);
  const whatsappEnviados = [];
  const crmEscritos = [];

  // Webhook chega
  const filaId = await simularWebhook(fila, {
    telefone: "5581999001001",
    nomeContato: "Construtora Alfa",
    texto: "Preciso de bomba lança em Recife",
    messageId: "msg-wh-001",
  });

  assert(filaId !== null, "Mensagem registrada na fila com ID único");
  assert(banco.countStatus("AGUARDANDO") === 1, "Status inicial: AGUARDANDO");

  // Webhook retorna HTTP 200. after() dispara em background.
  await simularAfter(async () => {
    await fila.processarFilaParaTelefone("5581999001001", async (lote) => {
      whatsappEnviados.push({ tel: lote[0].telefone, texto: lote[0].texto });
      crmEscritos.push({ tel: lote[0].telefone });
    });
  });

  assert(whatsappEnviados.length === 1, "WhatsApp enviado exatamente 1 vez");
  assert(crmEscritos.length === 1, "CRM escrito exatamente 1 vez");
  assert(banco.countStatus("CONCLUIDA") === 1, "Mensagem marcada CONCLUIDA");
  assert(banco.countStatus("AGUARDANDO") === 0, "Fila esvaziada");
});

await grupo("T2 — Idempotência Meta (mesmo messageId → não reenvia)", async () => {
  const banco = new BancoDados();
  const fila = new FilaSimulada(banco);
  const whatsappEnviados = [];

  // Meta reenvia a mesma mensagem (mesmo messageId)
  const id1 = await simularWebhook(fila, {
    telefone: "5581999002002",
    nomeContato: "Cliente B",
    texto: "Quero alugar bomba",
    messageId: "meta-id-reentrega",
  });
  const id2 = await simularWebhook(fila, {
    telefone: "5581999002002",
    nomeContato: "Cliente B",
    texto: "Quero alugar bomba",
    messageId: "meta-id-reentrega", // mesmo id
  });

  assert(id1 !== null, "Primeira mensagem registrada");
  assert(id2 === null, "Segunda (duplicata) ignorada pelo messageId único");

  await fila.processarFilaParaTelefone("5581999002002", async (lote) => {
    whatsappEnviados.push(lote[0].texto);
  });

  assert(whatsappEnviados.length === 1, "WhatsApp enviado apenas 1 vez (sem duplicata)");
  assert(banco.countStatus("CONCLUIDA") === 1, "Apenas 1 mensagem concluída");
});

await grupo("T3 — Debounce: 5 mensagens rápidas agrupadas em 1 lote", async () => {
  const banco = new BancoDados();
  const fila = new FilaSimulada(banco);
  const lotesChamados = [];

  // 5 mensagens do mesmo telefone registradas rapidamente (mesma janela de tempo)
  const agora = new Date();
  for (let i = 0; i < 5; i++) {
    const id = `${++banco.idSeq}_direct`;
    banco.mensagens.set(id, {
      id,
      telefone: "5581999003003",
      nomeContato: "Cliente C",
      texto: `msg ${i + 1}`,
      messageId: `id-rapid-${i}`,
      messageType: "text",
      status: "AGUARDANDO",
      tentativas: 0,
      processandoAte: null,
      concluidaEm: null,
      erroMsg: null,
      criadoEm: new Date(agora.getTime() + i * 500), // 500ms entre mensagens (< 4s)
    });
  }

  await fila.processarFilaParaTelefone("5581999003003", async (lote) => {
    lotesChamados.push(lote.length);
  });

  assert(lotesChamados.length >= 1, "Pelo menos 1 lote processado");
  assert(lotesChamados[0] === 5, "Primeiro lote agrupou todas as 5 mensagens");
  assert(banco.countStatus("AGUARDANDO") === 0, "Fila completamente esvaziada");
});

await grupo("T4 — Falha no CRM após WhatsApp enviado (não retenta WhatsApp)", async () => {
  const banco = new BancoDados();
  const fila = new FilaSimulada(banco);
  const whatsappEnviados = [];
  let crmTentativas = 0;

  await fila.registrarNaFila({
    telefone: "5581999004004",
    nomeContato: "Cliente D",
    texto: "Preciso de bomba",
    messageId: "id-crm-fail",
    messageType: "text",
  });

  // Simula: WhatsApp enviado → CRM falha → handler não relança
  await fila.processarFilaParaTelefone("5581999004004", async (lote) => {
    whatsappEnviados.push("enviado");
    crmTentativas++;
    // Simula comportamento de handler-fila.ts: WhatsApp enviado antes de qualquer erro
    // Após envio: captura erro do CRM sem relançar
    try {
      throw new Error("Timeout CRM");
    } catch (crmErr) {
      // Silencioso — CRM falhou mas WhatsApp já foi
      // NÃO relança o erro
    }
    // função retorna sem erro → fila marca CONCLUIDA
  });

  assert(whatsappEnviados.length === 1, "WhatsApp enviado 1 vez");
  assert(crmTentativas === 1, "CRM tentado apenas 1 vez (sem retry)");
  assert(banco.countStatus("CONCLUIDA") === 1, "Mensagem CONCLUIDA (não AGUARDANDO nem FALHOU)");
  assert(banco.countStatus("AGUARDANDO") === 0, "Sem retry (WhatsApp já enviado)");
});

await grupo("T5 — Falha antes do WhatsApp (retenta dentro do mesmo ciclo)", async () => {
  // O loop de processarFilaParaTelefone retenta DENTRO da mesma chamada (não entre chamadas).
  // Após falha: mensagem volta para AGUARDANDO → loop pega novamente na próxima rodada.
  // Comportamento correto: 1 chamada a processarFilaParaTelefone → falha 1x → sucesso na 2a rodada.
  const banco = new BancoDados();
  const fila = new FilaSimulada(banco);
  let callCount = 0;

  await fila.registrarNaFila({
    telefone: "5581999005005",
    nomeContato: "Cliente E",
    texto: "Teste retry",
    messageId: "id-retry",
    messageType: "text",
  });

  // Callback: falha na 1ª chamada, sucede na 2ª — tudo dentro do mesmo processarFilaParaTelefone
  const { lotesProcessados, erros } = await fila.processarFilaParaTelefone(
    "5581999005005",
    async () => {
      callCount++;
      if (callCount === 1) throw new Error("Anthropic API timeout (1ª tentativa)");
      // 2ª tentativa: sem erro → concluída
    },
  );

  assert(callCount === 2, "Callback chamado 2 vezes (1 falha + 1 sucesso)");
  assert(erros === 1, "1 erro registrado pelo orquestrador");
  assert(lotesProcessados === 1, "1 lote processado com sucesso");
  assert(banco.countStatus("CONCLUIDA") === 1, "Mensagem CONCLUIDA após retry interno");
  assert(banco.countStatus("AGUARDANDO") === 0, "Fila esvaziada");
});

await grupo("T6 — Recovery de mensagem travada (after() interrompido = crash simulado)", async () => {
  const banco = new BancoDados();
  const fila = new FilaSimulada(banco);

  // Simula mensagem que ficou PROCESSANDO com processandoAte expirado (crash)
  const id = "crashed_msg";
  const passado = new Date(Date.now() - 95_000); // 95s atrás > 90s TTL
  banco.mensagens.set(id, {
    id,
    telefone: "5581999006006",
    nomeContato: "Cliente F",
    texto: "Mensagem que crashou",
    messageId: "id-crash",
    messageType: "text",
    status: "PROCESSANDO",
    tentativas: 1,
    processandoAte: passado,
    concluidaEm: null,
    erroMsg: null,
    criadoEm: new Date(Date.now() - 100_000),
  });

  assert(banco.countStatus("PROCESSANDO") === 1, "Mensagem travada em PROCESSANDO");

  const whatsappEnviados = [];

  // Cron de recovery dispara processarFilaParaTelefone
  await fila.processarFilaParaTelefone("5581999006006", async (lote) => {
    whatsappEnviados.push(lote[0].texto);
  });

  assert(whatsappEnviados.length === 1, "Mensagem travada recuperada e processada");
  assert(banco.countStatus("CONCLUIDA") === 1, "Status: CONCLUIDA após recovery");
});

await grupo("T7 — Cron de recovery: múltiplos telefones com pendências", async () => {
  const banco = new BancoDados();
  const fila = new FilaSimulada(banco);
  const telefonesProcessados = [];

  // 3 telefones com mensagens aguardando (simula o que o cron encontraria)
  const telefones = ["5581991001001", "5581991002002", "5581991003003"];
  for (const tel of telefones) {
    await fila.registrarNaFila({ telefone: tel, nomeContato: `Cliente ${tel}`, texto: "msg", messageId: `cron-${tel}`, messageType: "text" });
  }

  // Cron dispara processarFilaParaTelefone para cada telefone (via after())
  for (const tel of telefones) {
    await fila.processarFilaParaTelefone(tel, async (lote) => {
      telefonesProcessados.push(lote[0].telefone);
    });
  }

  assert(telefonesProcessados.length === 3, "3 telefones processados pelo cron");
  assert(banco.countStatus("CONCLUIDA") === 3, "Todas as 3 mensagens concluídas");
  assert(banco.countStatus("AGUARDANDO") === 0, "Fila limpa após cron");
});

await grupo("T8 — Duas instâncias Vercel (advisory lock): apenas 1 processa", async () => {
  const banco = new BancoDados();
  const fila = new FilaSimulada(banco);
  let execucoesSimultaneas = 0;
  let maxSimultaneas = 0;

  await fila.registrarNaFila({
    telefone: "5581999008008",
    nomeContato: "Cliente H",
    texto: "Teste lock",
    messageId: "id-lock-test",
    messageType: "text",
  });

  // Duas instâncias tentam processar ao mesmo tempo
  const instancia1 = fila.processarFilaParaTelefone("5581999008008", async () => {
    execucoesSimultaneas++;
    maxSimultaneas = Math.max(maxSimultaneas, execucoesSimultaneas);
    await new Promise((r) => setTimeout(r, 50));
    execucoesSimultaneas--;
  });
  const instancia2 = fila.processarFilaParaTelefone("5581999008008", async () => {
    execucoesSimultaneas++;
    maxSimultaneas = Math.max(maxSimultaneas, execucoesSimultaneas);
    await new Promise((r) => setTimeout(r, 50));
    execucoesSimultaneas--;
  });

  await Promise.all([instancia1, instancia2]);

  assert(maxSimultaneas <= 1, "Nunca mais de 1 instância processando o mesmo telefone");
  assert(banco.countStatus("CONCLUIDA") === 1, "Mensagem processada exatamente 1 vez");
});

await grupo("T9 — FALHOU após MAX_TENTATIVAS (3)", async () => {
  const banco = new BancoDados();
  const fila = new FilaSimulada(banco);
  let tentativas = 0;

  await fila.registrarNaFila({
    telefone: "5581999009009",
    nomeContato: "Cliente I",
    texto: "Mensagem que sempre falha",
    messageId: "id-always-fail",
    messageType: "text",
  });

  // 3 tentativas que sempre falham
  for (let i = 0; i < 3; i++) {
    await fila.processarFilaParaTelefone("5581999009009", async () => {
      tentativas++;
      throw new Error("API sempre indisponível");
    });
  }

  assert(tentativas === 3, "3 tentativas realizadas");
  const msg = [...banco.mensagens.values()][0];
  assert(msg.status === "FALHOU", "Status FALHOU após MAX_TENTATIVAS");
  assert(msg.erroMsg !== null, "Erro registrado em erroMsg");
});

await grupo("T10 — Isolamento: mensagens de telefones diferentes não se misturam", async () => {
  const banco = new BancoDados();
  const fila = new FilaSimulada(banco);
  const lotesPorTelefone = {};

  // 2 clientes, 2 mensagens cada
  await fila.registrarNaFila({ telefone: "11111111111", nomeContato: "A", texto: "msg A1", messageId: "a1", messageType: "text" });
  await fila.registrarNaFila({ telefone: "11111111111", nomeContato: "A", texto: "msg A2", messageId: "a2", messageType: "text" });
  await fila.registrarNaFila({ telefone: "22222222222", nomeContato: "B", texto: "msg B1", messageId: "b1", messageType: "text" });
  await fila.registrarNaFila({ telefone: "22222222222", nomeContato: "B", texto: "msg B2", messageId: "b2", messageType: "text" });

  for (const tel of ["11111111111", "22222222222"]) {
    lotesPorTelefone[tel] = [];
    await fila.processarFilaParaTelefone(tel, async (lote) => {
      for (const m of lote) {
        lotesPorTelefone[tel].push(m.texto);
      }
    });
  }

  const textoA = lotesPorTelefone["11111111111"].join(",");
  const textoB = lotesPorTelefone["22222222222"].join(",");

  assert(!textoA.includes("B"), "Cliente A não vê mensagens de B");
  assert(!textoB.includes("A"), "Cliente B não vê mensagens de A");
  assert(banco.countStatus("CONCLUIDA") === 4, "Todas as 4 mensagens concluídas");
});

// ─── Resultado final ───────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Integração FilaMensagem: ${pass + fail} assertions — ${pass} ✓  ${fail} ✗`);
if (fail > 0) process.exit(1);
