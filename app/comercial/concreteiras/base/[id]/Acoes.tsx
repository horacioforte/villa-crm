"use client";

// ARQUIVO: app/comercial/concreteiras/base/[id]/Acoes.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Formulários da ficha da Base Nacional. Todos gravam pela rota
// /api/base-nacional/candidatas/[id]/acoes (transação + histórico obrigatório).
// Nada aqui cria Empresa, Pessoa, Dossiê, Carteira, Oportunidade ou Tarefa, nem envia mensagens.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2Off, Loader2, Plus, X } from "lucide-react";
import {
  CONFIANCAS, CONFIANCA_LABEL, EQUIPAMENTOS, EQUIPAMENTO_LABEL, FONTE_LABEL, NIVEIS_POTENCIAL, NIVEL_LABEL, PAPEIS_PESSOA, PAPEL_PESSOA_LABEL,
  PRIORIDADES, PRIORIDADE_LABEL, SITUACOES_VERIFICACAO, SITUACAO_VERIFICACAO_LABEL, STATUS_LABEL, STATUS_VALIDACAO, TIPOS_ATIVIDADE,
  TIPOS_CONTATO, TIPOS_UNIDADE, TIPO_ATIVIDADE_LABEL, TIPO_CONTATO_LABEL, TIPO_UNIDADE_LABEL,
} from "@/lib/base-nacional/rotulos";
import { cn } from "@/lib/utils";

export const inputCls = "w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-400 focus:outline-none";
const btnCls = "inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50";
const btnSec = "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50";
const rotuloCls = "mb-0.5 block text-[10px] uppercase tracking-wide text-slate-400";

/** Envia uma ação e recarrega a ficha. Devolve os erros para exibir no formulário. */
function useAcao(candidataId: string) {
  const router = useRouter();
  const [erros, setErros] = useState<string[]>([]);
  const [ok, setOk] = useState(false);
  const [pendente, iniciar] = useTransition();
  async function enviar(corpo: Record<string, unknown>): Promise<boolean> {
    setErros([]); setOk(false);
    try {
      const r = await fetch(`/api/base-nacional/candidatas/${encodeURIComponent(candidataId)}/acoes`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; erros?: string[] };
      if (!r.ok || !j.ok) { setErros(j.erros?.length ? j.erros : ["Não foi possível gravar."]); return false; }
      setOk(true);
      iniciar(() => router.refresh());
      return true;
    } catch {
      setErros(["Falha de conexão. Nada foi gravado."]);
      return false;
    }
  }
  return { enviar, erros, ok, pendente };
}

function Mensagens({ erros, ok, textoOk = "Gravado e registrado no histórico." }: { erros: string[]; ok: boolean; textoOk?: string }) {
  if (erros.length) return <ul className="rounded-md bg-red-50 p-2 text-[11px] text-red-700">{erros.map(e => <li key={e}>• {e}</li>)}</ul>;
  if (ok) return <p className="rounded-md bg-emerald-50 p-2 text-[11px] text-emerald-700">{textoOk}</p>;
  return null;
}

/** Lê o formulário como objeto; campos com nome terminado em [] viram listas e checkboxes "on" viram true. */
function lerForm(f: HTMLFormElement): Record<string, unknown> {
  const fd = new FormData(f);
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.endsWith("[]")) { const n = k.slice(0, -2); out[n] = [...((out[n] as string[]) ?? []), String(v)]; }
    else out[k] = v === "on" ? true : String(v);
  }
  return out;
}

function Form({ candidataId, acao, children, botao, aoGravar, className, extras }: {
  candidataId: string; acao: string; children: React.ReactNode; botao: string; aoGravar?: () => void; className?: string; extras?: Record<string, unknown>;
}) {
  const { enviar, erros, ok, pendente } = useAcao(candidataId);
  const [enviando, setEnviando] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} className={cn("space-y-2", className)} onSubmit={async e => {
      e.preventDefault();
      setEnviando(true);
      const gravou = await enviar({ acao, ...lerForm(e.currentTarget), ...extras });
      setEnviando(false);
      if (gravou) { ref.current?.reset(); aoGravar?.(); }
    }}>
      {children}
      <Mensagens erros={erros} ok={ok} />
      <button type="submit" className={btnCls} disabled={enviando || pendente}>
        {(enviando || pendente) && <Loader2 className="h-3 w-3 animate-spin" />} {botao}
      </button>
    </form>
  );
}

