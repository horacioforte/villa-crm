"use client";

// ARQUIVO: components/conversas/SupervisaoBoard.tsx
// REGRA: nunca remover. Apenas acrescentar.
// Painel de supervisão — visão kanban de todos os canais WhatsApp.
// Colunas: João, Maria IA, Taciane, Morgana.
// Atualiza a cada 60s. Dropdown "Assumir" chama /api/conversas/{id}/transferir.

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ConversaBoard = {
  id: string;
  nomeContato: string | null;
  telefone: string | null;
  instanceName: string;
  status: string;
  aguardandoRespostaDesde: string | null;
  ultimaMensagemEm: string | null;
  atendidoPorId: string | null;
  atendidoPor: { nome: string } | null;
  iaPausada?: boolean;
  mensagens: Array<{ conteudo: string; direcao: string; createdAt: string }>;
};

type Usuario = { id: string; nome: string; email: string };

// ─── Task #11: fila de alertas (coluna "Precisa de ação") ─────────────────────
// Espelha o contrato de GET /api/conversas/alertas (lib/conversas/alertas.ts) — só o
// que este componente consome. Motivos e severidade já vêm calculados e ordenados pelo
// backend (nenhuma regra de SLA é recalculada aqui).
type MotivoAlerta = "aguardando_urgente" | "sem_responsavel" | "tarefa_whatsapp_vencida" | "aguardando_atencao";

type AlertaConversaApi = {
  tipo: "conversa";
  conversaId: string;
  instanceName: string;
  canalTipo: "IA" | "HUMANO" | "DESCONHECIDO";
  nomeContato: string | null;
  telefone: string | null;
  motivos: MotivoAlerta[];
  severidade: MotivoAlerta;
  aguardandoRespostaDesde: string | null;
  atendidoPorId: string | null;
  atendidoPorNome: string | null;
  empresaNome: string | null;
  oportunidade: { id: string; titulo: string; valor: number | null } | null;
  ultimaMensagem: { conteudo: string; direcao: string; createdAt: string } | null;
};

type AlertaTarefaApi = { tipo: "tarefa" };

type AlertaApi = AlertaConversaApi | AlertaTarefaApi;

const MOTIVO_LABEL: Record<MotivoAlerta, { label: string; cor: string }> = {
  aguardando_urgente: { label: "Urgente", cor: "bg-red-100 text-red-700" },
  sem_responsavel: { label: "Sem responsável", cor: "bg-amber-100 text-amber-700" },
  tarefa_whatsapp_vencida: { label: "Tarefa vencida", cor: "bg-purple-100 text-purple-700" },
  aguardando_atencao: { label: "Atenção", cor: "bg-amber-50 text-amber-600" },
};

interface Props {
  usuarios: Usuario[];
  onAbrirConversa: (conversa: ConversaBoard) => void;
}

// ─── Configuração dos canais ───────────────────────────────────────────────────

const CANAIS = [
  {
    instance: "joao-villa",
    label: "João",
    sigla: "JO",
    avatarCor: "bg-[#E6F1FB] text-[#185FA5]",
    badgeCor: "bg-[#E6F1FB] text-[#185FA5]",
    tipo: "IA",
  },
  {
    instance: "maria-villa",
    label: "Maria IA",
    sigla: "MA",
    avatarCor: "bg-[#EEEDFE] text-[#534AB7]",
    badgeCor: "bg-[#EEEDFE] text-[#534AB7]",
    tipo: "IA",
  },
  {
    instance: "taciane-villa",
    label: "Taciane",
    sigla: "TA",
    avatarCor: "bg-[#EAF3DE] text-[#3B6D11]",
    badgeCor: "bg-[#EAF3DE] text-[#3B6D11]",
    tipo: "HUMANO",
  },
  {
    instance: "morgana-villa",
    label: "Morgana",
    sigla: "MO",
    avatarCor: "bg-[#FAEEDA] text-[#854F0B]",
    badgeCor: "bg-[#FAEEDA] text-[#854F0B]",
    tipo: "HUMANO",
  },
] as const;

