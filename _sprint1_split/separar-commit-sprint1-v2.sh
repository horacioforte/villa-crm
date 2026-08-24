#!/bin/bash
# VERSÃO 2 — substitui separar-commit-sprint1.sh (não apague o v1, só não rode
# mais ele: a verificação de segurança dele vai falhar, porque o passo 1 dele
# (git reset --soft HEAD~1) já foi executado — ver
# Registro_Separacao_Commit_Sprint1_ADENDO.md para o que aconteceu).
#
# Este script assume que o repositório JÁ ESTÁ no estado pós-reset:
#   - HEAD em 6a9a4f0b8faf64f026926677b2b0c1de26f26766 (um commit antes do fe4a1f1)
#   - os 10 arquivos originais do commit fe4a1f1 staged (git diff --cached),
#     com o total exato "10 files changed, 1633 insertions(+), 1 deletion(-)"
# Se qualquer uma dessas duas condições não for verdadeira, o script aborta
# sem tocar em nada.
#
# A partir daí faz exatamente o que o v1 fazia a partir do passo 3:
#   1. escreve a versão "só Contratos" dos 3 arquivos mistos
#   2. commita só os arquivos de Contratos (10 arquivos, mensagem original)
#   3. restaura os 3 arquivos mistos para a versão completa
#   4. commita os arquivos de Mídias Sociais (3 mistos + novos da Sprint 1)
#
# Rode a partir da raiz do repositório:
#   cd ~/Desktop/villa-crm
#   bash _sprint1_split/separar-commit-sprint1-v2.sh

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

SPLIT_DIR="_sprint1_split"
EXPECTED_HEAD_POS_RESET="6a9a4f0b8faf64f026926677b2b0c1de26f26766"
EXPECTED_STAT="10 files changed, 1633 insertions(+), 1 deletion(-)"

echo "== Verificação de segurança =="

if [ -f .git/index.lock ] || [ -f .git/HEAD.lock ]; then
  echo "ABORTADO: existe um lock do git (.git/index.lock ou .git/HEAD.lock)."
  echo "Rode primeiro: rm .git/HEAD.lock .git/index.lock"
  echo "Depois rode este script de novo."
  exit 1
fi

CURRENT_HEAD="$(git rev-parse HEAD)"
if [ "$CURRENT_HEAD" != "$EXPECTED_HEAD_POS_RESET" ]; then
  echo "ABORTADO: HEAD atual ($CURRENT_HEAD) não é o esperado pós-reset ($EXPECTED_HEAD_POS_RESET)."
  echo "Alguma coisa mudou desde o diagnóstico — não vou prosseguir às cegas."
  echo "Me avise o resultado de 'git log --oneline -5' e 'git status --short --branch' antes de continuar."
  exit 1
fi

ACTUAL_STAT="$(git diff --cached --stat | tail -1 | sed 's/^[[:space:]]*//')"
if [ "$ACTUAL_STAT" != "$EXPECTED_STAT" ]; then
  echo "ABORTADO: o total staged ('$ACTUAL_STAT') não bate com o esperado ('$EXPECTED_STAT')."
  echo "Não vou prosseguir às cegas — me avise o resultado de 'git diff --cached --stat' antes de continuar."
  exit 1
fi

if [ ! -f "$SPLIT_DIR/schema.prisma.contratos-only" ] || \
   [ ! -f "$SPLIT_DIR/permissions.ts.contratos-only" ] || \
   [ ! -f "$SPLIT_DIR/PageNavigation.tsx.contratos-only" ]; then
  echo "ABORTADO: não encontrei os arquivos '*.contratos-only' em $SPLIT_DIR/."
  exit 1
fi

echo "HEAD confirmado (pós-reset, já sem o commit misto): $CURRENT_HEAD"
echo "Staged confirmado: $ACTUAL_STAT"
read -p "Confirma que quer separar em Contratos + Mídias Sociais a partir daqui? (digite 'sim' para continuar) " CONFIRM
if [ "$CONFIRM" != "sim" ]; then
  echo "Cancelado — nada foi alterado."
  exit 0
fi

echo ""
echo "== 1. Backup das versões completas (mistas) dos 3 arquivos =="
cp prisma/schema.prisma "$SPLIT_DIR/schema.prisma.full"
cp lib/auth/permissions.ts "$SPLIT_DIR/permissions.ts.full"
cp components/layout/PageNavigation.tsx "$SPLIT_DIR/PageNavigation.tsx.full"

echo "== 2. Escrevendo a versão 'só Contratos' dos 3 arquivos mistos =="
cp "$SPLIT_DIR/schema.prisma.contratos-only" prisma/schema.prisma
cp "$SPLIT_DIR/permissions.ts.contratos-only" lib/auth/permissions.ts
cp "$SPLIT_DIR/PageNavigation.tsx.contratos-only" components/layout/PageNavigation.tsx

echo "== 3. Commit 1 — Contratos =="
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

echo "== 4. Restaurando os 3 arquivos mistos para a versão completa =="
cp "$SPLIT_DIR/schema.prisma.full" prisma/schema.prisma
cp "$SPLIT_DIR/permissions.ts.full" lib/auth/permissions.ts
cp "$SPLIT_DIR/PageNavigation.tsx.full" components/layout/PageNavigation.tsx

echo "== 5. Commit 2 — Mídias Sociais (Sprint 1) =="
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
echo "== 6. Verificação final =="
echo "--- log ---"
git log --oneline -5
echo "--- status (deve mostrar só os arquivos que já eram untracked antes) ---"
git status --short
echo "--- comparação com a árvore original do commit misto (ideal: vazio) ---"
git diff fe4a1f1d4273c1979e5a95e72ba19d383a755a3b HEAD --stat

echo ""
echo "Pronto. Dois commits separados, nada foi enviado ao GitHub ainda (isso é manual, com git push, quando você quiser)."
echo "Você pode apagar a pasta $SPLIT_DIR/ depois de conferir — ela só tem arquivos de apoio deste processo."
