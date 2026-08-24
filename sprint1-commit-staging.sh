#!/bin/bash
# Script de staging cirurgico para o commit de fechamento da Sprint 1
# (Central de Midias Sociais). Roda 100% local, nao toca no banco, nao
# faz commit nem push - so organiza o que vai para o "git add".
#
# Motivo de existir: prisma/schema.prisma tem, no working tree, mudancas
# de tres frentes diferentes misturadas no mesmo arquivo (Sprint 1 de
# Midias Sociais + Carteiras Estrategicas + Joao Evidencias). Este script
# isola SOMENTE a linha da Sprint 1 (@@unique([rede]) -> @@unique([rede, nome]))
# no que vai para o commit, e devolve o arquivo de trabalho para o estado
# completo (com as outras duas frentes continuando como "modified",
# sem commitar nada delas).
set -e
cd ~/Desktop/villa-crm

echo "=== 0. Confirmando que nao ha index.lock ==="
ls -la .git/index.lock 2>&1 || echo "(nao existe - ok)"

echo ""
echo "=== 1. Backup do schema.prisma atual (com TODAS as mudancas pendentes) ==="
cp prisma/schema.prisma /tmp/schema.prisma.full-workingtree.bak
echo "OK"

echo ""
echo "=== 2. Extraindo a versao do HEAD e aplicando so a mudanca da Sprint 1 ==="
git show HEAD:prisma/schema.prisma > /tmp/schema.prisma.head.bak
python3 -c "
path = '/tmp/schema.prisma.head.bak'
with open(path) as f:
    content = f.read()
count = content.count('@@unique([rede])')
assert count == 1, f'esperado exatamente 1 ocorrencia de @@unique([rede]), encontrado {count} -- abortando, nada foi alterado.'
new_content = content.replace('@@unique([rede])', '@@unique([rede, nome])')
with open(path, 'w') as f:
    f.write(new_content)
print('OK: patch aplicado na copia do HEAD (so a linha do @@unique).')
"

echo ""
echo "=== 3. Colocando a versao patchada no lugar do arquivo real e dando stage ==="
cp /tmp/schema.prisma.head.bak prisma/schema.prisma
git add prisma/schema.prisma
echo "OK: prisma/schema.prisma staged (so a linha da Sprint 1)"

echo ""
echo "=== 4. Restaurando o arquivo de trabalho para o estado completo (Carteiras/Joao continuam pendentes, sem commit) ==="
cp /tmp/schema.prisma.full-workingtree.bak prisma/schema.prisma
diff prisma/schema.prisma /tmp/schema.prisma.full-workingtree.bak && echo "OK: working tree restaurado, identico ao que estava antes"

echo ""
echo "=== 5. Stage dos demais arquivos exclusivos da Sprint 1 ==="
git add prisma.config.ts
git add app/api/midias-sociais/contas/route.test.ts
git add prisma/migrations/20260821010000_add_rede_social_conta/
echo "OK"

echo ""
echo "=========================================="
echo "=== git status (revise com atencao)   ==="
echo "=========================================="
git status

echo ""
echo "=========================================="
echo "=== diff que vai para o commit (staged, resumo) ==="
echo "=========================================="
git diff --cached --stat

echo ""
echo "=========================================="
echo "=== diff que vai para o commit (staged, completo do schema.prisma - deve ser so 1 linha) ==="
echo "=========================================="
git diff --cached -- prisma/schema.prisma

echo ""
echo "NADA FOI COMMITADO AINDA. Revise a saida acima e mande para o Claude antes de rodar 'git commit'."
