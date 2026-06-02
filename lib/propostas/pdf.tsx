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

type DecimalLike = string | number | { toString(): string };

const styles = StyleSheet.create({
  page: {
    padding: 44,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  brandRow: {
    borderBottom: "2 solid #1A2E5A",
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 9,
  },
  brandName: {
    color: "#1A2E5A",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
  },
  brandSubtitle: {
    color: "#475467",
    fontSize: 7,
    marginTop: 3,
  },
  proposalNumber: {
    color: "#1A2E5A",
    fontSize: 10,
    fontWeight: 700,
    textAlign: "right",
  },
  dateLine: {
    fontSize: 10,
    marginBottom: 14,
    textAlign: "right",
  },
  recipient: {
    marginBottom: 14,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    color: "#1A2E5A",
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 6,
  },
  paragraph: {
    color: "#202938",
    fontSize: 8.5,
    lineHeight: 1.45,
    marginBottom: 4,
    textAlign: "justify",
  },
  bold: {
    fontWeight: 700,
  },
  table: {
    borderLeft: "1 solid #98A2B3",
    borderTop: "1 solid #98A2B3",
    marginBottom: 8,
    marginTop: 6,
  },
  tableRow: {
    display: "flex",
    flexDirection: "row",
  },
  tableHeaderCell: {
    backgroundColor: "#1A2E5A",
    borderBottom: "1 solid #98A2B3",
    borderRight: "1 solid #98A2B3",
    color: "#FFFFFF",
    fontSize: 7,
    fontWeight: 700,
    padding: 5,
  },
  tableCell: {
    borderBottom: "1 solid #98A2B3",
    borderRight: "1 solid #98A2B3",
    fontSize: 7,
    padding: 5,
  },
  tableTotalCell: {
    backgroundColor: "#1A2E5A",
    borderBottom: "1 solid #98A2B3",
    borderRight: "1 solid #98A2B3",
    color: "#FFFFFF",
    fontSize: 7,
    fontWeight: 700,
    padding: 5,
  },
  signatureGrid: {
    display: "flex",
    flexDirection: "row",
    gap: 20,
    marginTop: 16,
  },
  signatureBox: {
    flexGrow: 1,
    width: "48%",
  },
  line: {
    borderTop: "1 solid #111827",
    marginBottom: 4,
    marginTop: 26,
  },
  closing: {
    marginTop: 18,
  },
  footer: {
    borderTop: "1 solid #D7DEEA",
    color: "#667085",
    fontSize: 7,
    marginTop: 18,
    paddingTop: 8,
    textAlign: "center",
  },
});

function getFieldFromBlock(content: string, label: string) {
  const line = content
    .split("\n")
    .find((item) => item.toLowerCase().startsWith(label.toLowerCase()));

  return line?.split(":").slice(1).join(":").trim() || "";
}

function Paragraphs({ content }: { content: string }) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => (
      <Text key={`${index}-${line.slice(0, 16)}`} style={styles.paragraph}>
        {line}
      </Text>
    ));
}

function HeaderBlock({
  content,
  data,
}: {
  content: string;
  data: PropostaRenderData;
}) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const intro = lines.slice(6).join("\n");

  return (
    <View>
      <View style={styles.brandRow}>
        <View>
          <Text style={styles.brandName}>Villa Empreendimentos</Text>
          <Text style={styles.brandSubtitle}>
            Locação e venda de equipamentos para concreto
          </Text>
        </View>
        <Text style={styles.proposalNumber}>
          Proposta Nº {data.numeroProposta}
        </Text>
      </View>
      <Text style={styles.dateLine}>Recife, {variaveisData(data)}.</Text>
      <View style={styles.recipient}>
        <Text style={styles.paragraph}>À</Text>
        <Text style={[styles.paragraph, styles.bold]}>{data.cliente}</Text>
        <Text style={styles.paragraph}>Obra: {data.obra}</Text>
        <Text style={styles.paragraph}>
          Fone: {data.telefone || getFieldFromBlock(content, "Fone") || "Não informado"}
        </Text>
        <Text style={styles.paragraph}>
          Email: {data.email || getFieldFromBlock(content, "Email") || "Não informado"}
        </Text>
      </View>
      <Paragraphs content={intro} />
    </View>
  );
}

