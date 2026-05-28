"use client";

export function PropostaPreview({ html }: { html: string }) {
  return (
    <div
      className="overflow-hidden rounded-3xl border border-[#D7DEEA] bg-white shadow-sm"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
