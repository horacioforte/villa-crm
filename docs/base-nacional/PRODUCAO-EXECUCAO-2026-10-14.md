# Execução em produção — Base Nacional + Fila comercial do João (14/10/2026)

Autorizado por Horácio em 14/10/2026 ("fazer tudo" → "ir até o fim hoje"). Executado pelo Claude (Cowork).

## Banco de produção (endpoint ep-aged-shadow-aj***)

| Horário (UTC) | Passo | Resultado |
|---|---|---|
| 17:27 | Backup completo (`pg_dump -Fc`) | `~/Desktop/villa-crm-backups/producao-antes-base-nacional-2026-10-14.dump` (48 MB, 58 tabelas com dados) |
| 17:28–17:29 | Ensaio: backup restaurado num Postgres local, `migrate deploy` + carga | OK; tela da fila lida no ensaio (156 grupos: A 102 · B 21 · C 33) |
| 17:30 | `prisma migrate deploy` | Só 3 pendentes (v5, v6, v7), todas da Base Nacional e aditivas. Fundação, v4 e Instagram já estavam aplicadas. |
| 17:30 | Carga dos dados (uma transação) | 17 tabelas da Base Nacional; contagens idênticas ao ensaio e ao branch de teste |

- Usuários: 3 em produção, mesmos IDs e e-mails do branch de teste (pendência 4.3 do plano resolvida).
- Nenhum dado de demonstração (`demo-bn-*`), nenhum vínculo com Empresa.
- Fora da carga, de propósito: `RelatorioConcreteirasGerado`.
- Tabelas do CRM intocadas (Empresa 581, Oportunidade 392, Mensagem 1205 — iguais ao backup).
- Nenhuma mensagem enviada; módulo de pesquisa com IA continua **desligado** (variáveis não configuradas na Vercel).

## Código

- Branch `release/base-nacional-2026-10-14` = feature + main (fa7e934), avanço direto (fast-forward) da main.
- `tsc` sem erros; vitest 619/652 — as 33 falhas são as mesmas que já existem na main (testes do WhatsApp/Ciclo de Atendimento), não vêm da Base Nacional.
- Publicação: `git push origin release/base-nacional-2026-10-14:main` (feito pelo Horácio no Mac, que tem a credencial do GitHub). A Vercel publica sozinha.

## Volta (se precisar)

- Código: publicar de novo o commit `fa7e934` (main anterior).
- Dados: Nível 1 do plano (apagar só as tabelas da Base Nacional, com aprovação) ou restaurar o backup acima.
