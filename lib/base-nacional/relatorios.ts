// ARQUIVO: lib/base-nacional/relatorios.ts
// REGRA: nunca remover. Apenas acrescentar.
// Relatórios da Base Nacional: colunas de exportação e registro em
// RelatorioConcreteirasGerado (única gravação permitida nesta etapa — tabela nova).

import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import type { ReportColumn } from "@/lib/relatorios/export";
import { formatarCnpj } from "./cnpj";
import type { linhasParaExportar } from "./consulta";
import { descreverFiltros, tipoRelatorio, type FiltrosBase } from "./filtros";
import {
  CONFIANCA_LABEL,
  STATUS_LABEL,
  TIPO_UNIDADE_LABEL,
  type Confianca,
  type StatusValidacao,
  type TipoUnidade,
} from "./rotulos";

type Linha = Awaited<ReturnType<typeof linhasParaExportar>>["linhas"][number];

export const colunasRelatorio: ReportColumn<Linha>[] = [
  { header: "Razão social", value: l => l.razaoSocial },
  { header: "Nome fantasia", value: l => l.nomeFantasia },
  { header: "CNPJ", value: l => formatarCnpj(l.cnpjMatriz) ?? l.cnpjBasico },
  { header: "Cidade", value: l => l.municipioMatriz },
  { header: "UF", value: l => l.ufMatriz },
  { header: "Unidades", value: l => l._count.unidades, total: rows => rows.reduce((a, r) => a + r._count.unidades, 0) },
  { header: "Situação", value: l => STATUS_LABEL[l.statusValidacao as StatusValidacao] },
  { header: "Confiança", value: l => (l.confianca ? CONFIANCA_LABEL[l.confianca as Confianca] : null) },
  { header: "Evidências", value: l => l._count.evidencias },
  { header: "Empresa no CRM", value: l => l.empresa?.nomeFantasia ?? l.empresa?.razaoSocial ?? null },
  { header: "Última verificação", value: l => l.ultimaVerificacaoEm },
];

export function rotulosFiltros(f: FiltrosBase, segmentoNome?: string) {
  return descreverFiltros(f, {
    status: f.status ? STATUS_LABEL[f.status] : undefined,
    tipoUnidade: f.tipoUnidade ? TIPO_UNIDADE_LABEL[f.tipoUnidade as TipoUnidade] : undefined,
    confianca: f.confianca ? CONFIANCA_LABEL[f.confianca] : undefined,
    segmento: segmentoNome,
  });
}

export async function registrarRelatorio(args: {
  filtros: FiltrosBase;
  formato: "XLSX" | "PDF" | "IMPRESSAO";
  totalRegistros: number;
  exportados: number;
  usuarioId?: string | null;
  descricao: string;
}) {
  // geradoPorId só é preenchido se o usuário existir (FK com SET NULL; evita erro em ambientes de teste).
  const usuario = args.usuarioId
    ? await prisma.usuario.findUnique({ where: { id: args.usuarioId }, select: { id: true } })
    : null;
  return prisma.relatorioConcreteirasGerado.create({
    data: {
      tipo: tipoRelatorio(args.filtros),
      formato: args.formato,
      filtros: { ...args.filtros, descricao: args.descricao, exportados: args.exportados },
      totalRegistros: args.totalRegistros,
      geradoPorId: usuario?.id ?? null,
    },
    select: { id: true, geradoEm: true },
  });
}

/** Excel da Base Nacional: aba de dados + aba "Sobre o relatório" com data, filtros e identificação. */
export function gerarXlsxBase(linhas: Linha[], meta: { descricao: string; total: number; relatorioId: string; geradoEm: Date }) {
  const formatar = (v: unknown) => (v instanceof Date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife" }).format(v) : v ?? "-");
  const dados = linhas.map(l => Object.fromEntries(colunasRelatorio.map(c => [c.header, formatar(c.value(l))])));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados), "Base Nacional");
  const sobre = XLSX.utils.aoa_to_sheet([
    ["Villa Empreendimentos — Base Nacional de Concreteiras"],
    ["Gerado em", new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Recife" }).format(meta.geradoEm)],
    ["Filtros", meta.descricao],
    ["Candidatas no filtro", meta.total],
    ["Linhas exportadas", linhas.length],
    ["Identificação do relatório", meta.relatorioId],
    ["Observação", "Base de investigação — candidatas não fazem parte do cadastro comercial."],
  ]);
  XLSX.utils.book_append_sheet(wb, sobre, "Sobre o relatório");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
