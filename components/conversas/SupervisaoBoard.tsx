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

// ─── Componente ───────────────────────────────────────────────────────────────

export function SupervisaoBoard({ usuarios, onAbrirConversa }: Props) {
  const [conversas, setConversas] = useState<ConversaBoard[]>([]);
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

      {/* ── 4 Colunas ── */}
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto">
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
