// ARQUIVO: scripts/base-nacional/robo-gratuito.ts
// REGRA: nunca remover. Apenas acrescentar.
// Executa o robô gratuito pelo terminal (alternativa ao botão da tela). Só no branch isolado autorizado.
// Uso: npx tsx scripts/base-nacional/robo-gratuito.ts --uf=PE [--limite=50] [--sem-sites] [--relatorio=arquivo.json]
// Nesta etapa só PE é aceito (Brasil depende de autorização expressa do Horácio).

import { writeFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma/client";
import { carregarAmbienteIsolado } from "../../lib/base-nacional/ambiente";
import { executarRobo } from "../../lib/base-nacional/robo/executar";

export const ENDPOINT_AUTORIZADO = "ep-gentle-king-ajo60u4q";
const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.split("=")[1];

async function main() {
  const uf = (arg("uf") ?? "").toUpperCase();
  if (uf !== "PE") throw new Error("Nesta etapa o robô só está autorizado para PE.");
  const amb = carregarAmbienteIsolado();
  if (amb.endpoint !== ENDPOINT_AUTORIZADO) throw new Error(`BLOQUEADO: endpoint ${amb.endpointMascarado} não é o branch autorizado.`);
  console.log(`[robo] branch autorizado (${amb.endpointMascarado}) · UF ${uf}`);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: amb.url }) });
  try {
    const r = await executarRobo({
      db, uf, limite: arg("limite") ? Number(arg("limite")) : undefined, visitarSites: !process.argv.includes("--sem-sites"),
      log: m => console.log(`[robo] ${m}`),
    });
    const { itens, ...total } = r;
    console.log("[robo] RESUMO", JSON.stringify(total));
    const rel = arg("relatorio");
    if (rel) writeFileSync(rel, JSON.stringify(r, null, 1));
  } finally {
    await db.$disconnect();
  }
}
main().catch(e => { console.error("[robo] ERRO", e instanceof Error ? e.message : e); process.exit(1); });
