// ARQUIVO: app/api/inteligencia/[id]/assumir/route.ts
// REGRA: nunca remover. Apenas acrescentar.
// Ação principal da Morgana: assume o dossiê e cria Oportunidade no pipeline comercial.

import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import {
  CanalOrigem,
  PrioridadeTarefa,
  StatusObra,
  StatusOportunidade,
  StatusTarefa,
  TipoAtividade,
  TipoOperacao,
  InfluenciaDecisao,
  NivelRelacionamento,
  TipoPessoa,
} from "@/app/generated/prisma/client";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const authResult = await requireAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const usuario = { id: authResult.id, name: authResult.nome };

  let body: { responsavelId?: string; observacoes?: string } = {};
  try { body = await req.json(); } catch { /* body vazio é ok */ }

  const dossie = await prisma.dossieComercial.findUnique({
    where: { id: params.id },
    include: {
      decisores:            true,
      empresasRelacionadas: true,
    },
  });

  if (!dossie) return NextResponse.json({ error: "Dossiê não encontrado." }, { status: 404 });
  if (dossie.status === "ASSUMIDO") {
    return NextResponse.json({ error: "Dossiê já foi assumido.", oportunidadeId: dossie.oportunidadeId }, { status: 409 });
  }
  if (dossie.status === "ARQUIVADO") {
    return NextResponse.json({ error: "Dossiê arquivado não pode ser assumido." }, { status: 400 });
  }

  // ── Transação: cria empresa, obra, oportunidade e tarefa ──────────────────
  const resultado = await prisma.$transaction(async (tx) => {

    // 1. Buscar ou criar Empresa no CRM
    let empresaId = dossie.empresaId;
    if (!empresaId) {
      // Usa o nome da empresa do dossiê (clienteFinal ou título como fallback)
      const nomeEmpresa = dossie.clienteFinal ?? dossie.titulo;
      let empresa = await tx.empresa.findFirst({
        where: { razaoSocial: { equals: nomeEmpresa, mode: "insensitive" } },
        select: { id: true },
      });
      if (!empresa) {
        empresa = await tx.empresa.create({
          data: {
            razaoSocial: nomeEmpresa,
            segmento:    dossie.segmento ?? "Construtora",
            cidade:      dossie.cidade   ?? null,
            estado:      dossie.estado   ?? null,
            observacoes: `Origem: Central de Inteligência\nDossiê: ${dossie.id}`,
            ativa:       true,
          },
          select: { id: true },
        });
      }
      empresaId = empresa.id;

      // Vincula o dossiê à empresa criada
      await tx.dossieComercial.update({
        where: { id: dossie.id },
        data:  { empresaId },
      });
    }

    // 2. Buscar ou criar Obra no CRM
    let obraId = dossie.obraId;
    if (!obraId) {
      let obra = await tx.obra.findFirst({
        where: { empresaId, nome: { equals: dossie.titulo, mode: "insensitive" } },
        select: { id: true },
      });
      if (!obra) {
        obra = await tx.obra.create({
          data: {
            nome:       dossie.titulo,
            descricao:  dossie.resumo  ?? null,
            cidade:     dossie.cidade  ?? null,
            estado:     dossie.estado  ?? null,
            status:     StatusObra.PLANEJADA,
            empresaId,
            ativa:      true,
          },
          select: { id: true },
        });
      }
      obraId = obra.id;

      await tx.dossieComercial.update({
        where: { id: dossie.id },
        data:  { obraId },
      });
    }

    // 3. Vincular decisores → Pessoa no CRM
    let pessoaIdPrincipal: string | null = null;
    for (const decisor of dossie.decisores) {
      if (!decisor.nome) continue;
      if (decisor.pessoaId) {
        if (!pessoaIdPrincipal) pessoaIdPrincipal = decisor.pessoaId;
        continue;
      }
      // Busca ou cria Pessoa
      let pessoa = await tx.pessoa.findFirst({
        where: { empresaId, nome: { equals: decisor.nome, mode: "insensitive" } },
        select: { id: true },
      });
      if (!pessoa) {
        pessoa = await tx.pessoa.create({
          data: {
            nome:               decisor.nome,
            cargo:              decisor.cargo       ?? null,
            email:              decisor.email       ?? null,
            telefone:           decisor.telefone    ?? null,
            whatsapp:           decisor.telefone    ?? null,
            linkedin:           decisor.linkedin    ?? null,
            tipo:               TipoPessoa.DECISOR,
            influenciaDecisao:  InfluenciaDecisao.DECISOR,
            nivelRelacionamento: NivelRelacionamento.NEUTRO,
            empresaId,
            ativa: true,
          },
          select: { id: true },
        });
      }
      // Vincula o DecisorDossie à Pessoa criada
      await tx.decisorDossie.update({
        where: { id: decisor.id },
        data:  { pessoaId: pessoa.id },
      });
      if (!pessoaIdPrincipal) pessoaIdPrincipal = pessoa.id;
    }

    // 4. Criar Oportunidade no pipeline comercial
    const prioridadeMap: Record<string, PrioridadeTarefa> = {
      ALTA:  PrioridadeTarefa.ALTA,
      MEDIA: PrioridadeTarefa.MEDIA,
      BAIXA: PrioridadeTarefa.BAIXA,
    };
    const prioridadeTarefa = prioridadeMap[dossie.prioridade ?? ""] ?? PrioridadeTarefa.MEDIA;

    const oportunidade = await tx.oportunidade.create({
      data: {
        titulo:               dossie.titulo,
        descricao:            [
          dossie.resumo,
          dossie.equipamentosSugeridos ? `Equipamentos sugeridos: ${dossie.equipamentosSugeridos}` : null,
          dossie.proximaAcaoSugerida   ? `Próxima ação: ${dossie.proximaAcaoSugerida}`             : null,
          body.observacoes             ? `Observações: ${body.observacoes}`                         : null,
          `🧠 Origem: Central de Inteligência (Dossiê ${dossie.id})`,
        ].filter(Boolean).join("\n\n"),
        tipo:                 TipoOperacao.LOCACAO,
        status:               StatusOportunidade.NOVA,
        canalOrigem:          CanalOrigem.OBRA_MAPEADA,
        potencialOportunidade: dossie.valorEstimado ? String(dossie.valorEstimado) : null,
        temperatura:          dossie.score >= 80 ? "QUENTE" : dossie.score >= 50 ? "MEDIA" : "FRIA",
        empresaId,
        obraId,
        pessoaId:             pessoaIdPrincipal,
        responsavelId:        body.responsavelId ?? null,
        ativa:                true,
      },
      select: { id: true },
    });

    // 5. Criar tarefa de follow-up
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(9, 0, 0, 0);

    await tx.tarefa.create({
      data: {
        titulo:        `Primeiro contato — ${dossie.titulo}`,
        descricao:     `Oportunidade assumida da Central de Inteligência. Completude do dossiê: ${dossie.completude}%. Score: ${dossie.score}/100.`,
        tipo:          TipoAtividade.LIGACAO,
        prioridade:    prioridadeTarefa,
        status:        StatusTarefa.PENDENTE,
        dataVencimento: amanha,
        oportunidadeId: oportunidade.id,
        empresaId,
        pessoaId:      pessoaIdPrincipal,
        responsavelId: body.responsavelId ?? null,
      },
    });

    // 6. Atualizar dossiê: ASSUMIDO + oportunidadeId
    await tx.dossieComercial.update({
      where: { id: dossie.id },
      data: {
        status:        "ASSUMIDO",
        oportunidadeId: oportunidade.id,
        assumidoPorId: usuario?.id ?? null,
        assumidaEm:    new Date(),
        ultimaAtividade: new Date(),
      },
    });

    // 7. Registrar atualização no dossiê
    await tx.atualizacaoDossie.create({
      data: {
        dossieId:      dossie.id,
        tipo:          "ASSUMIDO_PELO_COMERCIAL",
        titulo:        "Oportunidade assumida pelo comercial",
        conteudo:      `${usuario?.name ?? "Usuário"} assumiu este dossiê. Oportunidade criada no pipeline comercial: ${oportunidade.id}.`,
        agente:        "comercial",
        oportunidadeId: oportunidade.id,
        usuarioId:     usuario?.id ?? null,
      },
    });

    return { oportunidadeId: oportunidade.id, empresaId, obraId };
  });

  await auditLog({
    action: "DOSSIE_ASSUMIDO",
    entity: "DossieComercial",
    entityId: params.id,
    after: { status: "ASSUMIDO", oportunidadeId: resultado.oportunidadeId },
    request: req,
  });

  return NextResponse.json({
    sucesso: true,
    mensagem: "Dossiê assumido. Oportunidade criada no pipeline comercial.",
    ...resultado,
    urlOportunidade: `/oportunidades/${resultado.oportunidadeId}`,
    urlDossie: `/inteligencia/${params.id}`,
  });
}
