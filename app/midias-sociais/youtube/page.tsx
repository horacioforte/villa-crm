import { Play } from "lucide-react";

// YouTube ainda não está ativo nesta fase — apenas preparado
// arquiteturalmente (aba, rota, RedeSocialConta) conforme escopo da Sprint 1.
export default function MidiasSociaisYoutubePage() {
  return (
    <div>
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
          Mídias Sociais
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">YouTube</h1>
      </header>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-[#D7DEEA] bg-white px-6 py-16 text-center">
        <Play className="size-10 text-[#D7DEEA]" />
        <p className="text-sm font-bold uppercase tracking-wide text-[#98A2B3]">
          Ainda não implementado nesta fase
        </p>
        <p className="max-w-md text-sm text-[#667085]">
          A estrutura para o YouTube já está preparada arquiteturalmente na Central de Mídias
          Sociais. A integração de dados será habilitada em uma sprint futura.
        </p>
      </div>
    </div>
  );
}
