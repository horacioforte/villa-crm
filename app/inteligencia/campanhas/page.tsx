// ARQUIVO: app/inteligencia/campanhas/page.tsx
// Placeholder da aba Campanhas — passo 1 do roadmap da Central de Inteligência

import Link from "next/link";

export default function CampanhasPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Campanhas — Disparo</h1>
      <p className="text-sm text-slate-600 mb-6">Módulo de campanhas standalone. Importe listas e dispare campanhas por Email/WhatsApp. Interface em construção.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded shadow-sm">Importar lista (placeholder)</div>
        <div className="p-4 bg-white rounded shadow-sm">Selecionar template (placeholder)</div>
      </div>

      <div className="mt-6">
        <Link href="/inteligencia" className="text-sm text-blue-600">← Voltar ao Radar</Link>
      </div>
    </div>
  );
}
