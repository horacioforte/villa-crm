"use client";

import { Info } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function InfoTooltip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger className="print:hidden">
        <Info className="size-3.5 text-[#98A2B3] hover:text-[#667085]" aria-label="Mais informações" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[240px] text-[11px] leading-snug">{children}</TooltipContent>
    </Tooltip>
  );
}
