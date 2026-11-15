// ARQUIVO: lib/agentes/maria/__tests__/memoria.test.ts
// Testes da Memória Inteligente — MARIA (Frente 1).
// Executar com: npx tsx lib/agentes/maria/__tests__/memoria.test.ts
//
// NÃO requer DB, NÃO requer LLM, NÃO requer network.
// Testa formatarContextoMaria() e comportamentos do contexto de sessão.

import { formatarContextoMaria } from "../contexto";
import type { MensagemSessao, OportunidadeContexto, HistoricoContexto } from "../contexto";

// ─── Utilidades ───────────────────────────────────────────────────────────────

let passou = 0;
let falhou = 0;

function assert(condicao: boolean, descricao: string) {
  if (condicao) {
    console.log(`  ✅ ${descricao}`);
    passou++;
  } else {
    console.error(`  ❌ FALHOU: ${descricao}`);
    falhou++;
  }
}

function grupo(nome: string) {
  console.log(`\n── ${nome} ──`);
}

// ─── Dados de teste ───────────────────────────────────────────────────────────

const mensagens2turnos: MensagemSessao[] = [
  { direcao: "ENTRADA", conteudo: "Oi, preciso de uma bomba lança" },
  { direcao: "SAIDA",   conteudo: "Olá! Posso ajudar. Qual cidade?" },
  { direcao: "ENTRADA", conteudo: "São Paulo, preciso para setembro" },
  { direcao: "SAIDA",   conteudo: "Ótimo! Qual volume estimado?" },
];

const oportunidade: OportunidadeContexto = {
  titulo: "WhatsApp - Carlos / São Paulo",
  tipoServico: "BOMBA_LANCA",
  descricao: "Lead recebido via WhatsApp.",
};

const historicos: HistoricoContexto[] = [
  // [ATUALIZADO 15/11/2026] dataContato agora é campo obrigatório do tipo
  { resumo: "WhatsApp de Carlos (5511999990000)", detalhes: "Mensagem: quero bomba\nResposta Maria: Olá!", dataContato: null },
];

// ─── 1. Contexto vazio ────────────────────────────────────────────────────────

grupo("1. Contexto completamente vazio (novo contato)");
{
  const ctx = formatarContextoMaria({ mensagensSessao: [], oportunidade: null, historicos: [] });
  assert(ctx === "", "Retorna string vazia quando não há dados");
  assert(ctx.length === 0, "Comprimento é 0");
}

// ─── 2. Apenas sessão atual ───────────────────────────────────────────────────

grupo("2. Apenas mensagens da sessão (sem histórico CRM)");
{
  const ctx = formatarContextoMaria({ mensagensSessao: mensagens2turnos, oportunidade: null, historicos: [] });
  assert(ctx.includes("Histórico recente desta conversa"), "Cabeçalho de sessão presente");
  assert(ctx.includes("Cliente: Oi, preciso de uma bomba lança"), "Primeira mensagem do cliente presente");
  assert(ctx.includes("Maria: Olá! Posso ajudar. Qual cidade?"), "Primeira resposta da Maria presente");
  assert(ctx.includes("Cliente: São Paulo, preciso para setembro"), "Segunda mensagem do cliente presente");
}

// ─── 3. Ordem cronológica das mensagens ──────────────────────────────────────

grupo("3. Mensagens aparecem em ordem cronológica (antiga → recente)");
{
  const ctx = formatarContextoMaria({ mensagensSessao: mensagens2turnos, oportunidade: null, historicos: [] });
  const posMsg1 = ctx.indexOf("preciso de uma bomba lança");
  const posMsg2 = ctx.indexOf("Qual cidade?");
  const posMsg3 = ctx.indexOf("São Paulo, preciso para setembro");
  assert(posMsg1 < posMsg2, "Primeira mensagem antes da segunda");
  assert(posMsg2 < posMsg3, "Segunda mensagem antes da terceira");
}

// ─── 4. Sessão + HistoricoContato ────────────────────────────────────────────

grupo("4. Sessão atual + histórico CRM anteriores");
{
  const ctx = formatarContextoMaria({ mensagensSessao: mensagens2turnos, oportunidade: null, historicos });
  assert(ctx.includes("Histórico recente desta conversa"), "Cabeçalho de sessão presente");
  assert(ctx.includes("WhatsApp de Carlos"), "Histórico CRM presente");
  const posSessao = ctx.indexOf("Histórico recente desta conversa");
  const posHistorico = ctx.indexOf("WhatsApp de Carlos");
  assert(posSessao < posHistorico, "Sessão aparece ANTES do histórico CRM");
}

// ─── 5. Oportunidade aberta no CRM ───────────────────────────────────────────

