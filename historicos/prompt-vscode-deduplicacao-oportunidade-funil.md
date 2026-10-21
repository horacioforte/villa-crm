# Prompt para VS Code — Verificar Oportunidade no funil antes de criar dossiê

Cole este prompt no GitHub Copilot Chat:

---

## CONTEXTO

Antes de criar um dossiê novo, o sistema deve verificar se a obra já existe como Oportunidade em qualquer estágio do funil — ativa, em negociação, perdida ou ganha. Se existir, não cria dossiê novo: retorna a oportunidade encontrada para que o radar saiba que essa obra já está sendo trabalhada comercialmente.

**REGRA: nunca remover código existente. Apenas acrescentar.**

---

## PASSO 1 — Leia os arquivos

- `app/api/agent/dossie/route.ts` — endpoint de criação (onde entra a verificação)
- `prisma/schema.prisma` — model `Oportunidade`: confirme os campos disponíveis (titulo, status, stage, etc.)

---

## PASSO 2 — Mapeie os status/stages da Oportunidade

No schema, liste todos os valores possíveis do enum de status/stage de `Oportunidade`. Exemplos prováveis:
- PROSPECCAO, QUALIFICACAO, PROPOSTA, NEGOCIACAO, FECHADO_GANHO, FECHADO_PERDIDO

Queremos checar TODOS — inclusive perdidas — porque uma obra perdida pode voltar, e é melhor saber do histórico do que criar do zero.

---

## PASSO 3 — Adicione a verificação de Oportunidade no início do POST

**Antes** da verificação de dossiê duplicado existente, adicione:

```typescript
// Verificação 0: obra já existe como Oportunidade em qualquer estágio do funil?
const tituloParaBusca = body?.titulo?.trim();

if (tituloParaBusca) {
  const oportunidadeExistente = await prisma.oportunidade.findFirst({
    where: {
      titulo: { contains: tituloParaBusca.slice(0, 50), mode: "insensitive" },
    },
    select: {
      id: true,
      titulo: true,
      status: true,     // ajuste o campo conforme o schema real
      // stage: true,   // se existir campo stage/etapa
      // valor: true,   // se existir
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (oportunidadeExistente) {
    // Determina o contexto para o radar entender o que fazer
    const statusOportunidade = oportunidadeExistente.status ?? "desconhecido";
    const estaAtiva = !["FECHADO_PERDIDO", "PERDIDA", "CANCELADA"].includes(statusOportunidade);
    const foiPerdida = ["FECHADO_PERDIDO", "PERDIDA"].includes(statusOportunidade);

    return NextResponse.json({
      sucesso: false,
      jaExisteComoOportunidade: true,
      estaAtiva,
      foiPerdida,
      oportunidade: oportunidadeExistente,
      mensagem: foiPerdida
        ? `Esta obra já foi trabalhada como oportunidade e foi perdida (${statusOportunidade}). Revise antes de criar novo dossiê.`
        : `Esta obra já está no funil comercial como oportunidade ativa (${statusOportunidade}). Não criar dossiê.`,
    }, { status: 200 });
  }
}
```

**Ajuste os nomes dos campos e valores do enum** de acordo com o schema real do model `Oportunidade` — confirme antes de escrever.

---

## PASSO 4 — Verifique também por cidade + palavras-chave (busca secundária)

Se o título vier levemente diferente (ex.: "Refinaria RNEST Fase 2" vs "RNEST — Fase 2"), a busca por `contains` pode não pegar. Adicione uma segunda busca pelas primeiras palavras significativas:

```typescript
if (tituloParaBusca && !oportunidadeExistente) {
  const palavras = tituloParaBusca
    .split(/\s+/)
    .filter((p: string) => p.length > 5)
    .slice(0, 2);

  if (palavras.length >= 2 && body?.cidade) {
    // busca por cidade + palavra-chave principal
    const oportunidadePorCidade = await prisma.oportunidade.findFirst({
      where: {
        titulo: { contains: palavras[0], mode: "insensitive" },
        // cidade: { contains: body.cidade, mode: "insensitive" }, // se existir campo cidade
      },
      select: { id: true, titulo: true, status: true, createdAt: true },
      orderBy: { updatedAt: "desc" },
    });

    if (oportunidadePorCidade) {
      return NextResponse.json({
        sucesso: false,
        jaExisteComoOportunidade: true,
        oportunidade: oportunidadePorCidade,
        mensagem: `Oportunidade similar encontrada: "${oportunidadePorCidade.titulo}" (${oportunidadePorCidade.status})`,
      }, { status: 200 });
    }
  }
}
```

---

## PASSO 5 — Resultado da busca + lógica do radar

O radar (skill do Cowork) deve tratar a resposta assim:

| Resposta da API | O que o radar faz |
|---|---|
| `jaExisteComoOportunidade: true, estaAtiva: true` | Ignora — obra já está sendo trabalhada |
| `jaExisteComoOportunidade: true, foiPerdida: true` | Registra nota: "obra já foi trabalhada e perdida em [data]" — não cria dossiê |
| `duplicata: true, merged: true` | Dossiê existente atualizado — OK |
| `sucesso: true, criado: true` | Dossiê novo criado — OK |

---

## PASSO 6 — Query de verificação no banco

Rode para confirmar quantas obras existem tanto como dossiê quanto como oportunidade (sobreposição atual):

```sql
SELECT d.titulo AS titulo_dossie, d.status AS status_dossie,
       o.titulo AS titulo_oportunidade, o.status AS status_oportunidade
FROM "DossieComercial" d
JOIN "Oportunidade" o
  ON LOWER(o.titulo) ILIKE '%' || LOWER(SPLIT_PART(d.titulo, ' ', 1)) || '%'
  AND LOWER(o.titulo) ILIKE '%' || LOWER(SPLIT_PART(d.titulo, ' ', 2)) || '%'
WHERE d.status IN ('INVESTIGANDO', 'PEDIR_MAIS_PESQUISA', 'AGUARDANDO_VALIDACAO')
LIMIT 20;
```

Se retornar resultados, são obras que estão simultaneamente como dossiê ativo e oportunidade — candidatos a arquivar o dossiê manualmente.

---

## RESULTADO ESPERADO

**Cenário 1 — Obra ativa no funil:**
Radar tenta criar dossiê "UTE Jandaia — 1,2 GW". Sistema encontra oportunidade "UTE Jandaia" em NEGOCIACAO → retorna `{ jaExisteComoOportunidade: true, estaAtiva: true }` → radar ignora e registra no relatório.

**Cenário 2 — Obra perdida:**
Radar tenta criar dossiê "Ferrovia EF-170". Sistema encontra oportunidade "Ferrovia EF-170" com status FECHADO_PERDIDO → retorna `{ foiPerdida: true }` → radar registra alerta: "esta obra já foi trabalhada e perdida — revisar antes de reabrir".

**Cenário 3 — Obra nova:**
Nenhuma oportunidade encontrada → segue para verificação de dossiê duplicado → e depois cria normalmente se não houver nada.

Me mostre o código implementado e o resultado da query do Passo 6.
