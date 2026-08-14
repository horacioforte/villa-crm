// Rodar da pasta villa-crm: node corrigir_badges.cjs
// Corrige criadoPorAgente e fonteInformacao dos 8 dossiês

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MORGANA = [
  'ute jandaia',
  'duplicação br-104',
  'consórcio nove de julho',
  'transnordestina',
];

const HORACIO = [
  'odata data center',
  'one data center',
  'datacenter ceara',
  'gwm nova fabrica',
];

async function run() {
  const dossies = await prisma.dossieComercial.findMany({
    where: { origem: 'MANUAL' },
    select: { id: true, titulo: true, criadoPorAgente: true },
  });

  console.log(`\nTotal MANUAL encontrados: ${dossies.length}\n`);

  for (const d of dossies) {
    const t = d.titulo.toLowerCase();
    const ehMorgana = MORGANA.some(m => t.includes(m));
    const ehHoracio = HORACIO.some(h => t.includes(h));

    if (ehMorgana) {
      await prisma.dossieComercial.update({
        where: { id: d.id },
        data: {
          criadoPorAgente: 'Morgana',
          fonteInformacao: 'Solicitado por Morgana',
        },
      });
      console.log(`✅ MORGANA → ${d.titulo}`);
    } else if (ehHoracio) {
      await prisma.dossieComercial.update({
        where: { id: d.id },
        data: {
          criadoPorAgente: 'Horácio',
          fonteInformacao: 'Solicitado por Horácio',
        },
      });
      console.log(`✅ HORÁCIO → ${d.titulo}`);
    } else {
      console.log(`⏭️  Sem match: ${d.titulo} [${d.criadoPorAgente}]`);
    }
  }

  console.log('\nConcluído. Recarregue a página Minhas Solicitações no CRM.');
  await prisma.$disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
