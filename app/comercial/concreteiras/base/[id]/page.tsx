// ARQUIVO: app/comercial/concreteiras/base/[id]/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Ficha da candidata da Base Nacional — SOMENTE LEITURA (Etapa 2A).
// Sem botões de confirmar, vincular ou gravar.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Info } from "lucide-react";
import { fichaCandidata } from "@/lib/base-nacional/consulta";
import { formatarCnpj } from "@/lib/base-nacional/cnpj";
import {
  CONFIANCA_COR,
  CONFIANCA_LABEL,
  FONTE_LABEL,
  SITUACAO_RECEITA_LABEL,
  STATUS_COR,
  STATUS_LABEL,
  TIPO_ATIVIDADE_LABEL,
  TIPO_MUDANCA_LABEL,
  TIPO_UNIDADE_LABEL,
  type Confianca,
  type StatusValidacao,
  type TipoAtividade,
  type TipoUnidade,
} from "@/lib/base-nacional/rotulos";
import { classificarLink, descreverCnae, descreverMudanca, descreverNatureza, descreverPorte } from "@/lib/base-nacional/receita-tabelas";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const fmtData = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife" }).format(d) : "—");
const fmtDataHora = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Recife" }).format(d) : "—";
const fmtMoeda = (v: unknown) =>
  v === null || v === undefined ? "—" : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Secao({ titulo, children, extra }: { titulo: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</h2>
        {extra}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{rotulo}</p>
      <p className="text-xs text-slate-700">{valor ?? "—"}</p>
    </div>
  );
}

const Vazio = ({ texto }: { texto: string }) => <p className="text-xs text-slate-400">{texto}</p>;

function Cnae({ codigo, compacto = false }: { codigo: string; compacto?: boolean }) {
  const c = descreverCnae(codigo);
  return (
    <span className={cn("inline-flex flex-col", c.concretoUsinado && "rounded bg-emerald-50 px-1 py-0.5")} title={`Código original: ${c.original ?? "—"}`}>
      <span className={cn("font-mono text-[11px]", c.concretoUsinado ? "font-semibold text-emerald-700" : "text-slate-600")}>
        {c.formatado}{c.concretoUsinado ? " · concreto usinado" : ""}
      </span>
      {!compacto && <span className="text-[10px] leading-tight text-slate-500">{c.descricao}</span>}
    </span>
  );
}

function CodigoTraduzido({ texto, codigo }: { texto: string; codigo: string | null }) {
  return (
    <span>
      {codigo ? <span className="text-slate-700">{codigo} — {texto}</span> : texto}
    </span>
  );
}

