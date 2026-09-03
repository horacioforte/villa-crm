"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/midias-sociais/StatTile";
import { STATUS_CONEXAO_LABELS } from "@/lib/validations/rede-social";

type StatusConexao = "NAO_CONECTADO" | "CONECTADO" | "ERRO" | "TOKEN_EXPIRADO";
type Periodo = "7d" | "30d" | "90d";
type TipoConteudo = "POST" | "REEL" | "CARROSSEL" | "STORY";

type Conta = {
  id: string;
  nome: string;
  instagramBusinessAccountId: string | null;
  statusConexao: StatusConexao;
  ultimaSincronizacaoEm: string | null;
  ultimoErro: string | null;
};

type MetricaComparacao = {
  valorAtual: number | null;
  valorAnterior: number | null;
  variacaoAbsoluta: number | null;
  variacaoPercentual: number | null;
};

type Comparacao = {
  disponivel: boolean;
  origemComparacao: "MANUAL" | "API" | null;
  porMetrica: Record<
    "seguidores" | "alcance" | "visualizacoes" | "interacoes" | "visitasPerfil" | "cliquesBio" | "quantidadePosts",
    MetricaComparacao
  >;
};

type SnapshotAtual = {
  seguidores: number | null;
  alcance: number | null;
  visualizacoes: number | null;
  interacoes: number | null;
  visitasPerfil: number | null;
  cliquesBio: number | null;
  quantidadePosts: number | null;
};

type ResumoResponse = {
  conectado: boolean;
  conta: Conta | null;
  snapshotAtual: SnapshotAtual | null;
  comparacao: Comparacao | null;
};

type Conteudo = {
  id: string;
  tipo: TipoConteudo;
  publicadoEm: string;
  legenda: string | null;
  url: string | null;
  thumbnailUrl: string | null;
  alcance: number | null;
  interacoes: number | null;
  curtidas: number | null;
  comentarios: number | null;
};

type ConteudosResponse = {
  data: Conteudo[];
  nextCursor: string | null;
};

const STATUS_BADGE: Record<StatusConexao, string> = {
  NAO_CONECTADO: "bg-slate-100 text-slate-600 border border-slate-200",
  CONECTADO: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  ERRO: "bg-red-100 text-red-700 border border-red-200",
  TOKEN_EXPIRADO: "bg-amber-100 text-amber-800 border border-amber-200",
};

const TIPO_CONTEUDO_LABELS: Record<TipoConteudo, string> = {
  POST: "Post",
  REEL: "Reel",
  CARROSSEL: "Carrossel",
  STORY: "Story",
};

const PERIODO_OPTIONS: { value: Periodo; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
];

function formatarNumero(valor: number | null | undefined): string | undefined {
  if (valor === null || valor === undefined) return undefined;
  return valor.toLocaleString("pt-BR");
}

// Hint de comparação por métrica: só aparece quando há um snapshot anterior
// cobrindo INTEGRALMENTE o período escolhido (ver route.ts — item 12 da
// proposta técnica: nunca comparar contra um ponto "quase certo"). Caso
// contrário mostra "Histórico insuficiente" em vez de esconder o problema.
function formatarHintComparacao(comparacao: Comparacao | null, campo: keyof Comparacao["porMetrica"]): string | undefined {
  if (!comparacao) return undefined;
  if (!comparacao.disponivel) return "Histórico insuficiente para comparar";

  const metrica = comparacao.porMetrica[campo];
  if (metrica.variacaoPercentual === null) return "Histórico insuficiente para comparar";

  const sinal = metrica.variacaoPercentual >= 0 ? "+" : "";
  const origem = comparacao.origemComparacao === "MANUAL" ? " (base manual)" : "";
  return `${sinal}${metrica.variacaoPercentual.toFixed(1)}% vs período anterior${origem}`;
}

