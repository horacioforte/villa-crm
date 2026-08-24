// ARQUIVO: lib/agentes/joao/__tests__/construtora-invariantes.test.ts
// Testes de invariantes do radar de construtoras.
// Executar com: npx tsx lib/agentes/joao/__tests__/construtora-invariantes.test.ts
//
// NÃO requer DB, NÃO requer LLM, NÃO requer network.
// Testa as funções puras que governam:
//   1. Mapeamento de fase → TipoEvidencia / TipoMovimentacao
//   2. Avanço de status da DossieCarteira
//   3. Idempotência dos hashes de evidência e movimentação
//   4. INVARIANTE SEMÂNTICA: potencial ≠ momento

import {
  faseParaTipoEvidencia,
  faseParaTipoMovimentacao,
  fasePossuiEvidenciaTemporal,
  calcularNovoStatusCarteira,
} from "../investigador-construtora";

import {
  calcularPrioridadeJoao,
  gerarHashEvidencia,
  gerarHashMovimentacaoPersistida,
} from "../../../inteligencia/joao-estrutura";

// ─── Utilidades ───────────────────────────────────────────────────────────────

let passou = 0;
let falhou = 0;

function assert(condicao: boolean, descricao: string) {
  if (condicao) {
    console.log(`  ✅ ${descricao}`);
    passou++;
  } else {
    console.error(`  ❌ FALHOU: ${descricao}`);
    falhou++;
  }
}

function grupo(nome: string) {
  console.log(`\n── ${nome} ──`);
}

// ─── 1. Mapeamento de fase ────────────────────────────────────────────────────

grupo("1. faseParaTipoEvidencia");
assert(faseParaTipoEvidencia("licenciamento")    === "LICENCIAMENTO",  "licenciamento → LICENCIAMENTO");
assert(faseParaTipoEvidencia("Licenciamento")    === "LICENCIAMENTO",  "Licenciamento (maiúscula) → LICENCIAMENTO");
assert(faseParaTipoEvidencia("mobilizacao")      === "MOBILIZACAO",    "mobilizacao → MOBILIZACAO");
assert(faseParaTipoEvidencia("mobilização")      === "MOBILIZACAO",    "mobilização (acento) → MOBILIZACAO");
assert(faseParaTipoEvidencia("terraplenagem")    === "TERRAPLENAGEM",  "terraplenagem → TERRAPLENAGEM");
assert(faseParaTipoEvidencia("fundacao")         === "FUNDACAO",       "fundacao → FUNDACAO");
assert(faseParaTipoEvidencia("fundação")         === "FUNDACAO",       "fundação (acento) → FUNDACAO");
assert(faseParaTipoEvidencia("concretagem")      === "CONCRETAGEM",    "concretagem → CONCRETAGEM");
assert(faseParaTipoEvidencia("estrutura")        === "ESTRUTURA",      "estrutura → ESTRUTURA");
assert(faseParaTipoEvidencia("execucao")         === "NOVA_OBRA",      "execucao → NOVA_OBRA (fallback)");
assert(faseParaTipoEvidencia("anunciada")        === "NOVA_OBRA",      "anunciada → NOVA_OBRA (fallback)");
assert(faseParaTipoEvidencia("planejada")        === "NOVA_OBRA",      "planejada → NOVA_OBRA (fallback)");

grupo("2. faseParaTipoMovimentacao");
assert(faseParaTipoMovimentacao("licenciamento") === "LICENCIAMENTO_EM_ANDAMENTO", "licenciamento → LICENCIAMENTO_EM_ANDAMENTO");
assert(faseParaTipoMovimentacao("mobilizacao")   === "MOBILIZACAO_INICIADA",       "mobilizacao → MOBILIZACAO_INICIADA");
assert(faseParaTipoMovimentacao("terraplenagem") === "TERRAPLENAGEM",              "terraplenagem → TERRAPLENAGEM");
assert(faseParaTipoMovimentacao("fundacao")      === "FUNDACAO_INICIADA",          "fundacao → FUNDACAO_INICIADA");
assert(faseParaTipoMovimentacao("concretagem")   === "CONCRETAGEM",                "concretagem → CONCRETAGEM");
assert(faseParaTipoMovimentacao("estrutura")     === "ESTRUTURA_EM_ANDAMENTO",     "estrutura → ESTRUTURA_EM_ANDAMENTO");
assert(faseParaTipoMovimentacao("anunciada")     === "OBRA_DETECTADA",             "anunciada → OBRA_DETECTADA (fallback)");

grupo("3. fasePossuiEvidenciaTemporal");
assert(fasePossuiEvidenciaTemporal("licenciamento") === true,  "licenciamento → evidência temporal");
assert(fasePossuiEvidenciaTemporal("mobilizacao")   === true,  "mobilizacao → evidência temporal");
assert(fasePossuiEvidenciaTemporal("fundacao")      === true,  "fundacao → evidência temporal");
assert(fasePossuiEvidenciaTemporal("concretagem")   === true,  "concretagem → evidência temporal");
assert(fasePossuiEvidenciaTemporal("anunciada")     === false, "anunciada → SEM evidência temporal");
assert(fasePossuiEvidenciaTemporal("planejada")     === false, "planejada → SEM evidência temporal");

