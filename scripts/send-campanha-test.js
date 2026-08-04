// scripts/send-campanha-test.js
// Executa um POST em /api/agent/campanha-email usando AGENT_API_KEY

import 'dotenv/config';

const AGENT_API_KEY = process.env.AGENT_API_KEY;
const URL = (process.env.NEXTAUTH_URL || 'http://localhost:3000') + '/api/agent/campanha-email';

if (!AGENT_API_KEY) {
  console.error('AGENT_API_KEY não configurada em .env.local');
  process.exit(1);
}

const payload = {
  tipo: 'GENERICO',
  destinatarios: [
    {
      nome: 'Teste Envio',
      email: 'joao.comercial@villaempreendimentos.com.br',
      empresa: 'Villa Teste'
    }
  ]
};

(async () => {
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGENT_API_KEY}`
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
  } catch (err) {
    console.error('Erro ao chamar endpoint:', err);
    process.exit(1);
  }
})();
