// ARQUIVO: app/comercial/concreteiras/base/fila/[id]/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Tela de revisão de UMA empresa da fila de verificação humana (funciona no celular).
// Mostra dados da Receita, triagem, vínculos, evidências e potencial; os botões de busca apenas abrem
// novas abas para a pessoa analisar (nenhuma raspagem). A decisão é gravada pelo componente Revisao.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { formatarCnpj } from "@/lib/base-nacional/cnpj";
import { fichaFila, lerFiltrosFila, progressoFila, qsFila } from "@/lib/base-nacional/fila-consulta";
import { linksDeBusca, podeRevisar } from "@/lib/base-nacional/fila";
import { SITUACAO_FILA_LABEL } from "@/lib/base-nacional/fila-relatorio";
import { CLASSE_TRIAGEM_LABEL, type ClasseTriagem } from "@/lib/base-nacional/triagem";
import { dominioDeEmail } from "@/lib/base-nacional/robo/site";
import { descreverCnae, descreverPorte } from "@/lib/base-nacional/receita-tabelas";
import { rotuloConclusaoSite } from "@/lib/base-nacional/rotulos-site";
import {
  CONFIANCA_LABEL, EQUIPAMENTO_LABEL, FONTE_LABEL, NIVEL_COR, NIVEL_LABEL, PRIORIDADE_LABEL, STATUS_COR, STATUS_LABEL,
  type Confianca, type Equipamento, type NivelPotencial, type Prioridade, type StatusValidacao,
} from "@/lib/base-nacional/rotulos";
import { podeValidar } from "@/lib/base-nacional/validacao";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { Revisao } from "./Revisao";

export const dynamic = "force-dynamic";
const BASE = "/comercial/concreteiras/base";
const FILA = `${BASE}/fila`;
const fmt = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife" }).format(d) : "—");

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white">
      <h2 className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{titulo}</h2>
      <div className="p-3">{children}</div>
    </section>
  );
}

