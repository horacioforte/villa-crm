// ARQUIVO: app/comercial/concreteiras/page.tsx
// REGRA: nunca remover. Apenas acrescentar.
// CRM João — Concreteiras. Server Component.
// Fonte: DossieComercial com carteira CONCRETEIRAS (DossieCarteira).
// O estágio do Kanban é derivado do NivelLabel (mesma regra dos Kanbans de Dossiês):
//   A → Monitorando | B → Sinal detectado | C → Em abordagem | PRONTO → Interessada | OPORTUNIDADE → Oportunidade criada
// Somente leitura: esta página não altera dossiês, carteiras, scores nem estados.
// Criado em 01/10/2026.

import { prisma } from "@/lib/prisma";
import { calcularNivelInvestigacao, type NivelLabel } from "@/lib/inteligencia/maturidade";
import { ConcreteirasView, type ConcreteiraParaView, type DecisorResumo } from "./ConcreteirasView";

export const dynamic = "force-dynamic";

type DecisorRaw = {
  nome: string;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  linkedin: string | null;
  confianca: number;
};

// Decisor principal: prioriza quem tem telefone, depois maior confiança.
function escolherDecisorPrincipal(decisores: DecisorRaw[]): DecisorResumo | null {
  if (decisores.length === 0) return null;
  const ordenados = [...decisores].sort((a, b) => {
    const telA = a.telefone?.trim() ? 1 : 0;
    const telB = b.telefone?.trim() ? 1 : 0;
    if (telA !== telB) return telB - telA;
    return b.confianca - a.confianca;
  });
  const d = ordenados[0];
  return { nome: d.nome, cargo: d.cargo, telefone: d.telefone };
}

export default async function ConcreteirasPage() {
  const dossiesRaw = await prisma.dossieComercial.findMany({
    where: {
      carteiras: { some: { carteira: "CONCRETEIRAS" } },
      status: { notIn: ["ARQUIVADO"] },
    },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: 500,
    include: {
      carteiras: {
        where: { carteira: "CONCRETEIRAS" },
        select: {
          status: true,
          principalSinal: true,
          ultimaAtualizacao: true,
          emCampanha: true,
          interessado: true,
        },
      },
      decisores: {
        where: { ativo: true },
        select: { nome: true, cargo: true, telefone: true, email: true, linkedin: true, confianca: true },
      },
    },
  });

  const concreteiras: ConcreteiraParaView[] = dossiesRaw.map(d => {
    const carteira = d.carteiras[0];

    let nivel: NivelLabel;
    if (d.status === "ASSUMIDO" || d.oportunidadeId) {
      nivel = "OPORTUNIDADE";
    } else {
      nivel = calcularNivelInvestigacao(
        {
          clienteFinal:          d.clienteFinal,
          construtora:           d.construtora,
          epc:                   d.epc,
          epcm:                  d.epcm,
          faseObra:              d.faseObra,
          cronograma:            d.cronograma,
          licenciamento:         d.licenciamento,
          valorEstimado:         d.valorEstimado?.toString() ?? null,
          volumeConcreto:        d.volumeConcreto?.toString() ?? null,
          equipamentosSugeridos: d.equipamentosSugeridos,
          potencialVilla:        d.potencialVilla,
          momentoVilla:          d.momentoVilla,
          prontidao:             d.prontidao,
          completude:            d.completude,
          totalDecisores:        d.decisores.length,
          score:                 d.score,
          cidade:                d.cidade,
          estado:                d.estado,
        },
        d.decisores,
      ).nivel;
    }

    const atualizadoEm = carteira?.ultimaAtualizacao ?? d.ultimaAtividade ?? d.updatedAt;

    return {
      id:              d.id,
      nome:            d.titulo,
      cidade:          d.cidade,
      estado:          d.estado,
      score:           d.score,
      completude:      d.completude ?? 0,
      prontidao:       d.prontidao,
      nivel,
      atualizadoEm:    atualizadoEm.toISOString(),
      principalSinal:  carteira?.principalSinal ?? null,
      emCampanha:      carteira?.emCampanha ?? false,
      etapaCarteira:   carteira?.status ?? "MONITORANDO",
      decisor:         escolherDecisorPrincipal(d.decisores),
    };
  });

  // KPIs
  const total      = concreteiras.length;
  const comSinal   = concreteiras.filter(c => Boolean(c.principalSinal?.trim()) || c.nivel !== "A").length;
  const prontas    = concreteiras.filter(c => c.nivel === "PRONTO" || c.etapaCarteira === "PRONTO_PARA_ABORDAR").length;
  const emCampanha = concreteiras.filter(c => c.emCampanha || c.etapaCarteira === "EM_CAMPANHA").length;
  const convertidas = concreteiras.filter(c => c.nivel === "OPORTUNIDADE").length;

  const kpis = [
    { label: "Total monitoradas",            valor: total,       cor: "text-slate-800",   bg: "bg-slate-50 border-slate-100" },
    { label: "Com sinal",                    valor: comSinal,    cor: "text-amber-700",   bg: "bg-amber-50 border-amber-100" },
    { label: "Prontas para abordagem",       valor: prontas,     cor: "text-violet-700",  bg: "bg-violet-50 border-violet-100" },
    { label: "Em campanha",                  valor: emCampanha,  cor: "text-emerald-700", bg: "bg-emerald-50 border-emerald-100" },
    { label: "Convertidas em oportunidade",  valor: convertidas, cor: "text-indigo-700",  bg: "bg-indigo-50 border-indigo-100" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 bg-white border-b border-slate-100 px-6 py-4">
        <div>
          <h1 className="text-base font-semibold text-slate-800">CRM João — Concreteiras</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Concreteiras monitoradas pelo João, do primeiro sinal até a oportunidade no pipeline
          </p>
        </div>

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          {kpis.map(k => (
            <div key={k.label} className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${k.bg}`}>
              <span className={`text-lg font-semibold ${k.cor}`}>{k.valor}</span>
              <span className="text-xs text-slate-500">{k.label}</span>
            </div>
          ))}
        </div>
      </div>

      <ConcreteirasView concreteiras={concreteiras} />
    </div>
  );
}
