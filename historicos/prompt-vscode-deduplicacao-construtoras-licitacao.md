# Prompt para VS Code — Deduplicação: construtoras de licitação no dossiê existente

Cole este prompt no GitHub Copilot Chat:

---

## CONTEXTO

O dossiê representa a OBRA, não a construtora. Numa licitação, várias construtoras disputam a mesma obra — elas devem ser registradas como `concorrentes` dentro do mesmo dossiê, nunca como dossiês separados.

**REGRA: nunca remover código existente. Apenas acrescentar.**

---

## PASSO 1 — Leia os arquivos

- `app/api/agent/dossie/route.ts` — endpoint de criação/mesclagem (singular)
- `prisma/schema.prisma` — campo `concorrentes` do model `DossieComercial` (tipo: String?)

---

## PASSO 2 — Entenda a lógica atual de mesclagem

No endpoint POST, quando encontra duplicata, ele já mescla campos vazios. Você vai **acrescentar** a lógica de concorrentes dentro do bloco de mesclagem existente, sem substituir nada.

---

## PASSO 3 — Implemente a atualização de concorrentes

Dentro do bloco de mesclagem (quando `duplicata === true`), após identificar o dossiê existente, adicione:

```typescript
// Acrescentar construtora ao campo concorrentes se for nova
const novaConstrutora: string | undefined =
  body?.construtora?.trim() || body?.campos?.construtora?.trim();

if (novaConstrutora && dossieExistente) {
  const concorrentesAtuais: string[] = dossieExistente.concorrentes
    ? dossieExistente.concorrentes.split(",").map((c: string) => c.trim()).filter(Boolean)
    : [];

  const construtoraExistenteNoDossie =
    dossieExistente.construtora?.toLowerCase() === novaConstrutora.toLowerCase();

  const jaEhConcorrente = concorrentesAtuais.some(
    (c) => c.toLowerCase() === novaConstrutora.toLowerCase()
  );

  if (!construtoraExistenteNoDossie && !jaEhConcorrente) {
    concorrentesAtuais.push(novaConstrutora);
    const novosConcorrentes = concorrentesAtuais.join(", ");

    await prisma.dossieComercial.update({
      where: { id: dossieExistente.id },
      data: {
        concorrentes: novosConcorrentes,
        ultimaAtividade: new Date(),
      },
    });

    // Registrar no histórico
    await prisma.atualizacaoDossie.create({
      data: {
        dossieId: dossieExistente.id,
        tipo: "CAMPO_ATUALIZADO",
        titulo: `Nova construtora identificada na licitação: ${novaConstrutora}`,
        conteudo: `O radar identificou ${novaConstrutora} como participante da licitação desta obra.\nConcorrentes atualizados: ${novosConcorrentes}`,
        agente: "joao-radar",
      },
    });

    // Adicionar ao retorno
    camposEnriquecidos.push("concorrentes");
    concorrenteAdicionado = true;
  }
}
```

Declare `let concorrenteAdicionado = false;` antes do bloco de mesclagem.

---

## PASSO 4 — Atualize o retorno da resposta de duplicata

No retorno `{ duplicata: true, merged: true, ... }`, acrescente:

```typescript
concorrenteAdicionado,
mensagem: concorrenteAdicionado
  ? `Dossiê existente atualizado com nova construtora da licitação: ${novaConstrutora}`
  : `Dossiê já existente — nenhum campo novo para mesclar.`,
```

---

## PASSO 5 — Verifique o campo `concorrentes` no schema

1. O campo é `String?` (texto livre) ou tem outro tipo?
2. Se for texto livre com vírgulas, a lógica acima já funciona.
3. Se for outro formato (array, JSON), ajuste a lógica de split/join de acordo com o schema real.

---

## PASSO 6 — Teste manual

Rode esta query no banco para ver obras que têm concorrentes registrados:

```sql
SELECT titulo, cidade, estado, construtora, concorrentes
FROM "DossieComercial"
WHERE concorrentes IS NOT NULL AND concorrentes != ''
ORDER BY "ultimaAtividade" DESC
LIMIT 10;
```

Se não houver nenhum resultado, é porque o campo ainda não está sendo usado — confirma que a nova lógica é o primeiro mecanismo para popular esse campo via radar.

---

## RESULTADO ESPERADO

**Cenário:** Obra "Refinaria RNEST — Módulo 3" já existe com construtora "Odebrecht". O radar encontra a mesma obra sendo disputada também pela "Andrade Gutierrez".

- **Antes:** criava dossiê novo "Refinaria RNEST — Módulo 3" com construtora "Andrade Gutierrez"
- **Depois:** atualiza o dossiê existente → `concorrentes: "Andrade Gutierrez"`, registra no histórico, retorna `{ duplicata: true, concorrenteAdicionado: true }`

**Cenário 2:** Mesma construtora tentando criar o mesmo dossiê duas vezes → `concorrenteAdicionado: false`, sem alteração (comportamento atual mantido).

Me mostre o código implementado e o resultado da query do Passo 6.
