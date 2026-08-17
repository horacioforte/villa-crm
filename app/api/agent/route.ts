// ARQUIVO: app/api/agent/route.ts
// Endpoint para o Agente de Vendas — Radar Infraestrutura Brasil
// Autenticação via AGENT_API_KEY (variável de ambiente no Vercel)
// NÃO usa requirePermission — é autenticação machine-to-machine via Bearer token

import { NextRequest, NextResponse } from "next/server";

import {
  CanalOrigem,
  InfluenciaDecisao,
  NivelRelacionamento,
  PrioridadeTarefa,
  StatusObra,
  StatusOportunidade,
  StatusTarefa,
  TemperaturaOportunidade,
  TipoAtividade,
  TipoOperacao,
  TipoPessoa,
  TipoServico,
} from "@/app/generated/prisma/client";
import { auditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { enviarWhatsappJoao } from "@/lib/agentes/joao/crm";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function verificarApiKey(req: NextRequest): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${apiKey}`;
}

// ─── GET — health check ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!verificarApiKey(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  return NextResponse.json({
    status: "ok",
    agente: "Radar Infraestrutura Brasil",
    versao: "1.0.0",
    timestamp: new Date().toISOString(),
  });
}

// ─── POST — criar lead no CRM ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Autenticar
  if (!verificarApiKey(req)) {
    return NextResponse.json(
      { error: "Não autorizado. API Key inválida." },
      { status: 401 },
    );
  }

  // 2. Parsear payload
  let body: {
    empresa: {
      razaoSocial: string;
      nomeFantasia?: string;
      cnpj?: string;
      segmento?: string;
      telefone?: string;
      email?: string;
      site?: string;
      cidade?: string;
      estado?: string;
      observacoes?: string;
      // Campos ampliados — Briefing Radar João (jul/2026)
      clienteFinal?: string;
      empresasExecutoras?: string;
      contatosPublicos?: string;
    };
    obra: {
      nome: string;
      descricao?: string;
      cidade?: string;
      estado?: string;
      volumeEstimado?: number;
      // Campos ampliados — Briefing Radar João (jul/2026)
      faseObra?: string;
      fonteInformacao?: string;
      linkNoticia?: string;
      dataDescoberta?: string;
    };
    oportunidade: {
      titulo: string;
      descricao?: string;
      tipoServico?: TipoServico;
      potencialOportunidade?: number;
      temperatura?: TemperaturaOportunidade;
      // Campos ampliados — Briefing Radar João (jul/2026)
      potencialUsoEquipamentos?: string;
      equipamentosRecomendados?: string;
      prioridade?: "alta" | "média" | "media" | "baixa";
      proximaAcaoComercial?: string;
    };
    pessoa?: {
      nome: string;
      cargo?: string;
      email?: string;
      telefone?: string;
      whatsapp?: string;
    };
    origemRadar?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Payload JSON inválido." }, { status: 400 });
  }

  const { empresa, obra, oportunidade, pessoa, origemRadar } = body;

  if (!empresa?.razaoSocial || !obra?.nome || !oportunidade?.titulo) {
    return NextResponse.json(
      {
        error:
          "Campos obrigatórios: empresa.razaoSocial, obra.nome, oportunidade.titulo",
      },
      { status: 400 },
    );
  }

  const origem = origemRadar ?? "Radar Infraestrutura Brasil";

  try {
    // 3. Buscar ou criar Empresa
    let empresaRecord = await prisma.empresa.findFirst({
      where: {
        razaoSocial: { equals: empresa.razaoSocial, mode: "insensitive" },
      },
    });

    if (!empresaRecord) {
      empresaRecord = await prisma.empresa.create({
        data: {
          razaoSocial: empresa.razaoSocial,
          nomeFantasia: empresa.nomeFantasia ?? null,
          cnpj: empresa.cnpj ?? null,
          segmento: empresa.segmento ?? "Construtora",
          telefone: empresa.telefone ?? null,
          email: empresa.email ?? null,
          site: empresa.site ?? null,
          cidade: empresa.cidade ?? null,
          estado: empresa.estado ?? null,
          observacoes: [
            `Origem: ${origem}`,
            empresa.observacoes ?? null,
            empresa.clienteFinal ? `Cliente final: ${empresa.clienteFinal}` : null,
            empresa.empresasExecutoras ? `Executoras: ${empresa.empresasExecutoras}` : null,
            empresa.contatosPublicos ? `Contatos públicos: ${empresa.contatosPublicos}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          ativa: true,
        },
      });

      await auditLog({
        action: "EMPRESA_CREATED_BY_AGENT",
        entity: "Empresa",
        entityId: empresaRecord.id,
        after: empresaRecord,
        metadata: { origem },
        request: req,
      });
    }

    // 4. Buscar ou criar Obra
    let obraRecord = await prisma.obra.findFirst({
      where: {
        empresaId: empresaRecord.id,
        nome: { equals: obra.nome, mode: "insensitive" },
      },
    });

    if (!obraRecord) {
      obraRecord = await prisma.obra.create({
        data: {
          nome: obra.nome,
          descricao: [
            obra.descricao ?? null,
            obra.faseObra ? `Fase: ${obra.faseObra}` : null,
            obra.fonteInformacao ? `Fonte: ${obra.fonteInformacao}` : null,
            obra.linkNoticia ? `Link: ${obra.linkNoticia}` : null,
            obra.dataDescoberta ? `Descoberta em: ${obra.dataDescoberta}` : null,
          ]
            .filter(Boolean)
            .join("\n") || null,
          cidade: obra.cidade ?? null,
          estado: obra.estado ?? null,
          volumeEstimado: obra.volumeEstimado ? String(obra.volumeEstimado) : null,
          status: StatusObra.EM_ANDAMENTO,
          empresaId: empresaRecord.id,
          ativa: true,
        },
      });
    }

    // 5. Criar Pessoa/Decisor se fornecido
    let pessoaRecord = null;
    if (pessoa?.nome) {
      pessoaRecord = await prisma.pessoa.findFirst({
        where: {
          empresaId: empresaRecord.id,
          nome: { equals: pessoa.nome, mode: "insensitive" },
        },
      });

      if (!pessoaRecord) {
        pessoaRecord = await prisma.pessoa.create({
          data: {
            nome: pessoa.nome,
            cargo: pessoa.cargo ?? null,
            email: pessoa.email ?? null,
            telefone: pessoa.telefone ?? null,
            whatsapp: pessoa.whatsapp ?? null,
            tipo: TipoPessoa.DECISOR,
            influenciaDecisao: InfluenciaDecisao.DECISOR,
            nivelRelacionamento: NivelRelacionamento.NEUTRO,
            empresaId: empresaRecord.id,
            ativa: true,
          },
        });
      }
    }

    // 6. Verificar duplicata antes de criar oportunidade
    const oportunidadeExistente = await prisma.oportunidade.findFirst({
      where: {
        empresaId: empresaRecord.id,
        obraId: obraRecord.id,
        titulo: { equals: oportunidade.titulo, mode: "insensitive" },
        ativa: true,
      },
    });

    if (oportunidadeExistente) {
      return NextResponse.json({
        sucesso: false,
        mensagem: "Oportunidade já existe no CRM.",
        oportunidadeId: oportunidadeExistente.id,
        duplicata: true,
      });
    }

    // 7. Notificar Morgana via WhatsApp para aprovação — João NÃO cria oportunidade automaticamente.
    // REGRA (17/08/2026): João apenas notifica Morgana para que ela decida se cria a oportunidade.
    // Código original de criação de oportunidade preservado abaixo como comentário (regra: nunca remover).
    //
    // CÓDIGO ORIGINAL PRESERVADO — NÃO REMOVER:
    // const oportunidadeRecord = await prisma.oportunidade.create({ data: { ... } });
    // await prisma.tarefa.create({ data: { ... } });

    const MORGANA_WHATSAPP = "5581985595931";

    const localizacao = [obraRecord.cidade, obraRecord.estado].filter(Boolean).join(" / ");
    const decisor = pessoaRecord
      ? `\n👤 Decisor: ${pessoaRecord.nome}${pessoaRecord.cargo ? ` (${pessoaRecord.cargo})` : ""}`
      : "";
    const potencial = oportunidade.potencialOportunidade
      ? `\n💰 Potencial: R$ ${Number(oportunidade.potencialOportunidade).toLocaleString("pt-BR")}`
      : "";
    const descricaoBreve = oportunidade.descricao
      ? `\n📋 ${oportunidade.descricao.substring(0, 300)}`
      : "";

    const mensagemMorgana = [
      `🏗️ *Obra do Radar — ${origem}*`,
      "",
      `*${oportunidade.titulo}*`,
      `🏢 ${empresaRecord.razaoSocial}`,
      localizacao ? `📍 ${localizacao}` : null,
      potencial || null,
      decisor || null,
      descricaoBreve || null,
      "",
      "A) Você quer que eu crie a oportunidade?",
      "B) Continuo investigando?",
    ]
      .filter((l) => l !== null)
      .join("\n");

    try {
      await enviarWhatsappJoao({ telefone: MORGANA_WHATSAPP, texto: mensagemMorgana });
    } catch (wppErr) {
      console.warn("[AGENT API] Falha ao notificar Morgana via WhatsApp (não crítico):", wppErr);
    }

    await auditLog({
      action: "OPORTUNIDADE_PENDENTE_APROVACAO_MORGANA",
      entity: "Obra",
      entityId: obraRecord.id,
      after: { titulo: oportunidade.titulo, empresaId: empresaRecord.id },
      metadata: { origem, notificadaMorgana: MORGANA_WHATSAPP },
      request: req,
    });

    return NextResponse.json(
      {
        sucesso: true,
        mensagem: "Obra e empresa registradas. Morgana notificada via WhatsApp para aprovação de oportunidade.",
        empresaId: empresaRecord.id,
        obraId: obraRecord.id,
        pessoaId: pessoaRecord?.id ?? null,
        notificadaMorgana: MORGANA_WHATSAPP,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[AGENT API] Erro ao criar lead:", error);
    return NextResponse.json(
      { error: "Erro interno ao criar lead no CRM.", detalhe: String(error) },
      { status: 500 },
    );
  }
}
