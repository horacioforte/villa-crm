import {
  Circle,
  Document,
  G,
  Line as SvgLine,
  Page,
  Polyline,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/session";
import {
  getPipelinePotencial,
  getPipelineProposto,
  getFunilComercial,
  getPipelinePorEstagio,
  getGanhosPerdas,
  getOportunidadesEstrategicasSemProposta,
  getEvolucaoOportunidadesAbertas,
  getEvolucaoResultadoComercial,
} from "@/lib/metrics/comercial";
import { gerarAnaliseExecutiva } from "@/lib/bi-executivo/analise";
import { resolvePeriodo, resolveTipo } from "@/lib/bi-executivo/periodo";

// ── Estilos — board report A4 paisagem, grade 3×2, 1 página ────────────────
const styles = StyleSheet.create({
  page: { padding: 22, fontFamily: "Helvetica", color: "#1A2E5A" },
  header: {
    borderBottom: "1.5 solid #1A2E5A",
    marginBottom: 8,
    paddingBottom: 6,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  brand: { fontSize: 8, fontWeight: 700, color: "#1E4FAB", letterSpacing: 1 },
  title: { fontSize: 15, fontWeight: 700, marginTop: 1 },
  subtitle: { color: "#667085", fontSize: 7.5, marginTop: 2 },
  metaRight: { textAlign: "right", fontSize: 6.5, color: "#98A2B3" },

  grid: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  quad: {
    width: "32.6%",
    height: 158,
    borderRadius: 8,
    border: "1 solid #D7DEEA",
    padding: 8,
    marginBottom: 6,
  },
  quadTitle: { fontSize: 7, fontWeight: 700, color: "#667085", textTransform: "uppercase", letterSpacing: 0.4 },
  bigNumber: { fontSize: 20, fontWeight: 700, color: "#1A2E5A", marginTop: 3 },
  microDelta: { fontSize: 7.5, fontWeight: 700, color: "#475569", marginTop: 1 },
  microSub: { fontSize: 6.5, color: "#98A2B3", marginTop: 1 },

  barLabel: { fontSize: 6.5, color: "#475569", width: 52 },
  barTrack: { flexGrow: 1, height: 5, borderRadius: 3, backgroundColor: "#EEF1F7" },
  barFill: { height: 5, borderRadius: 3, backgroundColor: "#1E4FAB" },
  barValue: { fontSize: 7, fontWeight: 700, color: "#1A2E5A", width: 16, textAlign: "right" },

  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", textAlign: "center", gap: 2 },
  emptyTitle: { fontSize: 8, fontWeight: 700, color: "#475569" },
  emptySub: { fontSize: 6.5, color: "#98A2B3", marginTop: 1, textAlign: "center" },
  emptyContext: {
    backgroundColor: "#EFF4FF", color: "#1849A9", fontSize: 6.5, borderRadius: 5,
    paddingVertical: 3, paddingHorizontal: 6, marginTop: 4, textAlign: "center",
  },

  kpiPair: { display: "flex", flexDirection: "row", gap: 5, marginTop: 3 },
  kpiChip: { flex: 1, borderRadius: 6, padding: 5 },
  kpiChipLabel: { fontSize: 6, fontWeight: 700, textTransform: "uppercase" },
  kpiChipValue: { fontSize: 13, fontWeight: 700, marginTop: 2 },
  kpiChipSub: { fontSize: 6, marginTop: 1 },

  listRow: { display: "flex", flexDirection: "row", gap: 4, marginTop: 3 },
  listIndex: { fontSize: 6.5, fontWeight: 700, color: "#B54708", width: 12 },
  listTitle: { fontSize: 7, fontWeight: 700, color: "#1A2E5A" },
  listSub: { fontSize: 6, color: "#98A2B3", marginTop: 0.5 },

  iaStrip: { borderRadius: 8, border: "1 solid #D7DEEA", padding: 8, marginTop: 2 },
  iaTitle: { fontSize: 7, fontWeight: 700, color: "#1E4FAB", textTransform: "uppercase", letterSpacing: 0.4 },
  iaRow: { display: "flex", flexDirection: "row", gap: 12, marginTop: 5 },
  iaText: { fontSize: 7.5, color: "#1A2E5A", lineHeight: 1.35, flex: 1.4 },
  iaColLabel: { fontSize: 6, fontWeight: 700, textTransform: "uppercase" },
  iaColItem: { fontSize: 7, color: "#475569", marginTop: 2 },

  footer: { color: "#B9C4D6", fontSize: 6, marginTop: 6, textAlign: "center" },
});

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
function formatCurrencyCompact(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }).format(
    value,
  );
}