export default async function RevisaoPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const f = lerFiltrosFila(await searchParams);
  const qs = qsFila(f);
  const [t, usuario, progresso] = await Promise.all([fichaFila(id), getCurrentUser(), progressoFila(f)]);
  if (!t) notFound();
  const c = t.candidata;
  const ativas = c.unidades.filter(u => u.ativa);
  const matriz = c.unidades.find(u => u.isMatriz) ?? c.unidades[0];
  // Site próprio: domínio do e-mail da Receita (dado público), se não for provedor genérico.
  const receita = await prisma.receitaEstabelecimento.findMany({ where: { cnpj: { in: c.unidades.map(u => u.cnpj) } }, select: { email: true }, take: 20 });
  const site = receita.map(r => dominioDeEmail(r.email)).find(Boolean) ?? null;
  const links = linksDeBusca({ razaoSocial: c.razaoSocial, nomeFantasia: c.nomeFantasia, cidade: t.municipio ?? c.municipioMatriz, uf: t.uf ?? c.ufMatriz, cnpj: c.cnpjMatriz ?? matriz?.cnpj, site });
  const resumoRobo = (t.roboResumo ?? {}) as { conclusaoSite?: string; dominios?: string[]; paginas?: string[] };
  const seloDoRobo = rotuloConclusaoSite(resumoRobo.conclusaoSite, resumoRobo.paginas);
  const pode = Boolean(usuario && podeValidar(usuario.papel));
  const livre = usuario ? podeRevisar(t, usuario.id) : false;
  const cnaes = [...new Set(ativas.flatMap(u => [u.cnaePrincipal]))];
  const secundarios = [...new Set(ativas.flatMap(u => u.cnaesSecundarios ?? []))].filter(s => !cnaes.includes(s));

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50">
      <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <Link href={`${FILA}${qs}`} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-700"><ArrowLeft className="h-3.5 w-3.5" /> Fila</Link>
          <p className="text-[11px] text-slate-500">Verificadas {progresso.verificadas} · pendentes {progresso.pendentes} · restantes {progresso.restantes}</p>
        </div>
        <h1 className="mt-1 text-base font-semibold leading-tight text-slate-800">{c.nomeFantasia || c.razaoSocial}</h1>
        <p className="text-[11px] text-slate-500">{c.razaoSocial} · {formatarCnpj(c.cnpjMatriz) ?? c.cnpjBasico} · {t.municipio ?? c.municipioMatriz}/{t.uf ?? c.ufMatriz}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
          <span className={cn("rounded px-1.5 py-0.5 font-semibold", t.prioridadeReceita === "A" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800")}>Prioridade {t.prioridadeReceita}</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{t.interior ? "Interior" : "Capital/região metropolitana"}</span>
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">Triagem: {CLASSE_TRIAGEM_LABEL[t.classificacao as ClasseTriagem] ?? t.classificacao}</span>
          <span className={cn("rounded px-1.5 py-0.5", STATUS_COR[c.statusValidacao as StatusValidacao])}>{STATUS_LABEL[c.statusValidacao as StatusValidacao]}{c.confianca ? ` · ${CONFIANCA_LABEL[c.confianca as Confianca]}` : ""}</span>
          <span className={cn("rounded px-1.5 py-0.5", NIVEL_COR[t.potencialCompra as NivelPotencial])}>Compra de usados: {NIVEL_LABEL[t.potencialCompra as NivelPotencial]}</span>
          {t.situacaoFila !== "AGUARDANDO" && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700">{SITUACAO_FILA_LABEL[t.situacaoFila]}{t.concluidaPor ? ` por ${t.concluidaPor.nome} em ${fmt(t.concluidaEm)}` : ""}</span>}
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:p-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <Bloco titulo="Buscas prontas (abrem em nova aba)">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {links.map(l => (
                <div key={l.chave} className="flex flex-col items-center gap-1">
                  <a href={l.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-xs font-medium text-slate-700 hover:border-indigo-300 hover:bg-indigo-50">
                    {l.rotulo} <ExternalLink className="h-3 w-3 text-slate-400" />
                  </a>
                  {l.chave === "site" && (
                    <span className={cn("rounded px-1.5 py-0.5 text-center text-[10px] font-medium", seloDoRobo.cor)}>{seloDoRobo.texto}</span>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-400">Os botões só abrem a pesquisa para você analisar. O CRM não lê nem copia nada dessas plataformas.</p>
          </Bloco>

          <Bloco titulo="Por que está na fila">
            <p className="text-xs text-slate-700">{t.motivoFila ?? "—"}</p>
            {t.sinais.length > 0 && <p className="mt-1 text-[11px] text-slate-500">Sinais da triagem: {t.sinais.join(" · ")}</p>}
            <p className="mt-1 text-[11px] text-slate-500">Robô: {t.roboExecutadoEm ? `${fmt(t.roboExecutadoEm)} · site: ${seloDoRobo.texto}${resumoRobo.dominios?.length ? ` (${resumoRobo.dominios.join(", ")})` : ""}` : "ainda não rodou"} · regra {t.versaoRegra}</p>
          </Bloco>

          <Bloco titulo={`Unidades (${ativas.length} ativa${ativas.length === 1 ? "" : "s"} de ${c.unidades.length})`}>
            <ul className="space-y-1.5">
              {c.unidades.map(u => (
                <li key={u.id} className={cn("text-xs", !u.ativa && "text-slate-400 line-through")}>
                  <span className="font-medium">{u.isMatriz ? "Matriz" : "Filial"}</span> · {formatarCnpj(u.cnpj)} · {u.municipioNome}/{u.uf}{u.nomeFantasia ? ` · ${u.nomeFantasia}` : ""}
                </li>
              ))}
            </ul>
            <div className="mt-2 grid gap-1 text-[11px] text-slate-600">
              <p><span className="text-slate-400">CNAE principal:</span> {cnaes.map(x => `${descreverCnae(x).formatado} ${descreverCnae(x).descricao}`).join("; ")}</p>
              {secundarios.length > 0 && <p><span className="text-slate-400">Secundários:</span> {secundarios.slice(0, 12).map(x => descreverCnae(x).formatado).join(", ")}{secundarios.length > 12 ? ` +${secundarios.length - 12}` : ""}</p>}
              <p><span className="text-slate-400">Porte:</span> {descreverPorte(c.porte).texto} · <span className="text-slate-400">Capital:</span> {c.capitalSocial === null ? "—" : Number(c.capitalSocial).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
            </div>
          </Bloco>

          <Bloco titulo="Possíveis vínculos (robô — só indício, não copia classificação)">
            {c.vinculosOrigem.length ? (
              <ul className="space-y-1">
                {c.vinculosOrigem.map(v => (
                  <li key={`${v.candidataRelacionada.id}-${v.tipo}`} className="text-xs">
                    <span className={cn("mr-1 rounded px-1 text-[10px]", v.forca === "ALTA" ? "bg-emerald-100 text-emerald-800" : v.forca === "MEDIA" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500")}>{v.forca.toLowerCase()}</span>
                    Mesmo {v.tipo.toLowerCase().replace("_", " de ")} ({v.chaveMascarada}) que{" "}
                    <Link href={`${BASE}/${v.candidataRelacionada.id}`} target="_blank" className="text-indigo-700 hover:underline">{v.candidataRelacionada.nomeFantasia || v.candidataRelacionada.razaoSocial}</Link>
                    {" "}· {v.candidataRelacionada.municipioMatriz}/{v.candidataRelacionada.ufMatriz} · <span className={cn("rounded px-1", STATUS_COR[v.candidataRelacionada.statusValidacao as StatusValidacao])}>{STATUS_LABEL[v.candidataRelacionada.statusValidacao as StatusValidacao]}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-slate-400">Nenhum vínculo encontrado.</p>}
          </Bloco>

          <Bloco titulo={`Evidências já registradas (${c.evidencias.length})`}>
            {c.evidencias.length ? (
              <ul className="space-y-2">
                {c.evidencias.map(e => (
                  <li key={e.id} className="text-xs">
                    <p className="font-medium text-slate-700">{e.titulo ?? FONTE_LABEL[e.tipoFonte] ?? e.tipoFonte}</p>
                    <p className="text-[11px] text-slate-500">{FONTE_LABEL[e.tipoFonte] ?? e.tipoFonte} · {fmt(e.coletadoEm)}{e.agente ? ` · ${e.agente}` : ""}{e.confianca ? ` · confiança ${CONFIANCA_LABEL[e.confianca as Confianca].toLowerCase()}` : ""}</p>
                    {e.trecho && <p className="mt-0.5 line-clamp-3 text-[11px] text-slate-600">“{e.trecho}”</p>}
                    {e.url && <a href={e.url} target="_blank" rel="noopener noreferrer" className="break-all text-[11px] text-indigo-700 hover:underline">{e.url}</a>}
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-slate-400">Nenhuma evidência ainda.</p>}
            {c.justificativa && <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">Última justificativa: {c.justificativa}</p>}
          </Bloco>

          <Bloco titulo="Potencial comercial atual">
            <p className="text-xs text-slate-700">Compra de usados: {NIVEL_LABEL[t.potencialCompra as NivelPotencial]} {t.situacaoFila === "AGUARDANDO" ? "(estimativa do robô)" : ""}</p>
            {c.potenciais.length > 0 && <p className="mt-1 text-[11px] text-slate-500">{c.potenciais.map(p => `${EQUIPAMENTO_LABEL[p.equipamento as Equipamento]} (${NIVEL_LABEL[p.potencialVenda as NivelPotencial].toLowerCase()})`).join("; ")}</p>}
            {c.prioridadeComercial && <p className="mt-1 text-[11px] text-slate-500">Prioridade de abordagem: {PRIORIDADE_LABEL[c.prioridadeComercial as Prioridade]}</p>}
            {c.observacaoComercial && <p className="mt-1 text-[11px] text-slate-500">Observação: {c.observacaoComercial}</p>}
            <Link href={`${BASE}/${c.id}`} target="_blank" className="mt-2 inline-block text-[11px] text-indigo-700 hover:underline">Abrir ficha completa da candidata</Link>
          </Bloco>
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          {pode && t.situacaoFila === "AGUARDANDO" ? (
            <Revisao candidataId={c.id} query={qs} livreParaMim={livre} ocupadaPor={livre ? null : t.emRevisaoPor?.nome ?? "outra pessoa"}
              potencialAtual={t.potencialCompra} prioridadeAtual={c.prioridadeComercial} observacaoAtual={c.observacaoComercial}
              statusAtual={c.statusValidacao} equipamentosExistentes={c.potenciais.map(p => p.equipamento)} />
          ) : (
            <div className="rounded-xl border border-slate-100 bg-white p-3 text-xs text-slate-500">
              {t.situacaoFila === "AGUARDANDO" ? "Seu perfil só pode consultar." : "Esta empresa não está aguardando verificação."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
