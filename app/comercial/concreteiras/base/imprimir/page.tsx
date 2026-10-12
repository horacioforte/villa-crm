// ARQUIVO: app/comercial/concreteiras/base/imprimir/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Versão para impressão da Base Nacional (com data e filtros no documento).
// O registro em RelatorioConcreteirasGerado acontece só ao clicar em Imprimir.

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { linhasParaExportar } from "@/lib/base-nacional/consulta";
import { formatarCnpj } from "@/lib/base-nacional/cnpj";
import { LIMITE_EXPORTACAO, lerFiltros, querystring } from "@/lib/base-nacional/filtros";
import { rotulosFiltros } from "@/lib/base-nacional/relatorios";
import { CONFIANCA_LABEL, STATUS_LABEL, type Confianca, type StatusValidacao, EQUIPAMENTO_LABEL, PRIORIDADE_LABEL, type Equipamento, type Prioridade } from "@/lib/base-nacional/rotulos";
import { prisma } from "@/lib/prisma";
import { BotaoImprimir } from "./BotaoImprimir";

export const dynamic = "force-dynamic";

export default async function ImprimirBasePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filtros = lerFiltros(await searchParams);
  const segmento = filtros.segmento
    ? (await prisma.segmentoEmpresa.findUnique({ where: { slug: filtros.segmento }, select: { nome: true } }))?.nome
    : undefined;
  const { total, linhas } = await linhasParaExportar(filtros, LIMITE_EXPORTACAO);
  const descricao = rotulosFiltros(filtros, segmento);
  const geradoEm = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Recife" }).format(new Date());
  const qs = querystring(filtros);

  return (
    <div className="h-full overflow-auto bg-white">
      <style>{`@media print { aside { display: none !important; } @page { size: A4 landscape; margin: 10mm; } }`}</style>
      <div className="mx-auto max-w-6xl p-6 print:p-0">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link href={`/comercial/concreteiras/base${qs}`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-3 w-3" /> Voltar à Base Nacional
          </Link>
          <BotaoImprimir query={qs.replace(/^\?/, "")} />
        </div>
        <header className="mb-3 border-b-2 border-[#1A2E5A] pb-2">
          <p className="text-sm font-bold text-[#1A2E5A]">Villa Empreendimentos — Base Nacional de Concreteiras</p>
          <p className="text-[11px] text-slate-500">Filtros: {descricao}</p>
          <p className="text-[11px] text-slate-500">
            Gerado em {geradoEm} · {linhas.length.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")} candidatas
            {total > linhas.length ? ` (limitado a ${LIMITE_EXPORTACAO.toLocaleString("pt-BR")})` : ""}
          </p>
        </header>
        {linhas.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma candidata com esses filtros.</p>
        ) : (
          <table className="w-full border-collapse text-left text-[10px]">
            <thead>
              <tr className="bg-[#1A2E5A] text-white">
                {["Razão social", "Nome fantasia", "CNPJ", "Cidade / UF", "Unid.", "Situação", "Confiança", "Prioridade", "Potencial de venda", "Evid.", "Empresa no CRM", "Últ. verificação"].map(h => (
                  <th key={h} className="border border-slate-300 px-1.5 py-1 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.id} className="break-inside-avoid">
                  <td className="border border-slate-200 px-1.5 py-1">{l.razaoSocial}</td>
                  <td className="border border-slate-200 px-1.5 py-1">{l.nomeFantasia ?? "—"}</td>
                  <td className="border border-slate-200 px-1.5 py-1 font-mono">{formatarCnpj(l.cnpjMatriz) ?? l.cnpjBasico}</td>
                  <td className="border border-slate-200 px-1.5 py-1">{[l.municipioMatriz, l.ufMatriz].filter(Boolean).join(" / ")}</td>
                  <td className="border border-slate-200 px-1.5 py-1 text-center">{l._count.unidades}</td>
                  <td className="border border-slate-200 px-1.5 py-1">{STATUS_LABEL[l.statusValidacao as StatusValidacao]}</td>
                  <td className="border border-slate-200 px-1.5 py-1">{l.confianca ? CONFIANCA_LABEL[l.confianca as Confianca] : "—"}</td>
                  <td className="border border-slate-200 px-1.5 py-1">{l.prioridadeComercial ? PRIORIDADE_LABEL[l.prioridadeComercial as Prioridade] : "—"}</td>
                  <td className="border border-slate-200 px-1.5 py-1">{[...new Set(l.potenciais.map(p => EQUIPAMENTO_LABEL[p.equipamento as Equipamento]))].join(", ") || "—"}</td>
                  <td className="border border-slate-200 px-1.5 py-1 text-center">{l._count.evidencias}</td>
                  <td className="border border-slate-200 px-1.5 py-1">{l.empresa?.nomeFantasia ?? l.empresa?.razaoSocial ?? "—"}</td>
                  <td className="border border-slate-200 px-1.5 py-1">{l.ultimaVerificacaoEm ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife" }).format(l.ultimaVerificacaoEm) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-center text-[9px] text-slate-400">Villa CRM · documento de consulta interna · base de investigação, não é cadastro comercial</p>
      </div>
    </div>
  );
}