const estagioLabels: Record<string, string> = {
  PROPOSTA_ENVIADA: "Proposta enviada",
  NEGOCIACAO: "Negociação",
};

// ── Mini gráfico de linha (SVG simples, sem eixo) ───────────────────────────
function MiniLineChart({ pontos, width = 150, height = 46 }: { pontos: number[]; width?: number; height?: number }) {
  if (pontos.length < 2) return null;
  const min = Math.min(...pontos);
  const max = Math.max(...pontos);
  const range = max - min || 1;
  const stepX = width / (pontos.length - 1);
  const coords = pontos.map((valor, index) => {
    const x = index * stepX;
    const y = height - ((valor - min) / range) * (height - 8) - 4;
    return { x, y };
  });
  const pontosStr = coords.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <Svg width={width} height={height}>
      <Polyline points={pontosStr} fill="none" stroke="#1E4FAB" strokeWidth={2} />
      {coords.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={2} fill="#1E4FAB" />
      ))}
    </Svg>
  );
}

// ── Mini gráfico de colunas pareadas (contratado × perdido) ─────────────────
function MiniColumnChart({
  dados,
  width = 150,
  height = 46,
}: {
  dados: Array<{ contratado: number; perdido: number }>;
  width?: number;
  height?: number;
}) {
  if (dados.length === 0) return null;
  const max = Math.max(...dados.map((d) => Math.max(d.contratado, d.perdido)), 1);
  const grupoWidth = width / dados.length;
  const barWidth = Math.min(10, grupoWidth / 2.6);

  return (
    <Svg width={width} height={height}>
      {dados.map((d, i) => {
        const cx = i * grupoWidth + grupoWidth / 2;
        const hContratado = (d.contratado / max) * (height - 6);
        const hPerdido = (d.perdido / max) * (height - 6);
        return (
          <G key={i}>
            <Rect
              x={cx - barWidth - 1}
              y={height - hContratado}
              width={barWidth}
              height={hContratado}
              fill="#10B981"
              rx={1.5}
            />
            <Rect x={cx + 1} y={height - hPerdido} width={barWidth} height={hPerdido} fill="#EF4444" rx={1.5} />
          </G>
        );
      })}
      <SvgLine x1={0} y1={height} x2={width} y2={height} stroke="#D7DEEA" strokeWidth={1} />
    </Svg>
  );
}

type RelatorioProps = {
  periodoLabel: string;
  geradoEm: string;
  potencial: { total: number; quantidade: number };
  proposto: { total: number; quantidade: number };
  funil: {
    abertas: number;
    comProposta: number;
    emNegociacao: number;
    ganhasNoPeriodo: number;
  };
  porEstagio: {
    porEstagio: Array<{ estagio: string; quantidade: number; valor: number; percentual: number }>;
    ticketMedio: number;
    quantidadeComProposta: number;
  };
  ganhas: { quantidade: number; valor: number };
  perdidas: { quantidade: number; valor: number };
  taxaConversao: number;
  estrategicas: Array<{
    titulo: string;
    empresa: { razaoSocial: string; nomeFantasia: string | null };
    responsavel: { nome: string } | null;
  }>;
  analise: { analise: string; alertas: string[]; prioridades: string[] } | null;
  evolucaoAbertas: Array<{ mes: string; quantidade: number }>;
  evolucaoResultado: Array<{ mes: string; contratado: number; perdido: number }>;
};

