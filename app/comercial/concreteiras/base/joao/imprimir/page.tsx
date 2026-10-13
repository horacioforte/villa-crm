// ARQUIVO: app/comercial/concreteiras/base/joao/imprimir/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Versão para impressão da fila comercial do João (o clique em Imprimir registra o relatório).

import { formatarCnpj } from "@/lib/base-nacional/cnpj";
import { CATEGORIA_LABEL, type Categoria } from "@/lib/base-nacional/joao/categorizar";
import { DECISAO_COMERCIAL_LABEL, lerFiltrosJoao, listarFilaJoao, qsJoao, type DecisaoComercial } from "@/lib/base-nacional/joao/fila-comercial";
import { descreverFiltrosJoao } from "@/lib/base-nacional/joao/relatorio-joao";
import { BotaoImprimirJoao } from "../BotaoImprimirJoao";

export const dynamic = "force-dynamic";

export default async function ImprimirJoao({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = lerFiltrosJoao(await searchParams);
  const { linhas, resumo } = await listarFilaJoao(f);
  const agora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Recife" }).format(new Date());
  const td = "border border-slate-200 px-1.5 py-1 align-top";
  return (
    <div className="mx-auto max-w-5xl bg-white p-6 text-slate-800 print:p-0">
      <div className="mb-4 flex items-start justify-between border-b-2 border-slate-800 pb-2">
        <div>
          <p className="text-base font-bold">Villa Empreendimentos — Fila comercial do João</p>
          <p className="text-[11px] text-slate-500">Gerado em {agora} · {descreverFiltrosJoao(f)} · {resumo.total} grupo(s): A {resumo.A} · B {resumo.B} · C {resumo.C}</p>
          <p className="text-[11px] text-slate-500">Contatos são gerais da empresa (não pertencem ao sócio). Nenhum contato foi feito.</p>
        </div>
        <BotaoImprimirJoao query={qsJoao(f)} />
      </div>
      <table className="w-full border-collapse text-[10px]">
        <thead><tr className="bg-slate-800 text-left text-white">{["Cat.", "Grupo e empresas", "UFs", "Unid.", "Sócios", "WhatsApp", "E-mail", "Tel.", "Revisão"].map(h => <th key={h} className="border border-slate-300 px-1.5 py-1">{h}</th>)}</tr></thead>
        <tbody>
          {linhas.map(g => (
            <tr key={g.chave} className="break-inside-avoid">
              <td className={td} title={CATEGORIA_LABEL[g.categoriaComercial as Categoria]}>{g.categoriaComercial}</td>
              <td className={td}><b>{g.nome}</b><br />{g.empresas.map(e => `${e.nomeFantasia || e.razaoSocial} (${formatarCnpj(e.cnpjMatriz) ?? e.cnpjBasico})`).join("; ")}</td>
              <td className={td}>{(g.ind.ufs ?? []).join(", ")}</td>
              <td className={td}>{g.ind.unidadesAtivas ?? 0}</td>
              <td className={td}>{g.ind.decisoresSocietarios ?? 0}</td>
              <td className={td}>{g.ind.whatsapp ?? 0}</td>
              <td className={td}>{g.ind.emailCorporativo ?? 0}</td>
              <td className={td}>{(g.ind.telefoneSite ?? 0) + (g.ind.telefoneReceita ?? 0)}</td>
              <td className={td}>{g.decisaoComercial ? DECISAO_COMERCIAL_LABEL[g.decisaoComercial as DecisaoComercial] : "Aguardando"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
