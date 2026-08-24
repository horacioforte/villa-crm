#!/bin/bash
# Separa o commit misto fe4a1f1 (Contratos + Mídias Sociais) em dois commits
# independentes, sem perder nenhuma linha de código.
#
# Como funciona (nada de "adivinhação" — cada arquivo misto tem uma versão
# "só Contratos" pré-calculada, verificada com diff antes de este script
# existir; ver Registro_Separacao_Commit_Sprint1.md):
#   1. git reset --soft HEAD~1   -> desfaz o commit, mantém tudo no working tree
#   2. escreve a versão "só Contratos" dos 3 arquivos mistos
#   3. commita só os arquivos de Contratos (10 arquivos, mensagem original)
#   4. restaura os 3 arquivos mistos para a versão completa
#   5. commita os arquivos de Mídias Sociais (3 mistos + os novos da Sprint 1)
#
# Rode a partir da raiz do repositório:
#   cd ~/Desktop/villa-crm
#   bash _sprint1_split/separar-commit-sprint1.sh

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

SPLIT_DIR="_sprint1_split"
EXPECTED_HEAD="fe4a1f1d4273c1979e5a95e72ba19d383a755a3b"

echo "== Verificação de segurança =="
CURRENT_HEAD="$(git rev-parse HEAD)"
if [ "$CURRENT_HEAD" != "$EXPECTED_HEAD" ]; then
  echo "ABORTADO: HEAD atual ($CURRENT_HEAD) não é o commit misto esperado ($EXPECTED_HEAD)."
  echo "Alguma coisa mudou desde que este script foi gerado — não vou prosseguir às cegas."
  exit 1
fi

if [ -f .git/index.lock ] || [ -f .git/HEAD.lock ]; then
  echo "ABORTADO: existe um lock do git (.git/index.lock ou .git/HEAD.lock)."
  echo "Rode: rm -f .git/index.lock .git/HEAD.lock"
  exit 1
fi

if [ ! -f "$SPLIT_DIR/schema.prisma.contratos-only" ] || \
   [ ! -f "$SPLIT_DIR/permissions.ts.contratos-only" ] || \
   [ ! -f "$SPLIT_DIR/PageNavigation.tsx.contratos-only" ]; then
  echo "ABORTADO: não encontrei os arquivos '*.contratos-only' em $SPLIT_DIR/."
  exit 1
fi

echo "HEAD confirmado: $CURRENT_HEAD"
read -p "Confirma que quer separar este commit em Contratos + Mídias Sociais? (digite 'sim' para continuar) " CONFIRM
if [ "$CONFIRM" != "sim" ]; then
  echo "Cancelado — nada foi alterado."
  exit 0
fi

echo ""
echo "== 1. Backup das versões completas (mistas) dos 3 arquivos =="
cp prisma/schema.prisma "$SPLIT_DIR/schema.prisma.full"
cp lib/auth/permissions.ts "$SPLIT_DIR/permissions.ts.full"
cp components/layout/PageNavigation.tsx "$SPLIT_DIR/PageNavigation.tsx.full"

echo "== 2. git reset --soft HEAD~1 (desfaz o commit, nada é perdido) =="
git reset --soft HEAD~1
git reset >/dev/null

echo "== 3. Escrevendo a versão 'só Contratos' dos 3 arquivos mistos =="
cp "$SPLIT_DIR/schema.prisma.contratos-only" prisma/schema.prisma
cp "$SPLIT_DIR/permissions.ts.contratos-only" lib/auth/permissions.ts
cp "$SPLIT_DIR/PageNavigation.tsx.contratos-only" components/layout/PageNavigation.tsx

echo "== 4. Commit 1 — Contratos =="
git add \
  AGENTS.md \
  "app/api/contratos/[id]/route.ts" \
  app/api/contratos/route.ts \
  app/contratos/page.tsx \
  components/layout/PageNavigation.tsx \
  lib/auth/permissions.ts \
  lib/contratos/regras.ts \
  lib/validations/contrato.ts \
  "prisma/migrations/20260821000000_add_analise_contrato/migration.sql" \
  prisma/schema.prisma

git commit -m "$(cat <<'EOF'
feat(contratos): integra o analisador de contratos (villa-contratos) como modulo do CRM

- Novo modelo AnaliseContrato (enums TipoContrato, NivelRisco) em prisma/schema.prisma
- API server-side em app/api/contratos (a chave da Anthropic deixa de ficar exposta no navegador)
- Pagina /contratos com upload/colar contrato, abas de resultado e historico
- Recurso RBAC 'contratos' em lib/auth/permissions.ts e item no menu principal
- Migration 20260821000000_add_analise_contrato escrita a mao (drift preexistente em outras tabelas impedia migrate dev)
EOF
)"

COMMIT_CONTRATOS="$(git rev-parse HEAD)"
echo "Commit de Contratos: $COMMIT_CONTRATOS"

echo "== 5. Restaurando os 3 arquivos mistos para a versão completa =="
cp "$SPLIT_DIR/schema.prisma.full" prisma/schema.prisma
cp "$SPLIT_DIR/permissions.ts.full" lib/auth/permissions.ts
cp "$SPLIT_DIR/PageNavigation.tsx.full" components/layout/PageNavigation.tsx

echo "== 6. Commit 2 — Mídias Sociais (Sprint 1) =="
git add \
  prisma/schema.prisma \
  lib/auth/permissions.ts \
  lib/auth/permissions.test.ts \
  components/layout/PageNavigation.tsx \
  lib/validations/rede-social.ts \
  app/api/midias-sociais \
  app/midias-sociais \
  components/midias-sociais

git commit -m "$(cat <<'EOF'
feat(midias-sociais): Sprint 1 — fundacao da Central de Midias Sociais

- Menu "Midias Sociais" -> /midias-sociais, abas Visao Geral/Instagram/Facebook/YouTube
- Modelo RedeSocialConta (config + status de conexao, sem armazenar token) em prisma/schema.prisma
- API app/api/midias-sociais/contas (GET/POST) com RBAC + auditoria
- Recurso RBAC 'midias_sociais' em lib/auth/permissions.ts
- Pagina de Configuracoes (cadastro de conta, ADMIN) sem chamar nenhuma API da Meta
- Estados vazios explicitos ("Aguardando conexao com a Meta") - nenhum dado ficticio
- Testes: permissions.test.ts + contas/route.test.ts
EOF
)"

COMMIT_MIDIAS="$(git rev-parse HEAD)"
echo "Commit de Midias Sociais: $COMMIT_MIDIAS"

echo ""
echo "== 7. Verificação final =="
echo "--- log ---"
git log --oneline -4
echo "--- status (deve mostrar só os arquivos que já eram untracked antes) ---"
git status --short

echo ""
echo "Pronto. Dois commits separados, nada foi enviado ao GitHub ainda (isso é manual, com git push, quando você quiser)."
echo "Você pode apagar a pasta $SPLIT_DIR/ depois de conferir — ela só tem arquivos de apoio deste processo."
