import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import {
  buildPropostaVariaveis,
  type PropostaRenderData,
} from "@/lib/propostas/render";
import { getPropostaTemplate } from "@/lib/propostas/templates";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    color: "#172033",
  },
  hero: {
    marginBottom: 24,
    padding: 24,
    backgroundColor: "#1A2E5A",
    color: "#FFFFFF",
  },
  brand: {
    color: "#9CB7F2",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.6,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 11,
  },
  grid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 22,
  },
  card: {
    width: "48%",
    padding: 12,
    border: "1 solid #D7DEEA",
    borderRadius: 10,
    backgroundColor: "#F4F6FA",
  },
  label: {
    color: "#667085",
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  value: {
    color: "#1A2E5A",
    fontSize: 12,
    fontWeight: 700,
  },
  price: {
    color: "#1E4FAB",
    fontSize: 18,
    fontWeight: 700,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    color: "#1A2E5A",
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
  },
  paragraph: {
    color: "#475467",
    fontSize: 10,
    lineHeight: 1.6,
  },
  bullet: {
    color: "#475467",
    fontSize: 10,
    lineHeight: 1.5,
    marginBottom: 4,
  },
  blockMeta: {
    color: "#667085",
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.8,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 24,
    borderTop: "1 solid #D7DEEA",
    color: "#667085",
    fontSize: 8,
    paddingTop: 10,
  },
});

function PropostaPdfDocument({ data }: { data: PropostaRenderData }) {
  const template = getPropostaTemplate(data.templateUtilizado);
  const variaveis = buildPropostaVariaveis(data);
  const escopo = template?.escopo ?? [];

  return (
    <Document
      title={`${data.numeroProposta} v${data.versao}`}
      author="Villa Empreendimentos"
      language="pt-BR"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.brand}>Villa Empreendimentos</Text>
          <Text style={styles.title}>
            {template?.titulo ?? "Proposta comercial Villa"}
          </Text>
          <Text style={styles.subtitle}>
            Proposta {data.numeroProposta} - versao {data.versao}
          </Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.card}>
            <Text style={styles.label}>Cliente</Text>
            <Text style={styles.value}>{variaveis.cliente}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Obra</Text>
            <Text style={styles.value}>{variaveis.obra}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Tipo de servico</Text>
            <Text style={styles.value}>{variaveis.tipo_servico}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Valor total</Text>
            <Text style={styles.price}>{variaveis.valor}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Prazo de execucao</Text>
            <Text style={styles.value}>{variaveis.prazo}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Validade</Text>
            <Text style={styles.value}>{variaveis.validade}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo comercial</Text>
          <Text style={styles.paragraph}>
            {template?.descricao ?? "Proposta comercial Villa."}
          </Text>
        </View>

        {data.blocos?.length ? (
          data.blocos
            .slice()
            .sort((left, right) => left.ordem - right.ordem)
            .map((bloco) => (
              <View key={`${bloco.ordem}-${bloco.titulo}`} style={styles.section}>
                <Text style={styles.blockMeta}>
                  {bloco.tipo.replaceAll("_", " ")}
                </Text>
                <Text style={styles.sectionTitle}>{bloco.titulo}</Text>
                <Text style={styles.paragraph}>{bloco.conteudoAtual}</Text>
              </View>
            ))
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Escopo previsto</Text>
            {escopo.map((item) => (
              <Text key={item} style={styles.bullet}>
                - {item}
              </Text>
            ))}
          </View>
        )}

        {data.observacoesComerciais ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observacoes comerciais</Text>
            <Text style={styles.paragraph}>{data.observacoesComerciais}</Text>
          </View>
        ) : null}

        {data.observacoesTecnicas ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observacoes tecnicas</Text>
            <Text style={styles.paragraph}>{data.observacoesTecnicas}</Text>
          </View>
        ) : null}

        {data.condicoesPagamento ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Condicoes de pagamento</Text>
            <Text style={styles.paragraph}>{data.condicoesPagamento}</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>
          Documento gerado em {variaveis.data}. Esta proposta esta sujeita a
          validacao operacional e comercial.
        </Text>
      </Page>
    </Document>
  );
}

export function renderPropostaPdfBuffer(data: PropostaRenderData) {
  return renderToBuffer(<PropostaPdfDocument data={data} />);
}