// ─── 2. Avanço de status da DossieCarteira ────────────────────────────────────

grupo("4. calcularNovoStatusCarteira");
// Primeira investigação com obras → SINAL_DETECTADO
assert(calcularNovoStatusCarteira("MONITORANDO", 2, false) === "SINAL_DETECTADO",    "MONITORANDO + obras → SINAL_DETECTADO");
// Sem obras → status não muda
assert(calcularNovoStatusCarteira("MONITORANDO", 0, false) === "MONITORANDO",        "MONITORANDO + 0 obras → MONITORANDO");
// Segunda investigação com obras → EM_INVESTIGACAO
assert(calcularNovoStatusCarteira("SINAL_DETECTADO", 1, false) === "EM_INVESTIGACAO","SINAL_DETECTADO + obras → EM_INVESTIGACAO");
// Decisor encontrado → DECISOR_ENCONTRADO
assert(calcularNovoStatusCarteira("EM_INVESTIGACAO", 0, true) === "DECISOR_ENCONTRADO", "EM_INVESTIGACAO + decisor → DECISOR_ENCONTRADO");
// PRONTO_PARA_ABORDAR nunca auto-avança
assert(calcularNovoStatusCarteira("PRONTO_PARA_ABORDAR", 5, true) === "PRONTO_PARA_ABORDAR", "PRONTO_PARA_ABORDAR nunca auto-avança");
// EM_CAMPANHA nunca auto-avança
assert(calcularNovoStatusCarteira("EM_CAMPANHA", 5, true) === "EM_CAMPANHA",          "EM_CAMPANHA nunca auto-avança");
// Status desconhecido → mantém
assert(calcularNovoStatusCarteira("STATUS_INVALIDO", 2, true) === "STATUS_INVALIDO",  "Status desconhecido → mantém");

// ─── 3. Idempotência de hashes ────────────────────────────────────────────────
// A mesma entrada deve gerar o mesmo hash, garantindo que reruns não duplicam.

grupo("5. Idempotência de hash de evidência");

const inputEvidencia = {
  dossieId: "dossie-pe-001",
  tipo: "NOVA_OBRA",
  titulo: "Obra Residencial Caruaru",
  descricao: "Construtora X inicia fundação em Caruaru/PE",
  url: "https://exemplo.com/noticia/123",
  dataInformacao: new Date("2026-08-01"),
};

const hash1 = gerarHashEvidencia(inputEvidencia);
const hash2 = gerarHashEvidencia(inputEvidencia);
const hash3 = gerarHashEvidencia({ ...inputEvidencia }); // cópia

assert(hash1 === hash2, "Mesmo input → mesmo hash (idempotência run 1→2)");
assert(hash1 === hash3, "Cópia do input → mesmo hash (idempotência run 1→3)");

// Input diferente → hash diferente
const inputEvidenciaDiferente = {
  ...inputEvidencia,
  titulo: "Obra Diferente em Recife",
  url: "https://exemplo.com/noticia/999",
};
const hashDiferente = gerarHashEvidencia(inputEvidenciaDiferente);
assert(hash1 !== hashDiferente, "Input diferente → hash diferente");

// URL normalização: URLs com e sem trailing slash produzem o mesmo hash
const inputComSlash  = { ...inputEvidencia, url: "https://exemplo.com/noticia/123/" };
const inputSemSlash  = { ...inputEvidencia, url: "https://exemplo.com/noticia/123" };
const hashComSlash   = gerarHashEvidencia(inputComSlash);
const hashSemSlash   = gerarHashEvidencia(inputSemSlash);
assert(hashComSlash === hashSemSlash, "URLs com/sem trailing slash → mesmo hash");

// UTM params ignorados
const inputComUtm = { ...inputEvidencia, url: "https://exemplo.com/noticia/123?utm_source=google" };
const hashComUtm  = gerarHashEvidencia(inputComUtm);
assert(hashComUtm === hash1, "UTM params ignorados no hash de URL");

grupo("6. Idempotência de hash de movimentação");

const inputMov = {
  dossieId: "dossie-pe-001",
  tipo: "FUNDACAO_INICIADA",
  titulo: "Obra Residencial Caruaru",
  descricao: "Fundação iniciada em agosto/2026",
  momento: new Date("2026-08-10"),
};

const hashMov1 = gerarHashMovimentacaoPersistida(inputMov);
const hashMov2 = gerarHashMovimentacaoPersistida(inputMov);
const hashMov3 = gerarHashMovimentacaoPersistida({ ...inputMov });

assert(hashMov1 === hashMov2, "Mesma movimentação → mesmo hash (run 1→2)");
assert(hashMov1 === hashMov3, "Cópia da movimentação → mesmo hash (run 1→3)");

