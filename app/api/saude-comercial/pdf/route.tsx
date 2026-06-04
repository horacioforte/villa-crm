import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import { PapelUsuario } from "@/app/generated/prisma/client";
import { requirePermission } from "@/lib/auth/session";

type SaudeComercialPdfData = {
  indicadores: {
    oportunidadesAbertas: number;
    oportunidadesSemProximaAcao: number;
    tarefasVencidas: number;
    propostasAguardandoRetorno: number;
    cumprimentoCadencia: number;
    oportunidadesDentroCadencia: number;
    oportunidadesForaCadencia: number;
    taxaConclusaoTarefas: number;
    saudeGeral: { score: number; label: string };
  };
  listas: {
    oportunidadesSemResponsavel: Array<{
      titulo: string;
      cliente: string;
      obra: string | null;
    }>;
    oportunidadesSemProximaAcao: Array<{
      titulo: string;
      cliente: string;
      obra: string | null;
      responsavel: string;
      motivo: string;
    }>;
    propostasAguardandoRetorno: Array<{
      numeroProposta: string;
      cliente: string;
      obra: string | null;
      valor: number;
      responsavel: string;
      diasSemContato: number;
    }>;
    diasSemInteracao: Array<{
      titulo: string;
      cliente: string;
      responsavel: string;
      dias: number;
      cor: string;
      ultimaInteracao: string;
    }>;
    tarefasPorUsuario: Array<{
      nome: string;
      criadas: number;
      concluidas: number;
      taxa: number;
    }>;
  };
};

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "Helvetica",
    color: "#1A2E5A",
  },
  header: {
    borderBottom: "2 solid #1A2E5A",
    marginBottom: 14,
    paddingBottom: 10,
  },
  title: { fontSize: 16, fontWeight: 700 },
  subtitle: { color: "#667085", fontSize: 8, marginTop: 4 },
  section: { marginTop: 14 },
  sectionTitle: {
    color: "#1A2E5A",
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
  },
  grid: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  card: {
    backgroundColor: "#F4F6FA",
    borderRadius: 8,
    padding: 8,
    width: "31%",
  },
  label: { color: "#667085", fontSize: 7 },
  value: { color: "#1A2E5A", fontSize: 13, fontWeight: 700, marginTop: 3 },
  row: {
    borderBottom: "1 solid #D7DEEA",
    display: "flex",
    flexDirection: "row",
    gap: 6,
    paddingVertical: 4,
  },
  cell: { color: "#202938", fontSize: 7, flexGrow: 1, width: "20%" },
  headerCell: {
    color: "#1A2E5A",
    fontSize: 7,
    fontWeight: 700,
    flexGrow: 1,
    width: "20%",
  },
  footer: {
    color: "#667085",
    fontSize: 7,
    marginTop: 16,
    textAlign: "center",
  },
});

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <View>
      <View style={styles.row}>
        {headers.map((header) => (
          <Text key={header} style={styles.headerCell}>
            {header}
          </Text>
        ))}
      </View>
      {rows.slice(0, 12).map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((cell, cellIndex) => (
            <Text key={cellIndex} style={styles.cell}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function HealthReportDocument({
  data,
  periodo,
}: {
  data: SaudeComercialPdfData;
  periodo: string;
}) {
  const criticas = data.listas.diasSemInteracao.filter(
    (item) => item.cor === "vermelho",
  );
  const ranking = [...data.listas.tarefasPorUsuario].sort((a, b) => b.taxa - a.taxa);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>RELATÓRIO DE SAÚDE COMERCIAL</Text>
          <Text style={styles.subtitle}>Villa Empreendimentos</Text>
          <Text style={styles.subtitle}>
            Período: {periodo} · Gerado em {formatDate(new Date())}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Resumo Executivo</Text>
          <View style={styles.grid}>
            <View style={styles.card}>
              <Text style={styles.label}>Saúde geral</Text>
              <Text style={styles.value}>
                {data.indicadores.saudeGeral.label} ({data.indicadores.saudeGeral.score})
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Oportunidades abertas</Text>
              <Text style={styles.value}>{data.indicadores.oportunidadesAbertas}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Sem próxima ação</Text>
              <Text style={styles.value}>
                {data.indicadores.oportunidadesSemProximaAcao}
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Tarefas vencidas</Text>
              <Text style={styles.value}>{data.indicadores.tarefasVencidas}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Propostas sem retorno</Text>
              <Text style={styles.value}>
                {data.indicadores.propostasAguardandoRetorno}
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.label}>Cadência / conclusão</Text>
              <Text style={styles.value}>
                {data.indicadores.cumprimentoCadencia}% /{" "}
                {data.indicadores.taxaConclusaoTarefas}%
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Alertas Críticos</Text>
          <Table
            headers={["Tipo", "Cliente", "Obra", "Responsável", "Alerta"]}
            rows={[
              ...data.listas.oportunidadesSemResponsavel.map((item) => [
                "Sem responsável",
                item.cliente,
                item.obra ?? "-",
                "-",
                item.titulo,
              ]),
              ...data.listas.oportunidadesSemProximaAcao.map((item) => [
                "Sem próxima ação",
                item.cliente,
                item.obra ?? "-",
                item.responsavel,
                item.motivo,
              ]),
              ...data.listas.propostasAguardandoRetorno.map((item) => [
                "Proposta sem retorno",
                item.cliente,
                item.obra ?? "-",
                item.responsavel,
                `${item.diasSemContato} dias · ${formatCurrency(item.valor)}`,
              ]),
            ]}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Ranking da Equipe</Text>
          <Table
            headers={["Usuário", "Tarefas criadas", "Concluídas", "% Conclusão"]}
            rows={ranking.map((item) => [
              item.nome,
              item.criadas,
              item.concluidas,
              `${item.taxa}%`,
            ])}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Oportunidades Críticas</Text>
          <Table
            headers={["Cliente", "Oportunidade", "Responsável", "Última interação", "Dias"]}
            rows={criticas.map((item) => [
              item.cliente,
              item.titulo,
              item.responsavel,
              formatDate(item.ultimaInteracao),
              item.dias,
            ])}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Cadência Comercial</Text>
          <Table
            headers={["Indicador", "Valor"]}
            rows={[
              ["Cumprimento", `${data.indicadores.cumprimentoCadencia}%`],
              ["Dentro da cadência", data.indicadores.oportunidadesDentroCadencia],
              ["Fora da cadência", data.indicadores.oportunidadesForaCadencia],
            ]}
          />
        </View>

        <Text style={styles.footer}>Villa CRM · Saúde Comercial</Text>
      </Page>
    </Document>
  );
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const authResult =
    cronSecret && authHeader === `Bearer ${cronSecret}`
      ? { id: "cron", papel: PapelUsuario.ADMIN }
      : await requirePermission("relatorios", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const url = new URL(request.url);
  const dataUrl = new URL("/api/saude-comercial", url.origin);
  dataUrl.search = url.search;

  const response = await fetch(dataUrl, {
    headers: {
      authorization: authHeader ?? "",
      cookie: request.headers.get("cookie") ?? "",
    },
  });

  if (!response.ok) {
    return NextResponse.json(
      { message: "Não foi possível gerar o relatório." },
      { status: response.status },
    );
  }

  const data = (await response.json()) as SaudeComercialPdfData;
  const buffer = await renderToBuffer(
    <HealthReportDocument
      data={data}
      periodo={url.searchParams.get("periodo") ?? "30d"}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-saude-comercial-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf"`,
    },
  });
}