// ─── Helpers de tempo ─────────────────────────────────────────────────────────

function calcMinutos(aguardandoDesde: string | null | undefined): number {
  if (!aguardandoDesde) return -1;
  return Math.floor((Date.now() - new Date(aguardandoDesde).getTime()) / 60_000);
}

function formatarEspera(minutos: number): string {
  if (minutos < 0) return "";
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function corBordaEsquerda(minutos: number): string {
  if (minutos < 0) return "border-l-[#D7DEEA]";
  if (minutos > 120) return "border-l-red-400";
  if (minutos > 30) return "border-l-amber-400";
  return "border-l-green-400";
}

function corTextoEspera(minutos: number): string {
  if (minutos < 0) return "text-[#98A2B3]";
  if (minutos > 120) return "text-red-600 font-bold";
  if (minutos > 30) return "text-amber-600 font-semibold";
  return "text-green-600 font-semibold";
}

// Converte um item da fila de alertas (Task #11) no formato ConversaBoard esperado por
// onAbrirConversa — reaproveita o mesmo fluxo de abertura já usado pelos cards por canal.
// status é um placeholder ("ABERTA"): carregarDetalhesConversa (no componente pai) refaz
// o fetch por id assim que a conversa é aberta, então o valor real chega em seguida.
function alertaParaConversaBoard(alerta: AlertaConversaApi): ConversaBoard {
  return {
    id: alerta.conversaId,
    nomeContato: alerta.nomeContato,
    telefone: alerta.telefone,
    instanceName: alerta.instanceName,
    status: "ABERTA",
    aguardandoRespostaDesde: alerta.aguardandoRespostaDesde,
    ultimaMensagemEm: alerta.ultimaMensagem?.createdAt ?? null,
    atendidoPorId: alerta.atendidoPorId,
    atendidoPor: alerta.atendidoPorNome ? { nome: alerta.atendidoPorNome } : null,
    mensagens: alerta.ultimaMensagem
      ? [{ conteudo: alerta.ultimaMensagem.conteudo, direcao: alerta.ultimaMensagem.direcao, createdAt: alerta.ultimaMensagem.createdAt }]
      : [],
  };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function SupervisaoBoard({ usuarios, onAbrirConversa }: Props) {
  const [conversas, setConversas] = useState<ConversaBoard[]>([]);
  const [alertas, setAlertas] = useState<AlertaConversaApi[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [assumirDropdownId, setAssumirDropdownId] = useState<string | null>(null);
  const [assumindo, setAssumindo] = useState<string | null>(null); // conversaId em transição
  const [, tickTempo] = useState(0);
  const dropdownWrapRef = useRef<HTMLDivElement | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      // Busca todas as conversas não-concluídas sem filtro de agente
      const res = await fetch("/api/conversas?status=ABERTA");
      if (res.ok) {
        const data: ConversaBoard[] = await res.json();
        // Inclui também PENDENTE (segunda chamada) e mescla
        const res2 = await fetch("/api/conversas?status=PENDENTE");
        const data2: ConversaBoard[] = res2.ok ? await res2.json() : [];
        const ids = new Set(data.map((c) => c.id));
        setConversas([...data, ...data2.filter((c) => !ids.has(c.id))]);
      }

      // Task #11 — coluna "Precisa de ação": consome exclusivamente
      // GET /api/conversas/alertas (nenhuma API nova, nenhuma regra de SLA recalculada
      // aqui — ordenação e severidade já vêm prontas do backend). Itens tipo:"tarefa"
      // (tarefa WhatsApp vencida sem conversa vinculada) ficam fora desta primeira
      // versão: não há "conversa" para abrir/assumir, então não cabem neste card ainda.
      const resAlertas = await fetch("/api/conversas/alertas");
      if (resAlertas.ok) {
        const dataAlertas: AlertaApi[] = await resAlertas.json();
        setAlertas(dataAlertas.filter((item): item is AlertaConversaApi => item.tipo === "conversa"));
      }
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // Atualiza o tempo exibido a cada 60s sem re-buscar
  useEffect(() => {
    const t = setInterval(() => tickTempo((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // Auto-refresh a cada 2 minutos
  useEffect(() => {
    const t = setInterval(() => carregar(), 120_000);
    return () => clearInterval(t);
  }, [carregar]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        dropdownWrapRef.current &&
        !dropdownWrapRef.current.contains(e.target as Node)
      ) {
        setAssumirDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ── Ação: Assumir ─────────────────────────────────────────────────────────

  async function assumirConversa(conversaId: string, paraUsuarioId: string) {
    setAssumindo(conversaId);
    try {
      const res = await fetch(`/api/conversas/${conversaId}/transferir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paraUsuarioId }),
      });
      if (res.ok) {
        setAssumirDropdownId(null);
        await carregar();
      }
    } finally {
      setAssumindo(null);
    }
  }

  // ── Dados por canal ───────────────────────────────────────────────────────

  const porCanal = CANAIS.map((canal) => ({
    ...canal,
    conversas: conversas
      .filter((c) => c.instanceName === canal.instance)
      .map((c) => ({ ...c, minutosEspera: calcMinutos(c.aguardandoRespostaDesde) }))
      .sort((a, b) => {
        // Mais urgentes primeiro: maiores minutos de espera no topo
        if (a.minutosEspera < 0 && b.minutosEspera < 0) return 0;
        if (a.minutosEspera < 0) return 1;
        if (b.minutosEspera < 0) return -1;
        return b.minutosEspera - a.minutosEspera;
      }),
  }));

  // ── Stats ─────────────────────────────────────────────────────────────────

  const total = conversas.length;
  const urgentes = conversas.filter((c) => calcMinutos(c.aguardandoRespostaDesde) > 120).length;
  const semResponsavel = conversas.filter((c) => !c.atendidoPorId).length;
  const pediramHumano = conversas.filter((c) => c.iaPausada).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full flex-col gap-3 overflow-hidden p-4">

      {/* ── Faixa de resumo ── */}
      <div className="flex shrink-0 items-stretch gap-3">
        <div className={cn(
          "flex flex-1 flex-col gap-0.5 rounded-2xl border p-3",
          urgentes > 0 ? "border-red-200 bg-red-50" : "border-[#D7DEEA] bg-white"
        )}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Aguardando &gt;2h</p>
          <p className={cn("text-2xl font-bold leading-none", urgentes > 0 ? "text-red-600" : "text-[#1A2E5A]")}>{urgentes}</p>
          <p className={cn("text-[10px] font-semibold", urgentes > 0 ? "text-red-500" : "text-[#98A2B3]")}>
            {urgentes > 0 ? "⚠ Requer atenção" : "Tudo ok"}
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-0.5 rounded-2xl border border-[#D7DEEA] bg-white p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Em andamento</p>
          <p className="text-2xl font-bold leading-none text-[#1A2E5A]">{total}</p>
          <p className="text-[10px] font-semibold text-[#98A2B3]">conversas ativas</p>
        </div>

        <div className={cn(
          "flex flex-1 flex-col gap-0.5 rounded-2xl border p-3",
          semResponsavel > 0 ? "border-amber-200 bg-amber-50" : "border-[#D7DEEA] bg-white"
        )}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Sem responsável</p>
          <p className={cn("text-2xl font-bold leading-none", semResponsavel > 0 ? "text-amber-600" : "text-[#1A2E5A]")}>{semResponsavel}</p>
          <p className={cn("text-[10px] font-semibold", semResponsavel > 0 ? "text-amber-500" : "text-[#98A2B3]")}>
            {semResponsavel > 0 ? "Atribuir agora" : "Tudo atribuído"}
          </p>
        </div>

        {pediramHumano > 0 && (
          <div className="flex flex-1 flex-col gap-0.5 rounded-2xl border border-purple-200 bg-purple-50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">Pediu humano</p>
            <p className="text-2xl font-bold leading-none text-purple-700">{pediramHumano}</p>
            <p className="text-[10px] font-semibold text-purple-500">IA pausada</p>
          </div>
        )}

        <button
          onClick={carregar}
          disabled={carregando}
          title="Recarregar supervisão"
          className="shrink-0 self-stretch rounded-2xl border border-[#D7DEEA] bg-white px-3 text-[#667085] transition hover:bg-[#F4F6FA] disabled:opacity-50"
        >
          <RefreshCw className={cn("size-4", carregando && "animate-spin")} />
        </button>
      </div>

      {/* ── Coluna "Precisa de ação" (Task #11) + 4 colunas por canal ── */}
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto">
        {/* Task #11 — consome exclusivamente GET /api/conversas/alertas. Um único card
            por conversa mesmo com vários motivos (motivos[] já vem deduplicado do
            backend); "pedir_humano" fica fora desta rodada (auditoria: sem fonte de
            dado real ainda). Colunas por canal abaixo não foram alteradas. */}
        <div className="flex min-h-0 w-[340px] shrink-0 flex-col gap-2">
          <div className="flex shrink-0 items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-sm leading-none">🔴</span>
              <p className="text-xs font-bold text-red-700">Precisa de ação</p>
            </div>
            <span className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-bold",
              alertas.length > 0 ? "bg-red-100 text-red-700" : "bg-[#F4F6FA] text-[#98A2B3]"
            )}>
              {alertas.length}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2 pr-0.5">
            {alertas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#D7DEEA] bg-[#F4F6FA] px-3 py-6 text-center text-[11px] text-[#98A2B3]">
                Nenhuma conversa precisa de ação agora
              </div>
            ) : (
              alertas.map((alerta) => {
                const minutosEspera = calcMinutos(alerta.aguardandoRespostaDesde);
                return (
                  <div
                    key={alerta.conversaId}
                    className="flex shrink-0 flex-col gap-2 rounded-2xl border border-red-100 bg-white p-3 border-l-4 border-l-red-400"
                  >
                    {/* Nome + tempo aguardando (só quando houver aguardandoRespostaDesde) */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-xs font-bold text-[#1A2E5A]">
                        {alerta.nomeContato ?? alerta.telefone ?? "Desconhecido"}
                      </p>
                      {minutosEspera >= 0 && (
                        <span className={cn("shrink-0 text-[10px]", corTextoEspera(minutosEspera))}>
                          {formatarEspera(minutosEspera)}
                        </span>
                      )}
                    </div>

                    {/* Empresa — só quando a conversa já tem esse vínculo */}
                    {alerta.empresaNome && (
                      <p className="truncate text-[10px] text-[#667085]">{alerta.empresaNome}</p>
                    )}

                    {/* Todos os motivos, sem duplicar o card */}
                    <div className="flex flex-wrap gap-1">
                      {alerta.motivos.map((motivo) => (
                        <span
                          key={motivo}
                          className={cn("rounded-md px-1.5 py-0.5 text-[9px] font-bold", MOTIVO_LABEL[motivo].cor)}
                        >
                          {MOTIVO_LABEL[motivo].label}
                        </span>
                      ))}
                    </div>

                    {/* Canal + responsável */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className="rounded-md bg-[#F4F6FA] px-1.5 py-0.5 font-semibold text-[#667085]">
                        {alerta.instanceName}
                      </span>
                      {alerta.atendidoPorNome ? (
                        <span className="text-[#98A2B3]">
                          Resp: <span className="font-semibold text-[#667085]">{alerta.atendidoPorNome}</span>
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-500">Sem responsável</span>
                      )}
                    </div>

                    {/* Oportunidade/valor — só quando já disponível (sem API nova) */}
                    {alerta.oportunidade && (
                      <p className="truncate text-[10px] text-[#667085]">
                        {alerta.oportunidade.titulo}
                        {alerta.oportunidade.valor != null &&
                          ` · ${alerta.oportunidade.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                      </p>
                    )}

                    {/* Última mensagem */}
                    {alerta.ultimaMensagem && (
                      <p className="line-clamp-2 text-[10px] leading-relaxed text-[#667085]">
                        &quot;{alerta.ultimaMensagem.conteudo.slice(0, 100)}&quot;
                      </p>
                    )}

                    {/* Ações — reaproveitam onAbrirConversa e assumirConversa já existentes */}
                    <div
                      className="relative flex gap-1.5"
                      ref={assumirDropdownId === alerta.conversaId ? dropdownWrapRef : undefined}
                    >
                      <button
                        onClick={() => onAbrirConversa(alertaParaConversaBoard(alerta))}
                        className="flex-1 rounded-xl bg-[#1A2E5A] py-1.5 text-[10px] font-bold text-white transition hover:bg-[#1E4FAB]"
                      >
                        Abrir conversa
                      </button>

                      <button
                        onClick={() =>
                          setAssumirDropdownId(assumirDropdownId === alerta.conversaId ? null : alerta.conversaId)
                        }
                        disabled={assumindo === alerta.conversaId}
                        className="flex items-center gap-1 rounded-xl border border-[#2A78D6] px-2 py-1.5 text-[10px] font-bold text-[#2A78D6] transition hover:bg-[#E8EEFB] disabled:opacity-50"
                      >
                        Assumir
                        <ChevronDown className={cn("size-3 transition-transform", assumirDropdownId === alerta.conversaId && "rotate-180")} />
                      </button>

                      {assumirDropdownId === alerta.conversaId && (
                        <div className="absolute bottom-full left-0 z-50 mb-1 w-52 rounded-2xl border border-[#D7DEEA] bg-white shadow-lg">
                          <div className="flex items-center justify-between border-b border-[#D7DEEA] px-3 py-2">
                            <p className="text-[10px] font-bold text-[#1A2E5A]">Atribuir para</p>
                            <button onClick={() => setAssumirDropdownId(null)}>
                              <X className="size-3.5 text-[#98A2B3] hover:text-[#1A2E5A]" />
                            </button>
                          </div>
                          <div className="py-1 max-h-48 overflow-y-auto">
                            {usuarios.length === 0 ? (
                              <p className="px-3 py-2 text-[10px] text-[#98A2B3]">Nenhum usuário disponível.</p>
                            ) : (
                              usuarios.map((u) => (
                                <button
                                  key={u.id}
                                  onClick={() => assumirConversa(alerta.conversaId, u.id)}
                                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[#F4F6FA]"
                                >
                                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E8EEFB] text-[9px] font-bold text-[#1E4FAB]">
                                    {u.nome.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-[11px] font-semibold text-[#1A2E5A]">{u.nome}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {porCanal.map((canal) => (
          <div
            key={canal.instance}
            className="flex min-h-0 w-[230px] shrink-0 flex-col gap-2"
          >
            {/* Cabeçalho da coluna */}
            <div className="flex shrink-0 items-center justify-between rounded-2xl border border-[#D7DEEA] bg-white px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                  canal.avatarCor
                )}>
                  {canal.sigla}
                </div>
                <div>
                  <p className="text-xs font-bold text-[#1A2E5A]">{canal.label}</p>
                  <p className="text-[9px] text-[#98A2B3]">{canal.tipo === "IA" ? "Agente IA" : "Humano"}</p>
                </div>
              </div>
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                canal.conversas.length > 0 ? canal.badgeCor : "bg-[#F4F6FA] text-[#98A2B3]"
              )}>
                {canal.conversas.length}
              </span>
            </div>

            {/* Cards rolável */}
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2 pr-0.5">
              {canal.conversas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#D7DEEA] bg-[#F4F6FA] px-3 py-6 text-center text-[11px] text-[#98A2B3]">
                  Sem conversas ativas
                </div>
              ) : (
                canal.conversas.map((c) => (
                  <div
                    key={c.id}
                    className={cn(
                      "flex shrink-0 flex-col gap-2 rounded-2xl border border-[#E8EDF5] bg-white p-3",
                      "border-l-4",
                      corBordaEsquerda(c.minutosEspera)
                    )}
                  >
                    {/* Nome + tempo */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-xs font-bold text-[#1A2E5A]">
                        {c.nomeContato ?? c.telefone ?? "Desconhecido"}
                      </p>
                      {c.minutosEspera >= 0 && (
                        <span className={cn("shrink-0 text-[10px]", corTextoEspera(c.minutosEspera))}>
                          {formatarEspera(c.minutosEspera)}
                        </span>
                      )}
                    </div>

                    {/* Responsável atual */}
                    {c.atendidoPor ? (
                      <p className="text-[10px] text-[#98A2B3]">
                        Resp: <span className="font-semibold text-[#667085]">{c.atendidoPor.nome}</span>
                      </p>
                    ) : (
                      <p className="text-[10px] font-semibold text-amber-500">Sem responsável</p>
                    )}

                    {/* Badge IA pausada */}
                    {c.iaPausada && (
                      <span className="w-fit rounded-md bg-purple-50 px-1.5 py-0.5 text-[9px] font-bold text-purple-600">
                        Pediu humano
                      </span>
                    )}

                    {/* Última mensagem */}
                    {c.mensagens?.[0] && (
                      <p className="line-clamp-2 text-[10px] leading-relaxed text-[#667085]">
                        "{c.mensagens[0].conteudo.slice(0, 100)}"
                      </p>
                    )}

                    {/* Botões de ação */}
                    <div
                      className="relative flex gap-1.5"
                      ref={assumirDropdownId === c.id ? dropdownWrapRef : undefined}
                    >
                      {/* Responder → abre no workspace */}
                      <button
                        onClick={() => onAbrirConversa(c)}
                        className="flex-1 rounded-xl bg-[#1A2E5A] py-1.5 text-[10px] font-bold text-white transition hover:bg-[#1E4FAB]"
                      >
                        Responder
                      </button>

                      {/* Assumir → dropdown de usuários */}
                      <button
                        onClick={() =>
                          setAssumirDropdownId(assumirDropdownId === c.id ? null : c.id)
                        }
                        disabled={assumindo === c.id}
                        className="flex items-center gap-1 rounded-xl border border-[#2A78D6] px-2 py-1.5 text-[10px] font-bold text-[#2A78D6] transition hover:bg-[#E8EEFB] disabled:opacity-50"
                      >
                        Assumir
                        <ChevronDown className={cn("size-3 transition-transform", assumirDropdownId === c.id && "rotate-180")} />
                      </button>

                      {/* Dropdown de usuários */}
                      {assumirDropdownId === c.id && (
                        <div className="absolute bottom-full left-0 z-50 mb-1 w-52 rounded-2xl border border-[#D7DEEA] bg-white shadow-lg">
                          <div className="flex items-center justify-between border-b border-[#D7DEEA] px-3 py-2">
                            <p className="text-[10px] font-bold text-[#1A2E5A]">Atribuir para</p>
                            <button onClick={() => setAssumirDropdownId(null)}>
                              <X className="size-3.5 text-[#98A2B3] hover:text-[#1A2E5A]" />
                            </button>
                          </div>
                          <div className="py-1 max-h-48 overflow-y-auto">
                            {usuarios.length === 0 ? (
                              <p className="px-3 py-2 text-[10px] text-[#98A2B3]">Nenhum usuário disponível.</p>
                            ) : (
                              usuarios.map((u) => (
                                <button
                                  key={u.id}
                                  onClick={() => assumirConversa(c.id, u.id)}
                                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[#F4F6FA]"
                                >
                                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E8EEFB] text-[9px] font-bold text-[#1E4FAB]">
                                    {u.nome.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-[11px] font-semibold text-[#1A2E5A]">{u.nome}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