function PriceBlock({
  content,
  data,
}: {
  content: string;
  data: PropostaRenderData;
}) {
  if ((data.itens?.length ?? 0) > 1) {
    const headers = ["Qtd.", "Descrição", "Volume mínimo", "Preço por m³", "Valor total"];
    const widths = ["8%", "34%", "18%", "20%", "20%"];
    const total = data.itens!.reduce(
      (sum, item) => sum + Number(item.valorTotal),
      0,
    );

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Preços</Text>
        <Text style={styles.paragraph}>
          Os preços ofertados nesta proposta serão os seguintes:
        </Text>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            {headers.map((label, index) => (
              <Text key={label} style={[styles.tableHeaderCell, { width: widths[index] }]}>
                {label}
              </Text>
            ))}
          </View>
          {data.itens!.map((item) => (
            <View key={`${item.ordem}-${item.descricao}`} style={styles.tableRow}>
              {[
                String(item.quantidade),
                item.descricao,
                item.volumeMinimoM3
                  ? `${formatPdfVolume(item.volumeMinimoM3)} m³`
                  : item.horasGarantidas ?? "-",
                item.precoM3
                  ? `${formatPdfCurrency(item.precoM3)}/m³`
                  : item.precoUnitario
                    ? formatPdfCurrency(item.precoUnitario)
                    : "-",
                formatPdfCurrency(item.valorTotal),
              ].map((value, index) => (
                <Text
                  key={`${index}-${value}`}
                  style={[styles.tableCell, { width: widths[index] }]}
                >
                  {value}
                </Text>
              ))}
            </View>
          ))}
          <View style={styles.tableRow}>
            {["", "", "", "TOTAL", formatPdfCurrency(total)].map((value, index) => (
              <Text
                key={`${index}-${value}`}
                style={[styles.tableTotalCell, { width: widths[index] }]}
              >
                {value}
              </Text>
            ))}
          </View>
        </View>
      </View>
    );
  }

  const variaveis = buildPropostaVariaveis(data);
  const isM3 =
    data.precoM3 !== null &&
    data.precoM3 !== undefined &&
    data.volumeMinimoM3 !== null &&
    data.volumeMinimoM3 !== undefined;
  const rows = isM3
    ? [
        getFieldFromBlock(content, "Qtd.") || variaveis.quantidade,
        getFieldFromBlock(content, "Descrição") ||
          getFieldFromBlock(content, "Descricao") ||
          variaveis.descricao_comercial,
        getFieldFromBlock(content, "Volume mínimo") ||
          getFieldFromBlock(content, "Volume minimo") ||
          variaveis.horas_garantidas,
        getFieldFromBlock(content, "Preço por m³") ||
          getFieldFromBlock(content, "Preco por m3") ||
          getFieldFromBlock(content, "Preço Unit./mês") ||
          getFieldFromBlock(content, "Preco Unit./mes") ||
          variaveis.preco_unitario,
        getFieldFromBlock(content, "Valor total") ||
          getFieldFromBlock(content, "Preço Total/mês") ||
          getFieldFromBlock(content, "Preco Total/mes") ||
          variaveis.valor,
      ]
    : [
        getFieldFromBlock(content, "Qtd.") || variaveis.quantidade,
        getFieldFromBlock(content, "Descrição") ||
          getFieldFromBlock(content, "Descricao") ||
          variaveis.descricao_comercial,
        getFieldFromBlock(content, "Horas Garantidas") ||
          variaveis.horas_garantidas,
        getFieldFromBlock(content, "Preço Unit./mês") ||
          getFieldFromBlock(content, "Preco Unit./mes") ||
          variaveis.preco_unitario,
        getFieldFromBlock(content, "Preço Total/mês") ||
          getFieldFromBlock(content, "Preco Total/mes") ||
          variaveis.valor,
        getFieldFromBlock(content, "Hora Extra/h") || variaveis.hora_extra,
      ];
  const headers = isM3
    ? ["Qtd.", "Descrição", "Volume mínimo", "Preço por m³", "Valor total"]
    : [
        "Qtd.",
        "Descrição",
        "Horas Garantidas",
        "Preço Unit./mês",
        "Preço Total/mês",
        "Hora Extra/h",
      ];
  const widths = isM3
    ? ["8%", "34%", "18%", "20%", "20%"]
    : ["8%", "30%", "16%", "17%", "17%", "12%"];
  const notes = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("Obs."));

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>4. Preços</Text>
      <Text style={styles.paragraph}>
        Os preços ofertados nesta proposta serão os seguintes:
      </Text>
      <View style={styles.table}>
        <View style={styles.tableRow}>
          {headers.map((label, index) => (
            <Text key={label} style={[styles.tableHeaderCell, { width: widths[index] }]}>
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.tableRow}>
          {rows.map((value, index) => (
            <Text key={`${index}-${value}`} style={[styles.tableCell, { width: widths[index] }]}>
              {value}
            </Text>
          ))}
        </View>
      </View>
      {notes.map((note) => (
        <Text key={note} style={styles.paragraph}>
          {note}
        </Text>
      ))}
    </View>
  );
}