function RelatorioBiExecutivo({ dados }: { dados: RelatorioProps }) {
  const abertasAnterior =
    dados.evolucaoAbertas.length >= 2 ? dados.evolucaoAbertas[dados.evolucaoAbertas.length - 2] : null;
  const abertasAtual =
    dados.evolucaoAbertas.length >= 2 ? dados.evolucaoAbertas[dados.evolucaoAbertas.length - 1] : null;
  const deltaAbertas =
    abertasAnterior && abertasAtual ? abertasAtual.quantidade - abertasAnterior.quantidade : null;

  const semProposta = dados.proposto.total === 0;
  const semPorEstagio = dados.porEstagio.quantidadeComProposta === 0;
  const maxFunil = Math.max(dados.funil.abertas, 1);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Cabeçalho */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>VILLA CRM</Text>
            <Text style={styles.title}>BI Executivo Comercial</Text>
            <Text style={styles.subtitle}>{dados.periodoLabel}</Text>
          </View>
          <Text style={styles.metaRight}>Gerado em {dados.geradoEm}</Text>
        </View>

        {/* Grade 3×2 */}
        <View style={styles.grid}>
          {/* 1. Oportunidades Abertas */}
          <View style={styles.quad}>
            <Text style={styles.quadTitle}>Oportunidades Abertas</Text>
            <Text style={styles.bigNumber}>{dados.funil.abertas}</Text>
            {deltaAbertas !== null ? (
              <Text style={styles.microDelta}>
                {deltaAbertas >= 0 ? "+" : ""}
                {deltaAbertas} vs. mês anterior
              </Text>
            ) : null}
            <View style={{ marginTop: 6, alignItems: "center" }}>
              <MiniLineChart pontos={dados.evolucaoAbertas.map((p) => p.quantidade)} />
            </View>
          </View>

          {/* 2. Funil Comercial — Pipeline Atual separado de Resultado do Período */}
          <View style={styles.quad}>
            <Text style={styles.quadTitle}>Funil Comercial</Text>
            <Text style={{ fontSize: 6, fontWeight: 700, color: "#98A2B3", marginTop: 4, textTransform: "uppercase" }}>
              Pipeline atual
            </Text>
            {[
              { label: "Abertas", valor: dados.funil.abertas },
              { label: "Com proposta", valor: dados.funil.comProposta },
              { label: "Negociação", valor: dados.funil.emNegociacao },
            ].map((etapa) => (
              <View key={etapa.label} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                <Text style={styles.barLabel}>{etapa.label}</Text>
                <View style={styles.barTrack}>
                  <View style={{ ...styles.barFill, width: `${Math.min(100, (etapa.valor / maxFunil) * 100)}%` }} />
                </View>
                <Text style={styles.barValue}>{etapa.valor}</Text>
              </View>
            ))}
            <View style={{ borderTop: "1 solid #D7DEEA", marginTop: 5, paddingTop: 4 }}>
              <Text style={{ fontSize: 6, fontWeight: 700, color: "#98A2B3", textTransform: "uppercase" }}>
                Resultado do período
              </Text>
              <View
                style={{
                  display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                  backgroundColor: "#ECFDF3", borderRadius: 5, padding: 4, marginTop: 3,
                }}
              >
                <Text style={{ fontSize: 7, fontWeight: 700, color: "#027A48" }}>Ganhas no período</Text>
                <Text style={{ fontSize: 11, fontWeight: 700, color: "#027A48" }}>{dados.funil.ganhasNoPeriodo}</Text>
              </View>
            </View>
          </View>

          {/* 3. Pipeline Proposto */}
          <View style={styles.quad}>
            <Text style={styles.quadTitle}>Pipeline Proposto</Text>
            {semProposta ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Nenhuma proposta vigente</Text>
                <Text style={styles.emptySub}>0 propostas abertas</Text>
                {dados.potencial.quantidade > 0 ? (
                  <Text style={styles.emptyContext}>
                    {dados.potencial.quantidade} oportunidade{dados.potencial.quantidade === 1 ? "" : "s"} com
                    potencial ainda sem proposta
                  </Text>
                ) : null}
              </View>
            ) : (
              <View style={{ flex: 1, justifyContent: "center" }}>
                <Text style={styles.bigNumber}>{formatCurrency(dados.proposto.total)}</Text>
                <Text style={styles.microSub}>
                  {dados.proposto.quantidade} proposta{dados.proposto.quantidade === 1 ? "" : "s"} vigente
                  {dados.proposto.quantidade === 1 ? "" : "s"}
                </Text>
              </View>
            )}
          </View>

          {/* 4. Pipeline por Estágio */}
          <View style={styles.quad}>
            <Text style={styles.quadTitle}>Pipeline por Estágio</Text>
            {semPorEstagio ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Ainda não há propostas vigentes</Text>
                <Text style={styles.emptySub}>Aparece quando propostas entrarem no pipeline</Text>
              </View>
            ) : (
              <View style={{ marginTop: 6 }}>
                {dados.porEstagio.porEstagio.map((item) => (
                  <View key={item.estagio} style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Text style={styles.barLabel}>{estagioLabels[item.estagio] ?? item.estagio}</Text>
                    <View style={styles.barTrack}>
                      <View style={{ ...styles.barFill, width: `${Math.round(item.percentual * 100)}%` }} />
                    </View>
                    <Text style={{ fontSize: 6.5, color: "#1A2E5A", width: 44, textAlign: "right" }}>
                      {formatCurrencyCompact(item.valor)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <View
              style={{
                display: "flex", flexDirection: "row", justifyContent: "space-between",
                backgroundColor: "#F4F6FA", borderRadius: 5, padding: 4, marginTop: 6,
              }}
            >
              <Text style={{ fontSize: 6.5, color: "#667085" }}>{dados.porEstagio.quantidadeComProposta} propostas</Text>
              <Text style={{ fontSize: 6.5, fontWeight: 700, color: "#1A2E5A" }}>
                Ticket médio {formatCurrencyCompact(dados.porEstagio.ticketMedio)}
              </Text>
            </View>
          </View>

          {/* 5. Resultado Comercial */}
          <View style={styles.quad}>
            <Text style={styles.quadTitle}>Resultado Comercial</Text>
            <View style={styles.kpiPair}>
              <View style={{ ...styles.kpiChip, backgroundColor: "#ECFDF3" }}>
                <Text style={{ ...styles.kpiChipLabel, color: "#027A48" }}>Contratado</Text>
                <Text style={{ ...styles.kpiChipValue, color: "#027A48" }}>{formatCurrencyCompact(dados.ganhas.valor)}</Text>
                <Text style={{ ...styles.kpiChipSub, color: "#027A48" }}>{dados.ganhas.quantidade} contratos</Text>
              </View>
              <View style={{ ...styles.kpiChip, backgroundColor: "#FEF3F2" }}>
                <Text style={{ ...styles.kpiChipLabel, color: "#B42318" }}>Perdido</Text>
                <Text style={{ ...styles.kpiChipValue, color: "#B42318" }}>{formatCurrencyCompact(dados.perdidas.valor)}</Text>
                <Text style={{ ...styles.kpiChipSub, color: "#B42318" }}>{dados.perdidas.quantidade} negócios</Text>
              </View>
            </View>
            <View style={{ marginTop: 5, alignItems: "center" }}>
              <MiniColumnChart dados={dados.evolucaoResultado} />
            </View>
            <Text style={styles.microSub}>Conversão {Math.round(dados.taxaConversao * 100)}% no período</Text>
          </View>

          {/* 6. Estratégicas sem Proposta */}
          <View style={styles.quad}>
            <Text style={styles.quadTitle}>Estratégicas sem Proposta</Text>
            {dados.estrategicas.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Nenhuma marcada</Text>
                <Text style={styles.emptySub}>Marcação manual disponível na tela de cada oportunidade</Text>
              </View>
            ) : (
              dados.estrategicas.slice(0, 5).map((op, index) => (
                <View key={index} style={styles.listRow}>
                  <Text style={styles.listIndex}>{String(index + 1).padStart(2, "0")}</Text>
                  <View>
                    <Text style={styles.listTitle}>{op.empresa.nomeFantasia ?? op.empresa.razaoSocial}</Text>
                    <Text style={styles.listSub}>
                      {op.titulo} · {op.responsavel?.nome ?? "Sem responsável"}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* CRM IA — faixa de rodapé */}
        <View style={styles.iaStrip}>
          <Text style={styles.iaTitle}>CRM IA — Leitura Executiva</Text>
          {dados.analise ? (
            <View style={styles.iaRow}>
              <Text style={styles.iaText}>{dados.analise.analise}</Text>
              {dados.analise.alertas.length > 0 ? (
                <View style={{ flex: 1 }}>
                  <Text style={{ ...styles.iaColLabel, color: "#B54708" }}>Alertas</Text>
                  {dados.analise.alertas.slice(0, 3).map((a, i) => (
                    <Text key={i} style={styles.iaColItem}>• {a}</Text>
                  ))}
                </View>
              ) : null}
              {dados.analise.prioridades.length > 0 ? (
                <View style={{ flex: 1 }}>
                  <Text style={{ ...styles.iaColLabel, color: "#1E4FAB" }}>Prioridades</Text>
                  {dados.analise.prioridades.slice(0, 3).map((p, i) => (
                    <Text key={i} style={styles.iaColItem}>
                      {i + 1}. {p}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={{ ...styles.iaText, marginTop: 5 }}>Análise da IA indisponível no momento.</Text>
          )}
        </View>

        <Text style={styles.footer}>Villa CRM · BI Executivo · villaempreendimentos.com.br</Text>
      </Page>
    </Document>
  );
}

export async function GET(request: Request) {
  const authResult = await requirePermission("bi_executivo", "read", request);
  if (authResult instanceof NextResponse) return authResult;

  const url = new URL(request.url);
  const { inicio, fim, label } = resolvePeriodo({
    periodo: url.searchParams.get("periodo") ?? undefined,
    dataInicio: url.searchParams.get("dataInicio") ?? undefined,
    dataFim: url.searchParams.get("dataFim") ?? undefined,
  });
  const tipo = resolveTipo(url.searchParams.get("tipo") ?? undefined);

  const filtrosEstoque = { user: authResult, tipo };
  const filtrosPeriodo = { user: authResult, tipo, dataInicio: inicio, dataFim: fim };

  const [potencial, proposto, funil, porEstagio, ganhosPerdas, estrategicas, evolucaoAbertas, evolucaoResultado] =
    await Promise.all([
      getPipelinePotencial(filtrosEstoque),
      getPipelineProposto(filtrosEstoque),
      getFunilComercial(filtrosPeriodo),
      getPipelinePorEstagio(filtrosEstoque),
      getGanhosPerdas(filtrosPeriodo),
      getOportunidadesEstrategicasSemProposta(filtrosEstoque),
      getEvolucaoOportunidadesAbertas(filtrosEstoque),
      getEvolucaoResultadoComercial(filtrosEstoque),
    ]);

  const analise = await gerarAnaliseExecutiva({
    periodoLabel: label,
    pipelinePotencial: potencial,
    pipelineProposto: proposto,
    pipelineContratadoPeriodo: ganhosPerdas.ganhas,
    perdidoPeriodo: ganhosPerdas.perdidas,
    funil,
    oportunidadesEstrategicasSemProposta: estrategicas.length,
  });

  const buffer = await renderToBuffer(
    <RelatorioBiExecutivo
      dados={{
        periodoLabel: label,
        geradoEm: new Date().toLocaleString("pt-BR"),
        potencial,
        proposto,
        funil,
        porEstagio,
        ganhas: ganhosPerdas.ganhas,
        perdidas: ganhosPerdas.perdidas,
        taxaConversao: ganhosPerdas.taxaConversao,
        estrategicas,
        analise,
        evolucaoAbertas,
        evolucaoResultado,
      }}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bi-executivo-villa-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
