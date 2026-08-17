// ARQUIVO: app/api/mensagens/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Envia mensagem via Evolution API e salva no banco.
//
// Fase 2 (Etapa 3) — ACRESCENTADO: roteamento determinístico por Conversa.canalWhatsapp.tipo.
// O provedor é decidido exclusivamente por esse campo, nunca por tentativa em cascata:
//   - CanalWhatsappTipo.META_CLOUD_API, canal de IA (agenteIA != null — Maria/João) com
//     WHATSAPP_JOAO_V2=true → lib/whatsapp/meta-client.ts. Com a flag desligada, cai no
//     caminho Evolution abaixo — EXATAMENTE o comportamento já existente, não alterado
//     aqui (ver auditoria: Maria/João continuam presos só a WHATSAPP_JOAO_V2).
//   - CanalWhatsappTipo.META_CLOUD_API, canal HUMANO (agenteIA === null — ex.: Taciane)
//     com WHATSAPP_META_HUMANO_OUTBOUND_V2=true → lib/whatsapp/meta-client.ts. Com a
//     flag desligada, o envio é BLOQUEADO (422) — nunca cai para Evolution. Um canal
//     cadastrado como META_CLOUD_API não deve silenciosamente tentar outro provedor só
//     porque sua feature flag está OFF.
//   - CanalWhatsappTipo.CHATWOOT_MIRROR → envio bloqueado (sem regra de negócio para isso ainda)
//   - Sem canalWhatsapp vinculado ou CanalWhatsappTipo.EVOLUTION → caminho Evolution
//     abaixo, exatamente como antes.
// Se o envio pelo canal escolhido falhar, a rota retorna erro — nunca tenta outro provedor.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { CanalWhatsappTipo } from "@/app/generated/prisma/client";
import { enviarTextoMeta, CanalInvalidoError, EnvioMetaError } from "@/lib/whatsapp/meta-client";

function getEvolutionToken(instanceName: string): string {
  if (instanceName.startsWith("joao")) {
    return process.env.JOAO_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  }
  if (instanceName.startsWith("morgana")) {
    return process.env.MORGANA_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  }
  if (instanceName.startsWith("taciane")) {
    return process.env.TACIANE_EVOLUTION_API_KEY ?? process.env.EVOLUTION_API_KEY ?? "";
  }
  return process.env.EVOLUTION_API_KEY ?? "";
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { conversaId, conteudo } = await req.json().catch(() => ({}));
  if (!conversaId || !conteudo) {
    return NextResponse.json({ error: "conversaId e conteudo são obrigatórios." }, { status: 400 });
  }

  const conversa = await prisma.conversa.findUnique({
    where: { id: conversaId },
    include: { canalWhatsapp: true },
  });
  if (!conversa) {
    return NextResponse.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  const telefone = conversa.telefone;
  if (!telefone) {
    return NextResponse.json({ error: "Conversa sem telefone de destino." }, { status: 400 });
  }

  // ─── Roteamento determinístico por canal (Fase 2) ────────────────────────

  // Compatibilidade V1: conversas criadas pelo webhook V1 do João/Maria não têm
  // canalWhatsappId. Se a conversa não tem canal vinculado mas tem instanceName,
  // tenta encontrar o canal pelo instanceName e preenche o vínculo automaticamente.
  let canalResolvido = conversa.canalWhatsapp;
  if (!canalResolvido && conversa.instanceName) {
    const canalPorInstance = await prisma.canalWhatsapp.findUnique({
      where: { instanceName: conversa.instanceName },
    });
    if (canalPorInstance) {
      canalResolvido = canalPorInstance;
      // Preenche o vínculo para que as próximas mensagens já encontrem o canal correto
      await prisma.conversa.update({
        where: { id: conversaId },
        data: { canalWhatsappId: canalPorInstance.id },
      }).catch((err) => {
        console.warn("[api/mensagens] Falha ao vincular canal à conversa (não bloqueia envio):", err);
      });
    }
  }

  if (canalResolvido?.tipo === CanalWhatsappTipo.CHATWOOT_MIRROR) {
    return NextResponse.json(
      { error: "Envio bloqueado: conversa espelhada do Chatwoot, sem regra de envio definida." },
      { status: 422 },
    );
  }

  const canalEhMetaCloudApi = canalResolvido?.tipo === CanalWhatsappTipo.META_CLOUD_API;
  const canalEhHumano = canalResolvido?.agenteIA === null;

  // Fase 2 (Etapa 4) — ACRESCENTADO: todos os canais META_CLOUD_API (IA e humanos)
  // usam o meta-client sem depender de feature flag. A flag WHATSAPP_META_HUMANO_OUTBOUND_V2
  // era uma proteção durante o desenvolvimento de Taciane — removida agora que o canal
  // está em produção e funcionando. A flag WHATSAPP_JOAO_V2 é mantida para compatibilidade
  // mas não é mais obrigatória para canais de IA com tipo=META_CLOUD_API no banco.
  const usarMetaClient = canalEhMetaCloudApi;

  if (usarMetaClient) {
    try {
      const mensagem = await enviarTextoMeta({
        canalId: (canalResolvido?.id ?? conversa.canalWhatsappId) as string,
        conversaId,
        telefone,
        texto: conteudo,
        autorUsuarioId: user.id,
      });

      await prisma.conversa.update({
        where: { id: conversaId },
        data: { ultimaMensagemEm: new Date(), atendidoPorId: user.id },
      });

      return NextResponse.json(mensagem);
    } catch (err) {
      const message =
        err instanceof CanalInvalidoError || err instanceof EnvioMetaError
          ? err.message
          : "Erro ao enviar mensagem via Meta Cloud API.";
      console.error("[api/mensagens] Erro ao enviar via meta-client:", err);
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // ─── Evolution API (caminho legado, inalterado) ──────────────────────────
  const apiUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const token = getEvolutionToken(conversa.instanceName);

  let waMessageId: string | undefined;

  try {
    const resp = await fetch(
      `${apiUrl}/message/sendText/${conversa.instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: token,
        },
        body: JSON.stringify({
          number: telefone,
          text: conteudo,
        }),
      }
    );

    if (resp.ok) {
      const data = await resp.json();
      waMessageId = data?.key?.id;
    }
  } catch (err) {
    console.error("[api/mensagens] Erro ao enviar via Evolution API:", err);
    // Continua para salvar no banco mesmo se a API falhar
  }

  // Salva no banco
  // canalWhatsappId + externalMessageId (= waMessageId, quando a Evolution devolve
  // key.id no envio): fecha o vínculo com o canal e permite que o webhook da Morgana
  // reconcilie o eco fromMe desta mesma mensagem sem criar uma segunda linha — ver
  // lib/whatsapp/agentes/morgana.ts.
  const mensagem = await prisma.mensagem.create({
    data: {
      conversaId,
      conteudo,
      direcao: "SAIDA",
      autor: "HUMANO",
      autorUsuarioId: user.id,
      waMessageId,
      status: waMessageId ? "ENVIADA" : "ERRO",
      canalWhatsappId: conversa.canalWhatsappId,
      externalMessageId: waMessageId,
    },
  });

  // Atualiza conversa
  await prisma.conversa.update({
    where: { id: conversaId },
    data: {
      ultimaMensagemEm: new Date(),
      atendidoPorId: user.id,
    },
  });

  return NextResponse.json(mensagem);
}
