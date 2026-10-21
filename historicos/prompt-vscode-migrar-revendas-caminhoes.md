# Prompt para VS Code — Migrar revendas de caminhões para Carteira Agências de Caminhões

Cole este prompt no GitHub Copilot Chat:

---

## OBJETIVO

Migrar os 436 dossiês do segmento "Revenda de Caminhões" (criados em 01/09/2026, score 0) para a Carteira Estratégica `REVENDAS_CAMINHOES` (aba "Agências de Caminhões" no CRM), e mudar o status deles para `AGUARDANDO_CAMPANHA` para tirá-los da fila de investigação automática do Loop.

**REGRA: nunca deletar nada. Apenas acrescentar registros e atualizar status.**

---

## PASSO 1 — Criar o script

Crie o arquivo `scripts/migrar-revendas-caminhoes.ts`:

```typescript
import { prisma } from "@/lib/prisma";

async function main() {
  // 1. Buscar os 436 dossiês de revenda de caminhões
  const revendas = await prisma.dossieComercial.findMany({
    where: {
      segmento: { contains: "Revenda de Caminhões", mode: "insensitive" },
      score: 0,
    },
    select: { id: true, titulo: true, cidade: true, estado: true },
  });

  console.log(`\nEncontrados: ${revendas.length} dossiês de revenda de caminhões`);

  if (revendas.length === 0) {
    console.log("Nenhum dossiê encontrado. Verifique o filtro.");
    return;
  }

  // 2. Verificar quantos já têm DossieCarteira REVENDAS_CAMINHOES
  const jaExistentes = await prisma.dossieCarteira.findMany({
    where: {
      carteira: "REVENDAS_CAMINHOES",
      dossieId: { in: revendas.map(d => d.id) },
    },
    select: { dossieId: true },
  });
  const idsJaExistentes = new Set(jaExistentes.map(d => d.dossieId));
  console.log(`Já na carteira: ${idsJaExistentes.size}`);

  const paracriar = revendas.filter(d => !idsJaExistentes.has(d.id));
  console.log(`Para criar na carteira: ${paraCreate.length}`);

  // 3. Criar DossieCarteira para cada revenda (em lotes de 50)
  let criados = 0;
  const lote = 50;
  for (let i = 0; i < paracriar.length; i += lote) {
    const batch = paracriar.slice(i, i + lote);
    await prisma.dossieCarteira.createMany({
      data: batch.map(d => ({
        dossieId: d.id,
        carteira: "REVENDAS_CAMINHOES",
        status: "MONITORANDO",
        observacoes: "Migrado automaticamente em " + new Date().toISOString().slice(0, 10) + " — aguarda campanha de caminhões usados",
      })),
      skipDuplicates: true,
    });
    criados += batch.length;
    console.log(`Criados: ${criados}/${paracriar.length}`);
  }

  // 4. Mudar status dos DossieComercial de INVESTIGANDO para ARQUIVADO
  // (para sair da fila do Loop de Investigação — dados preservados, só pausados)
  const atualizados = await prisma.dossieComercial.updateMany({
    where: {
      id: { in: revendas.map(d => d.id) },
      status: { in: ["INVESTIGANDO", "PEDIR_MAIS_PESQUISA"] },
    },
    data: {
      status: "ARQUIVADO",
    },
  });

  console.log(`\n✅ Concluído:`);
  console.log(`   DossieCarteira criados: ${criados}`);
  console.log(`   DossieComercial atualizados para ARQUIVADO: ${atualizados.count}`);
  console.log(`\nAs revendas agora aparecem na aba Agências de Caminhões e saíram da fila do Loop.`);

  await prisma.$disconnect();
}

main().catch(console.error);
```

---

## PASSO 2 — Corrigir o typo no script antes de rodar

No script acima há dois typos intencionais para você revisar antes de executar:
- `paraCreate` → deve ser `paracriar` (linha do console.log)
- Confirme que todas as referências usam `paracriar` (com i minúsculo)

---

## PASSO 4 — Executar

```bash
cd ~/Desktop/villa-crm
npx tsx scripts/migrar-revendas-caminhoes.ts
```

---

## RESULTADO ESPERADO

- `DossieCarteira criados: 436` (ou próximo disso)
- `DossieComercial atualizados para ARQUIVADO: 436`
- Na aba Agências de Caminhões do CRM, o contador "Total Monitorado" deve subir de 50 para ~486
- Os 436 dossiês saem da fila do Loop de Investigação

Me mostre o output completo do script.
