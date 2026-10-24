// ARQUIVO: scripts/inteligencia/auditar-dossies-vs-oportunidades.ts
// REGRA: nunca remover. Apenas acrescentar.
// SOMENTE LEITURA — não cria, não altera, não apaga nada. Lista todos os dossiês
// não arquivados que têm uma Oportunidade relacionada (mesma empresa, mesma obra
// ou título parecido — ver lib/inteligencia/historico-oportunidades.ts) em status
// PERDIDA ou em aberto, pra revisão manual. Separa por confiança (alta/media) —
// só "alta" é o que de fato bloqueia "Pronto para Morgana" em produção
// (lib/inteligencia/maturidade.ts); "media" é informativo.
//
// Uso: npx tsx --env-file=.env.local scripts/inteligencia/auditar-dossies-vs-oportunidades.ts

import { prisma } from "@/lib/prisma";
import { buscarOportunidadesRelacionadas, oportunidadesAbertas, oportunidadesPerdidas } from "@/lib/inteligencia/historico-oportunidades";

async function main() {
  const dossies = await prisma.dossieComercial.findMany({
    where: { status: { not: "ARQUIVADO" } },
    select: { id: true, titulo: true, status: true, empresaId: true, obraId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\nDossiês não arquivados analisados: ${dossies.length}\n`);

  type Conflito = {
    dossieId: string; dossieTitulo: string; dossieStatus: string;
    oportunidadeId: string; oportunidadeTitulo: string; oportunidadeStatus: string;
    motivoPerda: string | null; motivoMatch: string; confianca: "alta" | "media";
  };

  const conflitosPerdida: Conflito[] = [];
  const conflitosAberta: Conflito[] = [];

  for (const d of dossies) {
    const relacionadas = await buscarOportunidadesRelacionadas({ titulo: d.titulo, empresaId: d.empresaId, obraId: d.obraId });

    for (const o of oportunidadesPerdidas(relacionadas)) {
      conflitosPerdida.push({
        dossieId: d.id, dossieTitulo: d.titulo, dossieStatus: d.status,
        oportunidadeId: o.id, oportunidadeTitulo: o.titulo, oportunidadeStatus: o.status,
        motivoPerda: o.motivoPerda, motivoMatch: o.motivoMatch, confianca: o.confianca,
      });
    }
    for (const o of oportunidadesAbertas(relacionadas)) {
      conflitosAberta.push({
        dossieId: d.id, dossieTitulo: d.titulo, dossieStatus: d.status,
        oportunidadeId: o.id, oportunidadeTitulo: o.titulo, oportunidadeStatus: o.status,
        motivoPerda: null, motivoMatch: o.motivoMatch, confianca: o.confianca,
      });
    }
  }

  const perdidaAlta = conflitosPerdida.filter(c => c.confianca === "alta");
  const perdidaMedia = conflitosPerdida.filter(c => c.confianca === "media");
  const abertaAlta = conflitosAberta.filter(c => c.confianca === "alta");
  const abertaMedia = conflitosAberta.filter(c => c.confianca === "media");

  console.log(`=== DOSSIÊS COM OPORTUNIDADE PERDIDA — CONFIANÇA ALTA (${perdidaAlta.length}) — bloqueiam "Pronto para Morgana" ===`);
  for (const c of perdidaAlta) {
    console.log(`- [${c.dossieStatus}] "${c.dossieTitulo}" (${c.dossieId})`);
    console.log(`    ↳ Oportunidade PERDIDA: "${c.oportunidadeTitulo}" (${c.oportunidadeId}) — motivo: ${c.motivoPerda ?? "não informado"} — match: ${c.motivoMatch}`);
  }

  console.log(`\n=== DOSSIÊS COM OPORTUNIDADE PERDIDA — CONFIANÇA MEDIA (${perdidaMedia.length}) — só informativo, não bloqueia ===`);
  for (const c of perdidaMedia) {
    console.log(`- [${c.dossieStatus}] "${c.dossieTitulo}" (${c.dossieId})`);
    console.log(`    ↳ Oportunidade PERDIDA: "${c.oportunidadeTitulo}" (${c.oportunidadeId}) — motivo: ${c.motivoPerda ?? "não informado"} — match: ${c.motivoMatch}`);
  }

  console.log(`\n=== DOSSIÊS COM OPORTUNIDADE EM ABERTO — CONFIANÇA ALTA (${abertaAlta.length}) ===`);
  for (const c of abertaAlta) {
    console.log(`- [${c.dossieStatus}] "${c.dossieTitulo}" (${c.dossieId})`);
    console.log(`    ↳ Oportunidade ${c.oportunidadeStatus}: "${c.oportunidadeTitulo}" (${c.oportunidadeId}) — match: ${c.motivoMatch}`);
  }

  console.log(`\n=== DOSSIÊS COM OPORTUNIDADE EM ABERTO — CONFIANÇA MEDIA (${abertaMedia.length}) ===`);
  for (const c of abertaMedia) {
    console.log(`- [${c.dossieStatus}] "${c.dossieTitulo}" (${c.dossieId})`);
    console.log(`    ↳ Oportunidade ${c.oportunidadeStatus}: "${c.oportunidadeTitulo}" (${c.oportunidadeId}) — match: ${c.motivoMatch}`);
  }

  const dossiesEmConflitoAlta = new Set([...perdidaAlta, ...abertaAlta].map(c => c.dossieId));
  const dossiesEmConflitoTodos = new Set([...conflitosPerdida, ...conflitosAberta].map(c => c.dossieId));

  console.log(`\n=== RESUMO ===`);
  console.log(`Dossiês analisados                         : ${dossies.length}`);
  console.log(`Dossiês com oportunidade PERDIDA (alta)    : ${new Set(perdidaAlta.map(c => c.dossieId)).size}`);
  console.log(`Dossiês com oportunidade PERDIDA (media)   : ${new Set(perdidaMedia.map(c => c.dossieId)).size}`);
  console.log(`Dossiês com oportunidade em aberto (alta)  : ${new Set(abertaAlta.map(c => c.dossieId)).size}`);
  console.log(`Dossiês com oportunidade em aberto (media) : ${new Set(abertaMedia.map(c => c.dossieId)).size}`);
  console.log(`Total em conflito (confiança alta)         : ${dossiesEmConflitoAlta.size}`);
  console.log(`Total em conflito (alta + media)           : ${dossiesEmConflitoTodos.size}`);
  console.log(`\nNenhum dado foi alterado — este script é só leitura.\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
