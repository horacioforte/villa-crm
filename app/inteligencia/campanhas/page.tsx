// ARQUIVO: app/inteligencia/campanhas/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
import CampanhasClient from "@/components/inteligencia/CampanhasClient";

export default function CampanhasPage() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1A2E5A]">Campanhas de e-mail</h1>
        <p className="text-sm text-[#667085] mt-1">
          Disparo outbound do João — até 200 destinatários por campanha via Brevo.
        </p>
      </div>
      <CampanhasClient />
    </div>
  );
}
