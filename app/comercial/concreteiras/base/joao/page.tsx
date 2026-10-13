// ARQUIVO: app/comercial/concreteiras/base/joao/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Fila comercial do João (13/10/2026): grupos de concreteiras confirmadas/prováveis já pesquisados, em categorias
// A/B/C calculadas por código. Só leitura; a decisão humana fica na tela do grupo. Nada é enviado a ninguém.

import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { formatarCnpj } from "@/lib/base-nacional/cnpj";
import { CATEGORIA_COR, CATEGORIA_LABEL, PORTE_LABEL, type Categoria } from "@/lib/base-nacional/joao/categorizar";
import { DECISAO_COMERCIAL_LABEL, DECISOES_COMERCIAIS, lerFiltrosJoao, listarFilaJoao, qsJoao, type DecisaoComercial } from "@/lib/base-nacional/joao/fila-comercial";
import { STATUS_COR, STATUS_LABEL, type StatusValidacao } from "@/lib/base-nacional/rotulos";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
const BASE = "/comercial/concreteiras/base";
const JOAO = `${BASE}/joao`;
const sel = "w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700";

export default async function FilaJoaoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const f = lerFiltrosJoao(await searchParams);
  const { linhas, resumo, ufs } = await listarFilaJoao(f);
  const qs = qsJoao(f);
  const kpis = [
    { rotulo: "A · prontas para revisão", valor: resumo.A, cls: "bg-emerald-50 border-emerald-100 text-emerald-700" },
    { rotulo: "B · precisam de contato melhor", valor: resumo.B, cls: "bg-amber-50 border-amber-100 text-amber-700" },
    { rotulo: "C · grandes grupos", valor: resumo.C, cls: "bg-indigo-50 border-indigo-100 text-indigo-700" },
    { rotulo: "Aguardando revisão", valor: resumo.aguardando, cls: "bg-white border-slate-200 text-slate-700" },
    { rotulo: "Revisados", valor: resumo.revisados, cls: "bg-slate-50 border-slate-200 text-slate-500" },
  ];
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50">
      <div className="border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
        <Link href={BASE} className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-700"><ArrowLeft className="h-3.5 w-3.5" /> Base Nacional</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Fila comercial do João</h1>
            <p className="max-w-2xl text-xs text-slate-500">Concreteiras confirmadas e prováveis, agrupadas (matriz, filiais e grupo econômico aparecem uma vez). Decisores societários e contatos comerciais ficam separados: o contato geral é da empresa, não do sócio. Nada é enviado por esta tela.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/api/base-nacional/joao/relatorio${qs ? `${qs}&` : "?"}formato=xlsx`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"><FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Excel</a>
            <a href={`/api/base-nacional/joao/relatorio${qs ? `${qs}&` : "?"}formato=pdf`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"><FileText className="h-3.5 w-3.5 text-red-600" /> PDF</a>
            <a href={`${JOAO}/imprimir${qs}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"><Printer className="h-3.5 w-3.5 text-indigo-600" /> Imprimir</a>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {kpis.map(k => (
            <div key={k.rotulo} className={cn("rounded-lg border px-3 py-2", k.cls)}>
              <p className="text-lg font-semibold">{k.valor.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-slate-500">{k.rotulo}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-6">
        <form method="get" action={JOAO} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-white p-3 md:grid-cols-4 xl:grid-cols-8">
          <input name="busca" defaultValue={f.busca ?? ""} placeholder="Nome ou CNPJ" className={cn(sel, "col-span-2 md:col-span-1")} />
          <select name="uf" defaultValue={f.uf ?? ""} className={sel} aria-label="Estado"><option value="">Todos os estados</option>{ufs.map(u => <option key={u} value={u}>{u}</option>)}</select>
          <select name="categoria" defaultValue={f.categoria ?? ""} className={sel} aria-label="Categoria"><option value="">Categorias A, B e C</option>{(["A", "B", "C"] as Categoria[]).map(c => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}</select>
          <select name="porte" defaultValue={f.porte ?? ""} className={sel} aria-label="Porte"><option value="">Qualquer porte</option>{["01", "03", "05"].map(p => <option key={p} value={p}>{PORTE_LABEL[p]}</option>)}</select>
          <input name="unidadesMin" type="number" min={1} defaultValue={f.unidadesMin ?? ""} placeholder="Unidades de" className={sel} aria-label="Unidades mínimas" />
          <input name="unidadesMax" type="number" min={1} defaultValue={f.unidadesMax ?? ""} placeholder="Unidades até" className={sel} aria-label="Unidades máximas" />
          <select name="revisao" defaultValue={f.revisao ?? ""} className={sel} aria-label="Situação da revisão">
            <option value="">Qualquer situação</option><option value="AGUARDANDO">Aguardando revisão</option>
            {DECISOES_COMERCIAIS.map(d => <option key={d} value={d}>{DECISAO_COMERCIAL_LABEL[d]}</option>)}
          </select>
          <div className="col-span-2 flex gap-2 md:col-span-1">
            <button className="flex-1 rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white">Filtrar</button>
            <Link href={JOAO} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600">Limpar</Link>
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
          <p className="border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500">{resumo.total} grupo(s) · ordem: categoria A, B, C e força da evidência</p>
          <ul className="divide-y divide-slate-100">
            {linhas.map(g => (
              <li key={g.chave} className="flex flex-col gap-1.5 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <Link href={`${JOAO}/${encodeURIComponent(g.chave)}${qs}`} className="block truncate text-sm font-medium text-slate-800 hover:text-indigo-700">{g.nome}</Link>
                  <p className="truncate text-[11px] text-slate-500">
                    {g.empresas.length} empresa(s): {g.empresas.map(e => `${e.nomeFantasia || e.razaoSocial} (${formatarCnpj(e.cnpjMatriz) ?? e.cnpjBasico})`).join(" · ")}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">{g.categoriaMotivo}</p>
                </div>
                <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 text-[10px]">
                  <span className={cn("rounded px-1.5 py-0.5 font-semibold", CATEGORIA_COR[g.categoriaComercial as Categoria])}>{g.categoriaComercial}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{(g.ind.ufs ?? []).join(", ") || "—"} · {g.ind.unidadesAtivas ?? 0} unid.</span>
                  {[...new Set(g.empresas.map(e => e.statusValidacao))].map(s => <span key={s} className={cn("rounded px-1.5 py-0.5", STATUS_COR[s as StatusValidacao])}>{STATUS_LABEL[s as StatusValidacao]}</span>)}
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{g.ind.decisoresSocietarios ?? 0} sócio(s)</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">WhatsApp {g.ind.whatsapp ?? 0} · e-mail {g.ind.emailCorporativo ?? 0} · tel. {(g.ind.telefoneSite ?? 0) + (g.ind.telefoneReceita ?? 0)}</span>
                  <span className={cn("rounded px-1.5 py-0.5", g.decisaoComercial ? "bg-slate-800 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200")}>
                    {g.decisaoComercial ? `${DECISAO_COMERCIAL_LABEL[g.decisaoComercial as DecisaoComercial]}${g.decisaoPor ? ` · ${g.decisaoPor.nome}` : ""}` : "Aguardando revisão"}
                  </span>
                </div>
              </li>
            ))}
            {!linhas.length && <li className="px-3 py-6 text-center text-xs text-slate-400">Nenhum grupo com os filtros atuais.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
