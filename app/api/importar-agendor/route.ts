/**
 * app/api/importar-agendor/route.ts
 * ──────────────────────────────────────────────────────────────
 * POST /api/importar-agendor
 *
 * Importa Organizations → Empresa, People → Pessoa e
 * Deals → Oportunidade do Agendor para o Villa CRM.
 *
 * Requer autenticação com papel ADMIN ou GERENTE.
 * Registra cada operação no AuditLog.
 *
 * Exemplo de chamada:
 *   POST /api/importar-agendor
 *   Authorization: Bearer <session>
 *   Body: {} ou { apenas: "empresas" | "pessoas" | "negocios" }
 * ──────────────────────────────────────────────────────────────
 */

import { NextResponse } from "next/server";

import { auditLog } from "@/lib/audit";
import {
  AgendorClient,
  mapOrganizacaoParaEmpresa,
  mapPessoaAgendor,
  mapNegocioAgendor,
} from "@/lib/agendor";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────
// TIPOS AUXILIARES
// ─────────────────────────────────────────────────────────────

interface ImportResultado {
  criadas: number;
  atualizadas: number;
  ignoradas: number;
  erros: number;
}

interface ImportResumo {
  empresas: ImportResultado;
  pessoas: ImportResultado;
  oportunidades: ImportResultado;
  duracaoMs: number;
}

function resultadoVazio(): ImportResultado {
  return { criadas: 0, atualizadas: 0, ignoradas: 0, erros: 0 };
}

