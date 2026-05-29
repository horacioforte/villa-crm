"use client";

export function PropostaPreview({ html }: { html: string }) {
  return (
    <div className="max-h-[80vh] overflow-auto rounded-3xl border border-[#D7DEEA] bg-white p-4 shadow-sm">
      <div
        className="min-w-[760px]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
