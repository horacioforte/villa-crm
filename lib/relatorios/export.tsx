import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import * as XLSX from "xlsx";

type ReportCell = string | number | boolean | Date | null | undefined;

type ReportColumn<T> = {
  header: string;
  value: (row: T) => ReportCell;
  total?: (rows: T[]) => ReportCell;
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontFamily: "Helvetica",
    color: "#1A2E5A",
  },
  header: {
    borderBottom: "2 solid #1A2E5A",
    marginBottom: 12,
    paddingBottom: 8,
  },
  brand: {
    fontSize: 14,
    fontWeight: 700,
  },
  subtitle: {
    color: "#667085",
    fontSize: 8,
    marginTop: 3,
  },
  table: {
    borderLeft: "1 solid #D7DEEA",
    borderTop: "1 solid #D7DEEA",
  },
  row: {
    display: "flex",
    flexDirection: "row",
  },
  headerCell: {
    backgroundColor: "#1A2E5A",
    borderBottom: "1 solid #D7DEEA",
    borderRight: "1 solid #D7DEEA",
    color: "#FFFFFF",
    flexGrow: 1,
    fontSize: 6,
    fontWeight: 700,
    padding: 4,
    width: "10%",
  },
  cell: {
    borderBottom: "1 solid #D7DEEA",
    borderRight: "1 solid #D7DEEA",
    color: "#202938",
    flexGrow: 1,
    fontSize: 6,
    padding: 4,
    width: "10%",
  },
  totalCell: {
    backgroundColor: "#1A2E5A",
    borderBottom: "1 solid #D7DEEA",
    borderRight: "1 solid #D7DEEA",
    color: "#FFFFFF",
    flexGrow: 1,
    fontSize: 6,
    fontWeight: 700,
    padding: 4,
    width: "10%",
  },
  footer: {
    color: "#667085",
    fontSize: 7,
    marginTop: 12,
    textAlign: "center",
  },
});

function formatCell(value: ReportCell) {
  if (value === null || value === undefined || value === "") return "-";
  if (value instanceof Date) return new Intl.DateTimeFormat("pt-BR").format(value);
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number") return value;

  return value;
}

function formatPdfCell(value: ReportCell) {
  const formatted = formatCell(value);

  return typeof formatted === "number"
    ? new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 2,
      }).format(formatted)
    : String(formatted);
}

export function exportRowsToXlsx<T>({
  rows,
  columns,
  sheetName,
}: {
  rows: T[];
  columns: ReportColumn<T>[];
  sheetName: string;
}) {
  const body = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column.header, formatCell(column.value(row))])),
  );
  const totalRow = Object.fromEntries(
    columns.map((column, index) => [
      column.header,
      column.total ? formatCell(column.total(rows)) : index === 0 ? "Totais" : "",
    ]),
  );
  const worksheet = XLSX.utils.json_to_sheet([...body, totalRow]);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function exportRowsToPdf<T>({
  rows,
  columns,
  title,
}: {
  rows: T[];
  columns: ReportColumn<T>[];
  title: string;
}) {
  const totalColumns = columns.length;

  return renderToBuffer(
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Villa Empreendimentos</Text>
          <Text style={styles.subtitle}>
            {title} · Gerado em {new Intl.DateTimeFormat("pt-BR").format(new Date())}
          </Text>
        </View>
        <View style={styles.table}>
          <View style={styles.row}>
            {columns.map((column) => (
              <Text key={column.header} style={[styles.headerCell, { width: `${100 / totalColumns}%` }]}>
                {column.header}
              </Text>
            ))}
          </View>
          {rows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {columns.map((column) => (
                <Text key={column.header} style={[styles.cell, { width: `${100 / totalColumns}%` }]}>
                  {formatPdfCell(column.value(row))}
                </Text>
              ))}
            </View>
          ))}
          <View style={styles.row}>
            {columns.map((column, index) => (
              <Text key={column.header} style={[styles.totalCell, { width: `${100 / totalColumns}%` }]}>
                {column.total ? formatPdfCell(column.total(rows)) : index === 0 ? "Totais" : ""}
              </Text>
            ))}
          </View>
        </View>
        <Text style={styles.footer}>Villa CRM · Relatório gerado automaticamente</Text>
      </Page>
    </Document>,
  );
}

export type { ReportColumn };