export default async function FichaCandidataPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dados = await fichaCandidata(id);
  if (!dados) notFound();
  const { c, registrosReceita, competencias, mudancas, correspondencias } = dados;
  const matriz = c.unidades.find(u => u.isMatriz);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="border-b border-slate-100 bg-white px-4 py-4 sm:px-6">
        <Link href="/comercial/concreteiras/base" className="mb-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
          <ArrowLeft className="h-3 w-3" /> Base Nacional de Concreteiras
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-slate-800">{c.razaoSocial ?? "(sem razão social)"}</h1>
            <p className="text-xs text-slate-500">
              {c.nomeFantasia ?? "Sem nome fantasia"} · CNPJ {formatarCnpj(c.cnpjMatriz) ?? `raiz ${c.cnpjBasico}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_COR[c.statusValidacao as StatusValidacao])}>
              {STATUS_LABEL[c.statusValidacao as StatusValidacao]}
            </span>
            {c.confianca && (
              <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", CONFIANCA_COR[c.confianca as Confianca])}>
                Confiança {CONFIANCA_LABEL[c.confianca as Confianca].toLowerCase()}
              </span>
            )}
            {c.tipoAtividade && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">{TIPO_ATIVIDADE_LABEL[c.tipoAtividade as TipoAtividade]}</span>
            )}
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          Ficha de investigação, somente consulta. Confirmação, vínculo e promoção ao cadastro comercial serão liberados em etapa futura.
        </p>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:px-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Secao titulo="Dados cadastrais">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Campo rotulo="Raiz do CNPJ" valor={<span className="font-mono">{c.cnpjBasico}</span>} />
              <Campo rotulo="CNPJ da matriz" valor={<span className="font-mono">{formatarCnpj(c.cnpjMatriz) ?? "—"}</span>} />
              <Campo rotulo="Porte" valor={<CodigoTraduzido {...descreverPorte(c.porte)} />} />
              <Campo rotulo="Capital social" valor={fmtMoeda(c.capitalSocial)} />
              <Campo rotulo="Natureza jurídica" valor={<CodigoTraduzido {...descreverNatureza(c.naturezaJuridica)} />} />
              <Campo rotulo="Matriz" valor={[c.municipioMatriz, c.ufMatriz].filter(Boolean).join(" / ") || "—"} />
              <Campo rotulo="Unidades (ativas)" valor={`${c.totalUnidades} (${c.totalUnidadesAtivas})`} />
              <Campo rotulo="Primeira / última competência" valor={`${c.primeiraCompetencia ?? "—"} / ${c.ultimaCompetencia ?? "—"}`} />
              <Campo rotulo="Primeira verificação" valor={fmtData(c.primeiraVerificacaoEm)} />
              <Campo rotulo="Última verificação" valor={fmtData(c.ultimaVerificacaoEm)} />
              <Campo rotulo="Validado por" valor={c.validadoPor?.nome} />
              <Campo rotulo="Validado em" valor={fmtData(c.validadoEm)} />
            </div>
            {c.justificativa && <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600"><b>Justificativa:</b> {c.justificativa}</p>}
          </Secao>

          <Secao titulo={`Matriz, filiais e centrais (${c.unidades.length})`}>
            {c.unidades.length === 0 ? <Vazio texto="Nenhuma unidade registrada." /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="text-[10px] uppercase text-slate-400">
                    <tr><th className="py-1 pr-2">CNPJ</th><th className="pr-2">Tipo</th><th className="pr-2">Unidade</th><th className="pr-2">Situação</th><th className="pr-2">CNAE principal</th><th className="pr-2">Endereço</th><th>Cidade / UF</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {c.unidades.map(u => (
                      <tr key={u.id}>
                        <td className="py-1.5 pr-2 font-mono text-[11px]">{formatarCnpj(u.cnpj)}</td>
                        <td className="pr-2"><span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", u.isMatriz ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600")}>{u.isMatriz ? "Matriz" : "Filial"}</span></td>
                        <td className="pr-2">{TIPO_UNIDADE_LABEL[u.tipoUnidade as TipoUnidade]}</td>
                        <td className="pr-2">{u.ativa ? "Ativa" : (SITUACAO_RECEITA_LABEL[u.situacaoCadastral] ?? u.situacaoCadastral)}</td>
                        <td className="pr-2 py-1"><Cnae codigo={u.cnaePrincipal} /></td>
                        <td className="pr-2 text-slate-500">{[u.logradouro, u.numero, u.bairro].filter(Boolean).join(", ") || "—"}</td>
                        <td>{[u.municipioNome, u.uf].filter(Boolean).join(" / ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Secao>

          <Secao titulo="Dados da Receita por competência" extra={<span className="text-[11px] text-slate-400">{competencias.join(" · ") || "sem competências"}</span>}>
            {registrosReceita.length === 0 ? <Vazio texto="Nenhum registro da Receita para esta raiz de CNPJ." /> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="text-[10px] uppercase text-slate-400">
                    <tr><th className="py-1 pr-2">Competência</th><th className="pr-2">CNPJ</th><th className="pr-2">Nome fantasia</th><th className="pr-2">Situação</th><th className="pr-2">CNAE principal</th><th>Endereço</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...registrosReceita]
                      .sort((a, b) => b.competencia.competencia.localeCompare(a.competencia.competencia) || a.cnpj.localeCompare(b.cnpj))
                      .map(r => (
                        <tr key={r.id}>
                          <td className="py-1.5 pr-2 font-medium">{r.competencia.competencia}</td>
                          <td className="pr-2 font-mono text-[11px]">{formatarCnpj(r.cnpj)}</td>
                          <td className="pr-2">{r.nomeFantasia ?? "—"}</td>
                          <td className="pr-2">{SITUACAO_RECEITA_LABEL[r.situacaoCadastral] ?? r.situacaoCadastral}</td>
                          <td className="pr-2 py-1">
                            <Cnae codigo={r.cnaePrincipal} />
                            {r.cnaesSecundarios.length > 0 && (
                              <span className="mt-0.5 block text-[10px] text-slate-400">
                                Secundários: {r.cnaesSecundarios.map(cs => `${descreverCnae(cs).formatado} (${descreverCnae(cs).descricao})`).join("; ")}
                              </span>
                            )}
                          </td>
                          <td className="text-slate-500">{[r.logradouro, r.numero, r.municipioNome, r.uf].filter(Boolean).join(", ")}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Secao>

          <Secao titulo={`Mudanças entre competências (${mudancas.length})`}>
            {mudancas.length === 0 ? <Vazio texto="Nenhuma mudança registrada." /> : (
              <ul className="space-y-2">
                {mudancas.map(m => {
                  const u = c.unidades.find(x => x.cnpj === m.cnpj);
                  return (
                    <li key={m.id} className="rounded-lg border border-slate-100 p-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{TIPO_MUDANCA_LABEL[m.tipo] ?? m.tipo}</span>
                        <span className="text-slate-400">de {m.competenciaAnterior?.competencia ?? "—"} para {m.competencia.competencia}</span>
                      </div>
                      <p className="mt-1 font-medium text-slate-700">{descreverMudanca(m)}</p>
                      <p className="text-[11px] text-slate-500">
                        Estabelecimento: <span className="font-mono">{formatarCnpj(m.cnpj)}</span>
                        {u ? ` · ${u.isMatriz ? "Matriz" : "Filial"} · ${TIPO_UNIDADE_LABEL[u.tipoUnidade as TipoUnidade]} · ${[u.municipioNome, u.uf].filter(Boolean).join("/")}` : " · fora das unidades atuais"}
                      </p>
                      <div className="mt-1 grid gap-1 sm:grid-cols-2">
                        <div className="rounded bg-red-50 px-2 py-1"><span className="block text-[10px] uppercase text-red-500">Antes</span><span className="text-slate-700">{m.valorAnterior ?? "— (não existia)"}</span></div>
                        <div className="rounded bg-emerald-50 px-2 py-1"><span className="block text-[10px] uppercase text-emerald-600">Depois</span><span className="text-slate-700">{m.valorNovo ?? "—"}</span></div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Secao>
        </div>

        <div className="space-y-4">
          <Secao titulo="Empresa no CRM">
            {c.empresa ? (
              <div className="text-xs">
                <p className="text-[10px] uppercase text-emerald-600">Vinculada</p>
                <Link href={`/empresas/${c.empresa.id}`} className="font-medium text-indigo-700 hover:underline">{c.empresa.nomeFantasia ?? c.empresa.razaoSocial}</Link>
                <p className="text-slate-500">{[c.empresa.cidade, c.empresa.estado].filter(Boolean).join(" / ")}</p>
              </div>
            ) : <Vazio texto="Não vinculada a nenhuma Empresa do cadastro comercial." />}
            {c.empresaSugerida && (
              <div className="mt-3 rounded-lg bg-amber-50 p-2 text-xs">
                <p className="text-[10px] uppercase text-amber-700">Sugestão registrada ({c.criterioSugestao ?? "critério não informado"})</p>
                <p className="font-medium text-slate-700">{c.empresaSugerida.nomeFantasia ?? c.empresaSugerida.razaoSocial}</p>
              </div>
            )}
            <div className="mt-3">
              <p className="mb-1 text-[10px] uppercase text-slate-400">Possíveis correspondências (busca automática, somente sugestão)</p>
              {correspondencias.length === 0 ? <Vazio texto="Nenhuma correspondência encontrada por CNPJ ou nome." /> : (
                <ul className="space-y-1">
                  {correspondencias.map(e => (
                    <li key={e.id} className="text-xs">
                      <span className="text-slate-700">{e.nomeFantasia ?? e.razaoSocial}</span>
                      <span className="ml-1 text-[10px] text-slate-400">· {e.criterio}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Secao>

          <Secao titulo={`Evidências (${c.evidencias.length})`}>
            {c.evidencias.length === 0 ? <Vazio texto="Nenhuma evidência registrada." /> : (
              <ul className="space-y-2">
                {c.evidencias.map(ev => (
                  <li key={ev.id} className="rounded-lg border border-slate-100 p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-700">{FONTE_LABEL[ev.tipoFonte] ?? ev.tipoFonte}</span>
                      <span className="text-[10px] text-slate-400">Data: {fmtData(ev.coletadoEm)}</span>
                    </div>
                    {ev.titulo && <p className="text-slate-600">{ev.titulo}</p>}
                    {ev.trecho && <p className="mt-0.5 text-[11px] text-slate-500">“{ev.trecho}”</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                      <span>Confiança: {ev.confianca ? CONFIANCA_LABEL[ev.confianca as Confianca].toLowerCase() : "não informada"}</span>
                      <span>· Registrado por: {ev.registradoPor?.nome ?? ev.agente ?? "—"}</span>
                    </div>
                    {(() => {
                      const tipo = classificarLink(ev.url);
                      if (tipo === "valido") {
                        return (
                          <a href={ev.url!} target="_blank" rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100">
                            <ExternalLink className="h-3 w-3" /> Abrir fonte em nova aba
                          </a>
                        );
                      }
                      return (
                        <span className="mt-1 inline-flex items-center gap-1 rounded border border-dashed border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-500">
                          {tipo === "ficticio" ? "Endereço fictício (dado de demonstração) — sem link" : "Link indisponível"}
                        </span>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          <Secao titulo={`Histórico de validação (${c.historico.length})`}>
            {c.historico.length === 0 ? <Vazio texto="Sem histórico." /> : (
              <ol className="space-y-2 border-l border-slate-200 pl-3">
                {c.historico.map(h => (
                  <li key={h.id} className="text-xs">
                    <p className="text-[10px] text-slate-400">{fmtDataHora(h.createdAt)} · {h.usuario?.nome ?? h.agente ?? "—"}</p>
                    <p className="text-slate-700">
                      {h.statusAnterior ? STATUS_LABEL[h.statusAnterior as StatusValidacao] : "Início"} → <b>{STATUS_LABEL[h.statusNovo as StatusValidacao]}</b>
                      {h.confiancaNova ? ` · confiança ${CONFIANCA_LABEL[h.confiancaNova as Confianca].toLowerCase()}` : ""}
                    </p>
                    {h.motivo && <p className="text-[11px] text-slate-500">{h.motivo}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Secao>

          {matriz && (
            <p className="text-[10px] text-slate-400">Matriz: {formatarCnpj(matriz.cnpj)} · {TIPO_UNIDADE_LABEL[matriz.tipoUnidade as TipoUnidade]}</p>
          )}
        </div>
      </div>
    </div>
  );
}
