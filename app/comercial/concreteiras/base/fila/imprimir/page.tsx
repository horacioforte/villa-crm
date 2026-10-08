// ARQUIVO: app/comercial/concreteiras/base/fila/imprimir/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Versão para impressão do andamento da fila de verificação (o clique em Imprimir registra o relatório).

import { formatarCnpj } from "@/lib/base-nacional/cnpj";
import { lerFiltrosFila, listarFila, progressoFila, qsFila } from "@/lib/base-nacional/fila-consulta";
import { SITUACAO_FILA_LABEL } from "@/lib/base-nacional/fila-relatorio";
import { CLASSE_TRIAGEM_LABEL, type ClasseTriagem } from "@/lib/base-nacional/triagem";
import { NIVEL_LABEL, STATUS_LABEL, type NivelPotencial, type StatusValidacao } from "@/lib/base-nacional/rotulos";
import { BotaoImprimirFila } from "../Botoes";

export const dynamic = "force-dynamic";

export default async function ImprimirFila({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = lerFiltrosFila(await searchParams);
  const [p, { total, linhas }] = await Promise.all([progressoFila(f), listarFila(f, 2000)]);
  const agora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Recife" }).format(new Date());
  return (
    <div className="mx-auto max-w-5xl bg-white p-6 text-slate-800 print:p-0">
      <div className="mb-4 flex items-start justify-between border-b-2 border-slate-800 pb-2">
        <div>
          <p className="text-base font-bold">Villa Empreendimentos — Fila de verificação da Base Nacional</p>
          <p className="text-[11px] text-slate-500">Gerado em {agora} · {f.uf ? `UF ${f.uf}` : "Todas as UFs"} · fila: {f.situacao} · {total} empresa(s)</p>
          <p className="text-[11px] text-slate-500">Verificadas {p.verificadas} · pendentes {p.pendentes} · em revisão {p.emRevisao} · restantes {p.restantes} · dispensadas {p.dispensadas}</p>
        </div>
        <BotaoImprimirFila query={qsFila(f)} />
      </div>
      <table className="w-full border-collapse text-[10px]">
        <thead><tr className="bg-slate-800 text-left text-white">{["Empresa", "CNPJ", "Cidade/UF", "Pr.", "Triagem", "Fila", "Situação", "Compra"].map(h => <th key={h} className="border border-slate-300 px-1.5 py-1">{h}</th>)}</tr></thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.candidataId} className="break-inside-avoid">
              <td className="border border-slate-200 px-1.5 py-1">{l.candidata.nomeFantasia || l.candidata.razaoSocial}</td>
              <td className="border border-slate-200 px-1.5 py-1">{formatarCnpj(l.candidata.cnpjMatriz) ?? l.candidata.cnpjBasico}</td>
              <td className="border border-slate-200 px-1.5 py-1">{l.municipio}/{l.uf}</td>
              <td className="border border-slate-200 px-1.5 py-1">{l.prioridadeReceita}</td>
              <td className="border border-slate-200 px-1.5 py-1">{CLASSE_TRIAGEM_LABEL[l.classificacao as ClasseTriagem] ?? l.classificacao}</td>
              <td className="border border-slate-200 px-1.5 py-1">{SITUACAO_FILA_LABEL[l.situacaoFila]}</td>
              <td className="border border-slate-200 px-1.5 py-1">{STATUS_LABEL[l.candidata.statusValidacao as StatusValidacao]}</td>
              <td className="border border-slate-200 px-1.5 py-1">{NIVEL_LABEL[l.potencialCompra as NivelPotencial]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
