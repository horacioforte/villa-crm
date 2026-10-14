# Plano de produção — Base Nacional de Concreteiras

Criado em 14/10/2026. **Documento de planejamento — nada aqui foi executado.** Qualquer passo
deste plano só pode rodar contra produção depois de autorização explícita do Horácio, migration
por migration, seguindo `docs/GOVERNANCA_DATABASE_MIGRATIONS.md` (regra permanente do projeto,
vale para toda feature — este plano complementa aquele documento, não o substitui).

Hoje a Base Nacional vive **só** no branch Neon de teste `base-nacional-concreteiras`
(endpoint `ep-gentle-king-ajo60u4q`). As 5 migrations abaixo têm, cada uma, o cabeçalho
"Produção: proibido" — ou seja, a própria migration já deixa registrado que precisa de
autorização nova para rodar fora do branch de teste.

## 1. Escopo: as migrations v4 → v7 (e a fundação que elas dependem)

Ordem exata de aplicação (é a ordem cronológica das pastas em `prisma/migrations/`; o Prisma
já aplica nessa ordem, mas documentando aqui para conferência manual):

| # | Pasta | Nome | O que acrescenta |
|---|---|---|---|
| 0 (pré-requisito) | `20261002120000_add_base_nacional_concreteiras` | Fase 1 (fundação) | 7 enums + 12 tabelas novas (`ConcreteiraCandidata`, `ReceitaEstabelecimento` etc.) |
| v4 | `20261005120000_base_nacional_v4_validacao_contatos` | Validação manual, contatos, pessoas | Qualificação comercial por equipamento, histórico detalhado |
| v5 | `20261008160000_base_nacional_v5_robo_fila` | Robô gratuito + fila de verificação | Tabelas do robô e da fila humana |
| v6 | `20261012200000_base_nacional_v6_joao_enriquecimento` | Preparação técnica do João | Enriquecimento de decisores (colunas/tabelas novas) |
| v7 | `20261013180000_base_nacional_v7_fila_comercial_joao` | Fila comercial do João | Categorias A/B/C e decisão humana |

**Todas as 5 são estritamente aditivas** (conferido no cabeçalho de cada arquivo `migration.sql`):
só criam enum/tabela/coluna opcional novos. Nenhuma tem `DROP`, `TRUNCATE`, remoção de coluna,
mudança de tipo incompatível ou recriação de tabela — ou seja, nenhuma se qualifica como
"alteração destrutiva" pela Seção 6 da governança. Mesmo assim, este plano trata como se
precisasse de todo o cuidado da Seção 6 (backup, rollback, janela, aprovação), por ser a
primeira vez que a Base Nacional toca produção.

**Pendência a confirmar antes de aplicar**: rodar `prisma migrate status` (seguindo a Seção 3
da governança) para checar se existe alguma outra migration pendente de outra frente no mesmo
diretório — a Seção 5 da governança é explícita: `migrate deploy` aplica **todas** as pendentes,
não só as da Base Nacional.

## 2. Backup (antes de qualquer migration)

1. Confirmar com a Vercel/Neon se o projeto de produção tem **PITR** (point-in-time recovery)
   ativo e qual a janela de retenção.
2. Além do PITR automático do Neon, tirar um **branch Neon manual** de produção imediatamente
   antes da migration (`neon branches create --name pre-base-nacional-prod-AAAA-MM-DD`), que
   funciona como snapshot restaurável independente do PITR.
3. Registrar o nome do branch de backup e o horário exato neste documento (preencher na hora).
4. Backup confirmado e registrado é pré-requisito do passo 3 (preflight) — nunca pular.

## 3. Ordem de execução recomendada

1. Preflight completo da Seção 3 da governança (`migrate status`, advisory lock, `prisma
   generate`, `tsc --noEmit`, suíte de testes, leitura read-only no Neon confirmando a estrutura
   esperada, aprovação humana explícita citando as 5 migrations por nome).
2. Backup (Seção 2 deste documento).
3. `prisma migrate deploy --config prisma.config.ts` (ou o config de produção equivalente) —
   aplica as 5 migrations pendentes em sequência, numa única operação.
4. Pós-deploy completo da Seção 4 da governança (`migrate status`, conferir `_prisma_migrations`,
   `prisma generate`, `tsc --noEmit`, testes, validação funcional, registro de horário/autor).
5. Só depois do passo 4 confirmado: cópia dos dados do branch de teste (Seção 4 deste documento).

As migrations criam só a **estrutura** (tabelas/colunas vazias). Rodar as migrations sozinhas
não traz nenhuma candidata, estabelecimento ou decisão para produção — isso é um passo
separado e deliberado (Seção 4), nunca automático.

## 4. Cópia dos dados do branch de teste para produção

### 4.1 Por que não é só rodar os scripts de novo

Dois tipos de dado, tratados de formas diferentes:

