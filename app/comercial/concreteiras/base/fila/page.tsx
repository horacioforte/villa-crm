// ARQUIVO: app/comercial/concreteiras/base/fila/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Fila de verificação humana da Base Nacional (08/10/2026): filas por estado, filtros, progresso,
// exportação (Excel/PDF/impressão) e painel do robô gratuito (ADMIN). Somente leitura nesta página;
// as decisões acontecem na tela de revisão (fila/[id]).

import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { formatarCnpj } from "@/lib/base-nacional/cnpj";
import { filasPorEstado, lerFiltrosFila, listarFila, progressoFila, qsFila } from "@/lib/base-nacional/fila-consulta";
import { SITUACAO_FILA_LABEL } from "@/lib/base-nacional/fila-relatorio";
import { CLASSES_TRIAGEM, CLASSE_TRIAGEM_LABEL, type ClasseTriagem } from "@/lib/base-nacional/triagem";
import { NIVEIS_POTENCIAL, NIVEL_COR, NIVEL_LABEL, STATUS_COR, STATUS_LABEL, type NivelPotencial, type StatusValidacao } from "@/lib/base-nacional/rotulos";
import { podeValidar } from "@/lib/base-nacional/validacao";
import { reservaAtiva } from "@/lib/base-nacional/fila";
import { cn } from "@/lib/utils";
import { BotaoComecar, PainelRobo } from "./Botoes";

export const dynamic = "force-dynamic";
const BASE = "/comercial/concreteiras/base";
const FILA = `${BASE}/fila`;
const sel = "w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700";

