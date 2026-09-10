// ARQUIVO: scripts/reclassificar-maturidade.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Reclassifica os dossiês existentes para o novo funil de maturidade:
//   INVESTIGANDO (A) | AGUARDANDO_VALIDACAO (B) | EM_ANALISE (C)
//   | PRONTO_PARA_ASSUMIR | ASSUMIDO | ARQUIVADO
//
// Usa a MESMA função calcularNivelInvestigacao de lib/inteligencia/maturidade.ts.
//
// Uso:
//   npx tsx scripts/reclassificar-maturidade.ts           → dry run (não altera banco)
//   npx tsx scripts/reclassificar-maturidade.ts --commit  → grava no banco
//   npx tsx scripts/reclassificar-maturidade.ts --rerun   → verifica idempotência

import "./env";
import { Client } from "pg";
import { calcularNivelInvestigacao, THRESHOLDS, type NivelLabel } from "../lib/inteligencia/maturidade";

// ─── Ordem do funil (nunca regredir) ────────────────────────────────────────
// O status de um dossiê nunca pode ir para um nível abaixo do que já estava.
// Isso preserva classificações manuais feitas antes do pipeline de maturidade.

const NIVEL_ORDEM: Record<string, number> = {
  INVESTIGANDO:         0,
  PEDIR_MAIS_PESQUISA:  1, // mapeado para EM_ANALISE mas mantém posição mínima
  AGUARDANDO_VALIDACAO: 2,
  EM_ANALISE:           3,
  PRONTO_PARA_ASSUMIR:  4,
  // ASSUMIDO e ARQUIVADO são intocáveis — nunca entram nesta lógica
};

function statusMaisAlto(atual: string, calculado: string): string {
  const ordemAtual     = NIVEL_ORDEM[atual]     ?? 0;
  const ordemCalculado = NIVEL_ORDEM[calculado] ?? 0;
  return ordemAtual >= ordemCalculado ? atual : calculado;
}

const COMMIT = process.argv.includes("--commit");
const RERUN  = process.argv.includes("--rerun");

// ─── Guardrails ───────────────────────────────────────────────────────────────
// A reclassificação NÃO cria oportunidades, prospects, campanhas,
// mensagens ou qualquer ação comercial. Apenas atualiza `status`.
// ASSUMIDO e ARQUIVADO não são alterados — saíram do funil por ação humana.

const STATUS_INTOCAVEIS = new Set(["ASSUMIDO", "ARQUIVADO"]);

// ─── Tipos mínimos ────────────────────────────────────────────────────────────

interface DossieRow {
  id: string;
  titulo: string;
  status: string;
  completude: number;
  score: number;
  potencialVilla: number | null;
  momentoVilla: number | null;
  prontidao: number | null;
  clienteFinal: string | null;
  construtora: string | null;
  epc: string | null;
  epcm: string | null;
  faseObra: string | null;
  cronograma: string | null;
  licenciamento: string | null;
  valorEstimado: string | null;
  cidade: string | null;
  estado: string | null;
  totalDecisores: number;
}

