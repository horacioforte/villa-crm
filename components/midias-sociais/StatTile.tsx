import { cn } from "@/lib/utils";

type StatTileProps = {
  label: string;
  value?: string | number | null;
  hint?: string;
  emphasis?: "primary" | "secondary";
};

// Tile de métrica reutilizável para a Central de Mídias Sociais.
// Sprint 1: nenhuma tela ainda passa `value` — sempre renderiza "—" com o hint
// padrão ("Sem dados ainda"), nunca um número fictício. A partir da Sprint 2,
// quando houver sincronização real com a Meta, os chamadores passam `value`.
export function StatTile({ label, value, hint, emphasis = "secondary" }: StatTileProps) {
  const hasValue = value !== undefined && value !== null && value !== "";
  const displayValue = hasValue ? value : "—";
  const displayHint = hasValue ? hint : (hint ?? "Sem dados ainda");

  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        emphasis === "primary" ? "border-[#93C5FD] bg-[#E8EEFB]" : "border-[#D7DEEA] bg-white",
      )}
    >
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#667085]">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-bold",
          emphasis === "primary" ? "text-[#1A2E5A]" : "text-[#334155]",
        )}
      >
        {displayValue}
      </p>
      {displayHint ? <p className="mt-1 text-[11px] text-[#98A2B3]">{displayHint}</p> : null}
    </div>
  );
}