// ─────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Apenas ADMIN ou GERENTE podem importar
  const authResult = await requirePermission("empresas", "create", request);
  if (authResult instanceof NextResponse) return authResult;

  const inicio = Date.now();
  const body = await request.json().catch(() => ({})) as {
    apenas?: "empresas" | "pessoas" | "negocios";
  };

  const resumo: ImportResumo = {
    empresas: resultadoVazio(),
    pessoas: resultadoVazio(),
    oportunidades: resultadoVazio(),
    duracaoMs: 0,
  };

  try {
    const client = new AgendorClient();

    // ── MAPA: agendorOrgId → empresaId (Villa CRM) ─────────────
    const orgIdParaEmpresaId = new Map<number, string>();

    // ── 1. EMPRESAS ─────────────────────────────────────────────
    if (!body.apenas || body.apenas === "empresas") {
      const organizations = await client.getOrganizations();

      for (const org of organizations) {
        try {
          const dados = mapOrganizacaoParaEmpresa(org);

          // Tenta encontrar pelo CNPJ (mais confiável)
          const existentePorCnpj = dados.cnpj
            ? await prisma.empresa.findUnique({ where: { cnpj: dados.cnpj } })
            : null;

          // Se não achou por CNPJ, tenta pela razão social exata
          const existente =
            existentePorCnpj ??
            (await prisma.empresa.findFirst({
              where: { razaoSocial: dados.razaoSocial },
            }));

          let empresa;

          if (existente) {
            empresa = await prisma.empresa.update({
              where: { id: existente.id },
              data: { ...dados, updatedById: authResult.id },
            });
            resumo.empresas.atualizadas++;
          } else {
            empresa = await prisma.empresa.create({
              data: {
                ...dados,
                createdById: authResult.id,
                updatedById: authResult.id,
              },
            });
            resumo.empresas.criadas++;
          }

          orgIdParaEmpresaId.set(org.id, empresa.id);

          await auditLog({
            action: existente ? "EMPRESA_ATUALIZADA_AGENDOR" : "EMPRESA_CRIADA_AGENDOR",
            entity: "Empresa",
            entityId: empresa.id,
            after: empresa,
            userId: authResult.id,
            metadata: { agendorOrgId: org.id },
            request,
          });
        } catch (err) {
          console.error(`[Agendor] Erro ao importar empresa ${org.id}:`, err);
          resumo.empresas.erros++;
        }
      }
    }

    // ── MAPA: agendorPersonId → pessoaId (Villa CRM) ───────────
    const personIdParaPessoaId = new Map<number, string>();

    // ── 2. PESSOAS ──────────────────────────────────────────────
    if (!body.apenas || body.apenas === "pessoas") {
      const people = await client.getPeople();

      for (const person of people) {
        try {
          // Pessoa sem organização → não pode criar (empresaId obrigatório)
          const agendorOrgId = person.organization?.id;
          if (!agendorOrgId) {
            resumo.pessoas.ignoradas++;
            continue;
          }

          // Resolve o empresaId no Villa CRM
          let empresaId = orgIdParaEmpresaId.get(agendorOrgId);
          if (!empresaId) {
            // Pode ter sido importada numa sessão anterior → busca pela org
            const orgAgendor = await client.getOrganizations().then((orgs) =>
              orgs.find((o) => o.id === agendorOrgId)
            );
            if (orgAgendor) {
              const dadosOrg = mapOrganizacaoParaEmpresa(orgAgendor);
              const emp = dadosOrg.cnpj
                ? await prisma.empresa.findUnique({ where: { cnpj: dadosOrg.cnpj } })
                : await prisma.empresa.findFirst({ where: { razaoSocial: dadosOrg.razaoSocial } });
              if (emp) empresaId = emp.id;
            }
          }

          if (!empresaId) {
            resumo.pessoas.ignoradas++;
            continue;
          }

          const dados = mapPessoaAgendor(person);

          // Busca por e-mail dentro da mesma empresa
          const existente = dados.email
            ? await prisma.pessoa.findFirst({
                where: { email: dados.email, empresaId },
              })
            : null;

          let pessoa;

          if (existente) {
            pessoa = await prisma.pessoa.update({
              where: { id: existente.id },
              data: { ...dados, updatedById: authResult.id },
            });
            resumo.pessoas.atualizadas++;
          } else {
            pessoa = await prisma.pessoa.create({
              data: {
                ...dados,
                empresaId,
                createdById: authResult.id,
                updatedById: authResult.id,
              },
            });
            resumo.pessoas.criadas++;
          }

          personIdParaPessoaId.set(person.id, pessoa.id);

          await auditLog({
            action: existente ? "PESSOA_ATUALIZADA_AGENDOR" : "PESSOA_CRIADA_AGENDOR",
            entity: "Pessoa",
            entityId: pessoa.id,
            after: pessoa,
            userId: authResult.id,
            metadata: { agendorPersonId: person.id },
            request,
          });
        } catch (err) {
          console.error(`[Agendor] Erro ao importar pessoa ${person.id}:`, err);
          resumo.pessoas.erros++;
        }
      }
    }

    // ── 3. NEGÓCIOS → OPORTUNIDADES ─────────────────────────────
    if (!body.apenas || body.apenas === "negocios") {
      const deals = await client.getDeals();

      for (const deal of deals) {
        try {
          const agendorOrgId = deal.organization?.id;
          if (!agendorOrgId) {
            resumo.oportunidades.ignoradas++;
            continue;
          }

          const empresaId = orgIdParaEmpresaId.get(agendorOrgId);
          if (!empresaId) {
            resumo.oportunidades.ignoradas++;
            continue;
          }

          const dados = mapNegocioAgendor(deal);
          const pessoaId = deal.person?.id
            ? personIdParaPessoaId.get(deal.person.id) ?? null
            : null;

          // Não há ID único do Agendor no schema → evita duplicatas pelo título + empresa
          const existente = await prisma.oportunidade.findFirst({
            where: {
              titulo: dados.titulo,
              empresaId,
              origem: "Agendor",
            },
          });

          let oportunidade;

          if (existente) {
            oportunidade = await prisma.oportunidade.update({
              where: { id: existente.id },
              data: {
                ...dados,
                pessoaId: pessoaId ?? existente.pessoaId,
                updatedById: authResult.id,
              },
            });
            resumo.oportunidades.atualizadas++;
          } else {
            oportunidade = await prisma.oportunidade.create({
              data: {
                ...dados,
                empresaId,
                pessoaId,
                createdById: authResult.id,
                updatedById: authResult.id,
              },
            });
            resumo.oportunidades.criadas++;
          }

          await auditLog({
            action: existente
              ? "OPORTUNIDADE_ATUALIZADA_AGENDOR"
              : "OPORTUNIDADE_CRIADA_AGENDOR",
            entity: "Oportunidade",
            entityId: oportunidade.id,
            after: oportunidade,
            userId: authResult.id,
            metadata: { agendorDealId: deal.id },
            request,
          });
        } catch (err) {
          console.error(`[Agendor] Erro ao importar negócio ${deal.id}:`, err);
          resumo.oportunidades.erros++;
        }
      }
    }

    resumo.duracaoMs = Date.now() - inicio;

    return NextResponse.json({
      sucesso: true,
      resumo,
    });
  } catch (err) {
    console.error("[Agendor] Falha geral na importação:", err);
    return NextResponse.json(
      {
        sucesso: false,
        erro: err instanceof Error ? err.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
