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
    };
    obra: {
      nome: string;
      descricao?: string;
      cidade?: string;
      estado?: string;
      volumeEstimado?: number;
    };
    oportunidade: {
      titulo: string;
      descricao?: string;
      tipoServico?: TipoServico;
      potencialOportunidade?: number;
      temperatura?: TemperaturaOportunidade;
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
          observacoes: `Origem: ${origem}${
            empresa.observacoes ? `\n${empresa.observacoes}` : ""
          }`,
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
          descricao: obra.descricao ?? null,
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

    // 7. Criar Oportunidade
    const oportunidadeRecord = await prisma.oportunidade.create({
      data: {
        titulo: oportunidade.titulo,
        descricao: `${oportunidade.descricao ?? ""}\n\n📡 ${origem}`.trim(),
        tipo: TipoOperacao.LOCACAO,
        tipoServico: oportunidade.tipoServico ?? null,
        status: StatusOportunidade.NOVA,
        temperatura: oportunidade.temperatura ?? TemperaturaOportunidade.QUENTE,
        potencialOportunidade: oportunidade.potencialOportunidade
          ? String(oportunidade.potencialOportunidade)
          : null,
        canalOrigem: CanalOrigem.OBRA_MAPEADA,
        empresaId: empresaRecord.id,
        obraId: obraRecord.id,
        pessoaId: pessoaRecord?.id ?? null,
        ativa: true,
      },
    });

    await auditLog({
      action: "OPORTUNIDADE_CREATED_BY_AGENT",
      entity: "Oportunidade",
      entityId: oportunidadeRecord.id,
      after: oportunidadeRecord,
      metadata: { origem },
      request: req,
    });

    // 8. Criar tarefa de follow-up para o dia seguinte às 09h
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(9, 0, 0, 0);

    await prisma.tarefa.create({
      data: {
        titulo: `Primeiro contato — ${oportunidade.titulo}`,
        descricao: pessoaRecord
          ? `Decisor identificado: ${pessoaRecord.nome}${
              pessoaRecord.cargo ? ` (${pessoaRecord.cargo})` : ""
            }. Lead gerado pelo ${origem}.`
          : `Decisor ainda não identificado. Pesquisar antes do contato. Lead gerado pelo ${origem}.`,
        tipo: pessoaRecord?.whatsapp ? TipoAtividade.WHATSAPP : TipoAtividade.EMAIL,
        prioridade:
          oportunidade.temperatura === TemperaturaOportunidade.QUENTE
            ? PrioridadeTarefa.ALTA
            : PrioridadeTarefa.MEDIA,
        status: StatusTarefa.PENDENTE,
        dataVencimento: amanha,
        oportunidadeId: oportunidadeRecord.id,
        empresaId: empresaRecord.id,
        pessoaId: pessoaRecord?.id ?? null,
      },
    });

    return NextResponse.json(
      {
        sucesso: true,
        mensagem: "Lead criado com sucesso no CRM.",
        empresaId: empresaRecord.id,
        obraId: obraRecord.id,
        oportunidadeId: oportunidadeRecord.id,
        pessoaId: pessoaRecord?.id ?? null,
        urlCRM: "https://villa-crm.vercel.app/oportunidades",
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
