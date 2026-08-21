import { AlertCircle } from "lucide-react";

import { StatTile } from "@/components/midias-sociais/StatTile";

// Visão Geral da Central de Mídias Sociais.
// Sprint 1: sem conexão com a Meta ainda — todos os tiles renderizam "—" via
// StatTile (nenhum valor fictício é passado). Hierarquia visual proposital:
// Resultado comercial primeiro (peso visual maior), Aquisição/Audiência depois.
// Conteúdo e IA ficam para sprints futuras, quando houver dado real para mostrar.
export default function MidiasSociaisPage() {
  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
            Villa CRM
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">
            Central de Mídias Sociais
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
            Marketing conectado ao pipeline: do alcance no Instagram, Facebook e YouTube até o
            contrato assinado.
          </p>
        </div>
      </header>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertCircle className="mt-0.5 size-4 flex-shrink-0" />
        <div>
          <p className="font-semibold">Aguardando conexão com a Meta</p>
          <p className="mt-0.5 text-xs leading-5 text-amber-700">
            Nenhuma conta de rede social está conectada ainda. Os números abaixo aparecem assim
            que a conexão for configurada em Mídias Sociais → Configurações.
          </p>
        </div>
      </div>

      <section className="mt-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#1E4FAB]">
          Resultado comercial
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Investimento" emphasis="primary" />
          <StatTile label="Leads" emphasis="primary" />
          <StatTile label="Qualificados" emphasis="primary" />
          <StatTile label="Oportunidades" emphasis="primary" />
          <StatTile label="Valor proposto" emphasis="primary" />
          <StatTile label="Contratado" emphasis="primary" />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#667085]">
          Aquisição e audiência
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatTile label="Alcance" />
          <StatTile label="Não seguidores alcançados" />
          <StatTile label="Visitas ao perfil" />
          <StatTile label="Mensagens diretas" />
          <StatTile label="Engajamento" />
        </div>
      </section>
    </div>
  );
}
