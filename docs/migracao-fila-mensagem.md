# Procedimento de Migração — FilaMensagem

**Versão:** 15/11/2026  
**Branch de desenvolvimento:** atual (não pushar antes desta migração)  
**Requer autorização de Horácio** antes de qualquer execução em produção.

---

## O que esta migração faz

Cria a tabela `FilaMensagem` e o enum `StatusFilaMensagem` no banco de produção (Neon).  
Sem esta migração, `lib/agentes/maria/fila.ts` não funciona (mantém `@ts-nocheck` e não é chamado pelo webhook).

---

## Pré-requisitos

1. **Backup do banco de produção** — antes de qualquer migração, criar um snapshot no Neon:
   - Acesse: https://console.neon.tech → projeto villa-crm → Branch `main` → `Snapshots`
   - Crie um snapshot com o nome `pre-fila-mensagem-YYYYMMDD`
   - Confirme que o snapshot está disponível antes de prosseguir

2. **Variáveis de ambiente disponíveis localmente:**
   ```bash
   # .env.local deve ter DIRECT_URL e DATABASE_URL apontando para produção
   cat .env.local | grep -E "^(DIRECT_URL|DATABASE_URL)" | head -2
   ```

3. **Nenhum deploy em andamento** — verificar na dashboard Vercel que não há build ativo.

---

## Passo a passo

### 1. Verificar diferença de schema

```bash
cd ~/Desktop/villa-crm
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --shadow-database-url "$SHADOW_DATABASE_URL"
```

Deve mostrar exatamente: criação de `StatusFilaMensagem` enum e tabela `FilaMensagem`.  
Se mostrar outras diferenças, **não prosseguir** e verificar o schema.

### 2. Executar a migração em produção

```bash
cd ~/Desktop/villa-crm
npx prisma migrate deploy
```

> ⚠️ **NUNCA** usar `prisma migrate dev` em produção. Apenas `migrate deploy`.

### 3. Verificar que a tabela foi criada

```bash
# Via psql ou Neon SQL Editor:
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'FilaMensagem';

SELECT enum_range(NULL::"StatusFilaMensagem");
```

Deve retornar a tabela e os valores: `{AGUARDANDO,PROCESSANDO,CONCLUIDA,FALHOU}`.

### 4. Regenerar o Prisma Client

```bash
cd ~/Desktop/villa-crm
npx prisma generate
```

### 5. Remover o @ts-nocheck de fila.ts

```bash
# Remover a linha: // @ts-nocheck
# (linha 8 de lib/agentes/maria/fila.ts)
sed -i '' '/^\/\/ @ts-nocheck$/d' lib/agentes/maria/fila.ts
```

Ou manualmente no editor: remover `// @ts-nocheck` do arquivo.

### 6. Validar TypeScript e build local

```bash
cd ~/Desktop/villa-crm
npx tsc --noEmit
npm run build
```

Ambos devem passar com 0 erros.

### 7. Configurar CRON_SECRET na Vercel

```bash
# Gerar um UUID aleatório para o secret do cron:
uuidgen
# Exemplo: 7F2A4B1C-8E3D-4F5A-9B2C-1A6D7E8F9012
```

Na dashboard Vercel → projeto villa-crm → Settings → Environment Variables:
- Adicionar `CRON_SECRET` = o UUID gerado
- Escopo: Production (e Preview se quiser testar)

### 8. Deploy para produção

```bash
git add .
git commit -m "feat: FilaMensagem fila + integração route.ts + cron recovery + memória longo prazo"
git push
```

A Vercel fará o deploy automaticamente. Monitorar o deploy em:  
https://vercel.com/villaempreendimentos/villa-crm/deployments

### 9. Verificar cron na Vercel

Após o deploy, confirmar que o cron aparece em:  
Vercel → projeto → Cron Jobs → `/api/cron/maria-fila-recovery` (a cada 5min)

---

## Verificação pós-deploy

Enviar uma mensagem de teste para Maria pelo WhatsApp e verificar:

1. **Logs Vercel** → Webhook responde HTTP 200 em < 500ms
2. **Logs Vercel** → after() processa a mensagem em background
3. **Banco Neon** → `SELECT * FROM "FilaMensagem" ORDER BY "criadoEm" DESC LIMIT 5;`
   - Mensagem aparece com status `CONCLUIDA`
4. **WhatsApp** → Resposta recebida normalmente

---

## Rollback

Se algo der errado após a migração:

```sql
-- Via Neon SQL Editor ou psql:
DROP TABLE IF EXISTS "FilaMensagem";
DROP TYPE IF EXISTS "StatusFilaMensagem";
```

Depois:
1. Desfazer o registro de migração: `DELETE FROM "_prisma_migrations" WHERE migration_name = '20261115120000_add_fila_mensagem';`
2. Reverter o deploy para a versão anterior no Vercel
3. O webhook voltará ao modo direto (sem fila) automaticamente

---

## Notas técnicas

- **`@ts-nocheck` em fila.ts:** permanece até `prisma generate` ser executado com sucesso localmente (passo 4).
- **after() e Vercel:** executa dentro do mesmo `maxDuration = 90s`. Tempo médio por lote: ~8s.
- **Recovery automático:** se after() for interrompido, `processandoAte` expira em 90s e o cron recupera.
- **Cron de recovery:** `/api/cron/maria-fila-recovery` a cada 5 minutos — garante que mensagens não fiquem presas indefinidamente, mesmo sem novos webhooks.
- **Isolamento:** FilaMensagem é exclusiva da Maria. João não usa este mecanismo.
- **Custo adicional:** R$ 0 — usa o Neon existente, sem novos serviços.