const Justificativa = ({ nome = "justificativa", rotulo = "Justificativa (obrigatória)" }: { nome?: string; rotulo?: string }) => (
  <label className="block"><span className={rotuloCls}>{rotulo}</span>
    <textarea name={nome} required minLength={10} rows={2} className={inputCls} placeholder="Explique o motivo (mínimo 10 caracteres)" />
  </label>
);

function Opcoes<T extends string>({ lista, rotulos, vazio }: { lista: readonly T[]; rotulos: Record<T, string>; vazio?: string }) {
  return <>{vazio !== undefined && <option value="">{vazio}</option>}{lista.map(v => <option key={v} value={v}>{rotulos[v]}</option>)}</>;
}

function Recolhivel({ titulo, children, inicial = false }: { titulo: string; children: React.ReactNode; inicial?: boolean }) {
  const [aberto, setAberto] = useState(inicial);
  if (!aberto) return <button type="button" className={btnSec} onClick={() => setAberto(true)}><Plus className="h-3 w-3" /> {titulo}</button>;
  return (
    <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
      <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-slate-700">{titulo}</p>
        <button type="button" onClick={() => setAberto(false)} aria-label="Fechar" className="text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button></div>
      {children}
    </div>
  );
}

// ─── Validação ────────────────────────────────────────────────────────────────
export function PainelValidacao({ candidataId, status, confianca, tipoAtividade }: { candidataId: string; status: string; confianca: string | null; tipoAtividade: string | null }) {
  return (
    <Form candidataId={candidataId} acao="validar" botao="Gravar validação">
      <div className="grid gap-2 sm:grid-cols-3">
        <label><span className={rotuloCls}>Situação</span>
          <select name="status" defaultValue={status} className={inputCls}><Opcoes lista={STATUS_VALIDACAO} rotulos={STATUS_LABEL} /></select></label>
        <label><span className={rotuloCls}>Confiança</span>
          <select name="confianca" defaultValue={confianca ?? ""} className={inputCls}><Opcoes lista={CONFIANCAS} rotulos={CONFIANCA_LABEL} vazio="Não informada" /></select></label>
        <label><span className={rotuloCls}>Atividade</span>
          <select name="tipoAtividade" defaultValue={tipoAtividade ?? ""} className={inputCls}><Opcoes lista={TIPOS_ATIVIDADE} rotulos={TIPO_ATIVIDADE_LABEL} vazio="Não informada" /></select></label>
      </div>
      <Justificativa />
      <p className="text-[10px] text-slate-400">“Confirmada” exige confiança e justificativa; o responsável e a data são gravados automaticamente.</p>
    </Form>
  );
}

// ─── Tipo de unidade ─────────────────────────────────────────────────────────
export function EditorTipoUnidade({ candidataId, unidadeId, tipoAtual }: { candidataId: string; unidadeId: string; tipoAtual: string }) {
  const [aberto, setAberto] = useState(false);
  if (!aberto) return <button type="button" onClick={() => setAberto(true)} className="text-[10px] text-indigo-600 hover:underline">alterar</button>;
  return (
    <div className="mt-1 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-sm">
      <Form candidataId={candidataId} acao="tipoUnidade" botao="Salvar tipo" extras={{ unidadeId }} aoGravar={() => setAberto(false)}>
        <select name="tipoUnidade" defaultValue={tipoAtual} className={inputCls}><Opcoes lista={TIPOS_UNIDADE} rotulos={TIPO_UNIDADE_LABEL} /></select>
        <Justificativa />
      </Form>
      <button type="button" onClick={() => setAberto(false)} className="mt-1 text-[10px] text-slate-400">cancelar</button>
    </div>
  );
}

// ─── Evidência ───────────────────────────────────────────────────────────────
const FONTES = Object.keys(FONTE_LABEL);
export function NovaEvidencia({ candidataId }: { candidataId: string }) {
  return (
    <Recolhivel titulo="Registrar evidência">
      <Form candidataId={candidataId} acao="evidencia" botao="Registrar evidência">
        <div className="grid gap-2 sm:grid-cols-2">
          <label><span className={rotuloCls}>Fonte</span><select name="tipoFonte" required className={inputCls}>{FONTES.map(f => <option key={f} value={f}>{FONTE_LABEL[f]}</option>)}</select></label>
          <label><span className={rotuloCls}>Data da evidência</span><input type="date" name="dataEvidencia" className={inputCls} /></label>
        </div>
        <label className="block"><span className={rotuloCls}>Título</span><input name="titulo" required minLength={3} className={inputCls} placeholder="Ex.: Site mostra frota de bombas" /></label>
        <label className="block"><span className={rotuloCls}>Link (opcional)</span><input name="url" type="url" className={inputCls} placeholder="https://..." /></label>
        <label className="block"><span className={rotuloCls}>Trecho que comprova (obrigatório sem link)</span><textarea name="trecho" rows={2} className={inputCls} /></label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label><span className={rotuloCls}>Confiança</span><select name="confianca" className={inputCls}><Opcoes lista={CONFIANCAS} rotulos={CONFIANCA_LABEL} vazio="Não informada" /></select></label>
          <label><span className={rotuloCls}>Observação</span><input name="observacao" className={inputCls} /></label>
        </div>
      </Form>
    </Recolhivel>
  );
}

