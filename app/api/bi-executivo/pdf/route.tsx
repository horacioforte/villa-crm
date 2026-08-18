import {
  Document,
  Page,
  StyleSheet,
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
} from "@/lib/metrics/comercial";
import { gerarAnaliseExecutiva } from "@/lib/bi-executivo/analise";
import { resolvePeriodo, resolveTipo } from "@/lib/bi-executivo/periodo";

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: "Helvetica", color: "#1A2E5A" },
  header: {
    borderBottom: "2 solid #1A2E5A",
    marginBottom: 12,
    paddingBottom: 8,
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: { fontSize: 16, fontWeight: 700 },
  subtitle: { color: "#667085", fontSize: 8, marginTop: 3 },
  metaRight: { textAlign: "right", fontSize: 7, color: "#667085" },
  kpiRow: { display: "flex", flexDirection: "row", gap: 8, marginTop: 4 },
  kpiCard: {
    backgroundColor: "#F4F6FA",
    borderRadius: 8,
    padding: 8,
    flexGrow: 1,
  },
  kpiLabel: { color: "#667085", fontSize: 7 },
  kpiValue: { color: "#1A2E5A", fontSize: 14, fontWeight: 700, marginTop: 3 },
  kpiSub: { color: "#667085", fontSize: 6, marginTop: 1 },
  section: { marginTop: 12 },
  sectionTitle: { color: "#1A2E5A", fontSize: 10, fontWeight: 700, marginBottom: 5 },
  row: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottom: "1 solid #D7DEEA",
    paddingVertical: 3,
  },
  cell: { fontSize: 8, color: "#202938" },
  listItem: {
    backgroundColor: "#FFFBEB",
    borderRadius: 6,
    padding: 6,
    marginBottom: 4,
  },
  listItemTitle: { fontSize: 8, fontWeight: 700, color: "#1A2E5A" },
  listItemSub: { fontSize: 6.5, color: "#667085", marginTop: 2 },
  analiseBox: { backgroundColor: "#E8EEFB", borderRadius: 8, padding: 10, marginTop: 4 },
  analiseText: { fontSize: 8, color: "#1A2E5A" },
  footer: { color: "#98A2B3", fontSize: 6.5, marginTop: 16, textAlign: "center" },
});

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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
};

const estagioLabels: Record<string, string> = {
  PROPOSTA_ENVIADA: "Proposta enviada",
  NEGOCIACAO: "Negociação",
};

function RelatorioBiExecutivo({ dados }: { dados: RelatorioProps }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Villa Empreendimentos — Visão Executiva Comercial</Text>
            <Text style={styles.subtitle}>{dados.periodoLabel}</Text>
          </View>
          <Text style={styles.metaRight}>Gerado em {dados.geradoEm}</Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>PIPELINE POTENCIAL</Text>
            <Text style={styles.kpiValue}>{formatCurrency(dados.potencial.total)}</Text>
            <Text style={styles.kpiSub}>{dados.potencial.quantidade} oportunidades abertas</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>PIPELINE PROPOSTO</Text>
            <Text style={styles.kpiValue}>{formatCurrency(dados.proposto.total)}</Text>
            <Text style={styles.kpiSub}>{dados.proposto.quantidade} propostas vigentes</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>CONTRATADO NO PERÍODO</Text>
            <Text style={styles.kpiValue}>{formatCurrency(dados.ganhas.valor)}</Text>
            <Text style={styles.kpiSub}>{dados.ganhas.quantidade} contratos</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>PERDIDO NO PERÍODO</Text>
            <Text style={styles.kpiValue}>{formatCurrency(dados.perdidas.valor)}</Text>
            <Text style={styles.kpiSub}>{dados.perdidas.quantidade} negócios</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TAXA DE CONVERSÃO</Text>
            <Text style={styles.kpiValue}>{Math.round(dados.taxaConversao * 100)}%</Text>
            <Text style={styles.kpiSub}>ganhas / (ganhas + perdidas) no período</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={{ ...styles.section, flexGrow: 1 }}>
            <Text style={styles.sectionTitle}>Funil Comercial</Text>
            <View style={styles.row}>
              <Text style={styles.cell}>Abertas</Text>
              <Text style={styles.cell}>{dados.funil.abertas}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cell}>Com proposta</Text>
              <Text style={styles.cell}>{dados.funil.comProposta}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cell}>Em negociação</Text>
              <Text style={styles.cell}>{dados.funil.emNegociacao}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.cell}>Ganhas no período</Text>
              <Text style={styles.cell}>{dados.funil.ganhasNoPeriodo}</Text>
            </View>
          </View>

          <View style={{ ...styles.section, flexGrow: 1 }}>
            <Text style={styles.sectionTitle}>Pipeline por Estágio</Text>
            {dados.porEstagio.porEstagio.map((item) => (
              <View style={styles.row} key={item.estagio}>
                <Text style={styles.cell}>{estagioLabels[item.estagio] ?? item.estagio}</Text>
                <Text style={styles.cell}>{formatCurrency(item.valor)}</Text>
                <Text style={styles.cell}>{Math.round(item.percentual * 100)}%</Text>
              </View>
            ))}
            <View style={styles.row}>
              <Text style={styles.cell}>Ticket médio</Text>
              <Text style={styles.cell}>{formatCurrency(dados.porEstagio.ticketMedio)}</Text>
              <Text style={styles.cell} />
            </View>
          </View>

          <View style={{ ...styles.section, flexGrow: 1 }}>
            <Text style={styles.sectionTitle}>⭐ Estratégicas sem Proposta</Text>
            {dados.estrategicas.length === 0 ? (
              <Text style={styles.cell}>Nenhuma no momento.</Text>
            ) : (
              dados.estrategicas.slice(0, 5).map((op, index) => (
                <View style={styles.listItem} key={index}>
                  <Text style={styles.listItemTitle}>
                    {op.empresa.nomeFantasia ?? op.empresa.razaoSocial}
                  </Text>
                  <Text style={styles.listItemSub}>
                    {op.titulo} · {op.responsavel?.nome ?? "Sem responsável"}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✨ CRM IA — Análise Executiva</Text>
          <View style={styles.analiseBox}>
            {dados.analise ? (
              <>
                <Text style={styles.analiseText}>{dados.analise.analise}</Text>
                {dados.analise.alertas.length > 0 ? (
                  <Text style={{ ...styles.analiseText, marginTop: 6, fontWeight: 700 }}>
                    Alertas: {dados.analise.alertas.join(" · ")}
                  </Text>
                ) : null}
                {dados.analise.prioridades.length > 0 ? (
                  <Text style={{ ...styles.analiseText, marginTop: 4, fontWeight: 700 }}>
                    Prioridades: {dados.analise.prioridades.join(" · ")}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.analiseText}>Análise da IA indisponível no momento.</Text>
            )}
          </View>
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

  const [potencial, proposto, funil, porEstagio, ganhosPerdas, estrategicas] = await Promise.all([
    getPipelinePotencial(filtrosEstoque),
    getPipelineProposto(filtrosEstoque),
    getFunilComercial(filtrosPeriodo),
    getPipelinePorEstagio(filtrosEstoque),
    getGanhosPerdas(filtrosPeriodo),
    getOportunidadesEstrategicasSemProposta(filtrosEstoque),
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
