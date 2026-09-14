// ARQUIVO: lib/conversas/alertas.ts
// Task #11 — motor de alertas do Ciclo de Atendimento (camada de composição pura).
// REGRA: nunca remover. Apenas acrescentar.
//
// Não define nenhum limiar novo de SLA. Reaproveita obrigatoriamente:
//   - getPrioridadeAguardando() (./prioridade.ts) — Atenção (30min-4h) e Urgente (>4h);
//   - getVirtualStatus() (@/lib/tarefas/service.ts) — decide "tarefa WhatsApp vencida"
//     (status ativo + dataVencimento antes de hoje). Essa validação é feita pela rota
//     (app/api/conversas/alertas/route.ts) antes de chamar montarFilaDeAlertas: este
//     arquivo só recebe tarefas que já foram confirmadas como vencidas.
//
// Nesta sprint (Task #11), por decisão explícita de Horácio (10/2026), NÃO são tratados
// como alerta operacional: "pediu_humano" e "ia_pausada". Auditoria mostrou que
// Conversa.iaPausada e Conversa.atendimentoHumanoAtivo não têm hoje nenhum fluxo de
// escrita real (nenhuma rota, webhook ou automação seta esses campos) — um alerta
// baseado neles seria sempre vazio na prática. Pendência registrada para sprint futura,
// quando existir a fonte de dado (ex.: botão de assumir/pausar IA).

import { getPrioridadeAguardando } from "./prioridade";

export type MotivoAlertaConversa =
  | "aguardando_urgente"
  | "sem_responsavel"
  | "tarefa_whatsapp_vencida"
  | "aguardando_atencao";

export type CanalTipo = "IA" | "HUMANO" | "DESCONHECIDO";

// Precedência de severidade (mais crítico → menos crítico). NÃO é um novo SLA: é só a
// ordem de exibição/ordenação quando uma conversa acumula mais de um motivo ao mesmo
// tempo (ex.: urgente + sem responsável). Único ponto do arquivo que precisa mudar para
// recalibrar essa ordem. Ordem definida por Horácio (revisão da coluna Precisa de ação,
// 10/2026): urgente > sem responsável > tarefa WhatsApp vencida > atenção.
export const PRECEDENCIA_MOTIVOS: readonly MotivoAlertaConversa[] = [
  "aguardando_urgente",
  "sem_responsavel",
  "tarefa_whatsapp_vencida",
  "aguardando_atencao",
];

// Dados de negócio que a Supervisão quer exibir no card, mas que NÃO participam da
// classificação/severidade — são só contexto, repassados sem alteração. Vêm da mesma
// linha de Conversa já buscada pela rota (nenhuma API nova, nenhuma query extra por
// conversa): empresa/oportunidade/atendidoPor/última mensagem são relações que o Prisma
// já resolve na mesma consulta.
export type OportunidadeParaAlerta = {
  id: string;
  titulo: string;
  valor: number | null;
};

export type UltimaMensagemParaAlerta = {
  conteudo: string;
  direcao: string;
  createdAt: string;
};

export type ConversaParaAlerta = {
  id: string;
  nomeContato: string | null;
  telefone: string | null;
  instanceName: string;
  canalTipo: CanalTipo;
  atendidoPorId: string | null;
  atendidoPorNome: string | null;
  tarefaAtualId: string | null;
  aguardandoRespostaDesde: string | null;
  ultimaMensagemEm: string | null;
  empresaNome: string | null;
  oportunidade: OportunidadeParaAlerta | null;
  ultimaMensagem: UltimaMensagemParaAlerta | null;
};

export type TarefaVencidaParaAlerta = {
  id: string;
  titulo: string;
  dataVencimento: string;
  responsavelId: string | null;
};

export type AlertaConversa = {
  tipo: "conversa";
  conversaId: string;
  instanceName: string;
  canalTipo: CanalTipo;
  nomeContato: string | null;
  telefone: string | null;
  motivos: MotivoAlertaConversa[];
  severidade: MotivoAlertaConversa;
  // Usado só para desempate na ordenação dentro da mesma severidade (não influencia a
  // severidade em si): timestamp mais relevante disponível para esta conversa.
  momentoCritico: string | null;
  aguardandoRespostaDesde: string | null;
  atendidoPorId: string | null;
  atendidoPorNome: string | null;
  tarefaVencidaId: string | null;
  empresaNome: string | null;
  oportunidade: OportunidadeParaAlerta | null;
  ultimaMensagem: UltimaMensagemParaAlerta | null;
};

export type AlertaTarefa = {
  tipo: "tarefa";
  tarefaId: string;
  titulo: string;
  motivos: MotivoAlertaConversa[]; // sempre ["tarefa_whatsapp_vencida"] nesta sprint
  severidade: "tarefa_whatsapp_vencida";
  momentoCritico: string;
  dataVencimento: string;
  responsavelId: string | null;
};

export type AlertaItem = AlertaConversa | AlertaTarefa;

function motivoMaisCritico(motivos: MotivoAlertaConversa[]): MotivoAlertaConversa {
  for (const motivo of PRECEDENCIA_MOTIVOS) {
    if (motivos.includes(motivo)) return motivo;
  }
  // Defensivo: este helper só é chamado com motivos não-vazio.
  return motivos[0];
}

