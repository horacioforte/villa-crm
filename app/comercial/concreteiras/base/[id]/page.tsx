// ARQUIVO: app/comercial/concreteiras/base/[id]/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Ficha da candidata da Base Nacional.
// Etapa 2A: somente leitura. v4 (05/10/2026): validação manual, contatos, pessoas, potencial por
// equipamento, vínculo manual com Empresa EXISTENTE e evidências — tudo com histórico.
// Formulários aparecem só para ADMIN, GERENTE e COMERCIAL. Nada cria Empresa/Dossiê/Carteira/Oportunidade.

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
import { getCurrentUser } from "@/lib/auth/session";
import { classeReceitaDe } from "@/lib/base-nacional/filtros";
import { rotuloCampoHistorico, traduzirCodigos, valoresHistorico } from "@/lib/base-nacional/historico";
import { podeValidar } from "@/lib/base-nacional/validacao";
import { formatarTelefone, linkContato } from "@/lib/base-nacional/contatos";
import {
  EQUIPAMENTOS, EQUIPAMENTO_LABEL, NIVEL_COR, NIVEL_LABEL, ORIGEM_LABEL, PAPEL_PESSOA_LABEL, PRIORIDADE_COR, PRIORIDADE_LABEL,
  SITUACAO_VERIFICACAO_LABEL, TIPO_CONTATO_LABEL, TIPO_EVENTO_LABEL,
  type Equipamento, type NivelPotencial, type PapelPessoa, type Prioridade, type SituacaoVerificacao, type TipoContato,
} from "@/lib/base-nacional/rotulos";
import {
  AcoesContato, EditorTipoUnidade, FormPotencial, InativarPessoa, NovaEvidencia, NovaPessoa, NovoContato, PainelValidacao, Qualificacao, VinculoEmpresa,
} from "./Acoes";

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
  const classeReceita = classeReceitaDe(c.unidades);
  const origemReceita = c.id.startsWith("rfb-cand-");
  const usuario = await getCurrentUser();
  const pode = podeValidar(usuario?.papel);
  const rotuloUnidade = (u: { cnpj: string; municipioNome: string | null; uf: string | null; isMatriz?: boolean; tipoUnidade?: string }) =>
    `${u.isMatriz === undefined ? "" : u.isMatriz ? "Matriz · " : "Filial · "}${u.tipoUnidade ? `${TIPO_UNIDADE_LABEL[u.tipoUnidade as TipoUnidade]} · ` : ""}${[u.municipioNome, u.uf].filter(Boolean).join("/")} (${formatarCnpj(u.cnpj)})`;
  const opcoesUnidade = c.unidades.map(u => ({ id: u.id, rotulo: rotuloUnidade(u) }));
  const opcoesEvidencia = c.evidencias.map(e => ({ id: e.id, titulo: `${FONTE_LABEL[e.tipoFonte] ?? e.tipoFonte}: ${e.titulo ?? "(sem título)"}` }));
  const contatosAtivos = c.contatos.filter(x => x.ativo);
  const contatosInativos = c.contatos.filter(x => !x.ativo);
  const pessoasAtivas = c.pessoas.filter(x => x.ativo);
  const pessoasInativas = c.pessoas.filter(x => !x.ativo);
  const potGerais = new Map(c.potenciais.filter(p => !p.unidadeId).map(p => [p.equipamento, p]));
  const potUnidades = c.potenciais.filter(p => p.unidadeId);

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
            {c.prioridadeComercial && (
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", PRIORIDADE_COR[c.prioridadeComercial as Prioridade])}>
                Prioridade {PRIORIDADE_LABEL[c.prioridadeComercial as Prioridade].toLowerCase()}
              </span>
            )}
            {c.tipoAtividade && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">{TIPO_ATIVIDADE_LABEL[c.tipoAtividade as TipoAtividade]}</span>
            )}
          </div>
        </div>
        {classeReceita === "A" && (
          <p className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] text-indigo-800">
            <b>Prioridade A</b> — tem unidade ativa com o CNAE 2330-3/05 (fabricação de concreto usinado) como atividade <b>principal</b> na Receita Federal.
            Ainda precisa de validação manual para ser confirmada.
          </p>
        )}
        {classeReceita === "B" && (
          <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
            <b>Prioridade B — candidata a validar.</b> O CNAE 2330-3/05 aparece só como atividade <b>secundária</b>.
            Isso <b>não confirma</b> que a empresa seja concreteira: verifique antes de qualquer abordagem.
          </p>
        )}
        {origemReceita && (
          <p className="mt-2 text-[10px] text-slate-400">
            Origem: Dados Abertos do CNPJ — Receita Federal · competência {c.primeiraCompetencia ?? "—"}
            {c.ultimaCompetencia && c.ultimaCompetencia !== c.primeiraCompetencia ? ` a ${c.ultimaCompetencia}` : ""}
          </p>
        )}
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          {pode
            ? "Ficha de investigação. Toda alteração fica no histórico. Nada aqui cria Empresa, Pessoa, Dossiê, Carteira ou Oportunidade no CRM."
            : "Ficha de investigação, somente consulta para o seu perfil."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:px-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          {pode && (
            <Secao titulo="Validação manual">
              <PainelValidacao candidataId={c.id} status={c.statusValidacao} confianca={c.confianca} tipoAtividade={c.tipoAtividade} />
            </Secao>
          )}
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
                        <td className="pr-2">
                          {TIPO_UNIDADE_LABEL[u.tipoUnidade as TipoUnidade]}
                          {pode && <div><EditorTipoUnidade candidataId={c.id} unidadeId={u.id} tipoAtual={u.tipoUnidade} /></div>}
                        </td>
                        <td className="pr-2">{u.ativa ? "Ativa" : (SITUACAO_RECEITA_LABEL[u.situacaoCadastral] ?? u.situacaoCadastral)}</td>
                        <td className="pr-2 py-1">
                          <Cnae codigo={u.cnaePrincipal} />
                          {!u.cnaeAlvoComoPrincipal && u.cnaesSecundarios.includes("2330305") && (
                            <span className="mt-0.5 block w-fit rounded border border-sky-200 bg-sky-50 px-1 py-0.5 text-[10px] text-sky-700" title="Atividade secundária: não confirma que seja concreteira">
                              + 2330-3/05 como secundário
                            </span>
                          )}
                        </td>
                        <td className="pr-2 text-slate-500">{[u.logradouro, u.numero, u.bairro].filter(Boolean).join(", ") || "—"}</td>
                        <td>{[u.municipioNome, u.uf].filter(Boolean).join(" / ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Secao>

          <Secao titulo="Qualificação comercial — potencial por equipamento"
            extra={<span className="text-[10px] text-slate-400">Foco: venda de usados · locação secundária · sem preços</span>}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2 rounded-lg bg-slate-50 p-2 text-xs">
              <div>
                <p className="text-[10px] uppercase text-slate-400">Prioridade comercial</p>
                <p className="font-medium text-slate-700">{c.prioridadeComercial ? PRIORIDADE_LABEL[c.prioridadeComercial as Prioridade] : "Não definida"}</p>
                {c.observacaoComercial && <p className="mt-1 max-w-xl whitespace-pre-line text-[11px] text-slate-600">{c.observacaoComercial}</p>}
                {c.qualificadoEm && <p className="mt-1 text-[10px] text-slate-400">Qualificado em {fmtDataHora(c.qualificadoEm)} por {c.qualificadoPor?.nome ?? "—"}</p>}
              </div>
              {pode && <Qualificacao candidataId={c.id} prioridade={c.prioridadeComercial} observacao={c.observacaoComercial} />}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="text-[10px] uppercase text-slate-400">
                  <tr><th className="py-1 pr-2">Equipamento (empresa inteira)</th><th className="pr-2">Venda de usados</th><th className="pr-2">Locação</th><th className="pr-2">Qtd. estimada</th><th>Avaliação</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {EQUIPAMENTOS.map(eq => {
                    const p = potGerais.get(eq);
                    return (
                      <tr key={eq}>
                        <td className="py-1.5 pr-2 font-medium text-slate-700">{EQUIPAMENTO_LABEL[eq]}{p?.descricaoOutro ? ` — ${p.descricaoOutro}` : ""}</td>
                        <td className="pr-2"><span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", NIVEL_COR[(p?.potencialVenda ?? "DESCONHECIDO") as NivelPotencial])}>{NIVEL_LABEL[(p?.potencialVenda ?? "DESCONHECIDO") as NivelPotencial]}</span></td>
                        <td className="pr-2"><span className={cn("rounded px-1.5 py-0.5 text-[10px]", NIVEL_COR[(p?.interesseLocacao ?? "DESCONHECIDO") as NivelPotencial])}>{NIVEL_LABEL[(p?.interesseLocacao ?? "DESCONHECIDO") as NivelPotencial]}</span></td>
                        <td className="pr-2">{p?.quantidadeEstimada ?? "—"}</td>
                        <td className="text-[10px] text-slate-400">{p ? `${fmtData(p.avaliadoEm)} · ${p.avaliadoPor?.nome ?? "—"}${p.evidencia?.titulo ? ` · evidência: ${p.evidencia.titulo}` : ""}${p.observacao ? ` · ${p.observacao}` : ""}` : "Não avaliado"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {potUnidades.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-[10px] uppercase text-slate-400">Por unidade / central</p>
                <ul className="space-y-1">
                  {potUnidades.map(p => (
                    <li key={p.id} className="flex flex-wrap items-center gap-1.5 rounded border border-slate-100 px-2 py-1 text-[11px]">
                      <span className="font-medium text-slate-700">{EQUIPAMENTO_LABEL[p.equipamento as Equipamento]}</span>
                      <span className="text-slate-400">em {p.unidade ? rotuloUnidade(p.unidade) : "—"}</span>
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", NIVEL_COR[p.potencialVenda as NivelPotencial])}>Venda: {NIVEL_LABEL[p.potencialVenda as NivelPotencial]}</span>
                      <span className={cn("rounded px-1.5 py-0.5 text-[10px]", NIVEL_COR[p.interesseLocacao as NivelPotencial])}>Locação: {NIVEL_LABEL[p.interesseLocacao as NivelPotencial]}</span>
                      {p.quantidadeEstimada != null && <span className="text-slate-500">Qtd.: {p.quantidadeEstimada}</span>}
                      {p.observacao && <span className="text-slate-500">· {p.observacao}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {pode && <div className="mt-3"><FormPotencial candidataId={c.id} unidades={opcoesUnidade} evidencias={opcoesEvidencia} /></div>}
          </Secao>

          <Secao titulo={`Contatos (${contatosAtivos.length} ativos)`}>
            {contatosAtivos.length === 0 ? <Vazio texto="Nenhum contato ativo." /> : (
              <ul className="space-y-1.5">
                {contatosAtivos.map(ct => {
                  const link = linkContato(ct.tipo as TipoContato, ct.valor);
                  const exib = ct.tipo === "TELEFONE" || ct.tipo === "WHATSAPP" ? formatarTelefone(ct.valor) : ct.valor;
                  return (
                    <li key={ct.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-100 p-2 text-xs">
                      <div>
                        <p>
                          <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{TIPO_CONTATO_LABEL[ct.tipo as TipoContato]}</span>
                          {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-700 hover:underline">{exib}</a> : <span className="font-medium">{exib}</span>}
                          {ct.principal && <span className="ml-1 text-[10px] text-indigo-600">· principal</span>}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {SITUACAO_VERIFICACAO_LABEL[ct.situacao as SituacaoVerificacao]}
                          {ct.verificadoEm ? ` em ${fmtData(ct.verificadoEm)} por ${ct.verificadoPor?.nome ?? "—"}` : ""}
                          {ct.descricao ? ` · ${ct.descricao}` : ""}
                          {ct.unidade ? ` · ${rotuloUnidade(ct.unidade)}` : ""}
                          {ct.fonte ? ` · fonte: ${FONTE_LABEL[ct.fonte] ?? ct.fonte}` : ""}
                          {` · registrado por ${ct.registradoPor?.nome ?? "—"}`}
                        </p>
                      </div>
                      {pode && <AcoesContato candidataId={c.id} contatoId={ct.id} situacao={ct.situacao} />}
                    </li>
                  );
                })}
              </ul>
            )}
            {contatosInativos.length > 0 && (
              <details className="mt-2 text-[11px] text-slate-500">
                <summary className="cursor-pointer">Contatos inativos ({contatosInativos.length})</summary>
                <ul className="mt-1 space-y-1">
                  {contatosInativos.map(ct => (
                    <li key={ct.id} className="rounded bg-slate-50 px-2 py-1">
                      <s>{TIPO_CONTATO_LABEL[ct.tipo as TipoContato]}: {ct.valor}</s> — inativado em {fmtData(ct.inativadoEm)} por {ct.inativadoPor?.nome ?? "—"}: {ct.motivoInativacao}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {pode && <div className="mt-3"><NovoContato candidataId={c.id} unidades={opcoesUnidade} /></div>}
          </Secao>

          <Secao titulo={`Pessoas (${pessoasAtivas.length} ativas)`} extra={<span className="text-[10px] text-slate-400">Não criam Pessoa nem Decisor no CRM</span>}>
            {pessoasAtivas.length === 0 ? <Vazio texto="Nenhuma pessoa registrada." /> : (
              <ul className="space-y-1.5">
                {pessoasAtivas.map(ps => (
                  <li key={ps.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-100 p-2 text-xs">
                    <div>
                      <p className="font-medium text-slate-700">{ps.nome}{ps.funcao ? <span className="font-normal text-slate-500"> · {ps.funcao}</span> : null}</p>
                      <p className="mt-0.5 flex flex-wrap gap-1">
                        {ps.papeis.map(pp => <span key={pp} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700">{PAPEL_PESSOA_LABEL[pp as PapelPessoa]}</span>)}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px]">
                        {ps.telefone && <a href={linkContato("TELEFONE", ps.telefone) ?? undefined} className="text-indigo-700 hover:underline">Tel. {formatarTelefone(ps.telefone)}</a>}
                        {ps.whatsapp && <a href={linkContato("WHATSAPP", ps.whatsapp) ?? undefined} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline">WhatsApp {formatarTelefone(ps.whatsapp)}</a>}
                        {ps.email && <a href={linkContato("EMAIL", ps.email) ?? undefined} className="text-indigo-700 hover:underline">{ps.email}</a>}
                        {ps.linkedinUrl && <a href={ps.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline">LinkedIn</a>}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {SITUACAO_VERIFICACAO_LABEL[ps.situacao as SituacaoVerificacao]}{ps.verificadoEm ? ` em ${fmtData(ps.verificadoEm)}` : ""}
                        {ps.fonte ? ` · fonte: ${FONTE_LABEL[ps.fonte] ?? ps.fonte}` : ""} · registrado por {ps.registradoPor?.nome ?? "—"}
                        {ps.observacao ? ` · ${ps.observacao}` : ""}
                      </p>
                    </div>
                    {pode && <InativarPessoa candidataId={c.id} pessoaId={ps.id} />}
                  </li>
                ))}
              </ul>
            )}
            {pessoasInativas.length > 0 && (
              <details className="mt-2 text-[11px] text-slate-500">
                <summary className="cursor-pointer">Pessoas inativas ({pessoasInativas.length})</summary>
                <ul className="mt-1 space-y-1">
                  {pessoasInativas.map(ps => (
                    <li key={ps.id} className="rounded bg-slate-50 px-2 py-1"><s>{ps.nome}</s> — inativada em {fmtData(ps.inativadoEm)} por {ps.inativadoPor?.nome ?? "—"}: {ps.motivoInativacao}</li>
                  ))}
                </ul>
              </details>
            )}
            {pode && <div className="mt-3"><NovaPessoa candidataId={c.id} /></div>}
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

        <div className="min-w-0 space-y-4">
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
            {c.empresa && c.vinculadoEm && <p className="mt-1 text-[10px] text-slate-400">Vinculada em {fmtDataHora(c.vinculadoEm)}</p>}
            {pode && (
              <div className="mt-3">
                <VinculoEmpresa candidataId={c.id}
                  vinculada={c.empresa ? { id: c.empresa.id, nome: c.empresa.nomeFantasia ?? c.empresa.razaoSocial } : null}
                  sugestoes={correspondencias.map(e => ({ id: e.id, razaoSocial: e.razaoSocial, nomeFantasia: e.nomeFantasia, cnpj: e.cnpj, cidade: e.cidade, estado: e.estado }))} />
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
                    {ev.observacao && <p className="mt-0.5 text-[11px] text-slate-500"><b>Obs.:</b> {ev.observacao}</p>}
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

          {pode && <NovaEvidencia candidataId={c.id} />}

          <Secao titulo={`Histórico e auditoria (${c.historico.length})`}>
            {c.historico.length === 0 ? <Vazio texto="Sem histórico." /> : (
              <ol className="space-y-2 border-l border-slate-200 pl-3">
                {c.historico.map(h => (
                  <li key={h.id} className="text-xs">
                    <p className="text-[10px] text-slate-400">
                      {fmtDataHora(h.createdAt)} · {h.usuario?.nome ?? h.agente ?? "—"} · {TIPO_EVENTO_LABEL[h.tipoEvento] ?? h.tipoEvento}
                      {h.origem !== "NAO_INFORMADA" ? ` · ${ORIGEM_LABEL[h.origem] ?? h.origem}` : ""}
                    </p>
                    {h.tipoEvento === "VALIDACAO" ? (
                      <p className="text-slate-700">
                        {h.statusAnterior ? STATUS_LABEL[h.statusAnterior as StatusValidacao] : "Início"} → <b>{STATUS_LABEL[h.statusNovo as StatusValidacao]}</b>
                        {h.confiancaNova ? ` · confiança ${CONFIANCA_LABEL[h.confiancaNova as Confianca].toLowerCase()}` : ""}
                      </p>
                    ) : (
                      (() => {
                        const v = valoresHistorico(h);
                        return (
                          <p className="text-slate-700">
                            {h.campo && <span className="text-slate-500">{rotuloCampoHistorico(h.campo)}: </span>}
                            {v.antes ? <span className="line-through decoration-slate-300">{v.antes}</span> : null}
                            {v.antes && v.depois ? " → " : ""}
                            {v.depois ? <b>{v.depois}</b> : null}
                          </p>
                        );
                      })()
                    )}
                    {h.motivo && <p className="text-[11px] text-slate-500">{traduzirCodigos(h.motivo)}</p>}
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
