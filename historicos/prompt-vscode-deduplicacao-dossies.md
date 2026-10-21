# Prompt para VS Code — Deduplicação de Dossiês antes de criar

Cole este prompt no GitHub Copilot Chat:

---

## OBJETIVO

Antes de criar um novo Dossiê Comercial, verificar se já existe um dossiê ou oportunidade com o mesmo nome/obra. Se existir, retornar o existente em vez de criar duplicata.

**REGRA: nunca remover código existente. Apenas acrescentar lógica de deduplicação.**

---

## PASSO 1 — Leia os arquivos relevantes

- `app/api/agent/dossies/route.ts` — endpoint POST que cria dossiês (aqui entra a deduplicação)
- `app/api/agent/dossie/route.ts` — endpoint de dossiê individual (se existir)
- `prisma/schema.prisma` — modelos DossieComercial e Oportunidade (ver campos disponíveis)

---

## PASSO 2 — Implemente a deduplicação no POST /api/agent/dossies

Logo no início do handler POST, **antes** de criar o dossiê, adicione a verificação:

### 2a. Buscar dossiê similar por título

```typescript
// Deduplicação: buscar dossiê com título similar
const tituloBusca = body.titulo?.trim();
if (tituloBusca) {
  const similar = await prisma.dossieComercial.findFirst({
    where: {
      titulo: { contains: tituloBusca.slice(0, 40), mode: "insensitive" },
    },
    select: {
      id: true,
      titulo: true,
      status: true,
      completude: true,
      cidade: true,
      estado: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (similar) {
    return NextResponse.json({
      jaExiste: true,
      motivo: "dossiê_similar",
      dossieExistente: similar,
      mensagem: `Dossiê similar já existe: "${similar.titulo}" (status: ${similar.status})`,
    }, { status: 200 });
  }
}
```

### 2b. Buscar oportunidade com título similar

```typescript
// Deduplicação: buscar Oportunidade com nome similar
if (tituloBusca) {
  const oportunidade = await prisma.oportunidade.findFirst({
    where: {
      nome: { contains: tituloBusca.slice(0, 40), mode: "insensitive" },
    },
    select: {
      id: true,
      nome: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (oportunidade) {
    return NextResponse.json({
      jaExiste: true,
      motivo: "oportunidade_existente",
      oportunidadeExistente: oportunidade,
      mensagem: `Oportunidade já existe: "${oportunidade.nome}" (status: ${oportunidade.status})`,
    }, { status: 200 });
  }
}
```

### 2c. Deduplicação por cidade + segmento + trecho do título (opcional, mais precisa)

Se a busca por título puro for muito restritiva (obras com nomes ligeiramente diferentes), adicione também:

```typescript
// Deduplicação secundária: cidade + segmento + palavras-chave do título
const palavrasChave = tituloBusca
  ?.split(/\s+/)
  .filter(p => p.length > 5)
  .slice(0, 3);

if (palavrasChave?.length && body.cidade) {
  for (const palavra of palavrasChave) {
    const porCidadeSegmento = await prisma.dossieComercial.findFirst({
      where: {
        cidade: { contains: body.cidade, mode: "insensitive" },
        titulo: { contains: palavra, mode: "insensitive" },
      },
      select: { id: true, titulo: true, status: true, completude: true },
    });

    if (porCidadeSegmento) {
      return NextResponse.json({
        jaExiste: true,
        motivo: "cidade_titulo_similar",
        dossieExistente: porCidadeSegmento,
        mensagem: `Dossiê similar encontrado na mesma cidade: "${porCidadeSegmento.titulo}"`,
      }, { status: 200 });
    }
  }
}
```

---

## PASSO 3 — Verifique o modelo Oportunidade no schema

Antes de implementar o Passo 2b, confirme:
1. O model `Oportunidade` existe no schema? Qual o campo de nome/título?
2. Se não existir, pule o 2b e implemente só o 2a e 2c.

---

## PASSO 4 — Atualize a resposta de sucesso da criação

Quando o dossiê for criado com sucesso, adicione `jaExiste: false` na resposta:

```typescript
return NextResponse.json({
  jaExiste: false,
  criado: true,
  dossie: novoDossie,
}, { status: 201 });
```

---

## PASSO 5 — Verifique os radares que criam dossiês

Procure nos arquivos de skills e agentes por chamadas ao endpoint `/api/agent/dossies` (POST). Para cada um:

1. Após a chamada POST, verifique se a resposta tem `jaExiste: true`
2. Se sim, logue: `"Dossiê já existe — ignorando criação: [titulo]"`
3. Não trate como erro — é comportamento esperado

Arquivos prováveis:
- `skills/radar-joao-*/` (skills do Cowork)
- `lib/agentes/joao/radar*.ts` (se existir)
- `app/api/agent/` (outros endpoints de radar)

---

## PASSO 6 — Teste

Rode esta query no banco para confirmar que há duplicatas hoje:

```sql
SELECT titulo, COUNT(*) as total, array_agg(status) as statuses
FROM "DossieComercial"
GROUP BY titulo
HAVING COUNT(*) > 1
ORDER BY total DESC
LIMIT 20;
```

Se houver duplicatas, mostre a lista para que possamos arquivar as redundantes manualmente.

---

## RESULTADO ESPERADO

- POST `/api/agent/dossies` com título já existente → retorna `{ jaExiste: true, dossieExistente: {...} }` com status 200 (não cria)
- POST com título novo → cria normalmente, retorna `{ jaExiste: false, criado: true, dossie: {...} }` com status 201
- Os radares param de criar duplicatas silenciosamente
- Obras já em oportunidade (perdida ou em andamento) não viram dossiê novo

Me mostre o código implementado e o resultado da query de duplicatas.
