// ARQUIVO: app/comercial/concreteiras/base/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Base Nacional de Concreteiras — tela de CONSULTA (Etapa 2A).
// Server Component; filtros via URL (GET); paginação no servidor.
// Etapa 2A: somente leitura. v4 (05/10/2026): filtros de prioridade e de equipamento com potencial
// de venda; a gravação acontece só na ficha da candidata (com histórico).

import Link from "next/link";
import { Building2, FileSpreadsheet, FileText, Printer, Search, X } from "lucide-react";
import { contarResumo, listarCandidatas, opcoesFiltro } from "@/lib/base-nacional/consulta";
import { formatarCnpj } from "@/lib/base-nacional/cnpj";
import { classeReceitaDe, lerFiltros, lerPaginacao, querystring, temFiltroAtivo, totalPaginas, TAMANHOS_PAGINA } from "@/lib/base-nacional/filtros";
import {
  CONFIANCAS,
  CONFIANCA_COR,
  CONFIANCA_LABEL,
  EQUIPAMENTOS,
  EQUIPAMENTO_LABEL,
  NIVEL_COR,
  PRIORIDADES,
  PRIORIDADE_COR,
  PRIORIDADE_LABEL,
  STATUS_COR,
  STATUS_LABEL,
  STATUS_VALIDACAO,
  TIPOS_UNIDADE,
  TIPO_UNIDADE_LABEL,
  type Confianca,
  type Equipamento,
  type NivelPotencial,
  type Prioridade,
  type StatusValidacao,
  type TipoUnidade,
} from "@/lib/base-nacional/rotulos";
import { cn } from "@/lib/utils";
import { CidadeAutocomplete } from "./CidadeAutocomplete";

export const dynamic = "force-dynamic";

const BASE = "/comercial/concreteiras/base";

function dataCurta(d: Date | null) {
  return d ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife" }).format(d) : "—";
}

