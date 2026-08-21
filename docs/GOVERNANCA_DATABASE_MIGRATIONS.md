# Governança de Banco de Dados e Migrations — Villa CRM

Este documento registra regras permanentes de governança para operações de banco de dados (Neon/Postgres, único ambiente compartilhado dev/prod) no Villa CRM. Aplica-se a todas as frentes de trabalho (Mídias Sociais, Carteiras Estratégicas, João Evidências e demais futuras), não apenas à Sprint em que foi criado.

## 1. Separação de conexões (regra permanente)

- Runtime da aplicação (Next.js, API routes, `lib/prisma.ts`): usa exclusivamente `DATABASE_URL` (conexão pooled/PgBouncer via Neon).
- Prisma CLI e migrations (`generate`, `migrate status`/`deploy`, `studio`): usa exclusivamente `DIRECT_URL` (conexão direta/unpooled).
- `prisma.config.ts` deve falhar explicitamente (`throw`) se `DIRECT_URL` não estiver definida — nunca cair silenciosamente para `DATABASE_URL`.
- Nunca permitir fallback silencioso de migration para `DATABASE_URL`, em nenhuma circunstância.

## 2. Advisory locks

No preflight, confirmar que não existe advisory lock ativo que possa bloquear ou indicar outra operação Prisma/migration concorrente. Esta é uma regra geral, permanente — não amarrada a um `objid` específico.

(O `objid 72707369` é citado aqui apenas como exemplo/histórico do incidente ocorrido na Sprint 1 de Mídias Sociais, não como valor de referência universal.)

Se houver lock ativo:

- não matar o PID/processo automaticamente;
- identificar a sessão que detém o lock;
- verificar `state`, `xact_start`, `backend_type`, usuário e origem da conexão;
- qualquer `pg_terminate_backend` (ou equivalente) exige aprovação humana explícita antes de ser executado.

## 3. Preflight obrigatório antes de `migrate deploy`

1. Confirmar qual(is) migration(ões) estão pendentes (`migrate status`) e que cada uma pertence a uma frente identificada e aprovada.
2. Confirmar ausência de advisory lock ativo relevante (ver Seção 2).
3. Rodar `prisma generate` e confirmar sucesso.
4. Rodar `tsc --noEmit` e classificar quaisquer erros (novos vs. pré-existentes vs. relacionados à migration).
5. Rodar a suíte de testes relevante e registrar números exatos (sem metrificação fictícia).
6. Validar leitura read-only no Neon (SQL Editor) confirmando que a estrutura esperada pós-migration é a que será aplicada.
7. Obter aprovação humana explícita, por escrito, citando exatamente qual(is) migration(ões) serão deployadas.

## 4. Pós-deploy obrigatório

Depois de qualquer `prisma migrate deploy`:

1. rodar `npx prisma migrate status`;
2. confirmar quais migrations efetivamente foram aplicadas em `_prisma_migrations`;
3. confirmar que nenhuma migration não autorizada entrou junto;
4. validar objetos/índices/FKs esperados em leitura;
5. rodar `prisma generate`;
6. rodar `tsc --noEmit`;
7. rodar os testes relacionados;
8. validar funcionalmente a feature;
9. registrar resultado e horário do deploy;
10. registrar quem autorizou e quem executou.

Se algo inesperado tiver sido aplicado: não fazer rollback automático. Primeiro auditar o ocorrido.

## 5. Múltiplas migrations pendentes

`prisma migrate deploy` aplica **todas** as migrations pendentes disponíveis no diretório de migrations, não apenas a migration "desejada" no momento.

Portanto: se houver duas ou mais migrations pendentes de frentes diferentes, **todas** precisam ter o SQL revisado e aprovação explícita antes do deploy — não basta confirmar que a migration específica de uma frente está correta. Foi exatamente esse risco identificado na Sprint 1 (migrations de outras frentes presentes no mesmo diretório no momento do deploy).

## 6. Alterações destrutivas

Qualquer migration que contenha, direta ou indiretamente:

- `DROP`;
- `TRUNCATE`;
- remoção de coluna;
- alteração incompatível de tipo;
- recriação de tabela;
- exclusão ou transformação irreversível de dados;

exige, antes da execução:

1. backup verificado;
2. plano de rollback;
3. janela de execução definida;
4. avaliação de impacto;
5. aprovação humana explícita.

## 7. Drift de schema

Drift de schema não deve ser "corrigido" incidentalmente durante o trabalho de uma feature.

Se o Prisma identificar drift:

- parar;
- documentar o drift encontrado;
- tratar em trabalho próprio, separado da feature em andamento;
- nunca aceitar `migrate reset` para resolver automaticamente no banco Neon compartilhado.

## 8. Ações proibidas sem aprovação humana explícita

- `prisma migrate reset` no banco Neon compartilhado (dev/prod único).
- `prisma migrate dev` contra o banco Neon quando houver drift de schema.
- `prisma db push` em qualquer ambiente conectado ao Neon compartilhado.
- Qualquer `prisma migrate deploy` em produção sem o preflight da Seção 3 cumprido.

## 9. Rastreabilidade

Toda migration de produção deve deixar registrado:

- migration aplicada;
- commit correspondente;
- responsável pela execução;
- data/hora;
- ambiente/banco;
- aprovação (quem autorizou);
- resultado do preflight;
- resultado do pós-deploy.

Isso é especialmente importante porque, na Sprint 1, houve migrations aplicadas em produção cuja autoria não pôde ser determinada posteriormente ("autoria não determinada").

## 10. Segurança de credenciais

- Nunca expor connection string completa, usuário, senha ou token em logs, prints, relatórios ou conversas.
- `.env` e `.env.local` nunca são versionados (devem permanecer no `.gitignore`).
- Secrets de produção vivem em serviço apropriado de variáveis de ambiente (nunca em código ou em arquivo versionado).
- Connection strings nunca são copiadas para relatórios ou documentação.
- Documentação pode mostrar apenas host mascarado e classificação `POOLED` / `DIRECT` (nunca a string completa).
- Backup obrigatório antes de qualquer alteração destrutiva, mesmo já aprovada.
