"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, Factory, Filter, MapPin, Search, Target, TrendingUp, Users } from "lucide-react";
import { CarteiraKanban, type CarteiraKanbanItem, type EtapaCarteira } from "@/components/inteligencia/CarteiraKanban";

const CARTEIRAS_META: Record<string, { title: string; description: string; foco: string[] }> = {
  mcmv: {
    title: "Minha Casa Minha Vida",
    description: "Monitoramento de construtoras e empreendimentos em MCMV com foco em mobilização, fundação, estrutura e concretagem.",
    foco: ["Unidades", "Fase da obra", "Decisores", "Score Villa"],
  },
  "construtoras-brasil": {
    title: "Construtoras",
    description: "Carteira de construtoras estratégicas e obras relevantes em múltiplos estados.",
    foco: ["Estado", "Porte", "Obras", "Movimentações"],
  },
  concreteiras: {
    title: "Concreteiras",
    description: "Monitoramento de expansão regional, plantas, frota, novas filiais e movimentações societárias.",
    foco: ["Expansão", "Frota", "Compra de equipamentos", "Novas plantas"],
  },
  "pre-moldados": {
    title: "Pré-Moldados",
    description: "Carteira focada em expansão de fábricas, novas linhas e indústrias com potencial de compra de equipamentos.",
    foco: ["Fábrica", "Linhas", "Contratações", "Equipamentos"],
  },
  "revendas-caminhoes": {
    title: "Agência de Caminhões",
    description: "Parcerias em revendas, concessionárias e redes especializadas em veículos pesados.",
    foco: ["Estoque", "Parcerias", "Compradores", "Indicações"],
  },
};

const filtrosPadrao = [
  "Estado",
  "Cidade",
  "Score",
  "Estágio",
  "Com decisor",
  "Sem decisor",
  "Em campanha",
  "Interessado",
  "Sem atualização recente",
];

