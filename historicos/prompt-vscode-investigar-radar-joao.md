# Prompt para VS Code — Investigar últimas inserções do Radar João no CRM

Cole este prompt no GitHub Copilot Chat ou outra extensão de IA do VS Code:

---

## OBJETIVO

Quero saber quais foram as últimas inserções feitas pelo Radar João (agente IA) na Central de
Inteligência (tabela `DossieComercial` no banco Neon/PostgreSQL via Prisma), e por que pararam
de ser criadas após 28-29 de setembro de 2026.

## PASSO 1 — Listar os últimos dossiês criados pelo João

Execute um script TypeScript (ou use o Prisma Studio / query direta) para buscar os últimos
20 dossiês criados, ordenados do mais recente para o mais antigo:

```typescript
// scripts/investigar-radar-joao.ts
import { prisma } from "@/lib/prisma";

async function main() {
  const dossies = await prisma.dossieComercial.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      titulo: true,
      origem: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      fonteInformacao: true,
      linkFonte: true,
    },
  });

  console.log("\n=== ÚLTIMOS 20 DOSSIÊS CRIADOS ===\n");
  for (const d of dossies) {
    console.log(`[${d.createdAt.toISOString().slice(0,10)}] ${d.titulo}`);
    console.log(`  Status: ${d.status} | Origem: ${d.origem} | Fonte: ${d.fonteInformacao ?? "—"}`);
    console.log(`  ID: ${d.id}`);
    console.log();
  }

  // Contagem por origem
  const porOrigem = await prisma.dossieComercial.groupBy({
    by: ["origem"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });
  console.log("=== TOTAL POR ORIGEM ===");
  for (const o of porOrigem) {
    console.log(`  ${o.origem}: ${o._count.id} dossiês`);
  }

  // Últimas atualizações (loop de investigação)
  const atualizados = await prisma.dossieComercial.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { id: true, titulo: true, updatedAt: true, status: true },
  });
  console.log("\n=== ÚLTIMOS 10 DOSSIÊS ATUALIZADOS (LOOP) ===");
  for (const d of atualizados) {
    console.log(`[${d.updatedAt.toISOString().slice(0,10)}] ${d.titulo} — ${d.status}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
```

Execute com:
```bash
cd ~/Desktop/villa-crm
npx tsx scripts/investigar-radar-joao.ts
```

## PASSO 2 — Verificar se AGENT_API_KEY está no Vercel

Confirme que a variável `AGENT_API_KEY` está configurada no Vercel com o valor `villa-radar-2026-vila`.
Se não estiver, adicione em: Vercel → projeto villa-crm → Settings → Environment Variables.

## PASSO 3 — Verificar o endpoint de criação de dossiês

Verifique se o endpoint `POST /api/agent/dossies` (criação de dossiê pelo radar) está funcionando:

```bash
curl -s -w "\n__STATUS__:%{http_code}" \
  -X POST "https://villa-crm.vercel.app/api/agent/dossies" \
  -H "Authorization: Bearer villa-radar-2026-vila" \
  -H "Content-Type: application/json" \
  -d '{"titulo":"TESTE","origem":"LINKEDIN","tipo":"OBRA"}' 
```

Se retornar 401: AGENT_API_KEY não está no Vercel ou está com valor diferente.
Se retornar 400: endpoint OK, só faltaram campos obrigatórios.
Se retornar 200/201: funcionando normalmente.

## RESULTADO ESPERADO

Me mostre:
1. A listagem dos últimos 20 dossiês (data, título, origem, status)
2. A contagem total por origem
3. Os últimos 10 dossiês atualizados pelo loop de investigação
4. O HTTP status do teste do endpoint `/api/agent/dossies`
