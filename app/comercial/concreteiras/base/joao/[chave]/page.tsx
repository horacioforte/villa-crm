// ARQUIVO: app/comercial/concreteiras/base/joao/[chave]/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Grupo da fila comercial do João: empresas vinculadas, estados e unidades, classificação, decisores societários,
// contatos comerciais (separados, com origem e confiança) e decisão humana. Nada é enviado por esta tela.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { formatarCnpj } from "@/lib/base-nacional/cnpj";
import { CATEGORIA_COR, CATEGORIA_LABEL, PORTE_LABEL, type Categoria } from "@/lib/base-nacional/joao/categorizar";
import { DECISAO_COMERCIAL_LABEL, detalheGrupoJoao, escolherProximoPendente, lerFiltrosJoao, listarFilaJoao, qsJoao, type DecisaoComercial } from "@/lib/base-nacional/joao/fila-comercial";
import { linksConferenciaGrupo } from "@/lib/base-nacional/joao/links-conferencia";
import { pesquisaIaAtiva } from "@/lib/base-nacional/joao/pesquisa-ia-config";
import { formatarTelefone } from "@/lib/base-nacional/joao/validar";
import { CONFIANCA_LABEL, FONTE_LABEL, STATUS_COR, STATUS_LABEL, type StatusValidacao } from "@/lib/base-nacional/rotulos";
import { podeValidar } from "@/lib/base-nacional/validacao";
import { cn } from "@/lib/utils";
import { DecisaoJoao } from "./DecisaoJoao";
import { PesquisaIA } from "./PesquisaIA";

export const dynamic = "force-dynamic";
const JOAO = "/comercial/concreteiras/base/joao";
const data = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife" }).format(d) : "—");
const conf = (c: string | null) => (c ? (CONFIANCA_LABEL as Record<string, string>)[c] ?? c : "—");
const fonte = (f: string | null) => (f ? (FONTE_LABEL as Record<string, string>)[f] ?? f : "—");
const PAPEL: Record<string, string> = { PROPRIETARIO_SOCIO: "Sócio/proprietário", ADMINISTRADOR: "Administrador/diretor", COMPRADOR: "Compras", RESPONSAVEL_FROTA: "Frota", RESPONSAVEL_MANUTENCAO: "Manutenção", RESPONSAVEL_EQUIPAMENTOS: "Equipamentos", OUTRO: "Outro" };
const TIPO: Record<string, string> = { TELEFONE: "Telefone", WHATSAPP: "WhatsApp", EMAIL: "E-mail", LINKEDIN: "LinkedIn da empresa" };

