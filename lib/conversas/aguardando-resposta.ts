// ARQUIVO: lib/conversas/aguardando-resposta.ts
// Ciclo de Atendimento — cálculo de "aguardando resposta humana". NUNCA persistido em
// Conversa.status: é sempre derivado de Mensagem em tempo de leitura.
//
// Regra: existe ENTRADA (mensagem do cliente) mais recente que a última SAIDA/HUMANO.
// Resposta de IA (SAIDA/IA — Maria, João) NUNCA encerra a espera por atendimento
// humano — é exatamente o que evita confundir resposta automática com atendimento real.
//
// Cuidado documentado (auditoria): o fluxo legado do João (lib/agentes/joao/crm.ts,
// V1 — ativo hoje porque WHATSAPP_JOAO_V2 está OFF) grava a mensagem do CLIENTE com
// autor "HUMANO" (nomenclatura histórica, não corrigida nesta sprint). A regra abaixo
// é segura mesmo assim porque só considera "resposta humana" quando direcao=SAIDA — a
// mensagem do cliente daquele fluxo é direcao=ENTRADA, então nunca entra nesse lado da
// comparação, não importa o valor de autor.

export type MensagemParaAguardando = {
  direcao: string;
  autor?: string | null;
  createdAt: string | Date;
};

/**
 * Combina as duas datas já conhecidas (última mensagem do cliente, última resposta
 * humana) e decide se a conversa está aguardando resposta — e desde quando.
 */
export function calcularAguardandoRespostaDesde(
  ultimaMensagemClienteEm: string | Date | null | undefined,
  ultimaRespostaHumanaEm: string | Date | null | undefined,
): string | null {
  if (!ultimaMensagemClienteEm) return null;

  const cliente = new Date(ultimaMensagemClienteEm).getTime();
  const humana = ultimaRespostaHumanaEm ? new Date(ultimaRespostaHumanaEm).getTime() : null;

  if (humana !== null && humana >= cliente) return null;

  return new Date(cliente).toISOString();
}

/**
 * Mesma regra, mas calculada a partir de uma lista completa de mensagens já carregada
 * em memória (uso: detalhe de uma única conversa, onde todas as mensagens já vieram
 * do banco — evita uma query extra).
 */
export function calcularAguardandoRespostaDesdeMensagens(
  mensagens: MensagemParaAguardando[],
): string | null {
  let ultimaCliente: number | null = null;
  let ultimaHumana: number | null = null;

  for (const m of mensagens) {
    const timestamp = new Date(m.createdAt).getTime();
    if (m.direcao === "ENTRADA") {
      if (ultimaCliente === null || timestamp > ultimaCliente) ultimaCliente = timestamp;
    } else if (m.direcao === "SAIDA" && m.autor === "HUMANO") {
      if (ultimaHumana === null || timestamp > ultimaHumana) ultimaHumana = timestamp;
    }
  }

  return calcularAguardandoRespostaDesde(
    ultimaCliente !== null ? new Date(ultimaCliente) : null,
    ultimaHumana !== null ? new Date(ultimaHumana) : null,
  );
}

/**
 * Texto de exibição do tempo decorrido desde `desde` (ex.: "7 min", "1h 32min",
 * "1 dia"). Puramente client-side — recalculado a cada render, nunca escrito no banco
 * nem atualizado por cron/job. `agora` é parametrizável só para facilitar teste.
 */
export function formatarTempoDecorrido(desde: string | Date, agora: number = Date.now()): string {
  const inicio = new Date(desde).getTime();
  const ms = Math.max(0, agora - inicio);
  const minutos = Math.floor(ms / 60_000);

  if (minutos < 1) return "agora";
  if (minutos < 60) return `${minutos} min`;

  const horas = Math.floor(minutos / 60);
  const minutosRestantes = minutos % 60;
  if (horas < 24) {
    return minutosRestantes > 0 ? `${horas}h ${minutosRestantes}min` : `${horas}h`;
  }

  const dias = Math.floor(horas / 24);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}