export default async function FilaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const f = lerFiltrosFila(params);
  const usuario = await getCurrentUser();
  const [progresso, estados, { total, linhas }] = await Promise.all([progressoFila(f), filasPorEstado(), listarFila(f, 100)]);
  const qs = qsFila(f);
  const pct = progresso.verificadas + progresso.pendentes ? Math.round((100 * progresso.verificadas) / (progresso.verificadas + progresso.pendentes)) : 0;
  const kpis = [
    { rotulo: "Verificadas", valor: progresso.verificadas, cor: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
    { rotulo: "Pendentes", valor: progresso.pendentes, cor: "text-indigo-700", bg: "bg-indigo-50 border-indigo-100" },
    { rotulo: "Em revisão agora", valor: progresso.emRevisao, cor: "text-amber-700", bg: "bg-amber-50 border-amber-100" },
    { rotulo: "Restantes", valor: progresso.restantes, cor: "text-slate-700", bg: "bg-white border-slate-200" },
    { rotulo: "Dispensadas pela triagem", valor: progresso.dispensadas, cor: "text-slate-500", bg: "bg-slate-50 border-slate-200" },
  ];

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50">
      <div className="border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
        <Link href={BASE} className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-700"><ArrowLeft className="h-3.5 w-3.5" /> Base Nacional</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Fila de verificação</h1>
            <p className="max-w-2xl text-xs text-slate-500">Empresas que o robô gratuito não conseguiu resolver. Abra as buscas prontas, analise e registre a decisão — com confiança, justificativa, link, responsável e data. Ausência de resultado nunca vira “não é concreteira”.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {usuario && podeValidar(usuario.papel) && <BotaoComecar query={qs} rotulo={progresso.verificadas ? "Continuar revisão" : "Começar revisão"} />}
            <a href={`/api/base-nacional/fila/relatorio${qs ? `${qs}&` : "?"}formato=xlsx`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"><FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Excel</a>
            <a href={`/api/base-nacional/fila/relatorio${qs ? `${qs}&` : "?"}formato=pdf`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"><FileText className="h-3.5 w-3.5 text-red-600" /> PDF</a>
            <a href={`${FILA}/imprimir${qs}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"><Printer className="h-3.5 w-3.5 text-indigo-600" /> Imprimir</a>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {kpis.map(k => (
            <div key={k.rotulo} className={cn("rounded-lg border px-3 py-2", k.bg)}>
              <p className={cn("text-lg font-semibold", k.cor)}>{k.valor.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-slate-500">{k.rotulo}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-label={`Progresso ${pct}%`}>
          <div className="h-2 bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-[11px] text-slate-500">{pct}% da fila verificada (filtros atuais)</p>
      </div>

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <form method="get" action={FILA} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-white p-3 md:grid-cols-4 xl:grid-cols-7">
            <input name="busca" defaultValue={f.busca ?? ""} placeholder="Nome ou CNPJ" className={cn(sel, "col-span-2 md:col-span-1")} />
            <select name="uf" defaultValue={f.uf ?? ""} className={sel} aria-label="Estado">
              <option value="">Todos os estados</option>
              {estados.map(e => <option key={e.uf} value={e.uf}>{e.uf}</option>)}
            </select>
            <select name="prioridade" defaultValue={f.prioridade ?? ""} className={sel} aria-label="Prioridade">
              <option value="">Prioridade A e B</option><option value="A">A · CNAE principal</option><option value="B">B · secundário</option>
            </select>
            <select name="local" defaultValue={f.local ?? ""} className={sel} aria-label="Interior ou capital">
              <option value="">Interior e capital</option><option value="interior">Interior</option><option value="capital">Capital/região metropolitana</option>
            </select>
            <select name="classificacao" defaultValue={f.classificacao ?? ""} className={sel} aria-label="Classificação da triagem">
              <option value="">Qualquer triagem</option>
              {CLASSES_TRIAGEM.map(c => <option key={c} value={c}>{CLASSE_TRIAGEM_LABEL[c]}</option>)}
            </select>
            <select name="potencial" defaultValue={f.potencial ?? ""} className={sel} aria-label="Potencial de compra">
              <option value="">Qualquer potencial</option>
              {NIVEIS_POTENCIAL.map(n => <option key={n} value={n}>{NIVEL_LABEL[n]}</option>)}
            </select>
            <select name="situacao" defaultValue={f.situacao} className={sel} aria-label="Situação na fila">
              <option value="AGUARDANDO">Aguardando</option><option value="CONCLUIDA">Verificadas</option>
              <option value="DISPENSADA_TRIAGEM">Dispensadas pela triagem</option><option value="TODAS">Todas</option>
            </select>
            <select name="origem" defaultValue={f.origem ?? ""} className={sel} aria-label="Origem">
              <option value="">Qualquer origem</option><option value="robo">Prováveis pelo site (confirmar)</option>
            </select>
            <div className="col-span-2 flex gap-2 md:col-span-1">
              <button className="flex-1 rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-white">Filtrar</button>
              <Link href={FILA} className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600">Limpar</Link>
            </div>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] text-slate-500">{total.toLocaleString("pt-BR")} empresa(s) · ordem: maior pontuação da triagem primeiro{total > linhas.length ? ` · mostrando ${linhas.length}` : ""}</p>
            <ul className="divide-y divide-slate-100">
              {linhas.map(l => {
                const ocupada = l.situacaoFila === "AGUARDANDO" && reservaAtiva(l) && l.emRevisaoPorId !== usuario?.id;
                return (
                  <li key={l.candidataId} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link href={`${FILA}/${encodeURIComponent(l.candidataId)}${qs}`} className="block truncate text-sm font-medium text-slate-800 hover:text-indigo-700">
                        {l.candidata.nomeFantasia || l.candidata.razaoSocial}
                      </Link>
                      <p className="truncate text-[11px] text-slate-500">
                        {l.candidata.razaoSocial} · {formatarCnpj(l.candidata.cnpjMatriz) ?? l.candidata.cnpjBasico} · {l.municipio}/{l.uf} · {l.interior ? "interior" : "capital/RM"}
                      </p>
                      <p className="truncate text-[11px] text-slate-400">{l.motivoFila}</p>
                    </div>
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 text-[10px]">
                      <span className={cn("rounded px-1.5 py-0.5 font-semibold", l.prioridadeReceita === "A" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800")}>{l.prioridadeReceita}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{CLASSE_TRIAGEM_LABEL[l.classificacao as ClasseTriagem] ?? l.classificacao}</span>
                      <span className={cn("rounded px-1.5 py-0.5", STATUS_COR[l.candidata.statusValidacao as StatusValidacao])}>{STATUS_LABEL[l.candidata.statusValidacao as StatusValidacao]}</span>
                      <span className={cn("rounded px-1.5 py-0.5", NIVEL_COR[l.potencialCompra as NivelPotencial])}>Compra: {NIVEL_LABEL[l.potencialCompra as NivelPotencial]}</span>
                      {l.situacaoFila !== "AGUARDANDO" && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">{SITUACAO_FILA_LABEL[l.situacaoFila]}{l.concluidaPor ? ` · ${l.concluidaPor.nome}` : ""}</span>}
                      {ocupada && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">Em revisão por {l.emRevisaoPor?.nome ?? "outra pessoa"}</span>}
                    </div>
                  </li>
                );
              })}
              {!linhas.length && <li className="px-3 py-6 text-center text-xs text-slate-400">Nenhuma empresa nesta fila com os filtros atuais.</li>}
            </ul>
          </div>
        </div>

        <aside className="space-y-4">
          {usuario?.papel === "ADMIN" && <PainelRobo ufPadrao={f.uf} />}
          <div className="rounded-xl border border-slate-100 bg-white">
            <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Filas por estado</p>
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead><tr className="text-[10px] uppercase text-slate-400"><th className="px-3 py-1.5 text-left">UF</th><th className="px-1 text-right">Aguard.</th><th className="px-1 text-right">Verif.</th><th className="px-3 text-right">Dispens.</th></tr></thead>
              <tbody>
                {estados.map(e => (
                  <tr key={e.uf} className="border-t border-slate-50">
                    <td className="px-3 py-1.5"><Link href={`${FILA}${qsFila({ ...f, uf: e.uf })}`} className="font-medium text-indigo-700 hover:underline">{e.uf}</Link></td>
                    <td className="px-2 text-right">{e.aguardando}</td><td className="px-2 text-right">{e.concluidas}</td><td className="px-3 text-right text-slate-400">{e.dispensadas}</td>
                  </tr>
                ))}
                {!estados.length && <tr><td colSpan={4} className="px-3 py-3 text-center text-slate-400">O robô ainda não rodou.</td></tr>}
              </tbody>
            </table></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
