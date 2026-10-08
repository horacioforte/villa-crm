// ARQUIVO: lib/base-nacional/fila-relatorio.ts
// REGRA: nunca remover. Apenas acrescentar.
// Exportação do andamento da fila de verificação (Excel, PDF, impressão).

import * as XLSX from "xlsx";
import type { ReportColumn } from "@/lib/relatorios/export";
import { formatarCnpj } from "./cnpj";
import type { listarFila } from "./fila-consulta";
import { CLASSE_TRIAGEM_LABEL, type ClasseTriagem } from "./triagem";
import { NIVEL_LABEL, STATUS_LABEL, type NivelPotencial, type StatusValidacao } from "./rotulos";

export type LinhaFila = Awaited<ReturnType<typeof listarFila>>["linhas"][number];
export const SITUACAO_FILA_LABEL: Record<string, string> = { AGUARDANDO: "Aguardando verificação", CONCLUIDA: "Verificada", DISPENSADA_TRIAGEM: "Dispensada pela triagem" };

export const colunasFila: ReportColumn<LinhaFila>[] = [
  { header: "Razão social", value: l => l.candidata.razaoSocial },
  { header: "Nome fantasia", value: l => l.candidata.nomeFantasia },
  { header: "CNPJ", value: l => formatarCnpj(l.candidata.cnpjMatriz) ?? l.candidata.cnpjBasico },
  { header: "Cidade", value: l => l.municipio },
  { header: "UF", value: l => l.uf },
  { header: "Prioridade", value: l => l.prioridadeReceita },
  { header: "Local", value: l => (l.interior ? "Interior" : "Capital/região metropolitana") },
  { header: "Triagem", value: l => CLASSE_TRIAGEM_LABEL[l.classificacao as ClasseTriagem] ?? l.classificacao },
  { header: "Fila", value: l => SITUACAO_FILA_LABEL[l.situacaoFila] ?? l.situacaoFila },
  { header: "Situação", value: l => STATUS_LABEL[l.candidata.statusValidacao as StatusValidacao] },
  { header: "Potencial de compra", value: l => NIVEL_LABEL[l.potencialCompra as NivelPotencial] },
  { header: "Verificada por", value: l => l.concluidaPor?.nome ?? null },
  { header: "Verificada em", value: l => l.concluidaEm },
];

export function gerarXlsxFila(linhas: LinhaFila[], meta: { descricao: string; progresso: Record<string, number>; relatorioId: string; geradoEm: Date }) {
  const fmt = (v: unknown) => (v instanceof Date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife" }).format(v) : v ?? "-");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas.map(l => Object.fromEntries(colunasFila.map(c => [c.header, fmt(c.value(l))])))), "Fila");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Villa Empreendimentos — Fila de verificação da Base Nacional"],
    ["Gerado em", new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Recife" }).format(meta.geradoEm)],
    ["Filtros", meta.descricao],
    ["Verificadas", meta.progresso.verificadas], ["Pendentes", meta.progresso.pendentes], ["Em revisão agora", meta.progresso.emRevisao],
    ["Restantes", meta.progresso.restantes], ["Dispensadas pela triagem", meta.progresso.dispensadas],
    ["Identificação do relatório", meta.relatorioId],
  ]), "Andamento");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
