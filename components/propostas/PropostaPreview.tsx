"use client";

export function PropostaPreview({ html }: { html: string }) {
  return (
    <div
      className="overflow-auto rounded-3xl border border-[#D7DEEA] bg-[#F4F6FA] shadow-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