// Fase nova → hash diferente
const inputMovFaseNova = { ...inputMov, tipo: "CONCRETAGEM", descricao: "Concretagem iniciada em setembro/2026", momento: new Date("2026-09-05") };
const hashMovFaseNova  = gerarHashMovimentacaoPersistida(inputMovFaseNova);
assert(hashMov1 !== hashMovFaseNova, "Fase nova → hash diferente (nova movimentação criada)");

// ─── 4. INVARIANTE SEMÂNTICA: POTENCIAL ≠ MOMENTO ─────────────────────────────

grupo("7. CASO A — Construtora grande, sem evidência temporal atual");
// Construtora conhecida, com EPC e valor, mas sem fase temporal comprovada
const casoA = {
  clienteFinal: "Vale S.A.",
  construtora: "Andrade Gutierrez",
  epc: "Odebrecht Engenharia",
  valorEstimado: 500_000_000,
  cidade: "Caruaru",
  estado: "PE",
  // Ausentes intencionalmente:
  faseObra:     null, // SEM fase temporal
  cronograma:   null,
  licenciamento: null,
  volumeConcreto: null,
  segmento: "Construtora",
  resumo: "Grande construtora com portfólio histórico relevante.",
  equipamentosSugeridos: null,
  campanhasSugerida: null,
  concorrentes: null,
};

const scoresA = calcularPrioridadeJoao(casoA);

assert(scoresA.potencialVilla > 0,           "CASO A: potencialVilla > 0 (construtora conhecida e valorosa)");
assert(scoresA.momentoVilla === null,         "CASO A: momentoVilla === null (SEM evidência temporal)");
assert(scoresA.prioridadeJoao === null,       "CASO A: prioridadeJoao === null (sem momento, sem prioridade real)");
console.log(`         potencialVilla=${scoresA.potencialVilla}, momentoVilla=${scoresA.momentoVilla}, prioridadeJoao=${scoresA.prioridadeJoao}`);
console.log(`         motivo: "${scoresA.motivoPrioridade}"`);

grupo("8. CASO B — Construtora com obra real encontrada em fase temporal comprovada");
const casoB = {
  clienteFinal: "Petrobras",
  construtora: "Queiroz Galvão",
  epc: "TechnipFMC",
  valorEstimado: 800_000_000,
  volumeConcreto: 25000,
  cidade: "Recife",
  estado: "PE",
  faseObra:     "fundacao",  // FASE TEMPORAL REAL
  cronograma:   "Início fundação: ago/2026. Concretagem: jan/2027.",
  licenciamento: "LI emitida pelo IBAMA em jun/2026",
  segmento: "Refinaria / Petroquímica",
  resumo: "Construtora executando fundação de terminal em Suape.",
  equipamentosSugeridos: "Bomba lança 52m + bomba estacionária",
  campanhasSugerida: "BOMBA_LANCA",
  concorrentes: "Concremax, Cimento Apodi",
};

const scoresB = calcularPrioridadeJoao(casoB);

assert(scoresB.potencialVilla > 0,           "CASO B: potencialVilla > 0");
assert(scoresB.momentoVilla !== null,         "CASO B: momentoVilla ≠ null (tem evidência temporal)");
assert((scoresB.momentoVilla ?? 0) > 0,      "CASO B: momentoVilla > 0");
assert(scoresB.prioridadeJoao !== null,       "CASO B: prioridadeJoao calculado (momento real)");
assert((scoresB.prioridadeJoao ?? 0) > 0,    "CASO B: prioridadeJoao > 0");
assert(scoresB.potencialVilla !== scoresB.momentoVilla, "CASO B: potencial ≠ momento (scores independentes)");
console.log(`         potencialVilla=${scoresB.potencialVilla}, momentoVilla=${scoresB.momentoVilla}, prioridadeJoao=${scoresB.prioridadeJoao}`);
console.log(`         prontidao=${scoresB.prontidao}, motivo: "${scoresB.motivoPrioridade}"`);

grupo("9. INVARIANTE: momentoVilla === null quando faseObra é genérica ou ausente");
const fasesGenericasOuAusentes = [null, undefined, "", "anunciada", "planejada", "desconhecida"];
for (const fase of fasesGenericasOuAusentes) {
  const resultado = calcularPrioridadeJoao({
    construtora: "Construtora Fictícia",
    faseObra: fase as string | null,
    cronograma: null,
    licenciamento: null,
    valorEstimado: null,
    cidade: "Recife",
    estado: "PE",
  });
  assert(
    resultado.momentoVilla === null,
    `faseObra="${fase ?? "null"}" → momentoVilla === null (sem falso positivo de momento)`,
  );
}

// ─── Resultado ────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(60)}`);
console.log(`Total: ${passou + falhou} | ✅ Passou: ${passou} | ❌ Falhou: ${falhou}`);

if (falhou > 0) {
  console.error(`\n${falhou} teste(s) falharam.`);
  process.exit(1);
} else {
  console.log(`\nTodos os testes passaram.`);
}