grupo("5. Oportunidade aberta no CRM aparece no contexto");
{
  const ctx = formatarContextoMaria({ mensagensSessao: [], oportunidade, historicos: [] });
  assert(ctx.includes("Oportunidade aberta existente:"), "Cabeçalho de oportunidade presente");
  assert(ctx.includes("WhatsApp - Carlos / São Paulo"), "Título da oportunidade presente");
  assert(ctx.includes("BOMBA_LANCA"), "TipoServico presente");
}

// ─── 6. Sessão antes da oportunidade ─────────────────────────────────────────

grupo("6. Sessão atual aparece ANTES da oportunidade aberta");
{
  const ctx = formatarContextoMaria({ mensagensSessao: mensagens2turnos, oportunidade, historicos: [] });
  const posSessao = ctx.indexOf("Histórico recente desta conversa");
  const posOpor = ctx.indexOf("Oportunidade aberta existente:");
  assert(posSessao < posOpor, "Sessão antes da oportunidade (sessão é mais imediata)");
}

// ─── 7. Limite de 3000 chars ──────────────────────────────────────────────────

grupo("7. Limite de 3000 caracteres respeitado");
{
  const muitasMensagens: MensagemSessao[] = Array.from({ length: 50 }, (_, i) => ({
    direcao: i % 2 === 0 ? "ENTRADA" : "SAIDA",
    conteudo: `Mensagem de teste número ${i} com conteúdo repetitivo para encher o buffer de contexto da Maria. `.repeat(3),
  }));
  const ctx = formatarContextoMaria({ mensagensSessao: muitasMensagens, oportunidade, historicos });
  assert(ctx.length <= 3000, `Contexto não excede 3000 chars (tamanho: ${ctx.length})`);
}

// ─── 8. Sem sessão — só histórico CRM ────────────────────────────────────────

grupo("8. Sem sessão — retorna apenas histórico CRM (backward compatible)");
{
  const ctx = formatarContextoMaria({ mensagensSessao: [], oportunidade, historicos });
  assert(!ctx.includes("Histórico recente desta conversa"), "Cabeçalho de sessão ausente quando não há mensagens");
  assert(ctx.includes("Oportunidade aberta existente:"), "Oportunidade presente");
  assert(ctx.includes("WhatsApp de Carlos"), "Histórico presente");
}

// ─── 9. Histórico ordenado cronologicamente (antigo → recente) ───────────────

grupo("9. Histórico CRM: sessões passadas em ordem cronológica (antiga → recente)");
{
  // [ATUALIZADO 15/11/2026] dataContato agora é campo obrigatório do tipo
  const historicosMultiplos: HistoricoContexto[] = [
    { resumo: "Contato mais antigo — sessão 1", detalhes: null, dataContato: null },
    { resumo: "Contato intermediário — sessão 2", detalhes: null, dataContato: null },
    { resumo: "Contato mais recente — sessão 3", detalhes: null, dataContato: null },
  ];
  // A função recebe do banco em ordem DESC (recente primeiro) e reverte
  const ctx = formatarContextoMaria({ mensagensSessao: [], oportunidade: null, historicos: historicosMultiplos });
  const pos1 = ctx.indexOf("sessão 1");
  const pos2 = ctx.indexOf("sessão 2");
  const pos3 = ctx.indexOf("sessão 3");
  assert(pos1 > pos2, "sessão 1 (mais antiga) aparece depois de sessão 2 no contexto (ordem DESC invertida = mais antigas primeiro no texto)");
  assert(pos2 > pos3, "sessão 2 depois de sessão 3");
}

// ─── 10. Detalhe da mensagem de sessão: prefixo "Maria:" e "Cliente:" ────────

grupo("10. Prefixo correto: 'Cliente:' para ENTRADA, 'Maria:' para SAIDA");
{
  const msgs: MensagemSessao[] = [
    { direcao: "ENTRADA", conteudo: "Mensagem do cliente" },
    { direcao: "SAIDA",   conteudo: "Resposta da Maria" },
  ];
  const ctx = formatarContextoMaria({ mensagensSessao: msgs, oportunidade: null, historicos: [] });
  assert(ctx.includes("Cliente: Mensagem do cliente"), "Prefixo 'Cliente:' para ENTRADA");
  assert(ctx.includes("Maria: Resposta da Maria"), "Prefixo 'Maria:' para SAIDA");
  assert(!ctx.includes("João:"), "Prefixo 'João:' nunca aparece no contexto da Maria");
}

// ─── Resultado final ──────────────────────────────────────────────────────────

console.log("\n══════════════════════════════════════");
console.log(`RESULTADO — MARIA MEMÓRIA`);
console.log(`  ✅ Passou: ${passou}`);
console.log(`  ❌ Falhou: ${falhou}`);
console.log(`  Total:    ${passou + falhou}`);
console.log("══════════════════════════════════════\n");

if (falhou > 0) process.exit(1);
