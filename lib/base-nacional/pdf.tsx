// ARQUIVO: lib/base-nacional/pdf.tsx
// REGRA: nunca remover. Apenas acrescentar.
// PDF próprio da Base Nacional: relatório cadastral SEM linha de "Totais" e com
// data, filtros e identificação no cabeçalho. Não altera o gerador compartilhado
// de outros relatórios do CRM (lib/relatorios/export.tsx).

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ReportColumn } from "@/lib/relatorios/export";

const estilos = StyleSheet.create({
  pagina: { padding: 24, fontFamily: "Helvetica", color: "#1A2E5A" },
  cabecalho: { borderBottom: "2 solid #1A2E5A", marginBottom: 10, paddingBottom: 6 },
  marca: { fontSize: 13, fontWeight: 700 },
  linha: { color: "#667085", fontSize: 7.5, marginTop: 2 },
  tabela: { borderLeft: "1 solid #D7DEEA", borderTop: "1 solid #D7DEEA" },
  fila: { flexDirection: "row" },
  th: { backgroundColor: "#1A2E5A", color: "#FFFFFF", fontSize: 6.5, fontWeight: 700, padding: 4, borderRight: "1 solid #D7DEEA", borderBottom: "1 solid #D7DEEA" },
  td: { color: "#202938", fontSize: 6.5, padding: 4, borderRight: "1 solid #D7DEEA", borderBottom: "1 solid #D7DEEA" },
  rodape: { color: "#667085", fontSize: 7, marginTop: 10, textAlign: "center" },
  numero: { position: "absolute", bottom: 12, right: 24, fontSize: 7, color: "#98A2B3" },
});

function celula(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (v instanceof Date) return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife" }).format(v);
  return String(v);
}

// Não quebra palavras com hífen ("CON-CRETEIRA"). Aplicado só neste PDF, sem alterar o padrão global.
const semHifen = (palavra: string) => [palavra];

export async function gerarPdfBase<T>(args: {
  linhas: T[];
  colunas: ReportColumn<T>[];
  filtros: string;
  total: number;
  relatorioId: string;
  geradoEm: Date;
}) {
  const largura = `${100 / args.colunas.length}%`;
  const quando = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Recife" }).format(args.geradoEm);
  // Estilo de célula pré-computado FORA do loop de linhas: com N colunas × M linhas, criar
  // `[estilos.td, { width: largura }]` (novo array + novo objeto) dentro do .map() aloca
  // N×M objetos à toa a cada geração — a mesma largura vale para toda célula de dados.
  // Reaproveitar uma única referência reduz alocação/GC sem mudar nada visualmente.
  const estiloThLargura = { ...estilos.th, width: largura };
  const estiloTdLargura = { ...estilos.td, width: largura };
  // Mesma ideia: pré-computa o texto de cada célula de dados antes de montar o PDF, em vez de
  // chamar c.value(l) + celula(...) de novo a cada render interno do react-pdf.
  const linhasPreparadas = args.linhas.map(l => args.colunas.map(c => celula(c.value(l))));
  return renderToBuffer(
    <Document title="Base Nacional de Concreteiras" author="Villa CRM">
      <Page size="A4" orientation="landscape" style={estilos.pagina}>
        <View style={estilos.cabecalho} fixed>
          <Text style={estilos.marca}>Villa Empreendimentos — Base Nacional de Concreteiras</Text>
          <Text style={estilos.linha}>Filtros: {args.filtros}</Text>
          <Text style={estilos.linha}>
            Gerado em {quando} · {args.linhas.length} de {args.total} candidatas · relatório {args.relatorioId}
          </Text>
        </View>
        <View style={estilos.tabela}>
          <View style={estilos.fila} fixed>
            {args.colunas.map(c => <Text key={c.header} style={estiloThLargura} hyphenationCallback={semHifen}>{c.header}</Text>)}
          </View>
          {linhasPreparadas.map((celulas, i) => (
            <View key={i} style={estilos.fila} wrap={false}>
              {celulas.map((texto, j) => <Text key={args.colunas[j].header} style={estiloTdLargura} hyphenationCallback={semHifen}>{texto}</Text>)}
            </View>
          ))}
        </View>
        <Text style={estilos.rodape}>Villa CRM · base de investigação — candidatas não fazem parte do cadastro comercial</Text>
        <Text style={estilos.numero} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>,
  );
}
