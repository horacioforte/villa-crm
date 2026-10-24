# Prompt para VS Code — Merge do branch fix/joao-historico-oportunidades

Cole este prompt no GitHub Copilot Chat:

---

## OBJETIVO

Fazer o merge do branch `fix/joao-historico-oportunidades` no `main` e garantir que está tudo funcionando em produção.

**REGRA: nunca remover código existente. Apenas merge e verificação.**

---

## PASSO 1 — Verifique o estado atual

```bash
git status
git branch
git log --oneline -5
```

Confirme que está no branch `fix/joao-historico-oportunidades` e que está limpo (sem arquivos modificados não commitados).

---

## PASSO 2 — Certifique que o TypeScript compila

```bash
npx tsc --noEmit
```

Se houver erros, corrija antes de fazer o merge. Se tiver 0 erros, prossiga.

---

## PASSO 3 — Merge para main

```bash
git checkout main
git pull origin main
git merge fix/joao-historico-oportunidades --no-ff -m "feat: histórico de oportunidades, gate PERDIDA, dedup empresas"
git push origin main
```

O `--no-ff` garante um merge commit explícito para rastreabilidade.

---

## PASSO 4 — Verifique os arquivos novos no main

Confirme que estes arquivos existem após o merge:

- `lib/inteligencia/historico-oportunidades.ts`
- `lib/inteligencia/palavras-distintivas.ts`
- `lib/empresas/encontrar-existente.ts`
- `scripts/empresas/relatorio-duplicadas.ts`
- `prisma/migrations/20261022120000_empresa_duplicada_de/migration.sql`

```bash
ls lib/inteligencia/historico-oportunidades.ts
ls lib/empresas/encontrar-existente.ts
ls scripts/empresas/relatorio-duplicadas.ts
```

---

## PASSO 5 — Confirme a migração já aplicada em produção

A migração `20261022120000_empresa_duplicada_de` já foi aplicada em produção (campo `Empresa.duplicadaDeId` existe no banco). Não precisa rodar `prisma migrate deploy` novamente — só confirme:

```bash
npx prisma migrate status
```

Deve mostrar "Database schema is up to date".

---

## PASSO 6 — Verifique o deploy na Vercel

Após o push para main, a Vercel vai fazer deploy automático. Aguarde 2–3 minutos e teste:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://villa-crm.vercel.app/api/agent/joao/investigar \
  -H "Authorization: Bearer villa-radar-2026-vila" \
  -H "Content-Type: application/json" \
  -d '{"limite": 1}'
```

Deve retornar `200`. Se retornar `500`, verifique os logs da Vercel.

---

## RESULTADO ESPERADO

- Branch `fix/joao-historico-oportunidades` mergeado em `main`
- Push para `origin/main` feito com sucesso
- Vercel deploy automático iniciado
- `npx tsc --noEmit` sem erros
- Endpoint `/api/agent/joao/investigar` respondendo 200

Me mostre o output de cada comando.
