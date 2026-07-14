// ARQUIVO: app/inteligencia/campanhas/page.tsx
// Placeholder da aba Campanhas — passo 1 do roadmap da Central de Inteligência

import Link from "next/link";
import CampanhasClient from "@/components/inteligencia/CampanhasClient";

export default function CampanhasPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Campanhas — Disparo</h1>
      <p className="text-sm text-slate-600 mb-6">Módulo de campanhas standalone. Importe listas e dispare campanhas por Email/WhatsApp.</p>

      <div className="bg-slate-50 p-4 rounded">
        <CampanhasClient />
      </div>

      <div className="mt-6">
        <Link href="/inteligencia" className="text-sm text-blue-600">← Voltar ao Radar</Link>
      </div>
    </div>
  );
}
