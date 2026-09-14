// ARQUIVO: app/api/conversas/nova/route.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Inicia uma conversa nova via CRM, sem precisar que o cliente tenha mandado
// mensagem antes. Aceita qualquer instanceName (maria-villa, taciane-villa, etc.).
// Detecta automaticamente se o canal é Evolution ou Meta Cloud API e usa a rota certa.
// Cria a Conversa + a Mensagem no banco e devolve { conversaId }.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { CanalWhatsappTipo } from "@/app/generated/prisma/client";
import { enviarTextoMeta, enviarTemplateMeta, CanalInvalidoError, EnvioMetaError } from "@/lib/whatsapp/meta-client";
import { variantesTelefoneBR } from "@/lib/whatsapp/telefone";

const INSTANCES_VALIDAS = ["maria-villa", "joao-villa", "morgana-villa", "taciane-villa"];

function getApiKeyEvolution(instanceName: string): string {
  if (instanceName.startsWith("joao")) return process.env.JOAO_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  if (instanceName.startsWith("morgana")) return process.env.MORGANA_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  if (instanceName.startsWith("taciane")) return process.env.TACIANE_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  return process.env.EVOLUTION_API_KEY ?? ""; // maria + default
}

function normalizarTelefone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.startsWith("55") && d.length >= 12 ? d : `55${d}`;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    telefone,
    mensagem,
    nomeContato,
    oportunidadeId,
    pessoaId,
    instanceName: rawInstance,
    // ACRESCENTADO — inicia conversa com um modelo (template) aprovado pela Meta, para
    // quando o cliente nunca falou com a gente antes (não existe janela de 24h aberta e
    // uma mensagem de texto livre seria rejeitada pela Meta). Ver enviarTemplateMeta em
    // lib/whatsapp/meta-client.ts — já existia pronto, só nunca tinha sido chamado por
    // nenhuma rota/tela do Workspace.
    usarTemplate,
    templateName,
    templateIdioma,
    templateParametros,
    // ACRESCENTADO — quando a conversa é iniciada a partir do botão "Abrir no
    // WhatsApp" de uma tarefa, vincula a conversa (nova ou reaproveitada) a essa
    // tarefa de origem. Puramente opcional — sem isso, tudo continua como antes.
    tarefaId,
  } = body as {
    telefone?: string;
    mensagem?: string;
    nomeContato?: string;
    oportunidadeId?: string;
    pessoaId?: string;
    instanceName?: string;
    usarTemplate?: boolean;
    templateName?: string;
    templateIdioma?: string;
    templateParametros?: string[];
    tarefaId?: string;
  };

  if (!telefone) {
    return NextResponse.json({ error: "telefone é obrigatório." }, { status: 400 });
  }
  if (usarTemplate) {
    if (!templateName) {
      return NextResponse.json({ error: "templateName é obrigatório ao usar um modelo." }, { status: 400 });
    }
  } else if (!mensagem) {
    return NextResponse.json({ error: "mensagem é obrigatória." }, { status: 400 });
  }

  const INSTANCE_NAME = INSTANCES_VALIDAS.includes(rawInstance ?? "")
    ? (rawInstance as string)
    : "maria-villa";

  const telFull = normalizarTelefone(telefone);
  const telSem55 = telFull.slice(2);

  // Busca canal com tipo para saber se é Meta ou Evolution
  const canal = await prisma.canalWhatsapp.findUnique({
    where: { instanceName: INSTANCE_NAME },
    select: { id: true, tipo: true, ativo: true },
  });

  const ehMeta = canal?.tipo === CanalWhatsappTipo.META_CLOUD_API;

  // ACRESCENTADO — modelo (template) só existe no mundo Meta Cloud API; Evolution/
  // Baileys não tem essa restrição de janela de 24h, então não faz sentido pedir um
  // template lá. Falha cedo com uma mensagem clara em vez de silenciosamente cair no
  // fluxo de texto livre sem mensagem nenhuma.
  if (usarTemplate && !ehMeta) {
    return NextResponse.json(
      { error: "Modelos (templates) só se aplicam a canais Meta Cloud API." },
      { status: 422 },
    );
  }

  // Tenta vincular a Pessoa pelo telefone (ignora DDI 55 — tanto faz ter 55 ou não).
  // Lookup por DDD+número (telSem55) cobre casos com e sem o prefixo no banco.
  const pessoaEncontrada = (!pessoaId && !nomeContato)
    ? await prisma.pessoa.findFirst({
        where: {
          OR: [
            { whatsapp: { contains: telSem55 } },
            { telefone: { contains: telSem55 } },
          ],
        },
        select: { id: true, nome: true },
      })
    : null;

  // Reutiliza conversa existente ou cria nova
  let conversa = await prisma.conversa.findFirst({
    where: {
      instanceName: INSTANCE_NAME,
      status: { not: "SPAM" },
      OR: [
        { telefone: { contains: telSem55 } },
        { telefone: { contains: telFull } },
        // ACRESCENTADO — cobre a ambiguidade do "nono dígito" de celulares BR: o
        // WhatsApp/Meta às vezes reporta o mesmo contato com ou sem esse dígito
        // extra, o que fazia uma conversa iniciada pelo CRM não ser reconhecida
        // quando o cliente respondia de verdade, criando uma conversa duplicada.
        { telefone: { in: variantesTelefoneBR(telFull) } },
      ],
    },
    orderBy: { ultimaMensagemEm: "desc" },
    select: { id: true, telefone: true, canalWhatsappId: true },
  });

  if (!conversa) {
    conversa = await prisma.conversa.create({
      data: {
        instanceName: INSTANCE_NAME,
        telefone: telFull,
        nomeContato: nomeContato ?? pessoaEncontrada?.nome ?? null,
        canalWhatsappId: canal?.id ?? null,
        oportunidadeId: oportunidadeId ?? null,
        pessoaId: pessoaId ?? pessoaEncontrada?.id ?? null,
        atendidoPorId: user.id,
        ultimaMensagemEm: new Date(),
        tarefaAtualId: tarefaId ?? null,
      },
      select: { id: true, telefone: true, canalWhatsappId: true },
    });
  } else if (tarefaId) {
    // ACRESCENTADO — conversa já existia (reaproveitada); ainda assim vincula a
    // tarefa de origem, para o atalho de concluir aparecer na Central de Atendimento.
    await prisma.conversa.update({
      where: { id: conversa.id },
      data: { tarefaAtualId: tarefaId },
    });
  }

  // ─── Envio via Meta Cloud API ────────────────────────────────────────────
  if (ehMeta && canal) {
    // ACRESCENTADO — modelo (template) só existe/faz sentido em canais Meta Cloud API
    // (é uma regra da própria Meta; Evolution/Baileys não tem essa restrição de janela
    // de 24h). Fora daqui, o fluxo de texto livre abaixo continua 100% inalterado.
    if (usarTemplate) {
      try {
        await enviarTemplateMeta({
          canalId: canal.id,
          conversaId: conversa.id,
          telefone: telFull,
          templateName: templateName as string,
          idiomaCode: templateIdioma || "pt_BR",
          parametros: templateParametros ?? [],
          autorUsuarioId: user.id,
        });
        await prisma.conversa.update({
          where: { id: conversa.id },
          data: { ultimaMensagemEm: new Date(), atendidoPorId: user.id },
        });
        return NextResponse.json({ conversaId: conversa.id });
      } catch (err) {
        const msg =
          err instanceof CanalInvalidoError || err instanceof EnvioMetaError
            ? err.message
            : "Erro ao enviar o modelo via Meta Cloud API.";
        console.error("[api/conversas/nova] Erro ao enviar template Meta", err);
        return NextResponse.json({ error: msg }, { status: 502 });
      }
    }

    try {
      await enviarTextoMeta({
        canalId: canal.id,
        conversaId: conversa.id,
        telefone: telFull,
        texto: mensagem as string,
        autorUsuarioId: user.id,
      });
      await prisma.conversa.update({
        where: { id: conversa.id },
        data: { ultimaMensagemEm: new Date(), atendidoPorId: user.id },
      });
      return NextResponse.json({ conversaId: conversa.id });
    } catch (err) {
      const msg =
        err instanceof CanalInvalidoError || err instanceof EnvioMetaError
          ? err.message
          : "Erro ao enviar pela Meta Cloud API.";
      // Se o erro for "janela de 24h fechada", informa claramente
      const metaErr = err instanceof EnvioMetaError ? err : null;
      const fora24h = metaErr?.message?.includes("outside") || metaErr?.errorCode === "131047";
      if (fora24h) {
        return NextResponse.json(
          { error: "Janela de 24h encerrada. Para reabrir a conversa, use um template aprovado pela Meta — ou aguarde o cliente mandar mensagem primeiro." },
          { status: 422 }
        );
      }
      console.error("[api/conversas/nova] Erro Meta", err);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  // ─── Envio via Evolution API ─────────────────────────────────────────────
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apiKey = getApiKeyEvolution(INSTANCE_NAME);
  let waMessageId: string | undefined;

  try {
    const resp = await fetch(`${apiUrl}/message/sendText/${INSTANCE_NAME}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      // usarTemplate já é rejeitado antes de chegar aqui quando o canal não é Meta
      // (ver checagem acima) — chegando neste ponto, mensagem é sempre string.
      body: JSON.stringify({ number: telFull, text: mensagem as string }),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      waMessageId = data?.key?.id as string | undefined;
    } else {
      const errText = await resp.text().catch(() => "");
      console.error("[api/conversas/nova] Evolution API error", resp.status, errText);
    }
  } catch (err) {
    console.error("[api/conversas/nova] Erro ao chamar Evolution API", err);
  }

  await prisma.mensagem.create({
    data: {
      conversaId: conversa.id,
      conteudo: mensagem as string,
      direcao: "SAIDA",
      autor: "HUMANO",
      autorUsuarioId: user.id,
      waMessageId,
      status: waMessageId ? "ENVIADA" : "ERRO",
      canalWhatsappId: canal?.id ?? null,
    },
  });

  await prisma.conversa.update({
    where: { id: conversa.id },
    data: { ultimaMensagemEm: new Date(), atendidoPorId: user.id },
  });

  return NextResponse.json({ conversaId: conversa.id });
}
