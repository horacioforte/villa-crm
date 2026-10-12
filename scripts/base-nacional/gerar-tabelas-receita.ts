// ARQUIVO: scripts/base-nacional/gerar-tabelas-receita.ts
// REGRA: nunca remover. Apenas acrescentar.
// Gera as tabelas COMPLETAS de apoio da Receita Federal (CNAE, Natureza Jurídica,
// Município, Motivo de situação cadastral, Qualificação do responsável, País) a
// partir dos arquivos oficiais de Dados Abertos do CNPJ, SEM tocar em banco de dados.
//
// Fonte oficial: pasta mensal em
//   https://arquivos.receitafederal.gov.br/dados/cnpj/dados_abertos_cnpj/<AAAA-MM>/
// (portal atual é um Nextcloud; o link de compartilhamento público é resolvido a partir
// da página https://arquivos.receitafederal.gov.br). NÃO usar espelhos não oficiais.
//
// Uso:
//   npx tsx scripts/base-nacional/gerar-tabelas-receita.ts ~/villa-dados-receita/2026-09
//
// Lê os arquivos extraídos (layout oficial "F.K03200$Z.<data>.<SUFIXO>CSV", latin1,
// separador ";", valores entre aspas, sem cabeçalho) e escreve dois arquivos GERADOS
// (não editar manualmente — rodar este script de novo para atualizar):
//   lib/base-nacional/receita-tabelas-completo.generated.ts
//   lib/base-nacional/municipios-receita.generated.ts
//
// Município da Receita NÃO é o código IBGE (ver lib/base-nacional/municipios-receita.ts).

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

type ParOpcoes = { sufixo: string; nome: string };

const TABELAS: ParOpcoes[] = [
  { sufixo: "CNAECSV", nome: "CNAE" },
  { sufixo: "NATJUCSV", nome: "NATUREZA_JURIDICA" },
  { sufixo: "MUNICCSV", nome: "MUNICIPIO" },
  { sufixo: "MOTICSV", nome: "MOTIVO_SITUACAO" },
  { sufixo: "QUALSCSV", nome: "QUALIFICACAO" },
  { sufixo: "PAISCSV", nome: "PAIS" },
];

function localizarArquivo(pasta: string, sufixo: string): string | null {
  const achado = readdirSync(pasta).find(f => f.toUpperCase().endsWith(sufixo));
  return achado ? path.join(pasta, achado) : null;
}

/** Linha "código";"descrição" em latin1, separador ";", sem cabeçalho. */
function lerTabela(caminho: string): Map<string, string> {
  const bruto = readFileSync(caminho).toString("latin1");
  const mapa = new Map<string, string>();
  for (const linha of bruto.split(/\r?\n/)) {
    if (!linha.trim()) continue;
    const m = linha.match(/^"([^"]*)";"([^"]*)"\s*$/);
    if (!m) continue; // linha fora do padrão — ignorada, não derruba a geração
    const [, codigo, descricao] = m;
    mapa.set(codigo.trim(), descricao.trim());
  }
  return mapa;
}

function escaparTs(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function gerarRecordTs(mapa: Map<string, string>): string {
  const linhas = [...mapa.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([codigo, descricao]) => `  "${escaparTs(codigo)}": "${escaparTs(descricao)}",`);
  return `{\n${linhas.join("\n")}\n}`;
}

function main() {
  const pasta = process.argv[2];
  if (!pasta) {
    console.error("Uso: npx tsx scripts/base-nacional/gerar-tabelas-receita.ts <pasta-da-competencia-extraida>");
    process.exit(1);
  }
  const competencia = path.basename(pasta);
  const agora = new Date().toISOString().slice(0, 10);

  const tabelas: Record<string, Map<string, string>> = {};
  for (const { sufixo, nome } of TABELAS) {
    const arquivo = localizarArquivo(pasta, sufixo);
    if (!arquivo) {
      console.warn(`[gerar-tabelas-receita] AVISO: arquivo ${sufixo} não encontrado em ${pasta} — tabela ${nome} ficará vazia.`);
      tabelas[nome] = new Map();
      continue;
    }
    tabelas[nome] = lerTabela(arquivo);
    console.log(`[gerar-tabelas-receita] ${nome}: ${tabelas[nome].size} códigos (${path.basename(arquivo)})`);
  }

  const cabecalho = `// ARQUIVO GERADO AUTOMATICAMENTE por scripts/base-nacional/gerar-tabelas-receita.ts
// NÃO EDITAR MANUALMENTE. Para atualizar, baixe a competência mais recente dos Dados
// Abertos do CNPJ (https://arquivos.receitafederal.gov.br) e rode o gerador de novo.
// Fonte: competência ${competencia} · gerado em ${agora}.
// REGRA: nunca remover do projeto. Apenas regenerar/acrescentar.
`;

  const saidaTabelas = `${cabecalho}
/** Tabela oficial COMPLETA de CNAE (código de 7 dígitos → descrição). */
export const CNAE_DESCRICAO_RFB: Record<string, string> = ${gerarRecordTs(tabelas.CNAE)};

/** Tabela oficial COMPLETA de Natureza Jurídica (código de 4 dígitos → descrição). */
export const NATUREZA_JURIDICA_RFB: Record<string, string> = ${gerarRecordTs(tabelas.NATUREZA_JURIDICA)};

/** Motivo da situação cadastral (código de 2 dígitos → descrição). */
export const MOTIVO_SITUACAO_RFB: Record<string, string> = ${gerarRecordTs(tabelas.MOTIVO_SITUACAO)};

/** Qualificação do responsável/sócio (código de 2 dígitos → descrição). */
export const QUALIFICACAO_RFB: Record<string, string> = ${gerarRecordTs(tabelas.QUALIFICACAO)};

/** País (código de 3 dígitos → nome). */
export const PAIS_RFB: Record<string, string> = ${gerarRecordTs(tabelas.PAIS)};
`;

  const saidaMunicipios = `${cabecalho}
// IMPORTANTE: o código de município da Receita Federal NÃO é o código IBGE de 7 dígitos.
// Esta tabela só traduz código RFB → nome do município. A UF de um estabelecimento vem
// do próprio campo "uf" do registro da Receita, não desta tabela. Correspondência para
// o código IBGE (municipioCodigoIbge) é tratada separadamente — ver
// lib/base-nacional/municipios-receita.ts (pendência registrada: sem tabela oficial
// RFB → IBGE publicada nesta mesma fonte).

/** Código de município da Receita Federal (4 dígitos) → nome do município. */
export const MUNICIPIO_RFB: Record<string, string> = ${gerarRecordTs(tabelas.MUNICIPIO)};
`;

  const raiz = path.join(__dirname, "..", "..", "lib", "base-nacional");
  writeFileSync(path.join(raiz, "receita-tabelas-completo.generated.ts"), saidaTabelas);
  writeFileSync(path.join(raiz, "municipios-receita.generated.ts"), saidaMunicipios);
  console.log(`[gerar-tabelas-receita] gravado lib/base-nacional/receita-tabelas-completo.generated.ts e municipios-receita.generated.ts`);
}

main();
