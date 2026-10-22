// ARQUIVO: lib/empresas/encontrar-existente.ts
// REGRA: nunca remover. Apenas acrescentar.
// Antes de criar uma Empresa nova (João ou Maria), procura se ela já existe:
// 1) por CNPJ (comparando só os dígitos — "33.000.167/0001-01" e "33000167000101"
//    são o mesmo CNPJ, mas hoje coexistem como 2 linhas diferentes em produção);
// 2) por nome normalizado (sem acento, sem sufixo societário como LTDA/S.A.,
//    sinônimos conhecidos como "Petróleo Brasileiro" = "Petrobras", ignorando
//    conteúdo entre parênteses — ex.: "Petrobras (RNEST)" = "Petrobras").
// Nunca cria, nunca altera — só procura e devolve pro chamador decidir.

import { prisma } from "@/lib/prisma";

export type EmpresaParaBusca = {
  cnpj?: string | null;
  nome?: string | null;
};

export type EmpresaEncontrada = {
  id: string;
  razaoSocial: string;
  cnpj: string | null;
  motivoMatch: "cnpj" | "nome";
};

type EmpresaCandidata = { id: string; razaoSocial: string; cnpj: string | null };

type EmpresaClient = {
  empresa: {
    findMany: (args: { select: { id: true; razaoSocial: true; cnpj: true } }) => Promise<EmpresaCandidata[]>;
  };
};

export function somenteDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

// Sufixos societários que não fazem parte da identidade da empresa pra fins de comparação.
// Aplicado DEPOIS de remover pontuação (então "S.A." já chegou aqui como "S A").
const SUFIXOS_SOCIETARIOS = /\b(S\s*A|LTDA|LIMITADA|CIA|COMPANHIA|EIRELI|HOLDING|GRUPO|ME|EPP)\b/g;

// Sinônimos conhecidos (nome popular vs. razão social oficial).
const SINONIMOS: Array<[RegExp, string]> = [
  [/\bPETROLEO\s+BRASILEIRO\b/, "PETROBRAS"],
];

/**
 * Nome normalizado para comparação: remove conteúdo entre parênteses, acentos,
 * sufixo societário e aplica sinônimos conhecidos. Maiúsculo, sem pontuação.
 */
export function normalizarNomeEmpresa(nome: string): string {
  let n = nome
    .replace(/\([^)]*\)/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
  n = n.replace(/[^A-Z0-9 ]+/g, " "); // remove pontuação (., /, -) antes de comparar sufixos
  n = n.replace(SUFIXOS_SOCIETARIOS, " ");
  n = n.replace(/\s+/g, " ").trim();
  for (const [re, repl] of SINONIMOS) n = n.replace(re, repl);
  return n;
}

/**
 * Procura uma Empresa já existente por CNPJ (dígitos) e, se não achar, por nome
 * normalizado. `client` permite passar uma transação (`tx`) do Prisma em vez do
 * singleton padrão — necessário pra João/Maria chamarem de dentro de um
 * `prisma.$transaction(...)`.
 */
export async function encontrarEmpresaExistente(
  dados: EmpresaParaBusca,
  client: EmpresaClient = prisma,
): Promise<EmpresaEncontrada | null> {
  const nomeNormalizado = dados.nome?.trim() ? normalizarNomeEmpresa(dados.nome) : "";
  const cnpjDigits = dados.cnpj ? somenteDigitos(dados.cnpj) : "";

  if (!cnpjDigits && !nomeNormalizado) return null;

  const candidatas = await client.empresa.findMany({
    select: { id: true, razaoSocial: true, cnpj: true },
  });

  if (cnpjDigits) {
    const porCnpj = candidatas.find(e => e.cnpj && somenteDigitos(e.cnpj) === cnpjDigits);
    if (porCnpj) {
      return { id: porCnpj.id, razaoSocial: porCnpj.razaoSocial, cnpj: porCnpj.cnpj, motivoMatch: "cnpj" };
    }
  }

  if (nomeNormalizado) {
    const porNome = candidatas.find(e => normalizarNomeEmpresa(e.razaoSocial) === nomeNormalizado);
    if (porNome) {
      return { id: porNome.id, razaoSocial: porNome.razaoSocial, cnpj: porNome.cnpj, motivoMatch: "nome" };
    }
  }

  return null;
}
