import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/auth/session";
import { getRelatorioPropostas, parseFormato } from "@/lib/relatorios/data";
import {
  exportRowsToPdf,
  exportRowsToXlsx,
  type ReportColumn,
} from "@/lib/relatorios/export";

type PropostaRow = Awaited<ReturnType<typeof getRelatorioPropostas>>[number];

const columns: ReportColumn<PropostaRow>[] = [
  { header: "Numero", value: (row) => row.numeroProposta },
  { header: "Versao", value: (row) => row.versao },
  { header: "Ativa", value: (row) => row.ativa },
  {
    header: "Cliente",
    value: (row) =>
      row.oportunidade.empresa.nomeFantasia ??
      row.oportunidade.empresa.razaoSocial,
  },
  {
    header: "Obra",
    value: (row) =>
      row.oportunidade.obra
        ? `${row.oportunidade.obra.nome}${row.oportunidade.obra.cidade ? ` - ${row.oportunidade.obra.cidade}/${row.oportunidade.obra.estado ?? ""}` : ""}`
        : "",
  },
  { header: "Responsavel", value: (row) => row.oportunidade.responsavel?.nome },
  { header: "Template", value: (row) => row.templateUtilizado },
  { header: "Status", value: (row) => row.status },
  {
    header: "Valor",
    value: (row) => Number(row.valorTotal),
    total: (rows) => rows.reduce((sum, row) => sum + Number(row.valorTotal), 0),
  },
  { header: "Validade", value: (row) => row.validadeProposta },
  { header: "Gerada em", value: (row) => row.createdAt },
  { header: "Gerada por", value: (row) => row.criadoPor?.nome },
];

export async function GET(request: Request) {
  const authResult = await requirePermission("relatorios", "read", request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const url = new URL(request.url);
  const formato = parseFormato(url.searchParams.get("formato"));
  const rows = await getRelatorioPropostas(url.searchParams, authResult);
  const today = new Date().toISOString().slice(0, 10);

  if (formato === "xlsx") {
    const buffer = exportRowsToXlsx({ rows, columns, sheetName: "Propostas" });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="relatorio-propostas-${today}.xlsx"`,
      },
    });
  }

  if (formato === "pdf") {
    const buffer = await exportRowsToPdf({
      rows,
      columns,
      title: "Relatório de Propostas",
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="relatorio-propostas-${today}.pdf"`,
      },
    });
  }

  return NextResponse.json(rows);
}
