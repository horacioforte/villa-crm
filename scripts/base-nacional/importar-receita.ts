// ARQUIVO: scripts/base-nacional/importar-receita.ts
// REGRA: nunca remover. Apenas acrescentar.
// Importador dos Dados Abertos de CNPJ da Receita Federal — filtro CNAE 2330-3/05
// (fabricação de concreto usinado), principal OU secundário, Brasil inteiro (distância
// das filiais da Villa NÃO é critério).
//
// SEGURANÇA (ver lib/base-nacional/ambiente.ts):
// - Nunca importa lib/prisma.ts nem lê .env.local para conectar. Todo acesso ao banco
//   usa carregarAmbienteIsolado() + pg Client, e confere ENDPOINT_AUTORIZADO antes de
//   QUALQUER escrita. Endpoint diferente → lança e para, nada é gravado.
// - NÃO importa o arquivo de Sócios nem qualquer dado de pessoa física (LGPD pendente).
//   Só lê Estabelecimentos e Empresas (e as tabelas de apoio, via lib/base-nacional).
// - NÃO altera campos de validação manual da candidata (statusValidacao, confianca,
//   tipoAtividade, justificativa, validadoPor/Em, empresaId, prioridadeComercial,
//   observacaoComercial) nem contatos/pessoas/potenciais — só preenche dados da Receita.
// - NUNCA faz DELETE. Estabelecimento que sai do filtro ou muda de situação vira
//   ReceitaMudanca; candidata/unidade que desaparece desta competência mantém o último
//   estado conhecido.
//
// Modos:
//   --dry-run (padrão)         → só lê e gera relatório, NÃO toca no banco (nem conecta).
//   --competencia=AAAA-MM      → competência a importar (pasta em ~/villa-dados-receita/AAAA-MM/
//                                 ou indicada por --pasta=).
//   --pasta=<caminho>          → pasta com os arquivos da competência (zip ou .csv simples).
//   --uf=PE                    → filtro adicional só para reduzir volume em teste (não usado
//                                 em produção: distância/UF da Villa não é critério de inclusão).
//   --limite=N                 → lê no máximo N linhas por arquivo (teste).
//   --amostra-ficticia          → usa scripts/base-nacional/fixtures-receita/ em vez de arquivos
//                                 reais; é o ÚNICO jeito de usar --commit nesta etapa.
//   --commit                   → GRAVA no branch isolado. Com dados REAIS é sempre recusado:
//                                 "importação real exige autorização do Horácio."
//
// Uso:
//   npx tsx scripts/base-nacional/importar-receita.ts --amostra-ficticia --competencia=2026-08
//   npx tsx scripts/base-nacional/importar-receita.ts --amostra-ficticia --competencia=2026-08 --commit
//   npx tsx scripts/base-nacional/importar-receita.ts --competencia=2026-09 --uf=PE --limite=50000