function SignatureBlock({
  data,
  content,
  title,
}: {
  data: PropostaRenderData;
  content: string;
  title: string;
}) {
  const confirmacao = content.split("\n")[0] || "";

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.paragraph}>{confirmacao}</Text>
      <View style={styles.signatureGrid}>
        {[1, 2].map((item) => (
          <View key={item} style={styles.signatureBox}>
            <Text style={[styles.paragraph, styles.bold]}>{data.cliente}</Text>
            <View style={styles.line} />
            <Text style={styles.paragraph}>Assinatura</Text>
            <Text style={styles.paragraph}>Nome:</Text>
            <Text style={styles.paragraph}>Cargo:</Text>
            <Text style={styles.paragraph}>Data: _____/_____/_______</Text>
            <View style={styles.line} />
            <Text style={styles.paragraph}>Carimbo CNPJ</Text>
          </View>
        ))}
      </View>
      <View style={styles.closing}>
        <Text style={styles.paragraph}>Atenciosamente,</Text>
        <Text style={[styles.paragraph, styles.bold]}>Morgana Albertim</Text>
        <Text style={styles.paragraph}>Supervisora Comercial</Text>
        <Text style={styles.paragraph}>Villa Empreendimentos</Text>
      </View>
      <View style={styles.signatureGrid}>
        {[1, 2].map((item) => (
          <View key={item} style={styles.signatureBox}>
            <Text style={styles.paragraph}>Testemunha:</Text>
            <Text style={styles.paragraph}>Nome:</Text>
            <Text style={styles.paragraph}>CPF:</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function variaveisData(data: PropostaRenderData) {
  return buildPropostaVariaveis(data).data;
}

function formatPdfCurrency(value: DecimalLike) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatPdfVolume(value: DecimalLike) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(Number(value));
}

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
        {data.blocos?.length ? (
          data.blocos
            .slice()
            .sort((left, right) => left.ordem - right.ordem)
            .map((bloco) => {
              if (bloco.chave === "cabecalho") {
                return (
                  <HeaderBlock
                    key={`${bloco.ordem}-${bloco.titulo}`}
                    content={bloco.conteudoAtual}
                    data={data}
                  />
                );
              }

              if (bloco.chave === "precos") {
                return (
                  <PriceBlock
                    key={`${bloco.ordem}-${bloco.titulo}`}
                    content={bloco.conteudoAtual}
                    data={data}
                  />
                );
              }

              if (bloco.chave === "assinaturas") {
                return (
                  <SignatureBlock
                    key={`${bloco.ordem}-${bloco.titulo}`}
                    content={bloco.conteudoAtual}
                    data={data}
                    title={bloco.titulo}
                  />
                );
              }

              return (
                <View key={`${bloco.ordem}-${bloco.titulo}`} style={styles.section}>
                  <Text style={styles.sectionTitle}>{bloco.titulo}</Text>
                  <Paragraphs content={bloco.conteudoAtual} />
                </View>
              );
            })
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Escopo previsto</Text>
            {escopo.map((item) => (
              <Text key={item} style={styles.paragraph}>
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
