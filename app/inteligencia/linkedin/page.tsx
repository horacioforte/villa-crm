// ARQUIVO: app/inteligencia/linkedin/page.tsx
// Placeholder da aba LinkedIn — passo 1 do roadmap da Central de Inteligência

import Link from "next/link";

export default function LinkedInPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">LinkedIn — Descobertas</h1>
      <p className="text-sm text-slate-600 mb-6">Tela dedicada às descobertas do LinkedIn. Em desenvolvimento — funcionalidades de monitoramento e envio de e‑mails estarão disponíveis em próximas etapas.</p>

      <div className="space-y-3">
        <div className="p-4 bg-white rounded shadow-sm">Lista de descobertas (placeholder)</div>
        <div className="p-4 bg-white rounded shadow-sm">Detalhe da descoberta (placeholder)</div>
      </div>

      <div className="mt-6">
        <Link href="/inteligencia" className="text-sm text-blue-600">← Voltar ao Radar</Link>
      </div>
    </div>
  );
}