/**
 * Classifica uma única conversa. Retorna null quando nenhum dos sinais desta sprint se
 * aplica — conversa "normal", nada a fazer, não deve aparecer na fila.
 *
 * tarefaVencidaId: id de uma tarefa WHATSAPP já confirmada como vencida cujo
 * tarefaAtualId aponta para esta conversa (ligação real via schema — Conversa.tarefaAtualId
 * — nunca inferida por telefone/pessoa). Passe null quando não houver tarefa vinculada.
 */
export function classificarConversa(
  conversa: ConversaParaAlerta,
  tarefaVencidaId: string | null,
  // Mesmo padrão de getPrioridadeAguardando(): "agora" é parametrizável só para
  // permitir teste determinístico — em produção sempre é Date.now() (hora real).
  agora: number = Date.now(),
): AlertaConversa | null {
  const motivos: MotivoAlertaConversa[] = [];

  const prioridade = getPrioridadeAguardando(conversa.aguardandoRespostaDesde, agora);
  if (prioridade?.prioridade === "urgente") motivos.push("aguardando_urgente");
  if (prioridade?.prioridade === "atencao") motivos.push("aguardando_atencao");
  // prioridade === "normal" (0-30min aguardando) não gera alerta nesta sprint: é espera
  // dentro do esperado, não "precisa de ação".

  if (!conversa.atendidoPorId) motivos.push("sem_responsavel");
  if (tarefaVencidaId) motivos.push("tarefa_whatsapp_vencida");

  if (motivos.length === 0) return null;

  return {
    tipo: "conversa",
    conversaId: conversa.id,
    instanceName: conversa.instanceName,
    canalTipo: conversa.canalTipo,
    nomeContato: conversa.nomeContato,
    telefone: conversa.telefone,
    motivos,
    severidade: motivoMaisCritico(motivos),
    momentoCritico: conversa.aguardandoRespostaDesde ?? conversa.ultimaMensagemEm,
    aguardandoRespostaDesde: conversa.aguardandoRespostaDesde,
    atendidoPorId: conversa.atendidoPorId,
    atendidoPorNome: conversa.atendidoPorNome,
    tarefaVencidaId,
    empresaNome: conversa.empresaNome,
    oportunidade: conversa.oportunidade,
    ultimaMensagem: conversa.ultimaMensagem,
  };
}

function compararAlertas(a: AlertaItem, b: AlertaItem): number {
  const rankA = PRECEDENCIA_MOTIVOS.indexOf(a.severidade);
  const rankB = PRECEDENCIA_MOTIVOS.indexOf(b.severidade);
  if (rankA !== rankB) return rankA - rankB;

  // Mesma severidade: momento crítico mais antigo primeiro (espera/vencimento mais
  // longos = mais urgente dentro da própria faixa) — mesmo critério já usado em
  // ordenarConversasPorPrioridade (prioridade.ts).
  const tA = a.momentoCritico ? new Date(a.momentoCritico).getTime() : Number.POSITIVE_INFINITY;
  const tB = b.momentoCritico ? new Date(b.momentoCritico).getTime() : Number.POSITIVE_INFINITY;
  if (tA !== tB) return tA - tB;

  // Desempate final estável e determinístico — não é regra de SLA, só evita ordem
  // instável quando dois itens empatam em tudo.
  const idA = a.tipo === "conversa" ? a.conversaId : a.tarefaId;
  const idB = b.tipo === "conversa" ? b.conversaId : b.tarefaId;
  return idA.localeCompare(idB);
}

/**
 * Composição final: recebe as conversas do universo já filtrado (ver auditoria — mesmo
 * universo ABERTA/PENDENTE usado hoje pela Supervisão) e as tarefas WhatsApp já
 * confirmadas como vencidas (getVirtualStatus === "ATRASADA", aplicado pela rota).
 *
 * Garantia de não-duplicidade: cada conversa entra no máximo uma vez no resultado (com
 * todos os motivos aplicáveis agrupados em motivos[]); cada tarefa vencida entra no
 * máximo uma vez — como motivo dentro da conversa vinculada (via tarefaAtualId) OU como
 * item solto tipo:"tarefa", nunca as duas coisas.
 */
export function montarFilaDeAlertas({
  conversas,
  tarefasVencidas,
  agora = Date.now(),
}: {
  conversas: ConversaParaAlerta[];
  tarefasVencidas: TarefaVencidaParaAlerta[];
  agora?: number;
}): AlertaItem[] {
  const tarefaPorId = new Map(tarefasVencidas.map((t) => [t.id, t]));
  const tarefasVinculadas = new Set<string>();

  const alertasConversa: AlertaConversa[] = [];
  for (const conversa of conversas) {
    const tarefaVinculada =
      conversa.tarefaAtualId && tarefaPorId.has(conversa.tarefaAtualId)
        ? conversa.tarefaAtualId
        : null;
    if (tarefaVinculada) tarefasVinculadas.add(tarefaVinculada);

    const alerta = classificarConversa(conversa, tarefaVinculada, agora);
    if (alerta) alertasConversa.push(alerta);
  }

  const alertasTarefa: AlertaTarefa[] = tarefasVencidas
    .filter((t) => !tarefasVinculadas.has(t.id))
    .map((t) => ({
      tipo: "tarefa" as const,
      tarefaId: t.id,
      titulo: t.titulo,
      motivos: ["tarefa_whatsapp_vencida"] as MotivoAlertaConversa[],
      severidade: "tarefa_whatsapp_vencida" as const,
      momentoCritico: t.dataVencimento,
      dataVencimento: t.dataVencimento,
      responsavelId: t.responsavelId,
    }));

  return [...alertasConversa, ...alertasTarefa].sort(compararAlertas);
}
