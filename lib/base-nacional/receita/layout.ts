// ARQUIVO: lib/base-nacional/receita/layout.ts
// REGRA: nunca remover. Apenas acrescentar.
// Layout oficial dos arquivos de Dados Abertos do CNPJ da Receita Federal —
// ESTABELECIMENTOS e EMPRESAS. Funções puras, sem I/O e sem banco.
//
// Formato: CSV sem cabeçalho, separador ";", cada campo entre aspas duplas, latin1.
// Fonte: dicionário de dados oficial publicado junto aos arquivos em
// https://arquivos.receitafederal.gov.br (pasta mensal dos Dados Abertos do CNPJ).

/** Ordem oficial das colunas de ESTABELECIMENTOS (30 colunas). */
export const COLUNAS_ESTABELECIMENTOS = [
  "cnpjBasico",
  "cnpjOrdem",
  "cnpjDv",
  "identificadorMatrizFilial", // "1" = matriz, "2" = filial
  "nomeFantasia",
  "situacaoCadastral",
  "dataSituacaoCadastral", // AAAAMMDD
  "motivoSituacaoCadastral",
  "nomeCidadeExterior",
  "pais",
  "dataInicioAtividade", // AAAAMMDD
  "cnaeFiscalPrincipal",
  "cnaeFiscalSecundaria", // lista separada por vírgula, pode ser vazia
  "tipoLogradouro",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cep",
  "uf",
  "municipio", // código RFB — NÃO é o código IBGE
  "ddd1",
  "telefone1",
  "ddd2",
  "telefone2",
  "dddFax",
  "fax",
  "email",
  "situacaoEspecial",
  "dataSituacaoEspecial", // AAAAMMDD
] as const;

/** Ordem oficial das colunas de EMPRESAS (7 colunas). */
export const COLUNAS_EMPRESAS = [
  "cnpjBasico",
  "razaoSocial",
  "naturezaJuridica",
  "qualificacaoResponsavel",
  "capitalSocial", // decimal com vírgula, ex.: "2500000,00"
  "porte",
  "enteFederativoResponsavel",
] as const;

export type LinhaEstabelecimento = Record<(typeof COLUNAS_ESTABELECIMENTOS)[number], string>;
export type LinhaEmpresa = Record<(typeof COLUNAS_EMPRESAS)[number], string>;

/**
 * Divide uma linha CSV no formato da Receita: separador ";", campos entre aspas
 * duplas (aspas duplicadas "" escapam uma aspa literal dentro do campo).
 */
export function dividirLinhaCsv(linha: string, separador = ";"): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (dentroAspas) {
      if (ch === '"') {
        if (linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          dentroAspas = false;
        }
      } else {
        atual += ch;
      }
    } else if (ch === '"') {
      dentroAspas = true;
    } else if (ch === separador) {
      campos.push(atual);
      atual = "";
    } else {
      atual += ch;
    }
  }
  campos.push(atual);
  return campos;
}

/** "1234567,2345678" → ["1234567","2345678"]; vazio → []. */
export function dividirCnaesSecundarios(valor: string): string[] {
  return valor
    .split(",")
    .map(v => v.trim())
    .filter(v => v.length > 0);
}

function montarRegistro<T extends readonly string[]>(colunas: T, campos: string[]): Record<T[number], string> | null {
  if (campos.length !== colunas.length) return null;
  const registro = {} as Record<T[number], string>;
  colunas.forEach((nome, i) => {
    registro[nome as T[number]] = campos[i];
  });
  return registro;
}

/** Faz o parse de uma linha de ESTABELECIMENTOS. Retorna null se a linha for malformada. */
export function parseLinhaEstabelecimento(linha: string): LinhaEstabelecimento | null {
  if (!linha.trim()) return null;
  const campos = dividirLinhaCsv(linha);
  return montarRegistro(COLUNAS_ESTABELECIMENTOS, campos);
}

/** Faz o parse de uma linha de EMPRESAS. Retorna null se a linha for malformada. */
export function parseLinhaEmpresa(linha: string): LinhaEmpresa | null {
  if (!linha.trim()) return null;
  const campos = dividirLinhaCsv(linha);
  return montarRegistro(COLUNAS_EMPRESAS, campos);
}