import { spawn } from "node:child_process";
import { createReadStream, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";
import { Client } from "pg";

import { carregarAmbienteIsolado } from "../../lib/base-nacional/ambiente";
import { chaveOrdenacao } from "../../lib/base-nacional/contatos";
import { cnaeAlvoComoPrincipal, CNAES_CONCRETO_USINADO, estabelecimentoNoFiltro } from "../../lib/base-nacional/receita/filtro";
import { dividirCnaesSecundarios, parseLinhaEmpresa, parseLinhaEstabelecimento, type LinhaEstabelecimento } from "../../lib/base-nacional/receita/layout";
import {
  capitalSocialParaNumero,
  cnpjCompleto,
  dataReceitaParaDate,
  ehMatrizReceita,
  hashRegistroEstabelecimento,
} from "../../lib/base-nacional/receita/normalizacao";
import { municipioCodigoIbge, nomeMunicipioReceita } from "../../lib/base-nacional/municipios-receita";

export const ENDPOINT_AUTORIZADO = "ep-gentle-king-ajo60u4q";
export const TAMANHO_LOTE = 300;

// ─── Leitura em streaming (zip oficial OU .csv simples, nunca carrega tudo na memória) ──

async function* linhasDeStreamLatin1(stream: Readable): AsyncGenerator<string> {
  let resto = Buffer.alloc(0);
  for await (const pedaco of stream) {
    const chunk = Buffer.isBuffer(pedaco) ? pedaco : Buffer.from(pedaco);
    const buf = Buffer.concat([resto, chunk]);
    let inicio = 0;
    for (;;) {
      const idx = buf.indexOf(0x0a, inicio);
      if (idx === -1) break;
      let fim = idx;
      if (fim > inicio && buf[fim - 1] === 0x0d) fim--;
      yield buf.subarray(inicio, fim).toString("latin1");
      inicio = idx + 1;
    }
    resto = buf.subarray(inicio);
  }
  if (resto.length > 0) yield resto.toString("latin1");
}

async function* linhasDoArquivo(caminho: string): AsyncGenerator<string> {
  if (/\.zip$/i.test(caminho)) {
    const proc = spawn("unzip", ["-p", caminho]);
    let erro: Error | null = null;
    proc.on("error", e => { erro = e; });
    yield* linhasDeStreamLatin1(proc.stdout);
    await new Promise<void>((resolve, reject) => {
      proc.on("close", code => {
        if (erro) reject(erro);
        else if (code !== 0) reject(new Error(`unzip -p saiu com código ${code} (${caminho})`));
        else resolve();
      });
    });
  } else {
    yield* linhasDeStreamLatin1(createReadStream(caminho));
  }
}

/** Resolve os arquivos de uma competência pelo nome oficial (Estabelecimentos0..9.zip / Empresas0..9.zip). */
export function localizarArquivos(pasta: string, prefixo: "Estabelecimentos" | "Empresas"): string[] {
  const regexZip = new RegExp(`^${prefixo}\\d*\\.zip$`, "i");
  const regexCsv = new RegExp(`^${prefixo}.*\\.csv$`, "i");
  return readdirSync(pasta)
    .filter(f => regexZip.test(f) || regexCsv.test(f))
    .sort()
    .map(f => path.join(pasta, f));
}

// ─── Tipos agregados em memória (só os dados das raízes que batem o filtro) ──────────

export type UnidadeAgregada = {
  cnpj: string;
  cnpjBasico: string;
  isMatriz: boolean;
  nomeFantasia: string | null;
  situacaoCadastral: string;
  dataSituacaoCadastral: Date | null;
  motivoSituacaoCadastral: string | null;
  dataInicioAtividade: Date | null;
  cnaePrincipal: string;
  cnaesSecundarios: string[];
  cnaeAlvoComoPrincipal: boolean;
  tipoLogradouro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cep: string | null;
  uf: string | null;
  municipioCodigoReceita: string | null;
  municipioCodigoIbge: string | null;
  municipioNome: string | null;
  ddd1: string | null;
  telefone1: string | null;
  ddd2: string | null;
  telefone2: string | null;
  email: string | null;
};

export type EmpresaAgregada = {
  cnpjBasico: string;
  razaoSocial: string | null;
  naturezaJuridica: string | null;
  qualificacaoResponsavel: string | null;
  capitalSocial: number | null;
  porte: string | null;
};

const vazioParaNull = (v: string | undefined): string | null => (v && v.trim().length > 0 ? v.trim() : null);

function construirUnidade(r: LinhaEstabelecimento): UnidadeAgregada {
  const secundarios = dividirCnaesSecundarios(r.cnaeFiscalSecundaria);
  const cnpj = cnpjCompleto(r.cnpjBasico, r.cnpjOrdem, r.cnpjDv) ?? `${r.cnpjBasico}${r.cnpjOrdem}${r.cnpjDv}`;
  return {
    cnpj,
    cnpjBasico: r.cnpjBasico,
    isMatriz: ehMatrizReceita(r.identificadorMatrizFilial),
    nomeFantasia: vazioParaNull(r.nomeFantasia),
    situacaoCadastral: r.situacaoCadastral,
    dataSituacaoCadastral: dataReceitaParaDate(r.dataSituacaoCadastral),
    motivoSituacaoCadastral: vazioParaNull(r.motivoSituacaoCadastral),
    dataInicioAtividade: dataReceitaParaDate(r.dataInicioAtividade),
    cnaePrincipal: r.cnaeFiscalPrincipal,
    cnaesSecundarios: secundarios,
    cnaeAlvoComoPrincipal: cnaeAlvoComoPrincipal(r.cnaeFiscalPrincipal),
    tipoLogradouro: vazioParaNull(r.tipoLogradouro),
    logradouro: vazioParaNull(r.logradouro),
    numero: vazioParaNull(r.numero),
    complemento: vazioParaNull(r.complemento),
    bairro: vazioParaNull(r.bairro),
    cep: vazioParaNull(r.cep),
    uf: vazioParaNull(r.uf),
    municipioCodigoReceita: vazioParaNull(r.municipio),
    municipioCodigoIbge: municipioCodigoIbge(r.municipio, r.uf),
    municipioNome: nomeMunicipioReceita(r.municipio),
    ddd1: vazioParaNull(r.ddd1),
    telefone1: vazioParaNull(r.telefone1),
    ddd2: vazioParaNull(r.ddd2),
    telefone2: vazioParaNull(r.telefone2),
    email: vazioParaNull(r.email),
  };
}

export type RelatorioLeitura = {
  linhasLidasEstabelecimentos: number;
  linhasMalformadasEstabelecimentos: number;
  estabelecimentosNoFiltro: number;
  linhasLidasEmpresas: number;
  linhasMalformadasEmpresas: number;
  raizesEncontradas: number;
  unidadesTotais: number;
  tempoMs: number;
  memoriaMaximaMb: number;
};

/** Passo 1: lê Estabelecimentos e devolve o conjunto de raízes (cnpjBasico) que batem o filtro de CNAE. */
export async function passo1ColetarRaizes(
  arquivos: string[],
  opts: { uf?: string; limite?: number; alvos?: ReadonlySet<string> } = {},
): Promise<{ raizes: Set<string>; linhasLidas: number; malformadas: number; noFiltro: number }> {
  const raizes = new Set<string>();
  let linhasLidas = 0, malformadas = 0, noFiltro = 0;
  for (const arquivo of arquivos) {
    for await (const linha of linhasDoArquivo(arquivo)) {
      if (opts.limite !== undefined && linhasLidas >= opts.limite) break;
      linhasLidas++;
      const r = parseLinhaEstabelecimento(linha);
      if (!r) { malformadas++; continue; }
      if (opts.uf && r.uf.toUpperCase() !== opts.uf.toUpperCase()) continue;
      const secundarios = dividirCnaesSecundarios(r.cnaeFiscalSecundaria);
      if (estabelecimentoNoFiltro(r.cnaeFiscalPrincipal, secundarios, opts.alvos ?? CNAES_CONCRETO_USINADO)) {
        noFiltro++;
        raizes.add(r.cnpjBasico);
      }
    }
  }
  return { raizes, linhasLidas, malformadas, noFiltro };
}

/** Passo 2: lê Estabelecimentos de novo e traz TODAS as unidades das raízes encontradas (matriz e filiais, mesmo sem o CNAE alvo). */
export async function passo2ColetarUnidades(
  arquivos: string[],
  raizes: ReadonlySet<string>,
  opts: { limite?: number } = {},
): Promise<{ unidadesPorRaiz: Map<string, UnidadeAgregada[]>; linhasLidas: number; malformadas: number }> {
  const unidadesPorRaiz = new Map<string, UnidadeAgregada[]>();
  let linhasLidas = 0, malformadas = 0;
  for (const arquivo of arquivos) {
    for await (const linha of linhasDoArquivo(arquivo)) {
      if (opts.limite !== undefined && linhasLidas >= opts.limite) break;
      linhasLidas++;
      const r = parseLinhaEstabelecimento(linha);
      if (!r) { malformadas++; continue; }
      if (!raizes.has(r.cnpjBasico)) continue;
      const lista = unidadesPorRaiz.get(r.cnpjBasico) ?? [];
      lista.push(construirUnidade(r));
      unidadesPorRaiz.set(r.cnpjBasico, lista);
    }
  }
  return { unidadesPorRaiz, linhasLidas, malformadas };
}

/** Passo 3: lê Empresas e traz razão social, natureza, porte e capital das raízes encontradas. NUNCA lê Sócios. */
export async function passo3ColetarEmpresas(
  arquivos: string[],
  raizes: ReadonlySet<string>,
  opts: { limite?: number } = {},
): Promise<{ empresas: Map<string, EmpresaAgregada>; linhasLidas: number; malformadas: number }> {
  const empresas = new Map<string, EmpresaAgregada>();
  let linhasLidas = 0, malformadas = 0;
  for (const arquivo of arquivos) {
    for await (const linha of linhasDoArquivo(arquivo)) {
      if (opts.limite !== undefined && linhasLidas >= opts.limite) break;
      linhasLidas++;
      const r = parseLinhaEmpresa(linha);
      if (!r) { malformadas++; continue; }
      if (!raizes.has(r.cnpjBasico)) continue;
      empresas.set(r.cnpjBasico, {
        cnpjBasico: r.cnpjBasico,
        razaoSocial: vazioParaNull(r.razaoSocial),
        naturezaJuridica: vazioParaNull(r.naturezaJuridica),
        qualificacaoResponsavel: vazioParaNull(r.qualificacaoResponsavel),
        capitalSocial: capitalSocialParaNumero(r.capitalSocial),
        porte: vazioParaNull(r.porte),
      });
    }
  }
  return { empresas, linhasLidas, malformadas };
}

export type ResultadoLeitura = {
  raizes: Set<string>;
  unidadesPorRaiz: Map<string, UnidadeAgregada[]>;
  empresas: Map<string, EmpresaAgregada>;
  relatorio: RelatorioLeitura;
};

/** Orquestra os 3 passos sobre uma pasta de competência. Nunca toca em banco. */
export async function lerCompetencia(pasta: string, opts: { uf?: string; limite?: number } = {}): Promise<ResultadoLeitura> {
  const t0 = Date.now();
  const arquivosEstab = localizarArquivos(pasta, "Estabelecimentos");
  const arquivosEmp = localizarArquivos(pasta, "Empresas");
  if (arquivosEstab.length === 0) throw new Error(`[importar-receita] nenhum arquivo Estabelecimentos* encontrado em ${pasta}`);
  if (arquivosEmp.length === 0) throw new Error(`[importar-receita] nenhum arquivo Empresas* encontrado em ${pasta}`);

  const p1 = await passo1ColetarRaizes(arquivosEstab, opts);
  const p2 = await passo2ColetarUnidades(arquivosEstab, p1.raizes, { limite: opts.limite });
  const p3 = await passo3ColetarEmpresas(arquivosEmp, p1.raizes, { limite: opts.limite });

  const unidadesTotais = [...p2.unidadesPorRaiz.values()].reduce((a, l) => a + l.length, 0);
  const relatorio: RelatorioLeitura = {
    linhasLidasEstabelecimentos: p1.linhasLidas + p2.linhasLidas,
    linhasMalformadasEstabelecimentos: p1.malformadas + p2.malformadas,
    estabelecimentosNoFiltro: p1.noFiltro,
    linhasLidasEmpresas: p3.linhasLidas,
    linhasMalformadasEmpresas: p3.malformadas,
    raizesEncontradas: p1.raizes.size,
    unidadesTotais,
    tempoMs: Date.now() - t0,
    memoriaMaximaMb: Math.round((process.memoryUsage().heapUsed / (1024 * 1024)) * 10) / 10,
  };
  return { raizes: p1.raizes, unidadesPorRaiz: p2.unidadesPorRaiz, empresas: p3.empresas, relatorio };
}

// ─── Gravação (só quando autorizada — ver main()) ────────────────────────────────────

export type MudancaParaGravar = {
  cnpj: string;
  cnpjBasico: string;
  tipo: "NOVO_ESTABELECIMENTO" | "SAIU_DO_FILTRO" | "SITUACAO_ALTERADA" | "ENDERECO_ALTERADO" | "CNAE_ALTERADO" | "NOME_ALTERADO" | "CONTATO_ALTERADO" | "PORTE_ALTERADO" | "CAPITAL_ALTERADO";
  campo: string | null;
  valorAnterior: string | null;
  valorNovo: string | null;
};

type LinhaAnterior = {
  cnpj: string;
  cnpjBasico: string;
  hashRegistro: string;
  situacaoCadastral: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
  cnaePrincipal: string;
  cnaesSecundarios: string[];
  nomeFantasia: string | null;
  razaoSocial: string | null;
  telefone1: string | null;
  email: string | null;
  porte: string | null;
  capitalSocial: string | null;
};

function montarHashAtual(u: UnidadeAgregada, empresa: EmpresaAgregada | undefined): string {
  return hashRegistroEstabelecimento({
    situacaoCadastral: u.situacaoCadastral,
    razaoSocial: empresa?.razaoSocial ?? null,
    nomeFantasia: u.nomeFantasia,
    cnaePrincipal: u.cnaePrincipal,
    cnaesSecundarios: u.cnaesSecundarios,
    logradouro: u.logradouro,
    numero: u.numero,
    complemento: u.complemento,
    bairro: u.bairro,
    cep: u.cep,
    uf: u.uf,
    municipio: u.municipioCodigoReceita,
    telefone1: u.telefone1,
    telefone2: u.telefone2,
    email: u.email,
    porte: empresa?.porte ?? null,
    capitalSocial: empresa?.capitalSocial ?? null,
  });
}

/**
 * Compara a leitura atual com a competência anterior (se houver) e devolve as
 * ReceitaMudanca a gravar. Cobre tanto unidades que ficaram (mas mudaram campo a
 * campo) quanto: (a) unidades novas dentro de uma raiz já conhecida; (b) unidades que
 * desapareceram de uma raiz ainda presente; (c) raízes inteiras que saíram do filtro
 * (nenhuma unidade bateu o CNAE nesta competência) — nestas, o último estado conhecido
 * é preservado (nunca apagado), só é registrada a mudança.
 */
export async function compararComCompetenciaAnterior(
  c: Client,
  params: {
    competenciaAnteriorId: string | null;
    competenciaAnteriorStr: string | null;
    unidadesPorRaiz: Map<string, UnidadeAgregada[]>;
    empresas: Map<string, EmpresaAgregada>;
  },
): Promise<MudancaParaGravar[]> {
  if (!params.competenciaAnteriorId) return [];
  const mudancas: MudancaParaGravar[] = [];
  const cnpjsAtuaisPorRaiz = new Map<string, Set<string>>();

  for (const [cnpjBasico, unidades] of params.unidadesPorRaiz) {
    const empresa = params.empresas.get(cnpjBasico);
    const vistos = new Set<string>();
    cnpjsAtuaisPorRaiz.set(cnpjBasico, vistos);
    for (const u of unidades) {
      vistos.add(u.cnpj);
      const anteriorRows = await c.query(
        `SELECT cnpj,"cnpjBasico","hashRegistro","situacaoCadastral",logradouro,numero,bairro,cep,"cnaePrincipal","cnaesSecundarios","nomeFantasia","razaoSocial",telefone1,email,porte,"capitalSocial"
         FROM "ReceitaEstabelecimento" WHERE "competenciaId" = $1 AND cnpj = $2`,
        [params.competenciaAnteriorId, u.cnpj],
      );
      const anterior = anteriorRows.rows[0] as LinhaAnterior | undefined;
      if (!anterior) {
        mudancas.push({ cnpj: u.cnpj, cnpjBasico, tipo: "NOVO_ESTABELECIMENTO", campo: "estabelecimento", valorAnterior: null, valorNovo: `Novo estabelecimento em ${u.municipioNome ?? u.uf ?? "?"}` });
        continue;
      }
      const hashAtual = montarHashAtual(u, empresa);
      if (anterior.hashRegistro === hashAtual) continue;

      if (anterior.situacaoCadastral !== u.situacaoCadastral) {
        mudancas.push({ cnpj: u.cnpj, cnpjBasico, tipo: "SITUACAO_ALTERADA", campo: "situacaoCadastral", valorAnterior: anterior.situacaoCadastral, valorNovo: u.situacaoCadastral });
      }
      if ((anterior.logradouro ?? null) !== u.logradouro || (anterior.numero ?? null) !== u.numero || (anterior.bairro ?? null) !== u.bairro || (anterior.cep ?? null) !== u.cep) {
        mudancas.push({ cnpj: u.cnpj, cnpjBasico, tipo: "ENDERECO_ALTERADO", campo: "logradouro", valorAnterior: anterior.logradouro, valorNovo: u.logradouro });
      }
      const secAnt = [...(anterior.cnaesSecundarios ?? [])].sort().join(",");
      const secNovo = [...u.cnaesSecundarios].sort().join(",");
      if (anterior.cnaePrincipal !== u.cnaePrincipal || secAnt !== secNovo) {
        mudancas.push({ cnpj: u.cnpj, cnpjBasico, tipo: "CNAE_ALTERADO", campo: "cnaePrincipal", valorAnterior: anterior.cnaePrincipal, valorNovo: u.cnaePrincipal });
      }
      if ((anterior.nomeFantasia ?? null) !== u.nomeFantasia || (anterior.razaoSocial ?? null) !== (empresa?.razaoSocial ?? null)) {
        mudancas.push({ cnpj: u.cnpj, cnpjBasico, tipo: "NOME_ALTERADO", campo: "nomeFantasia", valorAnterior: anterior.nomeFantasia, valorNovo: u.nomeFantasia });
      }
      if ((anterior.telefone1 ?? null) !== u.telefone1 || (anterior.email ?? null) !== u.email) {
        mudancas.push({ cnpj: u.cnpj, cnpjBasico, tipo: "CONTATO_ALTERADO", campo: "telefone1", valorAnterior: anterior.telefone1, valorNovo: u.telefone1 });
      }
      if ((anterior.porte ?? null) !== (empresa?.porte ?? null)) {
        mudancas.push({ cnpj: u.cnpj, cnpjBasico, tipo: "PORTE_ALTERADO", campo: "porte", valorAnterior: anterior.porte, valorNovo: empresa?.porte ?? null });
      }
      const capAnterior = anterior.capitalSocial === null ? null : Number(anterior.capitalSocial);
      if (capAnterior !== (empresa?.capitalSocial ?? null)) {
        mudancas.push({ cnpj: u.cnpj, cnpjBasico, tipo: "CAPITAL_ALTERADO", campo: "capitalSocial", valorAnterior: capAnterior === null ? null : String(capAnterior), valorNovo: empresa?.capitalSocial === undefined || empresa?.capitalSocial === null ? null : String(empresa.capitalSocial) });
      }
    }
  }

  // (b) unidades que existiam na competência anterior, dentro de uma raiz ainda presente, e desapareceram.
  for (const [cnpjBasico, vistos] of cnpjsAtuaisPorRaiz) {
    const antigos = await c.query(`SELECT cnpj FROM "ReceitaEstabelecimento" WHERE "competenciaId" = $1 AND "cnpjBasico" = $2`, [params.competenciaAnteriorId, cnpjBasico]);
    for (const row of antigos.rows as Array<{ cnpj: string }>) {
      if (!vistos.has(row.cnpj)) {
        mudancas.push({ cnpj: row.cnpj, cnpjBasico, tipo: "SAIU_DO_FILTRO", campo: "estabelecimento", valorAnterior: "presente no filtro", valorNovo: null });
      }
    }
  }

  // (c) raízes inteiras que saíram do filtro (candidata já existia, estava na competência anterior,
  // e nenhuma unidade dela bateu o CNAE nesta competência — por isso nem aparece em unidadesPorRaiz).
  if (params.competenciaAnteriorStr) {
    const candidatasAnteriores = await c.query(
      `SELECT "cnpjBasico" FROM "ConcreteiraCandidata" WHERE "ultimaCompetencia" = $1`,
      [params.competenciaAnteriorStr],
    );
    for (const row of candidatasAnteriores.rows as Array<{ cnpjBasico: string }>) {
      if (params.unidadesPorRaiz.has(row.cnpjBasico)) continue; // já tratada acima
      const antigos = await c.query(`SELECT cnpj FROM "ReceitaEstabelecimento" WHERE "competenciaId" = $1 AND "cnpjBasico" = $2`, [params.competenciaAnteriorId, row.cnpjBasico]);
      for (const antigo of antigos.rows as Array<{ cnpj: string }>) {
        mudancas.push({ cnpj: antigo.cnpj, cnpjBasico: row.cnpjBasico, tipo: "SAIU_DO_FILTRO", campo: "estabelecimento", valorAnterior: "presente no filtro", valorNovo: null });
      }
    }
  }

  return mudancas;
}

async function gravarCompetencia(c: Client, id: string, competencia: string, fonteUrl: string | null): Promise<string> {
  const r = await c.query(
    `INSERT INTO "ReceitaCompetencia"(id, competencia, "fonteUrl", status, "cnaesFiltro", "ufsFiltro", "updatedAt")
     VALUES ($1,$2,$3,'PROCESSANDO',$4,'{}',now())
     ON CONFLICT (competencia) DO UPDATE SET status = 'PROCESSANDO', "fonteUrl" = EXCLUDED."fonteUrl", "updatedAt" = now()
     RETURNING id`,
    [id, competencia, fonteUrl, [...CNAES_CONCRETO_USINADO]],
  );
  return r.rows[0].id as string;
}

async function gravarEstabelecimentosLote(
  c: Client,
  competenciaId: string,
  lote: Array<{ unidade: UnidadeAgregada; empresa: EmpresaAgregada | undefined }>,
): Promise<void> {
  if (lote.length === 0) return;
  const colunas = [
    "id", "competenciaId", "cnpj", "cnpjBasico", "cnpjOrdem", "cnpjDv", "isMatriz", "razaoSocial", "nomeFantasia",
    "situacaoCadastral", "dataSituacaoCadastral", "motivoSituacao", "dataInicioAtividade", "cnaePrincipal", "cnaesSecundarios",
    "cnaeAlvoComoPrincipal", "naturezaJuridica", "porte", "capitalSocial", "tipoLogradouro", "logradouro", "numero",
    "complemento", "bairro", "cep", "municipioCodigoReceita", "municipioCodigoIbge", "municipioNome", "uf",
    "ddd1", "telefone1", "ddd2", "telefone2", "email", "hashRegistro",
  ];
  const linhas: string[] = [];
  const valores: unknown[] = [];
  lote.forEach(({ unidade: u, empresa }, i) => {
    const base = i * colunas.length;
    linhas.push(`(${colunas.map((_, j) => `$${base + j + 1}`).join(",")})`);
    valores.push(
      `rfb-est-${competenciaId}-${u.cnpj}`, competenciaId, u.cnpj, u.cnpjBasico, u.cnpj.slice(8, 12), u.cnpj.slice(12, 14), u.isMatriz,
      empresa?.razaoSocial ?? null, u.nomeFantasia, u.situacaoCadastral, u.dataSituacaoCadastral, u.motivoSituacaoCadastral, u.dataInicioAtividade,
      u.cnaePrincipal, u.cnaesSecundarios, u.cnaeAlvoComoPrincipal, empresa?.naturezaJuridica ?? null, empresa?.porte ?? null, empresa?.capitalSocial ?? null,
      u.tipoLogradouro, u.logradouro, u.numero, u.complemento, u.bairro, u.cep, u.municipioCodigoReceita, u.municipioCodigoIbge, u.municipioNome, u.uf,
      u.ddd1, u.telefone1, u.ddd2, u.telefone2, u.email, montarHashAtual(u, empresa),
    );
  });
  const setClause = colunas.filter(c2 => c2 !== "id" && c2 !== "competenciaId" && c2 !== "cnpj").map(c2 => `"${c2}" = EXCLUDED."${c2}"`).join(", ");
  await c.query(
    `INSERT INTO "ReceitaEstabelecimento"(${colunas.map(c2 => `"${c2}"`).join(",")}) VALUES ${linhas.join(",")}
     ON CONFLICT ("competenciaId", cnpj) DO UPDATE SET ${setClause}`,
    valores,
  );
}

async function gravarMudancasLote(c: Client, competenciaId: string, competenciaAnteriorId: string, lote: MudancaParaGravar[]): Promise<void> {
  if (lote.length === 0) return;
  const colunas = ["id", "competenciaId", "competenciaAnteriorId", "cnpj", "cnpjBasico", "tipo", "campo", "valorAnterior", "valorNovo"];
  const linhas: string[] = [];
  const valores: unknown[] = [];
  lote.forEach((m, i) => {
    const base = i * colunas.length;
    linhas.push(`(${colunas.map((_, j) => `$${base + j + 1}`).join(",")})`);
    // id determinístico (sem Date.now()/random): reimportar a MESMA competência gera os
    // mesmos ids e o ON CONFLICT abaixo evita duplicar — é o que torna isto idempotente.
    valores.push(`rfb-mud-${competenciaId}-${m.cnpj}-${m.tipo}`, competenciaId, competenciaAnteriorId, m.cnpj, m.cnpjBasico, m.tipo, m.campo, m.valorAnterior, m.valorNovo);
  });
  await c.query(
    `INSERT INTO "ReceitaMudanca"(${colunas.map(c2 => `"${c2}"`).join(",")}) VALUES ${linhas.join(",")} ON CONFLICT (id) DO NOTHING`,
    valores,
  );
}

/** Upsert de ConcreteiraCandidata — toca SOMENTE campos originados da Receita. Nunca cria histórico/validação manual. */
async function upsertCandidata(
  c: Client,
  cnpjBasico: string,
  unidades: UnidadeAgregada[],
  empresa: EmpresaAgregada | undefined,
  competencia: string,
): Promise<{ candidataId: string; criada: boolean }> {
  const matriz = unidades.find(u => u.isMatriz) ?? unidades[0];
  const ativas = unidades.filter(u => u.situacaoCadastral === "02").length;
  const nomeOrd = chaveOrdenacao(empresa?.razaoSocial ?? matriz?.nomeFantasia ?? null);
  const existente = await c.query(`SELECT id, "primeiraCompetencia" FROM "ConcreteiraCandidata" WHERE "cnpjBasico" = $1`, [cnpjBasico]);
  if (existente.rows.length === 0) {
    const id = `rfb-cand-${cnpjBasico}`;
    await c.query(
      `INSERT INTO "ConcreteiraCandidata"(id,"cnpjBasico","cnpjMatriz","razaoSocial","nomeFantasia","naturezaJuridica",porte,"capitalSocial","ufMatriz","municipioMatriz",
         "totalUnidades","totalUnidadesAtivas","primeiraCompetencia","ultimaCompetencia","nomeOrdenacao","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$14,now())`,
      [id, cnpjBasico, matriz?.cnpj ?? null, empresa?.razaoSocial ?? null, matriz?.nomeFantasia ?? null, empresa?.naturezaJuridica ?? null,
        empresa?.porte ?? null, empresa?.capitalSocial ?? null, matriz?.uf ?? null, matriz?.municipioNome ?? null,
        unidades.length, ativas, competencia, nomeOrd],
    );
    return { candidataId: id, criada: true };
  }
  const id = existente.rows[0].id as string;
  await c.query(
    `UPDATE "ConcreteiraCandidata" SET "cnpjMatriz"=$2,"razaoSocial"=$3,"nomeFantasia"=$4,"naturezaJuridica"=$5,porte=$6,"capitalSocial"=$7,
       "ufMatriz"=$8,"municipioMatriz"=$9,"totalUnidades"=$10,"totalUnidadesAtivas"=$11,"ultimaCompetencia"=$12,"nomeOrdenacao"=$13,"updatedAt"=now()
     WHERE id=$1`,
    [id, matriz?.cnpj ?? null, empresa?.razaoSocial ?? null, matriz?.nomeFantasia ?? null, empresa?.naturezaJuridica ?? null,
      empresa?.porte ?? null, empresa?.capitalSocial ?? null, matriz?.uf ?? null, matriz?.municipioNome ?? null,
      unidades.length, ativas, competencia, nomeOrd],
  );
  return { candidataId: id, criada: false };
}

async function upsertUnidade(c: Client, candidataId: string, u: UnidadeAgregada, competencia: string): Promise<void> {
  await c.query(
    `INSERT INTO "ConcreteiraCandidataUnidade"(id,"candidataId",cnpj,"isMatriz","nomeFantasia","situacaoCadastral",ativa,"dataInicioAtividade",
       "cnaePrincipal","cnaesSecundarios","cnaeAlvoComoPrincipal","tipoLogradouro",logradouro,numero,complemento,bairro,cep,
       "municipioCodigoIbge","municipioNome",uf,"primeiraCompetencia","ultimaCompetencia","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$21,now())
     ON CONFLICT (cnpj) DO UPDATE SET
       "candidataId"=EXCLUDED."candidataId", "isMatriz"=EXCLUDED."isMatriz", "nomeFantasia"=EXCLUDED."nomeFantasia",
       "situacaoCadastral"=EXCLUDED."situacaoCadastral", ativa=EXCLUDED.ativa, "dataInicioAtividade"=EXCLUDED."dataInicioAtividade",
       "cnaePrincipal"=EXCLUDED."cnaePrincipal", "cnaesSecundarios"=EXCLUDED."cnaesSecundarios", "cnaeAlvoComoPrincipal"=EXCLUDED."cnaeAlvoComoPrincipal",
       "tipoLogradouro"=EXCLUDED."tipoLogradouro", logradouro=EXCLUDED.logradouro, numero=EXCLUDED.numero, complemento=EXCLUDED.complemento,
       bairro=EXCLUDED.bairro, cep=EXCLUDED.cep, "municipioCodigoIbge"=EXCLUDED."municipioCodigoIbge", "municipioNome"=EXCLUDED."municipioNome",
       uf=EXCLUDED.uf, "ultimaCompetencia"=EXCLUDED."ultimaCompetencia", "updatedAt"=now()`,
    [`rfb-uni-${u.cnpj}`, candidataId, u.cnpj, u.isMatriz, u.nomeFantasia, u.situacaoCadastral, u.situacaoCadastral === "02",
      u.dataInicioAtividade, u.cnaePrincipal, u.cnaesSecundarios, u.cnaeAlvoComoPrincipal, u.tipoLogradouro, u.logradouro, u.numero,
      u.complemento, u.bairro, u.cep, u.municipioCodigoIbge, u.municipioNome, u.uf, competencia],
  );
}

const RELEVANTES_PARA_HISTORICO = new Set<MudancaParaGravar["tipo"]>(["NOVO_ESTABELECIMENTO", "SAIU_DO_FILTRO", "SITUACAO_ALTERADA"]);

async function gravarHistoricoSeRelevante(c: Client, candidataId: string, competenciaId: string, candidataCriada: boolean, mudancasDaRaiz: MudancaParaGravar[], agente: string): Promise<void> {
  // ids determinísticos (sem Date.now()/random), escopados pela competência: reimportar
  // a MESMA competência não duplica histórico (ON CONFLICT DO NOTHING).
  if (candidataCriada) {
    await c.query(
      `INSERT INTO "ConcreteiraValidacaoHistorico"(id,"candidataId","statusNovo",motivo,agente,"tipoEvento",origem)
       VALUES ($1,$2,'PENDENTE','Candidata nova encontrada via importação da Receita Federal.',$3,'VALIDACAO','IMPORTACAO_RECEITA')
       ON CONFLICT (id) DO NOTHING`,
      [`rfb-hist-novo-${candidataId}-${competenciaId}`, candidataId, agente],
    );
  }
  const relevantes = mudancasDaRaiz.filter(m => RELEVANTES_PARA_HISTORICO.has(m.tipo));
  if (relevantes.length === 0) return;
  // statusNovo é obrigatório no schema. O importador NUNCA altera a validação manual
  // (rule 5) — por isso grava o status ATUAL da candidata, sem mudar (statusAnterior = statusNovo).
  const statusAtual = (await c.query(`SELECT "statusValidacao" FROM "ConcreteiraCandidata" WHERE id = $1`, [candidataId])).rows[0]["statusValidacao"] as string;
  for (const m of relevantes) {
    await c.query(
      `INSERT INTO "ConcreteiraValidacaoHistorico"(id,"candidataId","statusAnterior","statusNovo",motivo,agente,"tipoEvento",origem,campo,"valorAnterior","valorNovo","entidadeId")
       VALUES ($1,$2,$3,$3,$4,$5,'OUTRO','IMPORTACAO_RECEITA',$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [`rfb-hist-${candidataId}-${m.cnpj}-${m.tipo}-${competenciaId}`, candidataId, statusAtual,
        `${m.tipo} (${m.cnpj}) — importação da Receita Federal.`, agente, m.campo, m.valorAnterior, m.valorNovo, m.cnpj],
    );
  }
}

export type ResultadoGravacao = {
  competenciaId: string;
  candidatasCriadas: number;
  candidatasAtualizadas: number;
  unidadesGravadas: number;
  estabelecimentosGravados: number;
  mudancasGravadas: number;
};

/**
 * Grava o resultado de lerCompetencia() no branch isolado. Idempotente: rodar duas
 * vezes para a MESMA competência não duplica nada (upserts por chave única).
 * NÃO gerencia transação (BEGIN/COMMIT) — quem chama decide: o CLI comita em lotes
 * (resumível por idempotência), o teste de integração embrulha tudo em UMA transação
 * com ROLLBACK no final.
 */
export async function gravarNoBranch(
  c: Client,
  params: {
    competencia: string;
    fonteUrl: string | null;
    leitura: ResultadoLeitura;
    competenciaAnteriorId: string | null;
    competenciaAnteriorStr: string | null;
    agente: string;
  },
): Promise<ResultadoGravacao> {
  const competenciaId = await gravarCompetencia(c, `rfb-comp-${params.competencia}`, params.competencia, params.fonteUrl);

  const mudancas = await compararComCompetenciaAnterior(c, {
    competenciaAnteriorId: params.competenciaAnteriorId,
    competenciaAnteriorStr: params.competenciaAnteriorStr,
    unidadesPorRaiz: params.leitura.unidadesPorRaiz,
    empresas: params.leitura.empresas,
  });
  if (params.competenciaAnteriorId && mudancas.length > 0) {
    for (let i = 0; i < mudancas.length; i += TAMANHO_LOTE) {
      await gravarMudancasLote(c, competenciaId, params.competenciaAnteriorId, mudancas.slice(i, i + TAMANHO_LOTE));
    }
  }

  let estabelecimentosGravados = 0, candidatasCriadas = 0, candidatasAtualizadas = 0, unidadesGravadas = 0;
  for (const [cnpjBasico, unidades] of params.leitura.unidadesPorRaiz) {
    const empresa = params.leitura.empresas.get(cnpjBasico);
    for (let i = 0; i < unidades.length; i += TAMANHO_LOTE) {
      const lote = unidades.slice(i, i + TAMANHO_LOTE).map(unidade => ({ unidade, empresa }));
      await gravarEstabelecimentosLote(c, competenciaId, lote);
      estabelecimentosGravados += lote.length;
    }
    const { candidataId, criada } = await upsertCandidata(c, cnpjBasico, unidades, empresa, params.competencia);
    if (criada) candidatasCriadas++; else candidatasAtualizadas++;
    for (const u of unidades) {
      await upsertUnidade(c, candidataId, u, params.competencia);
      unidadesGravadas++;
    }
    const mudancasDaRaiz = mudancas.filter(m => m.cnpjBasico === cnpjBasico);
    await gravarHistoricoSeRelevante(c, candidataId, competenciaId, criada, mudancasDaRaiz, params.agente);
  }

  const totalRegistros = await c.query(`SELECT count(*)::int n FROM "ReceitaEstabelecimento" WHERE "competenciaId" = $1`, [competenciaId]);
  await c.query(`UPDATE "ReceitaCompetencia" SET status='CONCLUIDA', "coletadoEm"=now(), "totalRegistros"=$2, "updatedAt"=now() WHERE id=$1`, [competenciaId, totalRegistros.rows[0].n]);

  return { competenciaId, candidatasCriadas, candidatasAtualizadas, unidadesGravadas, estabelecimentosGravados, mudancasGravadas: mudancas.length };
}

// ─── CLI ──────────────────────────────────────────────────────────────────────────────

function arg(nome: string): string | undefined {
  const pref = `--${nome}=`;
  const achado = process.argv.find(a => a.startsWith(pref));
  return achado?.slice(pref.length);
}

async function main() {
  const amostraFicticia = process.argv.includes("--amostra-ficticia");
  const commit = process.argv.includes("--commit");
  const competencia = arg("competencia");
  const uf = arg("uf");
  const limiteStr = arg("limite");
  const limite = limiteStr ? Number(limiteStr) : undefined;

  if (!competencia) throw new Error("[importar-receita] informe --competencia=AAAA-MM");

  const pasta = arg("pasta") ?? (amostraFicticia
    ? path.join(__dirname, "fixtures-receita", competencia)
    : path.join(os.homedir(), "villa-dados-receita", competencia));

  // Trava (revisão 07/10/2026): no modo amostra fictícia a pasta TEM de estar dentro de fixtures-receita/,
  // para que --pasta não permita gravar arquivos reais disfarçados de amostra.
  if (amostraFicticia) {
    const raizFixtures = path.resolve(__dirname, "fixtures-receita") + path.sep;
    if (!(path.resolve(pasta) + path.sep).startsWith(raizFixtures)) {
      throw new Error("[importar-receita] BLOQUEADO: --amostra-ficticia só aceita pastas dentro de scripts/base-nacional/fixtures-receita/.");
    }
  }

  console.log(`[importar-receita] competência ${competencia} · pasta ${pasta} · modo ${commit ? "COMMIT" : "dry-run"}${amostraFicticia ? " · AMOSTRA FICTÍCIA" : ""}`);
  if (uf) console.log(`[importar-receita] filtro --uf=${uf} (só reduz volume de teste; produção considera o Brasil inteiro)`);

  const leitura = await lerCompetencia(pasta, { uf, limite });
  const r = leitura.relatorio;
  console.log(`[importar-receita] linhas lidas (Estabelecimentos): ${r.linhasLidasEstabelecimentos} (${r.linhasMalformadasEstabelecimentos} malformadas ignoradas)`);
  console.log(`[importar-receita] estabelecimentos no filtro: ${r.estabelecimentosNoFiltro} · raízes: ${r.raizesEncontradas} · unidades totais: ${r.unidadesTotais}`);
  console.log(`[importar-receita] linhas lidas (Empresas): ${r.linhasLidasEmpresas} (${r.linhasMalformadasEmpresas} malformadas ignoradas)`);
  console.log(`[importar-receita] tempo: ${r.tempoMs} ms · memória (heap usado no fim): ${r.memoriaMaximaMb} MB`);

  if (!commit) {
    console.log("[importar-receita] dry-run: nada foi gravado no banco (nenhuma conexão aberta).");
    return;
  }
  if (!amostraFicticia) {
    throw new Error("[importar-receita] BLOQUEADO: importação real exige autorização do Horácio. Use --amostra-ficticia para testar a gravação.");
  }

  const amb = carregarAmbienteIsolado();
  if (amb.endpoint !== ENDPOINT_AUTORIZADO) {
    throw new Error(`[importar-receita] BLOQUEADO: endpoint ${amb.endpointMascarado} não é o branch autorizado. Nada foi feito.`);
  }
  console.log(`[importar-receita] branch autorizado confirmado (${amb.endpointMascarado})`);

  const c = new Client({ connectionString: amb.url });
  await c.connect();
  try {
    await c.query("BEGIN");
    const anteriorStr = arg("competencia-anterior") ?? null;
    const anterior = anteriorStr ? await c.query(`SELECT id FROM "ReceitaCompetencia" WHERE competencia = $1`, [anteriorStr]) : null;
    const resultado = await gravarNoBranch(c, {
      competencia,
      fonteUrl: amostraFicticia ? "amostra-ficticia://sem-fonte-real" : `https://arquivos.receitafederal.gov.br (${competencia})`,
      leitura,
      competenciaAnteriorId: anterior?.rows[0]?.id ?? null,
      competenciaAnteriorStr: anterior ? anteriorStr : null,
      agente: "importar-receita",
    });
    await c.query("COMMIT");
    console.log(`[importar-receita] gravado: ${resultado.candidatasCriadas} candidatas novas, ${resultado.candidatasAtualizadas} atualizadas, ${resultado.unidadesGravadas} unidades, ${resultado.estabelecimentosGravados} registros da Receita, ${resultado.mudancasGravadas} mudanças.`);
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await c.end();
  }
}

if (require.main === module) {
  main().catch(e => { console.error(e instanceof Error ? e.message : "erro"); process.exit(1); });
}
