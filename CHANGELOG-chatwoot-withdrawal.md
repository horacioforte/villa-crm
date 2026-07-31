# Retirada do webhook Chatwoot

Este documento registra a retirada da integração do Chatwoot em favor da integração direta com a Meta Cloud API.

## O que muda

- A rota /api/webhook/chatwoot deixa de ser tratada como rota pública pelo proxy auth.
- O handler específico do Chatwoot é removido do código.
- O fluxo Meta, Evolution e a Central de Atendimento continuam sendo mantidos.

## O que permanece

- Conversa.chatwootId continua presente no schema.
- CanalWhatsappTipo.CHATWOOT_MIRROR continua preservado.
- O bloqueio defensivo de envio para mensagens oriundas de CHATWOOT_MIRROR continua ativo.
- Os testes relacionados a esse comportamento defensivo permanecem.