- **Dado reproduzível** (Receita Federal, robô gratuito, triagem): poderia, em tese, ser
  recriado rodando os scripts direto em produção (`importar-receita.ts`, `robo-gratuito.ts`
  etc.). Mas isso levaria horas/dias de novo e poderia convergir para resultados levemente
  diferentes.
- **Dado humano, não reproduzível** (decisões de validação manual, decisões comerciais da fila
  do João, observações, contatos/pessoas marcados como inválidos): só existe no branch de
  teste. **Rodar os scripts de novo em produção perde todo esse trabalho.**

Por isso o plano é copiar os dados já existentes (`pg_dump`/`COPY`), preservando os IDs, em vez
de reprocessar.

### 4.2 Tabelas a copiar, na ordem de dependência (pai antes do filho)

```
1.  SegmentoEmpresa
2.  ReceitaCompetencia
3.  ReceitaEstabelecimento          (FK → ReceitaCompetencia)
4.  ReceitaMudanca                  (FK → ReceitaCompetencia)
5.  ConcreteiraCandidata            (FK opcional → Empresa, Usuario — ver 4.3)
6.  ConcreteiraCandidataUnidade     (FK → ConcreteiraCandidata)
7.  ConcreteiraTriagem              (FK → ConcreteiraCandidata)
8.  ConcreteiraVinculo              (FK → ConcreteiraCandidata × 2)
9.  ConcreteiraRoboCache            (sem FK para candidata)
10. ConcreteiraEvidencia            (FK opcional → ConcreteiraCandidata, Empresa)
11. ConcreteiraCandidataContato     (FK → ConcreteiraCandidata; opcional → Unidade, Usuario)
12. ConcreteiraCandidataPessoa      (FK → ConcreteiraCandidata; opcional → Usuario)
13. ConcreteiraPotencialEquipamento (FK → ConcreteiraCandidata; opcional → Unidade, Evidência, Usuario)
14. ConcreteiraValidacaoHistorico   (FK opcional → ConcreteiraCandidata, Empresa, Usuario)
15. EmpresaSegmento                 (FK → Empresa, SegmentoEmpresa — só se já houver vínculo real)
16. EmpresaUnidade                  (FK → Empresa, ConcreteiraCandidataUnidade — só se já houver vínculo real)
17. EmpresaValidacaoConcreteira     (FK → Empresa — só se já houver vínculo real)
18. JoaoEnriquecimentoGrupo         (FK opcional → Usuario)
19. JoaoEnriquecimentoCache
20. JoaoEnriquecimentoConsumo
```

**Fora da cópia, de propósito**: `RelatorioConcreteirasGerado` (é log operacional de quem
gerou qual export — não tem valor de negócio para carregar do ambiente de teste; produção
vai gerar o seu próprio histórico a partir do primeiro uso real).

### 4.3 Pendência crítica a resolver ANTES de copiar — IDs de `Usuario`

Várias tabelas acima referenciam `Usuario` (`vinculadoPorId`, `validadoPorId`,
`qualificadoPorId`, `decisaoPorId`, `registradoPorId`, `verificadoPorId`, `avaliadoPorId`).

Se o branch Neon de teste foi criado como um branch de verdade do Neon (point-in-time fork de
produção), os IDs de `Usuario` **coincidem** com os de produção — a cópia funciona direto. Se o
branch foi montado de outra forma (seed manual, `Usuario` recriado com outros IDs), os FKs
quebram ou — pior — apontam para a pessoa errada em produção.

**Antes de copiar, confirmar** (leitura, nas duas pontas): para cada ID de `Usuario` referenciado
nas tabelas acima, o e-mail/nome bate entre o branch de teste e produção. Qualquer ID sem
correspondência exata vira `null` na cópia (nunca um palpite de "parecido").

### 4.4 Dados fictícios (demo) — nunca entram em produção

Os seguintes prefixos de ID identificam dados de demonstração e **devem ser excluídos
explicitamente** da cópia (`WHERE id NOT LIKE 'demo-bn-%'` e equivalentes nas tabelas-filha):

- `demo-bn-*` (ver `scripts/base-nacional/demo-dados-branch.ts`)
- Candidatas com CNPJ propositalmente inválido (raiz começando em `9000000*`/`900000*` nos
  scripts de demonstração)
- Qualquer `ReceitaCompetencia` com `fonteUrl` começando em `demonstracao://` ou
  `teste://` ou `amostra-ficticia://`

### 4.5 Mecânica recomendada (documentação — não executar hoje)

```bash
# Para cada tabela, na ordem da Seção 4.2, do branch de teste para produção:
pg_dump "$URL_BRANCH_TESTE" \
  --data-only --table='"ConcreteiraCandidata"' \
  --no-owner --no-privileges \
  | grep -v "^-- " \
  > concreteira-candidata.sql
# revisar o arquivo (conferir que não tem id demo-bn-* nem CNPJ de teste) antes de:
psql "$URL_PRODUCAO" -f concreteira-candidata.sql
```