export default async function BaseNacionalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filtros = lerFiltros(params);
  const { pagina, porPagina } = lerPaginacao(params);

  const [resumo, opcoes, { total, linhas }] = await Promise.all([
    contarResumo(),
    opcoesFiltro(),
    listarCandidatas(filtros, pagina, porPagina),
  ]);
  const paginas = totalPaginas(total, porPagina);
  const temFiltro = temFiltroAtivo(filtros);
  const qsFiltros = querystring(filtros);

  const kpis = [
    { label: "Candidatas", valor: resumo.total, cor: "text-slate-800", bg: "bg-slate-50 border-slate-100" },
    { label: "Confirmadas como concreteira", valor: resumo.confirmadas, cor: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
    { label: "Em análise", valor: resumo.emAnalise, cor: "text-amber-700", bg: "bg-amber-50 border-amber-100" },
    { label: "Descartadas", valor: resumo.descartadas, cor: "text-red-700", bg: "bg-red-50 border-red-100" },
    { label: "Sem análise", valor: resumo.semAnalise, cor: "text-slate-600", bg: "bg-white border-slate-200" },
    // 08/10/2026 — classificação pela Receita Federal
    { label: "Prioridade A · CNAE principal", valor: resumo.classeA, cor: "text-indigo-700", bg: "bg-indigo-50 border-indigo-100" },
    { label: "Prioridade B · CNAE secundário (a validar)", valor: resumo.classeB, cor: "text-sky-700", bg: "bg-sky-50 border-sky-100" },
  ];

  const selectCls = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-indigo-300 focus:outline-none";

  return (
    <div className="flex h-full flex-col overflow-auto">
      {/* Cabeçalho */}
      <div className="flex-shrink-0 border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-slate-800">Base Nacional de Concreteiras</h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Base de investigação — candidatas ainda não fazem parte do cadastro comercial. A validação é feita na ficha de cada candidata.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a href={`/api/base-nacional/relatorio${querystring(filtros, { formato: "xlsx" })}`} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Excel
            </a>
            <a href={`/api/base-nacional/relatorio${querystring(filtros, { formato: "pdf" })}`} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <FileText className="h-3.5 w-3.5 text-red-600" /> PDF
            </a>
            {/* v5 (08/10/2026): fila de verificação humana + robô gratuito */}
            <Link href={`${BASE}/fila`} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
              Fila de verificação
            </Link>
            {/* v7 (13/10/2026): fila comercial do João (A/B/C, decisão humana; nada é enviado) */}
            <Link href={`${BASE}/joao`} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
              Fila comercial do João
            </Link>
            <a href={`${BASE}/imprimir${qsFiltros}`} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Printer className="h-3.5 w-3.5 text-indigo-600" /> Imprimir
            </a>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {kpis.map(k => (
            <div key={k.label} className={cn("rounded-lg border px-3 py-2", k.bg)}>
              <p className={cn("text-lg font-semibold", k.cor)}>{k.valor.toLocaleString("pt-BR")}</p>
              <p className="text-[11px] text-slate-500">{k.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros (GET — sem gravação) */}
      <form method="get" action={BASE} className="flex-shrink-0 border-b border-slate-100 bg-white px-4 py-3 sm:px-6">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          <div className="col-span-2 relative">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <input name="busca" defaultValue={filtros.busca ?? ""} placeholder="Razão social, fantasia, CNPJ ou município" className={cn(selectCls, "pl-8")} />
          </div>
          <select name="uf" defaultValue={filtros.uf ?? ""} className={selectCls} aria-label="Estado">
            <option value="">Todos os estados</option>
            {opcoes.ufs.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <CidadeAutocomplete valorInicial={filtros.cidade} className={selectCls} />
          <select name="status" defaultValue={filtros.status ?? ""} className={selectCls} aria-label="Situação">
            <option value="">Todas as situações</option>
            {STATUS_VALIDACAO.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select name="tipoUnidade" defaultValue={filtros.tipoUnidade ?? ""} className={selectCls} aria-label="Tipo de unidade">
            <option value="">Todos os tipos de unidade</option>
            {TIPOS_UNIDADE.map(t => <option key={t} value={t}>{TIPO_UNIDADE_LABEL[t]}</option>)}
          </select>
          <select name="confianca" defaultValue={filtros.confianca ?? ""} className={selectCls} aria-label="Confiança">
            <option value="">Qualquer confiança</option>
            {CONFIANCAS.map(c => <option key={c} value={c}>{CONFIANCA_LABEL[c]}</option>)}
          </select>
          <select name="segmento" defaultValue={filtros.segmento ?? ""} className={selectCls} aria-label="Segmento">
            <option value="">Todos os segmentos</option>
            {opcoes.segmentos.map(s => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
          </select>
          <select name="classeReceita" defaultValue={filtros.classeReceita ?? ""} className={selectCls} aria-label="Prioridade da Receita">
            <option value="">Prioridade A e B</option>
            <option value="A">Prioridade A · CNAE principal</option>
            <option value="B">Prioridade B · CNAE secundário (a validar)</option>
          </select>
          <select name="situacaoReceita" defaultValue={filtros.situacaoReceita ?? "ativas"} className={selectCls} aria-label="Situação na Receita">
            <option value="ativas">Somente ativas na Receita</option>
            <option value="todas">Ativas, inativas e baixadas</option>
            <option value="inativas">Somente inativas/baixadas</option>
          </select>
          <select name="prioridade" defaultValue={filtros.prioridade ?? ""} className={selectCls} aria-label="Prioridade comercial">
            <option value="">Qualquer prioridade</option>
            {PRIORIDADES.map(p => <option key={p} value={p}>Prioridade {PRIORIDADE_LABEL[p].toLowerCase()}</option>)}
          </select>
          <select name="equipamento" defaultValue={filtros.equipamento ?? ""} className={selectCls} aria-label="Potencial de venda por equipamento">
            <option value="">Qualquer equipamento</option>
            {EQUIPAMENTOS.map(e => <option key={e} value={e}>Potencial de venda: {EQUIPAMENTO_LABEL[e]}</option>)}
          </select>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="porPagina" value={porPagina} />
          <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">Aplicar filtros</button>
          {temFiltro && (
            <Link href={BASE} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              <X className="h-3 w-3" /> Limpar filtros
            </Link>
          )}
          <span className="ml-auto text-xs text-slate-400">
            {total.toLocaleString("pt-BR")} {total === 1 ? "candidata encontrada" : "candidatas encontradas"}
          </span>
        </div>
      </form>

      {/* Listagem */}
      <div className="flex-1 px-4 py-4 sm:px-6">
        {linhas.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white text-center">
            <Building2 className="mb-2 h-6 w-6 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">
              {resumo.total === 0 ? "A Base Nacional ainda está vazia" : "Nenhuma candidata com esses filtros"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {resumo.total === 0 ? "As candidatas aparecerão aqui depois da carga da Receita Federal." : "Ajuste ou limpe os filtros para ver mais resultados."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
            <table className="min-w-[1300px] w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Razão social</th>
                  <th className="px-3 py-2 font-semibold">Nome fantasia</th>
                  <th className="px-3 py-2 font-semibold">CNPJ</th>
                  <th className="px-3 py-2 font-semibold">Cidade / UF</th>
                  <th className="px-3 py-2 font-semibold">Unidades</th>
                  <th className="px-3 py-2 font-semibold">Situação</th>
                  <th className="px-3 py-2 font-semibold">Confiança</th>
                  <th className="px-3 py-2 font-semibold">Prioridade</th>
                  <th className="px-3 py-2 font-semibold">Potencial de venda</th>
                  <th className="px-3 py-2 font-semibold text-center">Evidências</th>
                  <th className="px-3 py-2 font-semibold">Empresa no CRM</th>
                  <th className="px-3 py-2 font-semibold">Última verificação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linhas.map(l => (
                  <tr key={l.id} className="hover:bg-indigo-50/40">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      <Link href={`${BASE}/${l.id}`} className="hover:text-indigo-700 hover:underline">{l.razaoSocial ?? "(sem razão social)"}</Link>
                      {(() => {
                        const classe = classeReceitaDe(l.unidades);
                        if (classe === "A") return <span className="mt-0.5 block w-fit rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white" title="Unidade ativa com CNAE 2330-3/05 como atividade principal">A · CNAE principal</span>;
                        if (classe === "B") return <span className="mt-0.5 block w-fit rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700" title="CNAE 2330-3/05 só como atividade secundária: NÃO confirma que seja concreteira">B · CNAE secundário — a validar</span>;
                        return <span className="mt-0.5 block w-fit rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">Sem unidade ativa</span>;
                      })()}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{l.nomeFantasia ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-600">{formatarCnpj(l.cnpjMatriz) ?? `${l.cnpjBasico}…`}</td>
                    <td className="px-3 py-2 text-slate-600">{[l.municipioMatriz, l.ufMatriz].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">
                      <span className="font-medium text-slate-700">{l._count.unidades}</span>
                      {l.tiposUnidade.length > 0 && (
                        <span className="block text-[10px] text-slate-400">
                          {l.tiposUnidade.map(t => `${TIPO_UNIDADE_LABEL[t.tipo as TipoUnidade]}: ${t.n}`).join(" · ")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_COR[l.statusValidacao as StatusValidacao])}>
                        {STATUS_LABEL[l.statusValidacao as StatusValidacao]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {l.confianca ? (
                        <span className={cn("whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium", CONFIANCA_COR[l.confianca as Confianca])}>
                          {CONFIANCA_LABEL[l.confianca as Confianca]}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {l.prioridadeComercial ? (
                        <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold", PRIORIDADE_COR[l.prioridadeComercial as Prioridade])}>
                          {PRIORIDADE_LABEL[l.prioridadeComercial as Prioridade]}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      {l.potenciais.length === 0 ? <span className="text-slate-300">—</span> : (
                        <span className="flex flex-wrap gap-0.5">
                          {[...new Map(l.potenciais.map(p => [p.equipamento, p])).values()].map(p => (
                            <span key={p.equipamento} className={cn("whitespace-nowrap rounded px-1.5 py-0.5 text-[10px]", NIVEL_COR[p.potencialVenda as NivelPotencial])}>
                              {EQUIPAMENTO_LABEL[p.equipamento as Equipamento]}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-600">{l._count.evidencias}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {l.empresa ? (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700">{l.empresa.nomeFantasia ?? l.empresa.razaoSocial}</span>
                      ) : <span className="whitespace-nowrap text-slate-300">Não vinculada</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-500">{dataCurta(l.ultimaVerificacaoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação (servidor) */}
        {total > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Página {Math.min(pagina, paginas)} de {paginas} · {((Math.min(pagina, paginas) - 1) * porPagina + 1).toLocaleString("pt-BR")}–
              {Math.min(Math.min(pagina, paginas) * porPagina, total).toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")}
            </span>
            <div className="flex items-center gap-1">
              {TAMANHOS_PAGINA.map(n => (
                <Link key={n} href={`${BASE}${querystring(filtros, { porPagina: n })}`}
                  className={cn("rounded-md border px-2 py-1", n === porPagina ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 hover:bg-slate-50")}>
                  {n}
                </Link>
              ))}
              <span className="mx-2 text-slate-300">|</span>
              {pagina > 1 ? (
                <Link href={`${BASE}${querystring(filtros, { porPagina, pagina: pagina - 1 })}`} className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50">‹ Anterior</Link>
              ) : <span className="rounded-md border border-slate-100 px-2 py-1 text-slate-300">‹ Anterior</span>}
              {pagina < paginas ? (
                <Link href={`${BASE}${querystring(filtros, { porPagina, pagina: pagina + 1 })}`} className="rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50">Próxima ›</Link>
              ) : <span className="rounded-md border border-slate-100 px-2 py-1 text-slate-300">Próxima ›</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