// ─── Vínculo manual com Empresa existente ─────────────────────────────────────
type EmpresaBusca = { id: string; razaoSocial: string; nomeFantasia: string | null; cnpj: string | null; cidade: string | null; estado: string | null };
export function VinculoEmpresa({ candidataId, vinculada, sugestoes }: { candidataId: string; vinculada: { id: string; nome: string } | null; sugestoes: EmpresaBusca[] }) {
  const [termo, setTermo] = useState("");
  const [lista, setLista] = useState<EmpresaBusca[]>(sugestoes);
  const [escolhida, setEscolhida] = useState<EmpresaBusca | null>(null);
  async function buscar() {
    if (termo.trim().length < 2) return;
    const r = await fetch(`/api/base-nacional/empresas?q=${encodeURIComponent(termo.trim())}`);
    if (r.ok) setLista(((await r.json()) as { empresas: EmpresaBusca[] }).empresas);
  }
  if (vinculada) {
    return (
      <Recolhivel titulo="Desfazer vínculo">
        <Form candidataId={candidataId} acao="desvincular" botao="Desfazer vínculo">
          <p className="flex items-center gap-1 text-[11px] text-slate-500"><Link2Off className="h-3 w-3" /> Remove só a ligação com “{vinculada.nome}”. A Empresa não é alterada.</p>
          <Justificativa />
        </Form>
      </Recolhivel>
    );
  }
  return (
    <Recolhivel titulo="Vincular a Empresa existente">
      <div className="space-y-2">
        <p className="text-[11px] text-slate-500">Somente Empresas que já existem no CRM. Nada é criado nem alterado na Empresa.</p>
        <div className="flex gap-1">
          <input value={termo} onChange={e => setTermo(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void buscar(); } }}
            className={inputCls} placeholder="Nome ou CNPJ da Empresa" aria-label="Buscar Empresa" />
          <button type="button" className={btnSec} onClick={() => void buscar()}>Buscar</button>
        </div>
        <ul className="max-h-48 space-y-1 overflow-auto">
          {lista.map(e => (
            <li key={e.id}>
              <button type="button" onClick={() => setEscolhida(e)}
                className={cn("w-full rounded border px-2 py-1 text-left text-[11px]", escolhida?.id === e.id ? "border-indigo-400 bg-indigo-50" : "border-slate-100 hover:bg-slate-50")}>
                <span className="font-medium text-slate-700">{e.nomeFantasia ?? e.razaoSocial}</span>
                <span className="block text-[10px] text-slate-400">{[e.razaoSocial, e.cnpj, [e.cidade, e.estado].filter(Boolean).join("/")].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
          {lista.length === 0 && <li className="text-[11px] text-slate-400">Busque pelo nome ou CNPJ.</li>}
        </ul>
        {escolhida && (
          <Form candidataId={candidataId} acao="vincular" botao="Vincular" extras={{ empresaId: escolhida.id }}>
            <label className="flex items-start gap-1.5 text-[11px] text-slate-600">
              <input type="checkbox" name="confirmado" required className="mt-0.5" />
              Confirmo que esta candidata corresponde a “{escolhida.nomeFantasia ?? escolhida.razaoSocial}”.
            </label>
            <Justificativa />
          </Form>
        )}
      </div>
    </Recolhivel>
  );
}

// ─── Qualificação comercial ──────────────────────────────────────────────────
export function Qualificacao({ candidataId, prioridade, observacao }: { candidataId: string; prioridade: string | null; observacao: string | null }) {
  return (
    <Recolhivel titulo="Alterar prioridade comercial">
      <Form candidataId={candidataId} acao="qualificar" botao="Gravar qualificação">
        <label className="block"><span className={rotuloCls}>Prioridade</span>
          <select name="prioridade" defaultValue={prioridade ?? ""} className={inputCls}><Opcoes lista={PRIORIDADES} rotulos={PRIORIDADE_LABEL} vazio="Sem prioridade" /></select></label>
        <label className="block"><span className={rotuloCls}>Observação comercial</span><textarea name="observacao" rows={3} defaultValue={observacao ?? ""} className={inputCls} /></label>
        <Justificativa />
      </Form>
    </Recolhivel>
  );
}

// ─── Potencial por equipamento ───────────────────────────────────────────────
export function FormPotencial({ candidataId, unidades, evidencias, inicial }: {
  candidataId: string; unidades: Array<{ id: string; rotulo: string }>; evidencias: Array<{ id: string; titulo: string }>;
  inicial?: { equipamento: string; unidadeId: string | null; potencialVenda: string; interesseLocacao: string; quantidadeEstimada: number | null };
}) {
  return (
    <Recolhivel titulo={inicial ? "Reavaliar" : "Avaliar equipamento"}>
      <Form candidataId={candidataId} acao="potencial" botao="Gravar avaliação">
        <div className="grid gap-2 sm:grid-cols-2">
          <label><span className={rotuloCls}>Equipamento</span>
            <select name="equipamento" defaultValue={inicial?.equipamento} className={inputCls}><Opcoes lista={EQUIPAMENTOS} rotulos={EQUIPAMENTO_LABEL} /></select></label>
          <label><span className={rotuloCls}>Onde</span>
            <select name="unidadeId" defaultValue={inicial?.unidadeId ?? ""} className={inputCls}>
              <option value="">Empresa inteira (geral)</option>
              {unidades.map(u => <option key={u.id} value={u.id}>{u.rotulo}</option>)}
            </select></label>
          <label><span className={rotuloCls}>Potencial de venda (foco)</span>
            <select name="potencialVenda" defaultValue={inicial?.potencialVenda ?? "DESCONHECIDO"} className={inputCls}><Opcoes lista={NIVEIS_POTENCIAL} rotulos={NIVEL_LABEL} /></select></label>
          <label><span className={rotuloCls}>Interesse em locação</span>
            <select name="interesseLocacao" defaultValue={inicial?.interesseLocacao ?? "DESCONHECIDO"} className={inputCls}><Opcoes lista={NIVEIS_POTENCIAL} rotulos={NIVEL_LABEL} /></select></label>
          <label><span className={rotuloCls}>Quantidade estimada</span><input name="quantidadeEstimada" type="number" min={0} max={10000} defaultValue={inicial?.quantidadeEstimada ?? ""} className={inputCls} /></label>
          <label><span className={rotuloCls}>Evidência (opcional)</span>
            <select name="evidenciaId" className={inputCls}><option value="">Nenhuma</option>{evidencias.map(e => <option key={e.id} value={e.id}>{e.titulo}</option>)}</select></label>
        </div>
        <label className="block"><span className={rotuloCls}>Descrição (obrigatória para “Outro”)</span><input name="descricaoOutro" className={inputCls} /></label>
        <label className="block"><span className={rotuloCls}>Observação</span><input name="observacao" className={inputCls} placeholder="Ex.: frota antiga, renovando em 2027" /></label>
      </Form>
    </Recolhivel>
  );
}

// ─── Contatos ────────────────────────────────────────────────────────────────
export function NovoContato({ candidataId, unidades }: { candidataId: string; unidades: Array<{ id: string; rotulo: string }> }) {
  return (
    <Recolhivel titulo="Adicionar contato">
      <Form candidataId={candidataId} acao="contato" botao="Adicionar contato">
        <div className="grid gap-2 sm:grid-cols-2">
          <label><span className={rotuloCls}>Tipo</span><select name="tipo" className={inputCls}><Opcoes lista={TIPOS_CONTATO} rotulos={TIPO_CONTATO_LABEL} /></select></label>
          <label><span className={rotuloCls}>Contato</span><input name="valor" required className={inputCls} placeholder="(81) 3333-0000 · email · site" /></label>
          <label><span className={rotuloCls}>Unidade (opcional)</span>
            <select name="unidadeId" className={inputCls}><option value="">Empresa (geral)</option>{unidades.map(u => <option key={u.id} value={u.id}>{u.rotulo}</option>)}</select></label>
          <label><span className={rotuloCls}>Situação</span><select name="situacao" defaultValue="NAO_VERIFICADO" className={inputCls}><Opcoes lista={SITUACOES_VERIFICACAO} rotulos={SITUACAO_VERIFICACAO_LABEL} /></select></label>
          <label><span className={rotuloCls}>Fonte</span><select name="fonte" className={inputCls}><option value="">Não informada</option>{FONTES.map(f => <option key={f} value={f}>{FONTE_LABEL[f]}</option>)}</select></label>
          <label><span className={rotuloCls}>Link da fonte</span><input name="fonteUrl" type="url" className={inputCls} placeholder="https://..." /></label>
        </div>
        <label className="block"><span className={rotuloCls}>Descrição</span><input name="descricao" className={inputCls} placeholder="Ex.: Comercial, Central Caruaru" /></label>
        <label className="flex items-center gap-1.5 text-[11px] text-slate-600"><input type="checkbox" name="principal" /> Contato principal</label>
      </Form>
    </Recolhivel>
  );
}

export function AcoesContato({ candidataId, contatoId, situacao }: { candidataId: string; contatoId: string; situacao: string }) {
  const { enviar, erros } = useAcao(candidataId);
  const [inativar, setInativar] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        {situacao !== "VERIFICADO" && <button type="button" className={btnSec} onClick={() => void enviar({ acao: "situacaoContato", contatoId, situacao: "VERIFICADO" })} title="Marcar como verificado"><Check className="h-3 w-3" /></button>}
        {situacao !== "INVALIDO" && <button type="button" className={btnSec} onClick={() => void enviar({ acao: "situacaoContato", contatoId, situacao: "INVALIDO" })}>Inválido</button>}
        <button type="button" className={btnSec} onClick={() => setInativar(v => !v)}>Inativar</button>
      </div>
      {inativar && (
        <div className="w-60"><Form candidataId={candidataId} acao="inativarContato" botao="Confirmar inativação" extras={{ contatoId }}>
          <Justificativa nome="motivo" rotulo="Motivo da inativação" />
        </Form></div>
      )}
      {erros.length > 0 && <p className="text-[10px] text-red-600">{erros[0]}</p>}
    </div>
  );
}

// ─── Pessoas ─────────────────────────────────────────────────────────────────
export function NovaPessoa({ candidataId }: { candidataId: string }) {
  return (
    <Recolhivel titulo="Adicionar pessoa">
      <Form candidataId={candidataId} acao="pessoa" botao="Adicionar pessoa">
        <p className="text-[10px] text-slate-500">Fica só na Base Nacional: não cria Pessoa, Decisor nem Oportunidade no CRM.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label><span className={rotuloCls}>Nome</span><input name="nome" required minLength={3} className={inputCls} /></label>
          <label><span className={rotuloCls}>Função / cargo</span><input name="funcao" className={inputCls} /></label>
        </div>
        <fieldset>
          <legend className={rotuloCls}>Papéis (um ou mais)</legend>
          <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
            {PAPEIS_PESSOA.map(p => <label key={p} className="flex items-center gap-1.5 text-[11px] text-slate-600"><input type="checkbox" name="papeis[]" value={p} /> {PAPEL_PESSOA_LABEL[p]}</label>)}
          </div>
        </fieldset>
        <div className="grid gap-2 sm:grid-cols-3">
          <label><span className={rotuloCls}>Telefone</span><input name="telefone" className={inputCls} /></label>
          <label><span className={rotuloCls}>WhatsApp</span><input name="whatsapp" className={inputCls} /></label>
          <label><span className={rotuloCls}>E-mail</span><input name="email" type="email" className={inputCls} /></label>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <label><span className={rotuloCls}>LinkedIn</span><input name="linkedinUrl" type="url" className={inputCls} placeholder="https://linkedin.com/in/..." /></label>
          <label><span className={rotuloCls}>Fonte</span><select name="fonte" className={inputCls}><option value="">Não informada</option>{FONTES.map(f => <option key={f} value={f}>{FONTE_LABEL[f]}</option>)}</select></label>
          <label><span className={rotuloCls}>Situação</span><select name="situacao" defaultValue="NAO_VERIFICADO" className={inputCls}><Opcoes lista={SITUACOES_VERIFICACAO} rotulos={SITUACAO_VERIFICACAO_LABEL} /></select></label>
        </div>
        <label className="block"><span className={rotuloCls}>Observação</span><input name="observacao" className={inputCls} /></label>
      </Form>
    </Recolhivel>
  );
}

export function InativarPessoa({ candidataId, pessoaId }: { candidataId: string; pessoaId: string }) {
  const [aberto, setAberto] = useState(false);
  if (!aberto) return <button type="button" className={btnSec} onClick={() => setAberto(true)}>Inativar</button>;
  return (
    <div className="w-60"><Form candidataId={candidataId} acao="inativarPessoa" botao="Confirmar inativação" extras={{ pessoaId }} aoGravar={() => setAberto(false)}>
      <Justificativa nome="motivo" rotulo="Motivo da inativação" />
    </Form></div>
  );
}