export function CarteiraEstratPage({ slug }: { slug: string }) {
  const meta = CARTEIRAS_META[slug] ?? CARTEIRAS_META.mcmv;
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("TODAS");
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [cidadeFiltro, setCidadeFiltro] = useState("");
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [comDecisor, setComDecisor] = useState(false);
  const [semDecisor, setSemDecisor] = useState(false);
  const [emCampanhaFiltro, setEmCampanhaFiltro] = useState(false);
  const [interessadoFiltro, setInteressadoFiltro] = useState(false);
  const [movimentoRecente, setMovimentoRecente] = useState(false);
  const [semAtualizacaoRecente, setSemAtualizacaoRecente] = useState(false);
  const [items, setItems] = useState<CarteiraKanbanItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function carregar() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (busca.trim()) params.set("q", busca.trim());
        if (statusFiltro && statusFiltro !== "TODAS") params.set("status", statusFiltro);
        if (estadoFiltro.trim()) params.set("estado", estadoFiltro.trim());
        if (cidadeFiltro.trim()) params.set("cidade", cidadeFiltro.trim());
        if (scoreMin.trim()) params.set("scoreMin", scoreMin.trim());
        if (scoreMax.trim()) params.set("scoreMax", scoreMax.trim());
        if (comDecisor) params.set("comDecisor", "true");
        if (semDecisor) params.set("semDecisor", "true");
        if (emCampanhaFiltro) params.set("emCampanha", "true");
        if (interessadoFiltro) params.set("interessado", "true");
        if (movimentoRecente) params.set("movimentoRecente", "true");
        if (semAtualizacaoRecente) params.set("semAtualizacaoRecente", "true");

        const response = await fetch(`/api/inteligencia/carteiras/${slug}${params.toString() ? `?${params.toString()}` : ""}`);
        if (!response.ok) {
          if (active) setItems([]);
          return;
        }
        const payload = await response.json();
        if (active) setItems(Array.isArray(payload.items) ? payload.items : []);
      } catch {
        if (active) setItems([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    carregar();
    return () => { active = false; };
  }, [slug, busca, statusFiltro, estadoFiltro, cidadeFiltro, scoreMin, scoreMax, comDecisor, semDecisor, emCampanhaFiltro, interessadoFiltro, movimentoRecente, semAtualizacaoRecente]);

  const metrics = [
    { label: "Total monitorado", value: String(items.length), icon: Building2 },
    { label: "Movimentações 24h", value: "0", icon: TrendingUp },
    { label: "Alertas críticos", value: "0", icon: AlertTriangle },
    { label: "Prontos para abordagem", value: String(items.filter((item) => item.estagio === "PRONTO_PARA_ABORDAR").length), icon: Target },
    { label: "Em campanha", value: String(items.filter((item) => item.estagio === "EM_CAMPANHA").length), icon: Users },
    { label: "Interessados", value: String(items.filter((item) => item.estagio === "INTERESSADO").length), icon: CheckCircle2 },
  ];

  const hasData = !loading && items.length > 0;

  const atualizarEstagio = async (item: CarteiraKanbanItem, nextStage: EtapaCarteira) => {
    if (!item.dossieId) return;

    const response = await fetch(`/api/inteligencia/carteiras/${slug}/${item.dossieId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStage, emCampanha: nextStage === "EM_CAMPANHA", interessado: nextStage === "INTERESSADO" }),
    });

    if (!response.ok) {
      throw new Error("Não foi possível atualizar o estágio desta carteira.");
    }

    setItems((atual) => atual.map((entry) => (entry.dossieId === item.dossieId ? { ...entry, estagio: nextStage, emCampanha: nextStage === "EM_CAMPANHA", interessado: nextStage === "INTERESSADO" } : entry)));
  };

  const abrirDossie = (item: CarteiraKanbanItem) => {
    if (item.dossieId) window.location.href = `/inteligencia/${item.dossieId}`;
  };

  const abrirLinkedin = (item: CarteiraKanbanItem) => {
    const termo = encodeURIComponent(`${item.empresa} ${item.cidade}`);
    window.open(`https://www.linkedin.com/search/results/all/?keywords=${termo}`, "_blank", "noopener,noreferrer");
  };

  const marcarCampanha = async (item: CarteiraKanbanItem) => {
    if (!item.dossieId) return;
    await atualizarEstagio(item, "EM_CAMPANHA");
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Carteiras Estratégicas</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{meta.title}</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">{meta.description}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Status</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {loading ? "Carregando..." : hasData ? "Dados ativos" : "Vazio / pronto para ingestão"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {meta.foco.map((item) => (
            <span key={item} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">{item}</span>
          ))}
        </div>
      </header>

      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {metrics.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">{label}</span>
                <Icon className="h-4 w-4 text-slate-400" />
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Ex: fundação · PE · sem decisor · score acima de 80"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFiltro}
                onChange={(event) => setStatusFiltro(event.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-400"
              >
                <option value="TODAS">Todos os estágios</option>
                {[
                  "MONITORANDO",
                  "SINAL_DETECTADO",
                  "EM_INVESTIGACAO",
                  "DECISOR_ENCONTRADO",
                  "PRONTO_PARA_ABORDAR",
                  "EM_CAMPANHA",
                  "RESPONDEU",
                  "INTERESSADO",
                ].map((etapa) => (
                  <option key={etapa} value={etapa}>{etapa}</option>
                ))}
              </select>
              <button className="inline-flex items-center gap-2 rounded-xl bg-[#1E4FAB] px-3 py-2 text-xs font-medium text-white hover:bg-[#1A2E5A]">
                <Target className="h-3.5 w-3.5" />
                Iniciar investigação
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            <input
              value={estadoFiltro}
              onChange={(event) => setEstadoFiltro(event.target.value)}
              placeholder="Estado"
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
            />
            <input
              value={cidadeFiltro}
              onChange={(event) => setCidadeFiltro(event.target.value)}
              placeholder="Cidade"
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
            />
            <input
              value={scoreMin}
              onChange={(event) => setScoreMin(event.target.value)}
              placeholder="Score min"
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
            />
            <input
              value={scoreMax}
              onChange={(event) => setScoreMax(event.target.value)}
              placeholder="Score max"
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
            />
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700">
              <input type="checkbox" checked={comDecisor} onChange={(event) => setComDecisor(event.target.checked)} />
              Com decisor
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700">
              <input type="checkbox" checked={semDecisor} onChange={(event) => setSemDecisor(event.target.checked)} />
              Sem decisor
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700">
              <input type="checkbox" checked={emCampanhaFiltro} onChange={(event) => setEmCampanhaFiltro(event.target.checked)} />
              Em campanha
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700">
              <input type="checkbox" checked={interessadoFiltro} onChange={(event) => setInteressadoFiltro(event.target.checked)} />
              Interessado
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700">
              <input type="checkbox" checked={movimentoRecente} onChange={(event) => setMovimentoRecente(event.target.checked)} />
              Mov. recente
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700">
              <input type="checkbox" checked={semAtualizacaoRecente} onChange={(event) => setSemAtualizacaoRecente(event.target.checked)} />
              Sem atualização recente
            </label>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {filtrosPadrao.map((filtro) => (
              <span key={filtro} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500">{filtro}</span>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            Carregando carteira...
          </div>
        ) : hasData ? (
          <CarteiraKanban
            items={items}
            onOpenDossie={abrirDossie}
            onLinkedIn={abrirLinkedin}
            onCampanha={marcarCampanha}
            onStageChange={async (item, nextStage) => { await atualizarEstagio(item, nextStage); }}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
              <Factory className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Nenhuma empresa monitorada ainda.</h2>
            <p className="mt-2 text-sm text-slate-600">
              A carteira {meta.title} está pronta para receber dados do João, mas ainda não há registros ativos para este segmento.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">Importar lista</button>
              <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Adicionar manualmente</button>
              <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Iniciar investigação</button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-900">Fluxo padrão da carteira</h2>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              "MONITORANDO",
              "SINAL_DETECTADO",
              "EM_INVESTIGACAO",
              "DECISOR_ENCONTRADO",
              "PRONTO_PARA_ABORDAR",
              "EM_CAMPANHA",
              "RESPONDEU",
              "INTERESSADO",
            ].map((stage, index) => (
              <div key={stage} className="flex items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-700">{stage}</span>
                {index < 7 && <span className="text-slate-300">→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
