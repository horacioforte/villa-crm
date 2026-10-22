// ARQUIVO: scripts/empresas/relatorio-duplicadas.ts
// REGRA: nunca remover. Apenas acrescentar.
// SOMENTE LEITURA — não cria, não altera, não apaga nenhuma Empresa. Lista grupos
// de Empresa que parecem duplicadas (mesmo CNPJ em formatos diferentes, ou nome
// normalizado igual) e sugere qual seria a "principal" do grupo (a que tem CNPJ
// preenchido, ou — se mais de uma tiver — a mais antiga).
//
// Uso: npx tsx --env-file=.env.local scripts/empresas/relatorio-duplicadas.ts

import { prisma } from "@/lib/prisma";
import { normalizarNomeEmpresa, somenteDigitos } from "@/lib/empresas/encontrar-existente";

type EmpresaRow = {
  id: string;
  razaoSocial: string;
  cnpj: string | null;
  ativa: boolean;
  createdAt: Date;
};

type Grupo = {
  chave: string;
  motivo: "cnpj" | "nome";
  empresas: EmpresaRow[];
  principalSugerida: EmpresaRow;
};

function sugerirPrincipal(empresas: EmpresaRow[]): EmpresaRow {
  const comCnpj = empresas.filter(e => e.cnpj);
  const candidatas = comCnpj.length > 0 ? comCnpj : empresas;
  return [...candidatas].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
}

async function main() {
  const empresas = await prisma.empresa.findMany({
    select: { id: true, razaoSocial: true, cnpj: true, ativa: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\nTotal de empresas no banco: ${empresas.length}\n`);

  // ── Grupos por CNPJ (dígitos) ────────────────────────────────────────────
  const porCnpjDigits = new Map<string, EmpresaRow[]>();
  for (const e of empresas) {
    if (!e.cnpj) continue;
    const digits = somenteDigitos(e.cnpj);
    if (!digits) continue;
    if (!porCnpjDigits.has(digits)) porCnpjDigits.set(digits, []);
    porCnpjDigits.get(digits)!.push(e);
  }

  const gruposCnpj: Grupo[] = [];
  for (const [digits, lista] of porCnpjDigits) {
    if (lista.length > 1) gruposCnpj.push({ chave: digits, motivo: "cnpj", empresas: lista, principalSugerida: sugerirPrincipal(lista) });
  }

  // ── Grupos por nome normalizado (só entre quem NÃO já caiu em um grupo de CNPJ) ──
  const idsJaAgrupados = new Set(gruposCnpj.flatMap(g => g.empresas.map(e => e.id)));
  const porNome = new Map<string, EmpresaRow[]>();
  for (const e of empresas) {
    if (idsJaAgrupados.has(e.id)) continue;
    const nome = normalizarNomeEmpresa(e.razaoSocial);
    if (!nome) continue;
    if (!porNome.has(nome)) porNome.set(nome, []);
    porNome.get(nome)!.push(e);
  }

  const gruposNome: Grupo[] = [];
  for (const [nome, lista] of porNome) {
    if (lista.length > 1) gruposNome.push({ chave: nome, motivo: "nome", empresas: lista, principalSugerida: sugerirPrincipal(lista) });
  }

  const todosGrupos = [...gruposCnpj, ...gruposNome];

  console.log(`=== GRUPOS DUPLICADOS POR CNPJ (${gruposCnpj.length}) ===`);
  for (const g of gruposCnpj) {
    console.log(`\nCNPJ ${g.chave}:`);
    for (const e of g.empresas) {
      const marca = e.id === g.principalSugerida.id ? " ← sugerida como principal" : "";
      console.log(`  [${e.createdAt.toISOString().slice(0, 10)}] ${e.razaoSocial} (cnpj: ${e.cnpj ?? "—"}, ativa: ${e.ativa}) id:${e.id}${marca}`);
    }
  }

  console.log(`\n=== GRUPOS DUPLICADOS POR NOME NORMALIZADO (${gruposNome.length}) ===`);
  for (const g of gruposNome) {
    console.log(`\nNome normalizado "${g.chave}":`);
    for (const e of g.empresas) {
      const marca = e.id === g.principalSugerida.id ? " ← sugerida como principal" : "";
      console.log(`  [${e.createdAt.toISOString().slice(0, 10)}] ${e.razaoSocial} (cnpj: ${e.cnpj ?? "—"}, ativa: ${e.ativa}) id:${e.id}${marca}`);
    }
  }

  const totalEmpresasEmGrupos = todosGrupos.reduce((s, g) => s + g.empresas.length, 0);
  console.log(`\n=== RESUMO ===`);
  console.log(`Grupos por CNPJ       : ${gruposCnpj.length}`);
  console.log(`Grupos por nome       : ${gruposNome.length}`);
  console.log(`Total de grupos       : ${todosGrupos.length}`);
  console.log(`Empresas envolvidas   : ${totalEmpresasEmGrupos}`);
  console.log(`\nNenhum dado foi alterado — este script é só leitura.\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
