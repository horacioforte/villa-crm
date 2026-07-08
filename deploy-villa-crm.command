#!/bin/bash
cd "/Users/horacioforte/Desktop/villa-crm"
rm -f .git/HEAD.lock .git/index.lock
git add app/api/saude-comercial/joao/route.ts \
        app/api/webhook/whatsapp/joao/route.ts \
        lib/agentes/joao/crm.ts \
        vercel.json \
        app/api/agent/route.ts
git commit -m "feat: João — campos ampliados no /api/agent (briefing radar jul/2026)" --allow-empty
git push origin main
echo ""
echo "✅ Deploy enviado. Vercel vai atualizar em instantes."
echo "   Health check ativo: todo dia às 6h (Recife)"
echo "   Alertas: WhatsApp + email se houver erro"
read -p "Pressione Enter para fechar..."
