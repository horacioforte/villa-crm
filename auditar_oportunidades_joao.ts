// Script de auditoria — oportunidades criadas nos últimos 3 dias
// Rodar com: npx tsx --env-file=.env auditar_oportunidades_joao.ts

import { prisma } from "./lib/prisma";

(async () => {
  const tresDispasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const rows = await prisma.oportunidade.findMany({
    where: { createdAt: { gte: tresDispasAtras } },
    include: { empresa: { select: { razaoSocial: true } } },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\n=== ${rows.length} oportunidade(s) criadas nos últimos 3 dias ===\n`);

  for (const r of rows) {
    const joao = r.canalOrigem === "JOAO_OUTBOUND" || r.titulo?.startsWith("[João]");
    console.log(`${joao ? "🔴 [JOÃO]" : "✅     "} ${r.titulo}`);
    console.log(`   Canal:     ${r.canalOrigem}`);
    console.log(`   Empresa:   ${r.empresa?.razaoSocial ?? "—"}`);
    console.log(`   Status:    ${r.status}  |  Temp: ${r.temperatura}`);
    console.log(`   Criado em: ${r.createdAt.toLocaleString("pt-BR")}`);
    console.log(`   ID:        ${r.id}`);
    console.log();
  }

  const joaoRows = rows.filter(
    (r) => r.canalOrigem === "JOAO_OUTBOUND" || r.titulo?.startsWith("[João]"),
  );
  console.log(`→ João criou ${joaoRows.length} oportunidade(s) sem autorização nos últimos 3 dias.`);

  await prisma.$disconnect();
})();
