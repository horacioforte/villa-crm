import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/session";
import { getRelatorioOportunidades, parseFormato } from "@/lib/relatorios/data";
import {
  exportRowsToPdf,
  exportRowsToXlsx,
  type ReportColumn,
} from "@/lib/relatorios/export";

type OportunidadeRow = Awaited<ReturnType<typeof getRelatorioOportunidades>>[number];

const columns: ReportColumn<OportunidadeRow>[] = [
  {
    header: "Cliente",
    value: (row) => row.empresa.nomeFantasia ?? row.empresa.razaoSocial,
  },
  {
    header: "Obra",
    value: (row) =>
      row.obra
        ? `${row.obra.nome}${row.obra.cidade ? ` - ${row.obra.cidade}/${row.obra.estado ?? ""}` : ""}`
        : "",
  },
  { header: "Contato", value: (row) => row.pessoa?.nome },
  { header: "Responsavel", value: (row) => row.responsavel?.nome },
  { header: "Tipo", value: (row) => row.tipoServico ?? row.tipo },
  { header: "Status", value: (row) => row.status },
  { header: "Temperatura", value: (row) => row.temperatura },
  { header: "Origem", value: (row) => row.canalOrigem },
  {
    header: "Potencial",
    value: (row) => Number(row.potencialOportunidade ?? 0),
    total: (rows) =>
      rows.reduce((sum, row) => sum + Number(row.potencialOportunidade ?? 0), 0),
  },
  {
    header: "Proposto",
    value: (row) => row.valorProposto,
    total: (rows) => rows.reduce((sum, row) => sum + row.valorProposto, 0),
  },
  {
    header: "Contrato",
    value: (row) => Number(row.valorContrato ?? 0),
    total: (rows) =>
      rows.reduce((sum, row) => sum + Number(row.valorContrato ?? 0), 0),
  },
  { header: "Previsao", value: (row) => row.previsaoFechamento },
  { header: "Criada em", value: (row) => row.createdAt },
  { header: "Qtd propostas", value: (row) => row._totalPropostas },
];

export async function GET(request: Request) {
  const authResult = await requirePermission("relatorios", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const url = new URL(request.url);
  const formato = parseFormato(url.searchParams.get("formato"));
  const rows = await getRelatorioOportunidades(url.searchParams, authResult);
  const today = new Date().toISOString().slice(0, 10);

  if (formato === "xlsx") {
    const buffer = exportRowsToXlsx({
      rows,
      columns,
      sheetName: "Oportunidades",
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="relatorio-oportunidades-${today}.xlsx"`,
      },
    });
  }

  if (formato === "pdf") {
    const buffer = await exportRowsToPdf({
      rows,
      columns,
      title: "Relatório de Oportunidades",
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="relatorio-oportunidades-${today}.pdf"`,
      },
    });
  }

  return NextResponse.json(rows);
}