export default function MidiasSociaisInstagramPage() {
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [resumo, setResumo] = useState<ResumoResponse | null>(null);
  const [loadingResumo, setLoadingResumo] = useState(true);
  const [erroResumo, setErroResumo] = useState(false);

  const [conteudos, setConteudos] = useState<Conteudo[]>([]);
  const [loadingConteudos, setLoadingConteudos] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const carregarResumo = useCallback(async (periodoAtual: Periodo) => {
    setLoadingResumo(true);
    setErroResumo(false);
    try {
      const response = await fetch(`/api/midias-sociais/instagram/resumo?periodo=${periodoAtual}`);
      if (!response.ok) {
        setErroResumo(true);
        return;
      }
      const dados = (await response.json()) as ResumoResponse;
      setResumo(dados);
    } catch {
      setErroResumo(true);
    } finally {
      setLoadingResumo(false);
    }
  }, []);

  const carregarConteudos = useCallback(async (cursor?: string) => {
    setLoadingConteudos(true);
    try {
      const params = new URLSearchParams({ limit: "9" });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/midias-sociais/instagram/conteudos?${params.toString()}`);
      if (!response.ok) return;
      const dados = (await response.json()) as ConteudosResponse;
      setConteudos((atual) => (cursor ? [...atual, ...dados.data] : dados.data));
      setNextCursor(dados.nextCursor);
    } finally {
      setLoadingConteudos(false);
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      if (!cancelado) await carregarResumo(periodo);
    }
    carregar();
    return () => {
      cancelado = true;
    };
  }, [periodo, carregarResumo]);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      // Conteúdo sincronizado não depende do período de comparação de
      // métricas de conta — carrega uma vez só.
      if (!cancelado) await carregarConteudos();
    }
    carregar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusConexao = resumo?.conta?.statusConexao ?? "NAO_CONECTADO";
  const snapshot = resumo?.snapshotAtual ?? null;
  const comparacao = resumo?.comparacao ?? null;

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#1E4FAB]">
            Mídias Sociais
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[#1A2E5A]">Instagram</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">
            @villapumps — audiência, conteúdo e leads gerados no Instagram.
          </p>
        </div>
        {!loadingResumo && (
          <Badge className={STATUS_BADGE[statusConexao]}>{STATUS_CONEXAO_LABELS[statusConexao]}</Badge>
        )}
      </header>

      {!loadingResumo && statusConexao === "NAO_CONECTADO" && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 size-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Aguardando conexão com a Meta</p>
            <p className="mt-0.5 text-xs leading-5 text-amber-700">
              Conecte a conta do Instagram em Mídias Sociais → Configurações para começar a
              receber dados reais.
            </p>
          </div>
        </div>
      )}

      {!loadingResumo && statusConexao === "TOKEN_EXPIRADO" && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 size-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Token de acesso expirado</p>
            <p className="mt-0.5 text-xs leading-5 text-amber-700">
              Os dados abaixo são do último sincronismo bem-sucedido. Gere um novo token em
              Mídias Sociais → Configurações para retomar a sincronização.
            </p>
          </div>
        </div>
      )}

      {!loadingResumo && statusConexao === "ERRO" && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 size-4 flex-shrink-0" />
          <div>
            <p className="font-semibold">Última sincronização falhou</p>
            <p className="mt-0.5 text-xs leading-5 text-red-700">
              {resumo?.conta?.ultimoErro ?? "Erro não especificado."} Os dados abaixo são do
              último sincronismo bem-sucedido.
            </p>
          </div>
        </div>
      )}

      {erroResumo && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Não foi possível carregar os dados agora. Tente recarregar a página.
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#1E4FAB]">
          Resultado comercial
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Investimento" emphasis="primary" />
          <StatTile label="Leads" emphasis="primary" />
          <StatTile label="Qualificados" emphasis="primary" />
          <StatTile label="Oportunidades" emphasis="primary" />
          <StatTile label="Valor proposto" emphasis="primary" />
          <StatTile label="Contratado" emphasis="primary" />
        </div>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#667085]">
            Aquisição e audiência
          </h2>
          <div className="flex flex-wrap gap-1 rounded-2xl border border-[#D7DEEA] bg-white p-1">
            {PERIODO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriodo(opt.value)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  periodo === opt.value
                    ? "bg-[#1E4FAB] text-white"
                    : "text-[#667085] hover:bg-[#F4F6FA]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatTile
            label="Seguidores"
            value={!loadingResumo ? formatarNumero(snapshot?.seguidores) : undefined}
            hint={!loadingResumo ? formatarHintComparacao(comparacao, "seguidores") : undefined}
          />
          <StatTile
            label="Alcance"
            value={!loadingResumo ? formatarNumero(snapshot?.alcance) : undefined}
            hint={!loadingResumo ? formatarHintComparacao(comparacao, "alcance") : undefined}
          />
          <StatTile label="Não seguidores alcançados" />
          <StatTile
            label="Visitas ao perfil"
            value={!loadingResumo ? formatarNumero(snapshot?.visitasPerfil) : undefined}
            hint={!loadingResumo ? formatarHintComparacao(comparacao, "visitasPerfil") : undefined}
          />
          <StatTile label="Mensagens diretas" />
          <StatTile
            label="Engajamento"
            value={!loadingResumo ? formatarNumero(snapshot?.interacoes) : undefined}
            hint={!loadingResumo ? formatarHintComparacao(comparacao, "interacoes") : undefined}
          />
        </div>
        {/*
          "Não seguidores alcançados" e "Mensagens diretas" continuam sem
          dado — nenhuma métrica sincronizada hoje cobre isso (a primeira
          exigiria a métrica de breakdown por audiência da Meta, a segunda a
          API de Mensagens do Instagram; nenhuma das duas faz parte do
          Sprint 2). Ver mensagem para o Horacio sobre este ponto.
        */}
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[#667085]">
          Conteúdo recente
        </h2>
        {!loadingConteudos && conteudos.length === 0 && (
          <p className="mt-3 rounded-2xl border border-[#D7DEEA] bg-white px-4 py-6 text-center text-sm text-[#667085]">
            Nenhum conteúdo sincronizado ainda.
          </p>
        )}
        {conteudos.length > 0 && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {conteudos.map((item) => (
              <a
                key={item.id}
                href={item.url ?? undefined}
                target={item.url ? "_blank" : undefined}
                rel={item.url ? "noopener noreferrer" : undefined}
                className="flex flex-col overflow-hidden rounded-2xl border border-[#D7DEEA] bg-white transition hover:border-[#93C5FD]"
              >
                {item.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnailUrl} alt="" className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-[#F4F6FA] text-xs text-[#98A2B3]">
                    Sem prévia
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className="border border-[#D7DEEA] bg-[#F4F6FA] text-[#334155]">
                      {TIPO_CONTEUDO_LABELS[item.tipo]}
                    </Badge>
                    <span className="text-[11px] text-[#98A2B3]">
                      {new Date(item.publicadoEm).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  {item.legenda && (
                    <p className="line-clamp-2 text-xs leading-5 text-[#667085]">{item.legenda}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-[#334155]">
                    <span>Alcance: {formatarNumero(item.alcance) ?? "—"}</span>
                    <span>Interações: {formatarNumero(item.interacoes) ?? "—"}</span>
                    {item.url && <ExternalLink className="size-3.5 text-[#98A2B3]" />}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
        {nextCursor && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => carregarConteudos(nextCursor)}
              disabled={loadingConteudos}
              className="rounded-xl border border-[#D7DEEA] bg-white px-4 py-2 text-xs font-semibold text-[#334155] transition hover:bg-[#F4F6FA] disabled:opacity-50"
            >
              {loadingConteudos ? "Carregando…" : "Carregar mais"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