interface DecisorRow {
  nome: string | null;
  telefone: string | null;
  email: string | null;
  linkedin: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(n: number, total: number) {
  return total === 0 ? "0%" : `${Math.round((n / total) * 100)}%`;
}

function percentil(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return Math.round((sorted[lo] + sorted[hi]) / 2);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log(`\n${"═".repeat(65)}`);
  console.log("RECLASSIFICAÇÃO DE MATURIDADE — FUNIL JOÃO");
  console.log(`Modo   : ${COMMIT ? "🔴 PRODUÇÃO (--commit)" : RERUN ? "🔁 RERUN IDEMPOTÊNCIA" : "🟡 DRY-RUN"}`);
  console.log(`Thresh.: A<${THRESHOLDS.B}% | B<${THRESHOLDS.C}% | C<${THRESHOLDS.PRONTO}% | Pronto≥${THRESHOLDS.PRONTO}%+gates`);
  console.log(`${"═".repeat(65)}\n`);

  // Busca todos os dossiês (exceto intocáveis)
  const { rows: dossies } = await client.query<DossieRow>(`
    SELECT
      id, titulo, status, completude, score,
      "potencialVilla", "momentoVilla", prontidao,
      "clienteFinal", construtora, epc, epcm,
      "faseObra", cronograma, licenciamento, "valorEstimado",
      cidade, estado, "totalDecisores"
    FROM "DossieComercial"
    WHERE status NOT IN ('ASSUMIDO', 'ARQUIVADO')
    ORDER BY completude DESC, score DESC
  `);

  // Busca decisores em batch
  const ids = dossies.map(d => d.id);
  let decisoresPorId: Record<string, DecisorRow[]> = {};

  if (ids.length > 0) {
    const { rows: decisores } = await client.query<{ dossieId: string } & DecisorRow>(`
      SELECT "dossieId", nome, telefone, email, linkedin
      FROM "DecisorDossie"
      WHERE "dossieId" = ANY($1::text[])
    `, [ids]);

    for (const d of decisores) {
      if (!decisoresPorId[d.dossieId]) decisoresPorId[d.dossieId] = [];
      decisoresPorId[d.dossieId].push({
        nome: d.nome, telefone: d.telefone, email: d.email, linkedin: d.linkedin,
      });
    }
  }

  // ── Distribuição ANTES ────────────────────────────────────────────────────

  const distAntes: Record<string, number> = {};
  for (const d of dossies) {
    distAntes[d.status] = (distAntes[d.status] ?? 0) + 1;
  }
  // Intocáveis
  const { rows: intocaveis } = await client.query(
    `SELECT status, COUNT(*)::int qtd FROM "DossieComercial" WHERE status IN ('ASSUMIDO','ARQUIVADO') GROUP BY status`
  );
  for (const r of intocaveis) distAntes[r.status] = r.qtd;

  const total = dossies.length + intocaveis.reduce((s, r) => s + r.qtd, 0);

  // ── Reclassificar ────────────────────────────────────────────────────────

  type Resultado = {
    id: string;
    titulo: string;
    statusAtual: string;
    novoStatus: string;
    nivel: string;
    completude: number;
    score: number;
    gatesFaltantes: string[];
    motivo: string;
    mudou: boolean;
  };

  const resultados: Resultado[] = [];

  for (const d of dossies) {
    const decisores = decisoresPorId[d.id] ?? [];
    const resultado = calcularNivelInvestigacao(
      {
        clienteFinal: d.clienteFinal,
        construtora: d.construtora,
        epc: d.epc,
        epcm: d.epcm,
        faseObra: d.faseObra,
        cronograma: d.cronograma,
        licenciamento: d.licenciamento,
        valorEstimado: d.valorEstimado,
        cidade: d.cidade,
        estado: d.estado,
        completude: d.completude,
        totalDecisores: d.totalDecisores,
        potencialVilla: d.potencialVilla,
        momentoVilla: d.momentoVilla,
        prontidao: d.prontidao,
      },
      decisores,
    );

    // Regra "nunca regredir": preserva status manual se for mais avançado
    const novoStatus = statusMaisAlto(d.status, resultado.statusDb);

    resultados.push({
      id: d.id,
      titulo: d.titulo,
      statusAtual: d.status,
      novoStatus,
      nivel: resultado.nivel,
      completude: d.completude,
      score: d.score,
      gatesFaltantes: resultado.gatesFaltantes,
      motivo: resultado.motivo,
      mudou: d.status !== novoStatus,
    });
  }

  // ── Distribuição DEPOIS ───────────────────────────────────────────────────

  const distDepois: Record<string, number> = { ...distAntes };
  // Zera os que serão reclassificados
  for (const r of resultados) {
    distDepois[r.statusAtual] = (distDepois[r.statusAtual] ?? 0) - 1;
    distDepois[r.novoStatus]  = (distDepois[r.novoStatus]  ?? 0) + 1;
  }

  // ── Relatório ─────────────────────────────────────────────────────────────

  const mudancas = resultados.filter(r => r.mudou);
  const semMudanca = resultados.filter(r => !r.mudou);

  const completudes = dossies.map(d => d.completude);
  const scores      = dossies.map(d => d.score);

  console.log("── DISTRIBUIÇÃO DE COMPLETUDE (dossiês ativos) ─────────────────");
  console.log(`  Min=${Math.min(...completudes)}  P25=${percentil(completudes,25)}  Med=${percentil(completudes,50)}  P75=${percentil(completudes,75)}  P90=${percentil(completudes,90)}  Max=${Math.max(...completudes)}`);
  const faixas = [
    [0,19], [20,39], [40,59], [60,79], [80,100]
  ] as const;
  for (const [lo, hi] of faixas) {
    const n = completudes.filter(c => c >= lo && c <= hi).length;
    console.log(`  ${lo.toString().padStart(3)}–${hi}%: ${n.toString().padStart(4)} (${pct(n, completudes.length)})`);
  }

  console.log("\n── DISTRIBUIÇÃO DE SCORE (dossiês ativos) ──────────────────────");
  console.log(`  Min=${Math.min(...scores)}  P25=${percentil(scores,25)}  Med=${percentil(scores,50)}  P75=${percentil(scores,75)}  P90=${percentil(scores,90)}  Max=${Math.max(...scores)}`);

  console.log("\n── STATUS ANTES ─────────────────────────────────────────────────");
  for (const [s, n] of Object.entries(distAntes).sort((a, b) => b[1] - a[1]))
    console.log(`  ${s.padEnd(24)}: ${String(n).padStart(4)} (${pct(n, total)})`);

  console.log("\n── STATUS DEPOIS (proposto) ─────────────────────────────────────");
  const mapa: Record<string, string> = {
    INVESTIGANDO: "🔎 Investigação A", AGUARDANDO_VALIDACAO: "🧠 Investigação B",
    EM_ANALISE: "🎯 Investigação C", PRONTO_PARA_ASSUMIR: "🟢 Pronto Morgana",
    ASSUMIDO: "🟣 Oportunidade", ARQUIVADO: "📁 Arquivado",
  };
  for (const [s, n] of Object.entries(distDepois).sort((a, b) => b[1] - a[1])) {
    if (n > 0) console.log(`  ${(mapa[s] ?? s).padEnd(24)}: ${String(n).padStart(4)} (${pct(n, total)})`);
  }

  console.log(`\n── MUDANÇAS ─────────────────────────────────────────────────────`);
  console.log(`  Analisados : ${dossies.length}`);
  console.log(`  Com mudança: ${mudancas.length}`);
  console.log(`  Sem mudança: ${semMudanca.length}`);

  // ── Exemplos por nível ────────────────────────────────────────────────────

  const porNivel: Record<string, Resultado[]> = {};
  for (const r of resultados) {
    if (!porNivel[r.nivel]) porNivel[r.nivel] = [];
    porNivel[r.nivel].push(r);
  }

  for (const [nivel, lista] of Object.entries(porNivel)) {
    console.log(`\n── EXEMPLOS NÍVEL ${nivel} (${lista.length} dossiês, mostrando 5) ────`);
    for (const ex of lista.slice(0, 5)) {
      const gates = ex.gatesFaltantes.length > 0 ? ` ⚠️ ${ex.gatesFaltantes[0]}` : "";
      console.log(`  [${ex.completude}% / score ${ex.score}] ${ex.titulo.slice(0, 55)}${gates}`);
    }
  }

  // ── Sanity checks ─────────────────────────────────────────────────────────

  console.log("\n── SANITY CHECKS ────────────────────────────────────────────────");
  let erros = 0;

  // Score >90 com completude <20 → deve estar em A
  const altaScore = resultados.filter(r => r.score >= 90 && r.completude < 20 && r.nivel !== "A");
  if (altaScore.length > 0) {
    console.error(`  ❌ ${altaScore.length} dossiês com score≥90 + completude<20% não estão em A`);
    erros++;
  } else {
    console.log(`  ✅ Dossiês score≥90 + completude<20% → todos em A`);
  }

  // Pronto sem gates completos
  const prontoSemGates = resultados.filter(r => r.nivel === "PRONTO" && r.gatesFaltantes.length > 0);
  if (prontoSemGates.length > 0) {
    console.error(`  ❌ ${prontoSemGates.length} dossiês marcados como Pronto com gates faltando`);
    erros++;
  } else {
    console.log(`  ✅ Nenhum Pronto com gates faltando`);
  }

  // Oportunidades criadas? (não deve acontecer)
  const opGeradas = resultados.filter(r => r.novoStatus === "ASSUMIDO");
  if (opGeradas.length > 0) {
    console.error(`  ❌ BLOQUEADO: ${opGeradas.length} dossiês tentando ir para ASSUMIDO via reclassificação`);
    erros += 100; // força bloqueio
  } else {
    console.log(`  ✅ Zero oportunidades criadas automaticamente`);
  }

  // Anomalia: >90% em uma única coluna
  const totalAtivos = resultados.length;
  for (const [nivel, lista] of Object.entries(porNivel)) {
    const proporcao = lista.length / totalAtivos;
    if (proporcao > 0.90 && totalAtivos > 20) {
      console.warn(`  ⚠️  ${Math.round(proporcao*100)}% dos dossiês no Nível ${nivel} — verifique se isso reflete o estado real (pode ser correto para dados seed)`);
    }
  }

  if (erros > 0) {
    console.error(`\n🔴 BLOQUEADO — ${erros} erro(s) crítico(s). Não persistindo.`);
    await client.end();
    process.exit(1);
  }

  console.log("\n✅ Sanity checks OK");

  // ── Persistir ─────────────────────────────────────────────────────────────

  if (!COMMIT && !RERUN) {
    console.log(`\n💡 Dry run concluído. Para gravar:`);
    console.log(`   npx tsx scripts/reclassificar-maturidade.ts --commit\n`);
    await client.end();
    return;
  }

  if (RERUN) {
    // Rerun: só reporta — não altera nada
    const rerunMudancas = resultados.filter(r => r.mudou);
    if (rerunMudancas.length === 0) {
      console.log("\n✅ IDEMPOTÊNCIA CONFIRMADA — segunda execução: 0 mudanças\n");
    } else {
      console.error(`\n❌ IDEMPOTÊNCIA FALHOU — ${rerunMudancas.length} mudança(s) na segunda execução`);
      for (const r of rerunMudancas.slice(0, 5))
        console.error(`   ${r.titulo} — atual:${r.statusAtual} → novo:${r.novoStatus}`);
    }
    await client.end();
    return;
  }

  // Commit: atualiza o banco
  console.log(`\nAtualizando ${mudancas.length} dossiês...`);
  let atualizados = 0;
  let errosPersistencia = 0;

  for (const r of mudancas) {
    try {
      await client.query(
        `UPDATE "DossieComercial" SET status = $1, "updatedAt" = NOW() WHERE id = $2`,
        [r.novoStatus, r.id]
      );
      atualizados++;
      if (atualizados % 100 === 0)
        console.log(`  ... ${atualizados}/${mudancas.length} atualizados`);
    } catch (err) {
      errosPersistencia++;
      console.error(`  Erro em ${r.id}: ${err}`);
    }
  }

  console.log(`\n${"─".repeat(65)}`);
  console.log(`  Atualizados : ${atualizados}`);
  console.log(`  Sem mudança : ${semMudanca.length}`);
  console.log(`  Erros       : ${errosPersistencia}`);

  if (errosPersistencia === 0) {
    console.log(`\n✅ Reclassificação concluída com sucesso.`);
    console.log(`   Verifique: npx tsx scripts/reclassificar-maturidade.ts --rerun\n`);
  } else {
    console.error(`\n⚠️  ${errosPersistencia} erro(s) de persistência.`);
  }

  await client.end();
}

main().catch(err => { console.error("Erro fatal:", err); process.exit(1); });
