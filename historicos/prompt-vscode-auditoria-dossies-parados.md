# Prompt para VS Code — Auditoria de Dossiês Parados

Cole este prompt no GitHub Copilot Chat:

---

## OBJETIVO

Auditar todos os dossiês ativos (status INVESTIGANDO ou PEDIR_MAIS_PESQUISA) e identificar por que alguns estão parados ou não evoluindo. Queremos entender padrões e corrigir o que for possível.

**REGRA: nunca deletar nada. Apenas ler e diagnosticar.**

---

## PASSO 1 — Leia os arquivos de contexto

Leia os seguintes arquivos para entender o sistema antes de começar:

- `app/api/agent/joao/investigar/route.ts` — lógica do Loop
- `lib/agentes/joao/investigador.ts` — investigador Claude
- `lib/agentes/joao/investigador-openai.ts` — investigador GPT-4o
- `lib/inteligencia/completude.ts` — cálculo de completude e missaoAtual
- `prisma/schema.prisma` — modelo DossieComercial (campos, enums, relações)

---

## PASSO 2 — Rode o diagnóstico no banco

Execute estas queries via `npx tsx` ou pelo Prisma Studio. Se não tiver DATABASE_URL local, forneça o SQL para rodar no neon.tech.

### 2a. Quantos dossiês há em cada status?

```sql
SELECT status, COUNT(*) AS total
FROM "DossieComercial"
GROUP BY status
ORDER BY total DESC;
```

### 2b. Dossiês há mais de 30 dias sem atividade (fila travada)

```sql
SELECT
  titulo,
  segmento,
  cidade,
  estado,
  status,
  completude,
  "missaoAtual",
  "ultimaAtividade"::date AS ultima_atividade,
  NOW()::date - "ultimaAtividade"::date AS dias_parado
FROM "DossieComercial"
WHERE status IN ('INVESTIGANDO', 'PEDIR_MAIS_PESQUISA')
  AND "ultimaAtividade" < NOW() - INTERVAL '30 days'
ORDER BY "ultimaAtividade" ASC
LIMIT 50;
```

### 2c. Dossiês com missaoAtual nula ou vazia (sem missão definida)

```sql
SELECT titulo, segmento, status, completude, "missaoAtual"
FROM "DossieComercial"
WHERE status IN ('INVESTIGANDO', 'PEDIR_MAIS_PESQUISA')
  AND ("missaoAtual" IS NULL OR "missaoAtual" = '')
ORDER BY completude DESC
LIMIT 30;
```

### 2d. Dossiês com completude = 0 ainda na fila

```sql
SELECT titulo, segmento, cidade, estado, status, "missaoAtual", "fonteInformacao"
FROM "DossieComercial"
WHERE status IN ('INVESTIGANDO', 'PEDIR_MAIS_PESQUISA')
  AND completude = 0
ORDER BY "ultimaAtividade" ASC
LIMIT 30;
```

### 2e. Dossiês com completude alta (≥ 60) ainda em INVESTIGANDO — deveriam estar em AGUARDANDO_VALIDACAO

```sql
SELECT titulo, segmento, status, completude, "missaoAtual"
FROM "DossieComercial"
WHERE status = 'INVESTIGANDO'
  AND completude >= 60
ORDER BY completude DESC
LIMIT 20;
```

### 2f. Histórico de atualizações: quais dossiês João nunca tocou?

```sql
SELECT d.titulo, d.segmento, d.status, d.completude, d."ultimaAtividade"::date
FROM "DossieComercial" d
WHERE d.status IN ('INVESTIGANDO', 'PEDIR_MAIS_PESQUISA')
  AND NOT EXISTS (
    SELECT 1 FROM "AtualizacaoDossie" a
    WHERE a."dossieId" = d.id
      AND a.agente = 'joao-investigador'
  )
ORDER BY d."ultimaAtividade" ASC
LIMIT 30;
```

---

## PASSO 3 — Analise os resultados e classifique os problemas

Para cada grupo identificado, classifique em uma das categorias:

| Categoria | Descrição |
|-----------|-----------|
| **SEM_MISSAO** | missaoAtual nula — João não sabe o que investigar |
| **COMPLETUDE_ZERO** | Dossiê vazio, dados insuficientes para João pesquisar |
| **NUNCA_INVESTIGADO** | João nunca tocou neste dossiê (pode estar no fundo da fila) |
| **PARADO_30_DIAS** | João investigou mas não evoluiu nos últimos 30 dias |
| **DEVERIA_VALIDAR** | completude ≥ 60, deveria estar em AGUARDANDO_VALIDACAO |
| **TITULO_GENERICO** | Título muito genérico (ex: "Obra Industrial SP") — João não consegue buscar |

---

## PASSO 4 — Verifique a lógica de `missaoAtual` no código

No arquivo `lib/inteligencia/completude.ts`:

1. Como é calculada a `missaoAtual`?
2. Existe algum caso onde ela retorna nula ou string vazia?
3. O campo `tipo` do dossiê influencia a missão? (OBRA vs outros)
4. Existe lógica para avançar a missão quando um campo é preenchido?

---

## PASSO 5 — Relatório final

Gere um relatório com:

1. **Números**: total por categoria de problema
2. **Top 10 dossiês mais parados** (com título, dias parado, categoria)
3. **Causa raiz mais comum**: qual problema aparece mais?
4. **Sugestões de correção** para cada categoria:
   - SEM_MISSAO → propor lógica para gerar missão automática baseada nos campos faltantes
   - COMPLETUDE_ZERO → sugerir regra para arquivar automaticamente após X dias sem evolução
   - DEVERIA_VALIDAR → SQL para mover os dossiês com completude ≥ 60 para AGUARDANDO_VALIDACAO
   - TITULO_GENERICO → listar títulos suspeitos para revisão manual

Me mostre o relatório completo com os resultados de cada query e as sugestões.
