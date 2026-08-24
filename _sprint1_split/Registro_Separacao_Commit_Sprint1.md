# Separação do commit misto fe4a1f1 — Contratos + Mídias Sociais

## O que aconteceu

Durante a Sprint 1, trabalhamos no mesmo repositório ao mesmo tempo. Um commit seu
(`fe4a1f1`, "feat(contratos): integra o analisador de contratos...") acabou incluindo,
junto com os arquivos de Contratos, as três edições que eu já tinha feito para a
Sprint 1 de Mídias Sociais em arquivos compartilhados:

- `prisma/schema.prisma`
- `lib/auth/permissions.ts`
- `components/layout/PageNavigation.tsx`

Você confirmou que esse commit não foi publicado/compartilhado antes de eu preparar
esta separação — por isso é seguro reorganizar (é só um `git reset --soft` local,
sem nenhum `push --force` nem alteração de histórico já publicado).

## O que este pacote faz

Três arquivos `*.contratos-only` são as versões exatas dos três arquivos mistos
**sem** as linhas de Mídias Sociais — calculadas removendo linha a linha,
a partir do diff real do commit `fe4a1f1` (não por adivinhação). Cada remoção foi
conferida com `diff` antes de eu gerar este pacote; o único conteúdo removido foi:

- `schema.prisma`: a relação `redesSociaisCriadas` em `Usuario`, e o bloco inteiro
  `enum RedeSocialTipo` / `enum RedeSocialStatusConexao` / `model RedeSocialConta`.
- `permissions.ts`: o membro `"midias_sociais"` do tipo `Resource`, e a linha
  `midias_sociais: ...` (+ comentário) em cada um dos 4 papéis.
- `PageNavigation.tsx`: o import do ícone `Megaphone` e a entrada de menu
  "Mídias Sociais".

O script `separar-commit-sprint1.sh` usa essas versões para:

1. Desfazer o commit misto (`git reset --soft HEAD~1` — nada é perdido, é só
   "descommitar", mantendo tudo no working tree).
2. Comitar só os arquivos de Contratos (10 arquivos, com a versão "só Contratos"
   dos 3 arquivos mistos) — mesma mensagem de commit original.
3. Restaurar os 3 arquivos mistos para a versão completa.
4. Comitar os arquivos de Mídias Sociais (os 3 mistos de volta ao normal + todos
   os arquivos novos da Sprint 1).

O script tem uma verificação de segurança no início (confere se o HEAD ainda é
exatamente `fe4a1f1` antes de tocar em qualquer coisa) e pede confirmação
digitada antes de prosseguir.

## Como rodar

```
cd ~/Desktop/villa-crm
bash _sprint1_split/separar-commit-sprint1.sh
```

## Como conferir depois

```
git log --oneline -4
```
Deve mostrar dois commits novos no lugar do fe4a1f1 — um de Contratos, um de
Mídias Sociais — e nada mais mudou (bi-executivo etc. continuam iguais).

```
git status --short
```
Deve mostrar exatamente os mesmos arquivos "não rastreados" que já existiam antes
(os `.docx`/`.xlsx` na raiz e a pasta `_to_delete/`) — nada de novo sobrando.

Se quiser uma conferência ainda mais rigorosa, o conteúdo final de cada arquivo
deve ser idêntico ao que estava em `fe4a1f1` — pode comparar com:
```
git diff fe4a1f1 HEAD --stat
```
(o ideal é essa saída vir vazia, confirmando que a árvore final é byte a byte
igual à do commit misto original, só que agora dividida em dois commits).

## Depois de conferir

Pode apagar a pasta `_sprint1_split/` inteira — ela só contém arquivos de apoio
deste processo, nada que precise ficar no repositório.

Nada foi enviado ao GitHub por este processo — o `git push` continua sendo uma
ação sua, quando quiser.