export default async function GrupoJoaoPage({ params, searchParams }: { params: Promise<{ chave: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { chave } = await params;
  const filtros = lerFiltrosJoao(await searchParams);
  const qs = qsJoao(filtros);
  const chaveAtual = decodeURIComponent(chave);
  const [d, usuario, fila] = await Promise.all([detalheGrupoJoao(chaveAtual), getCurrentUser(), listarFilaJoao(filtros)]);
  if (!d) notFound();
  const proximaChave = escolherProximoPendente(fila.linhas, chaveAtual);
  const { grupo: g, ind, empresas, unidades, pessoas, contatos, historico, sites } = d;
  const conf30 = linksConferenciaGrupo({ empresas, contatos: [...sites, ...contatos] });
  const nomeEmp = new Map(empresas.map(e => [e.id, e.nomeFantasia || e.razaoSocial]));
  const uniPorId = new Map(unidades.map(u => [u.id, u]));
  const societarios = pessoas.filter(p => p.fonte === "RECEITA_FEDERAL");
  const outros = pessoas.filter(p => p.fonte !== "RECEITA_FEDERAL");
  const porUf = new Map<string, number>();
  for (const u of unidades) porUf.set(u.uf ?? "—", (porUf.get(u.uf ?? "—") ?? 0) + 1);
  const valorContato = (t: string, v: string) => (t === "TELEFONE" || t === "WHATSAPP" ? formatarTelefone(v) : v);
  const card = "rounded-xl border border-slate-100 bg-white";
  const th = "px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-slate-400";
  const td = "px-2 py-1.5 align-top";
  const botaoConf = "rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 hover:border-indigo-300 hover:text-indigo-700";
  const fonteConf = "text-[10px] text-indigo-700 underline hover:text-indigo-900";

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50">
      <div className="border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
        <Link href={`${JOAO}${qs}`} className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-700"><ArrowLeft className="h-3.5 w-3.5" /> Fila comercial do João</Link>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">{g.nome}</h1>
            <p className="text-xs text-slate-500">{empresas.length} empresa(s) · {ind.unidadesAtivas ?? unidades.length} unidade(s) ativa(s) · {(ind.ufs ?? []).join(", ") || "—"}</p>
            <p className="mt-1 text-xs text-slate-500">{g.categoriaMotivo}</p>
            <p className="mt-1 text-[11px] font-medium text-indigo-700">Pendentes com estes filtros: {fila.resumo.aguardando}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {g.categoriaComercial && <span className={cn("rounded px-2 py-1 font-semibold", CATEGORIA_COR[g.categoriaComercial as Categoria])}>{CATEGORIA_LABEL[g.categoriaComercial as Categoria]}</span>}
            <span className={cn("rounded px-2 py-1", g.decisaoComercial ? "bg-slate-800 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200")}>
              {g.decisaoComercial ? `${DECISAO_COMERCIAL_LABEL[g.decisaoComercial as DecisaoComercial]} · ${g.decisaoPor?.nome ?? ""} · ${data(g.decisaoEm)}` : "Aguardando revisão"}
            </span>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] text-slate-500">Conferir em 30s: é concreteira? o WhatsApp é da empresa?</p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {conf30.site
              ? <>
                  <a href={conf30.site.url} target="_blank" rel="noopener noreferrer" className={botaoConf}>Site</a>
                  {conf30.site.fonteUrl && <a href={conf30.site.fonteUrl} target="_blank" rel="noopener noreferrer" className={fonteConf}>fonte</a>}
                </>
              : <span aria-disabled="true" className="cursor-not-allowed rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-slate-400">sem site</span>}
            {conf30.maps && <a href={conf30.maps} target="_blank" rel="noopener noreferrer" className={botaoConf}>Google Maps</a>}
            {conf30.instagram && <a href={conf30.instagram} target="_blank" rel="noopener noreferrer" className={botaoConf}>Instagram</a>}
            {conf30.google && <a href={conf30.google} target="_blank" rel="noopener noreferrer" className={botaoConf}>Google</a>}
            {conf30.whatsapps.map(w => (
              <span key={w.url} className="inline-flex items-center gap-1">
                <a href={w.url} target="_blank" rel="noopener noreferrer" className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-emerald-800 hover:bg-emerald-100">{w.rotulo}</a>
                {w.fonteUrl && <a href={w.fonteUrl} target="_blank" rel="noopener noreferrer" className={fonteConf}>fonte</a>}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className={card}>
            <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Empresas do grupo</p>
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead><tr><th className={th}>Empresa</th><th className={th}>CNPJ</th><th className={th}>Matriz</th><th className={th}>Porte</th><th className={th}>Unidades</th><th className={th}>Classificação</th></tr></thead>
              <tbody>{empresas.map(e => (
                <tr key={e.id} className="border-t border-slate-50">
                  <td className={td}><Link href={`/comercial/concreteiras/base/${encodeURIComponent(e.id)}`} className="font-medium text-indigo-700 hover:underline">{e.nomeFantasia || e.razaoSocial}</Link><p className="text-[10px] text-slate-400">{e.razaoSocial}</p></td>
                  <td className={td}>{formatarCnpj(e.cnpjMatriz) ?? e.cnpjBasico}</td>
                  <td className={td}>{e.municipioMatriz ?? "—"}/{e.ufMatriz ?? "—"}</td>
                  <td className={td}>{PORTE_LABEL[e.porte ?? "00"] ?? e.porte}</td>
                  <td className={td}>{e.totalUnidadesAtivas}</td>
                  <td className={td}><span className={cn("rounded px-1.5 py-0.5 text-[10px]", STATUS_COR[e.statusValidacao as StatusValidacao])}>{STATUS_LABEL[e.statusValidacao as StatusValidacao]}</span>{e.confianca && <span className="ml-1 text-[10px] text-slate-400">confiança {conf(e.confianca)}</span>}</td>
                </tr>))}</tbody>
            </table></div>
            <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">Unidades ativas por estado: {[...porUf.entries()].map(([uf, n]) => `${uf} ${n}`).join(" · ") || "—"}</p>
          </section>

          <section className={card}>
            <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Decisores societários (Receita)</p>
            <p className="px-3 pt-2 text-[11px] text-slate-500">Cargo societário registrado no quadro de sócios. Não indica quem cuida de compras, manutenção ou frota, e não traz telefone nem e-mail pessoal.</p>
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead><tr><th className={th}>Nome</th><th className={th}>Cargo</th><th className={th}>Empresa</th><th className={th}>Fonte</th><th className={th}>Confiança</th><th className={th}>LinkedIn</th></tr></thead>
              <tbody>{societarios.map(p => (
                <tr key={p.id} className="border-t border-slate-50">
                  <td className={cn(td, "font-medium text-slate-800")}>{p.nome}</td><td className={td}>{p.funcao ?? (p.papeis ?? []).map(x => PAPEL[x] ?? x).join(", ")}</td>
                  <td className={td}>{nomeEmp.get(p.candidataId)}</td><td className={td}>{fonte(p.fonte)}</td><td className={td}>{conf(p.confianca)}</td>
                  <td className={td}>{p.linkedinUrl ? <a href={p.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-700 hover:underline">perfil <ExternalLink className="h-3 w-3" /></a> : "—"}</td>
                </tr>))}
                {!societarios.length && <tr><td colSpan={6} className="px-3 py-3 text-center text-slate-400">Não localizado.</td></tr>}</tbody>
            </table></div>
            {outros.length > 0 && <>
              <p className="border-t border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Outras pessoas com cargo (site ou LinkedIn)</p>
              <ul className="divide-y divide-slate-50 text-xs">{outros.map(p => (
                <li key={p.id} className="px-3 py-1.5"><span className="font-medium text-slate-800">{p.nome}</span> · {p.funcao ?? "—"} · {fonte(p.fonte)} · confiança {conf(p.confianca)}
                  {(p.linkedinUrl || p.fonteUrl) && <a href={p.linkedinUrl ?? p.fonteUrl ?? "#"} target="_blank" rel="noreferrer" className="ml-1 text-indigo-700 hover:underline">fonte</a>}</li>))}</ul>
            </>}
          </section>

          <section className={card}>
            <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Contatos comerciais da empresa</p>
            <p className="px-3 pt-2 text-[11px] text-slate-500">Contato geral da empresa — não pertence a nenhum sócio. Telefone da Receita fica como “não verificado”.</p>
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead><tr><th className={th}>Tipo</th><th className={th}>Contato</th><th className={th}>Empresa / unidade</th><th className={th}>Origem</th><th className={th}>Confiança</th><th className={th}>Situação</th><th className={th}>Data</th></tr></thead>
              <tbody>{contatos.map(k => {
                const u = k.unidadeId ? uniPorId.get(k.unidadeId) : null;
                return (
                  <tr key={k.id} className="border-t border-slate-50">
                    <td className={td}>{TIPO[k.tipo] ?? k.tipo}</td>
                    <td className={cn(td, "font-medium text-slate-800")}>{valorContato(k.tipo, k.valor)}<p className="text-[10px] font-normal text-slate-400">{k.descricao}</p></td>
                    <td className={td}>{nomeEmp.get(k.candidataId)}{u ? <p className="text-[10px] text-slate-400">{u.isMatriz ? "matriz" : "filial"} {u.municipioNome}/{u.uf}</p> : null}</td>
                    <td className={td}>{fonte(k.fonte)}{k.fonteUrl && <a href={k.fonteUrl} target="_blank" rel="noreferrer" className="ml-1 text-indigo-700 hover:underline">link</a>}</td>
                    <td className={td}>{conf(k.confianca)}</td>
                    <td className={td}>{k.situacao === "VERIFICADO" ? "Verificado" : "Não verificado"}</td>
                    <td className={td}>{data(k.pesquisadoEm ?? k.createdAt)}</td>
                  </tr>);
              })}
                {!contatos.length && <tr><td colSpan={7} className="px-3 py-3 text-center text-slate-400">Nenhum contato comercial válido.</td></tr>}</tbody>
            </table></div>
          </section>

          {historico.length > 0 && <section className={card}>
            <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Histórico de decisões</p>
            <ul className="divide-y divide-slate-50 text-xs">{historico.map(h => <li key={h.id} className="px-3 py-1.5">{data(h.createdAt)} · {h.usuario?.nome ?? "—"} · {h.motivo}</li>)}</ul>
          </section>}
        </div>

        <aside className="space-y-3">
          {usuario && podeValidar(usuario.papel) && pesquisaIaAtiva() && (g.categoriaComercial === "B" || g.categoriaComercial === "C") && <PesquisaIA chave={g.chave} />}
          {usuario && podeValidar(usuario.papel)
            ? <DecisaoJoao key={g.chave} chave={g.chave} query={qs} proximaChave={proximaChave} decisaoAtual={g.decisaoComercial} observacaoAtual={g.decisaoObservacao}
                contatos={contatos.map(k => ({ id: k.id, rotulo: `${TIPO[k.tipo] ?? k.tipo}: ${valorContato(k.tipo, k.valor)} (${fonte(k.fonte)})` }))} />
            : <p className="rounded-xl border border-slate-100 bg-white p-3 text-xs text-slate-500">Seu perfil pode consultar, mas não registrar decisões.</p>}
        </aside>
      </div>
    </div>
  );
}
