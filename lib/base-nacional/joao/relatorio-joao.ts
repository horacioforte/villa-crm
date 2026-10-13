// ARQUIVO: lib/base-nacional/joao/relatorio-joao.ts
// REGRA: nunca remover. Apenas acrescentar.
// Exportação da fila comercial do João (Excel, PDF, impressão). Decisores e contatos ficam em abas separadas.

import * as XLSX from "xlsx";
import type { ReportColumn } from "@/lib/relatorios/export";
import { formatarCnpj } from "../cnpj";
import { CATEGORIA_LABEL, type Categoria } from "./categorizar";
import { DECISAO_COMERCIAL_LABEL, type DecisaoComercial } from "./fila-comercial-rotulos";
import type { FiltrosJoao, LinhaJoao } from "./fila-comercial";

export function descreverFiltrosJoao(f: FiltrosJoao) {
  return [f.uf ? `UF ${f.uf}` : "Todas as UFs", f.categoria ? `categoria ${f.categoria}` : null, f.porte ? `porte ${f.porte}` : null,
    f.unidadesMin ? `≥ ${f.unidadesMin} unidades` : null, f.unidadesMax ? `≤ ${f.unidadesMax} unidades` : null, f.revisao ? `revisão: ${f.revisao}` : null, f.busca ? `busca "${f.busca}"` : null].filter(Boolean).join(" · ");
}
export const colunasJoao: ReportColumn<LinhaJoao>[] = [
  { header: "Categoria", value: g => CATEGORIA_LABEL[g.categoriaComercial as Categoria] },
  { header: "Grupo", value: g => g.nome },
  { header: "Empresas", value: g => g.empresas.map(e => `${e.nomeFantasia || e.razaoSocial} (${formatarCnpj(e.cnpjMatriz) ?? e.cnpjBasico})`).join("; ") },
  { header: "Estados", value: g => (g.ind.ufs ?? []).join(", ") },
  { header: "Unidades", value: g => g.ind.unidadesAtivas ?? 0 },
  { header: "Sócios (Receita)", value: g => g.ind.decisoresSocietarios ?? 0 },
  { header: "WhatsApp", value: g => g.ind.whatsapp ?? 0 },
  { header: "E-mail corporativo", value: g => g.ind.emailCorporativo ?? 0 },
  { header: "Telefones", value: g => (g.ind.telefoneSite ?? 0) + (g.ind.telefoneReceita ?? 0) },
  { header: "Revisão", value: g => (g.decisaoComercial ? DECISAO_COMERCIAL_LABEL[g.decisaoComercial as DecisaoComercial] : "Aguardando revisão") },
];

export type DetalheExport = {
  pessoas: Array<{ grupo: string; empresa: string; nome: string; cargo: string | null; fonte: string | null; confianca: string | null; linkedin: string | null; fonteUrl: string | null }>;
  contatos: Array<{ grupo: string; empresa: string; tipo: string; valor: string; descricao: string | null; fonte: string | null; confianca: string | null; situacao: string; fonteUrl: string | null }>;
};

export function gerarXlsxJoao(linhas: LinhaJoao[], det: DetalheExport, meta: { descricao: string; relatorioId: string; geradoEm: Date }) {
  const fmt = (v: unknown) => (v instanceof Date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife" }).format(v) : v ?? "-");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas.map(l => Object.fromEntries(colunasJoao.map(c => [c.header, fmt(c.value(l))])))), "Grupos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(det.pessoas.map(p => ({ Grupo: p.grupo, Empresa: p.empresa, Nome: p.nome, Cargo: p.cargo ?? "-", Fonte: p.fonte ?? "-", Confiança: p.confianca ?? "-", LinkedIn: p.linkedin ?? "-", "URL da fonte": p.fonteUrl ?? "-" }))), "Decisores societários");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(det.contatos.map(k => ({ Grupo: k.grupo, Empresa: k.empresa, Tipo: k.tipo, Contato: k.valor, Descrição: k.descricao ?? "-", Fonte: k.fonte ?? "-", Confiança: k.confianca ?? "-", Situação: k.situacao === "VERIFICADO" ? "Verificado" : "Não verificado", "URL da fonte": k.fonteUrl ?? "-" }))), "Contatos da empresa");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Villa Empreendimentos — Fila comercial do João"],
    ["Gerado em", new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Recife" }).format(meta.geradoEm)],
    ["Filtros", meta.descricao],
    ["Observação", "Contatos são gerais da empresa (não pertencem ao sócio). Nenhum contato foi feito."],
    ["Identificação do relatório", meta.relatorioId],
  ]), "Sobre");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