Alternativa mais segura (permite filtrar os `demo-bn-*` na própria extração, sem depender de
revisão manual do arquivo): `COPY (SELECT * FROM "ConcreteiraCandidata" WHERE id NOT LIKE
'demo-bn-%') TO STDOUT` no branch de teste, encanado para `COPY "ConcreteiraCandidata" FROM
STDIN` em produção, tabela por tabela, na ordem da Seção 4.2.

Candidato a virar um script reaproveitável (`scripts/base-nacional/copiar-para-producao.ts`,
sempre `--dry-run` por padrão) — não construído hoje; ver pendências.

## 5. Verificação pós-cópia

1. Contagem de linhas por tabela: branch de teste (sem `demo-bn-*`) == produção (depois da
   cópia).
2. Nenhuma linha com `id LIKE 'demo-bn-%'` em produção, em nenhuma das 20 tabelas.
3. `SELECT count(*) FROM "ConcreteiraCandidata" WHERE "cnpjBasico" NOT IN (SELECT "cnpjBasico"
   FROM ... Receita real)` — confirmar zero candidatas fictícias coladas.
4. Toda FK para `Usuario` resolve para um usuário existente em produção (nenhum órfão).
5. Abrir a Fila Comercial do João (`/comercial/concreteiras/base/joao`) em produção e conferir
   visualmente uma amostra de grupos A, B e C.
6. Gerar Excel e PDF em produção e conferir que os números batem com a contagem da Seção 5.1.
7. Confirmar que nenhuma mensagem foi enviada, nenhuma Oportunidade/Tarefa foi criada pela
   cópia (ela só insere nas 20 tabelas da Base Nacional, nunca nas tabelas comerciais do CRM).

## 6. Plano de volta (rollback)

Como todas as migrations são aditivas, "desfazer" tem dois níveis bem diferentes:

**Nível 1 — só os dados copiados, migrations ficam** (caso mais provável de precisar): como
nenhuma tabela pré-existente foi alterada, basta `DELETE` nas 20 tabelas da Base Nacional em
produção, na ordem **inversa** da Seção 4.2 (filho antes do pai, por causa das FKs). As tabelas
ficam vazias, mas presentes — não afeta nenhuma outra parte do CRM. Exige aprovação explícita
antes de qualquer `DELETE` em produção (mesma regra de sempre).

**Nível 2 — reverter também a estrutura** (as 5 migrations): não existe `migrate down`
automático no Prisma. Reverter significaria escrever e revisar manualmente o SQL inverso
(`DROP TABLE`/`DROP TYPE` das 20 tabelas e 7+ enums, na ordem inversa de criação) — isso é
uma operação destrutiva de verdade e só faria sentido se as tabelas estiverem vazias (Nível 1
já aplicado) e se a decisão for abandonar a feature em produção. Não escrever esse SQL até
precisar de fato: o risco de errar a ordem/dependência num `DROP` manual é alto.

**Restauração pelo backup** (último recurso, qualquer nível): restaurar o branch Neon manual
da Seção 2, ou usar o PITR do Neon para o timestamp anterior à migration.

## 7. Checklist de deploy (para a hora de rodar de verdade, não hoje)

- [ ] Backup manual (branch Neon) criado e registrado com horário
- [ ] Preflight da governança completo, com aprovação humana explícita citando as 5 migrations
- [ ] Nenhuma outra migration pendente de outra frente misturada no deploy
- [ ] `prisma migrate deploy` executado
- [ ] Pós-deploy da governança completo
- [ ] IDs de `Usuario` conferidos (Seção 4.3) antes de copiar qualquer dado
- [ ] Cópia de dados feita tabela por tabela, na ordem da Seção 4.2, excluindo `demo-bn-*`
- [ ] Verificação da Seção 5 completa, com números registrados
- [ ] Nenhuma mensagem/WhatsApp/e-mail disparado em nenhum momento do processo
- [ ] Resultado registrado: quem autorizou, quem executou, data/hora, o que foi feito

## Pendências (decisão do Horácio)

1. Confirmar se o branch Neon de teste é um fork real de produção (IDs de `Usuario` coincidem)
   ou foi montado de outra forma — muda o risco da Seção 4.3.
2. Decidir se vale construir `scripts/base-nacional/copiar-para-producao.ts` (com `--dry-run`
   obrigatório, no padrão dos demais scripts da Base Nacional) antes do deploy real, em vez de
   rodar os comandos manuais da Seção 4.5 na hora.
3. Confirmar com quem tem acesso ao projeto Neon/Vercel se PITR está ativo e qual a retenção,
   antes de contar só com isso como rede de segurança.
4. Decidir a janela de execução (fora de horário comercial, por segurança, já que é a primeira
   vez que a Base Nacional toca produção).
