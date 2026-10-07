// ARQUIVO: lib/base-nacional/receita/normalizacao.ts
// REGRA: nunca remover. Apenas acrescentar.
// Normalização de campos vindos do CSV da Receita Federal — funções puras, sem I/O.
// nomeOrdenacao de uma candidata/estabelecimento usa chaveOrdenacao() de ../contatos
// (mesma regra já usada pela tela manual da Base Nacional — não duplicada aqui).

import { createHash } from "node:crypto";
import { normalizarCnpj } from "../cnpj";
import { normalizarTelefone } from "../contatos";

/** Junta cnpjBasico(8) + cnpjOrdem(4) + cnpjDv(2) em um CNPJ de 14 dígitos. Null se inválido. */
export function cnpjCompleto(cnpjBasico: string, cnpjOrdem: string, cnpjDv: string): string | null {
  return normalizarCnpj(`${cnpjBasico}${cnpjOrdem}${cnpjDv}`);
}

/** "1" (matriz) vira true; qualquer outro valor (ex.: "2" filial) vira false. */
export function ehMatrizReceita(identificadorMatrizFilial: string): boolean {
  return identificadorMatrizFilial.trim() === "1";
}

/** "AAAAMMDD" → Date; "00000000", vazio ou inválido → null. Nunca lança. */
export function dataReceitaParaDate(valor: string | null | undefined): Date | null {
  const v = (valor ?? "").trim();
  if (!/^\d{8}$/.test(v) || v === "00000000") return null;
  const ano = Number(v.slice(0, 4));
  const mes = Number(v.slice(4, 6));
  const dia = Number(v.slice(6, 8));
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  // Valida que a data "voltou" igual (descarta ex.: 20260231 → viraria 03/03).
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return d;
}

/** "2.500.000,00" / "2500000,00" / "" → número; vírgula é separador decimal (padrão BR/Receita). */
export function capitalSocialParaNumero(valor: string | null | undefined): number | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  const limpo = v.replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** DDD + número (campos separados da Receita) → dígitos normalizados (ver contatos.ts), ou null. */
export function telefoneReceitaNormalizado(ddd: string | null | undefined, numero: string | null | undefined): string | null {
  const d = (ddd ?? "").trim();
  const n = (numero ?? "").trim();
  if (!n) return null;
  const junto = `${d}${n}`.replace(/\D/g, "");
  if (junto.length < 8) return null;
  return normalizarTelefone(junto);
}

/** E-mail: trim + minúsculas; vazio → null (nunca inventa um e-mail). */
export function emailReceitaNormalizado(valor: string | null | undefined): string | null {
  const v = (valor ?? "").trim().toLowerCase();
  return v.length > 0 ? v : null;
}

/**
 * Hash estável dos campos relevantes de um estabelecimento, usado para detectar
 * mudança entre competências (ReceitaMudanca). Mesmo algoritmo (md5) do script de
 * demonstração (scripts/base-nacional/demo-dados-branch.ts), mas cobrindo todos os
 * campos que podem gerar um TipoMudancaReceita.
 */
export function hashRegistroEstabelecimento(campos: {
  situacaoCadastral: string;
  razaoSocial?: string | null;
  nomeFantasia: string | null;
  cnaePrincipal: string;
  cnaesSecundarios: readonly string[];
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  uf: string | null;
  municipio: string | null;
  telefone1: string | null;
  telefone2: string | null;
  email: string | null;
  porte?: string | null;
  capitalSocial?: number | null;
}): string {
  const partes = [
    campos.situacaoCadastral,
    campos.razaoSocial ?? "",
    campos.nomeFantasia ?? "",
    campos.cnaePrincipal,
    [...campos.cnaesSecundarios].sort().join(","),
    campos.logradouro ?? "",
    campos.numero ?? "",
    campos.complemento ?? "",
    campos.bairro ?? "",
    campos.cep ?? "",
    campos.uf ?? "",
    campos.municipio ?? "",
    campos.telefone1 ?? "",
    campos.telefone2 ?? "",
    campos.email ?? "",
    campos.porte ?? "",
    campos.capitalSocial ?? "",
  ];
  return createHash("md5").update(partes.join("|")).digest("hex");
}
