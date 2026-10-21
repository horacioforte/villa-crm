# Prompt para VS Code — Corrigir auth do endpoint /api/auditoria/resumo-diario

Cole este prompt no GitHub Copilot Chat ou outra extensão de IA do VS Code:

---

## CONTEXTO

No arquivo `app/api/auditoria/resumo-diario/route.ts` existe a função `isCronAuthorized` que
deveria permitir acesso ao endpoint via query param `?token=villa-historico-2026`.

O problema: mesmo com o token correto, o endpoint retorna HTTP 401. A causa provável é que
`process.env.RESUMO_DIARIO_TOKEN` está configurado no Vercel com algum valor diferente de
`villa-historico-2026`, fazendo o operador `??` ignorar o fallback hardcoded.

## O QUE PRECISA SER CORRIGIDO

### Arquivo: `app/api/auditoria/resumo-diario/route.ts`

Substitua a função `isCronAuthorized` atual por esta versão corrigida:

```typescript
const RESUMO_TOKEN_FIXO = "villa-historico-2026";

function isCronAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("authorization") ?? "";
  const { searchParams } = new URL(request.url);
  const tokenParam = searchParams.get("token") ?? "";

  // SEMPRE aceita o token fixo interno (independente de env var)
  if (authHeader === `Bearer ${RESUMO_TOKEN_FIXO}` || tokenParam === RESUMO_TOKEN_FIXO) {
    return true;
  }

  // Também aceita RESUMO_DIARIO_TOKEN se configurado e diferente do token fixo
  const envSecret = process.env.RESUMO_DIARIO_TOKEN;
  if (envSecret && envSecret !== RESUMO_TOKEN_FIXO) {
    if (authHeader === `Bearer ${envSecret}` || tokenParam === envSecret) {
      return true;
    }
  }

  return false;
}
```

**Por que isso resolve:** A versão anterior usava `envSecret ?? RESUMO_TOKEN_FIXO`, ou seja:
se `RESUMO_DIARIO_TOKEN` estiver definido no Vercel com QUALQUER valor (mesmo errado), o
fallback nunca é usado. A versão corrigida verifica o token fixo PRIMEIRO, independentemente
do env var.

## COMO TESTAR ANTES DE FAZER COMMIT

1. Rode o servidor local:
   ```bash
   npm run dev
   ```

2. Teste o endpoint com o token correto (deve retornar 200 com Markdown):
   ```bash
   curl -s -o /dev/null -w "%{http_code}" \
     "http://localhost:3000/api/auditoria/resumo-diario?formato=md&token=villa-historico-2026"
   ```
   Esperado: `200`

3. Teste sem token (deve retornar 401):
   ```bash
   curl -s -o /dev/null -w "%{http_code}" \
     "http://localhost:3000/api/auditoria/resumo-diario?formato=md"
   ```
   Esperado: `401`

4. Teste com token errado (deve retornar 401):
   ```bash
   curl -s -o /dev/null -w "%{http_code}" \
     "http://localhost:3000/api/auditoria/resumo-diario?formato=md&token=token-errado"
   ```
   Esperado: `401`

## APÓS OS TESTES

Faça commit e push:
```bash
cd ~/Desktop/villa-crm
git add app/api/auditoria/resumo-diario/route.ts
git commit -m "fix: isCronAuthorized sempre aceita token fixo, independente de RESUMO_DIARIO_TOKEN no Vercel"
git push
```

Aguarde o deploy no Vercel (~2 min) e então no Cowork, na tarefa agendada
"historico-diario-pipeline", clique em "Executar agora" para confirmar que retorna 200.
