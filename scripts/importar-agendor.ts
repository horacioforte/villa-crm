/**
 * scripts/importar-agendor.ts
 * ─────────────────────────────────────────────
 * Roda a importação Agendor → Villa CRM direto
 * pelo terminal, sem precisar do servidor Next.
 *
 * Uso (no terminal do Cursor):
 *   npx tsx scripts/importar-agendor.ts
 *
 * Opções:
 *   npx tsx scripts/importar-agendor.ts --apenas empresas
 *   npx tsx scripts/importar-agendor.ts --apenas pessoas
 *   npx tsx scripts/importar-agendor.ts --apenas negocios
 * ─────────────────────────────────────────────
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback para .env

import {
  AgendorClient,
  AgendorOrganization,
  mapOrganizacaoParaEmpresa,
  mapPessoaAgendor,
  mapNegocioAgendor,
} from "../lib/agendor";
import { prisma } from "../lib/prisma";

// ── lê argumento --apenas <tipo> ──────────────
const apenasIdx = process.argv.indexOf("--apenas");
const apenas = apenasIdx !== -1 ? process.argv[apenasIdx + 1] : null;

interface Resultado {
  criadas: number;
  atualizadas: number;
  ignoradas: number;
  erros: number;
}

function vazio(): Resultado {
  return { criadas: 0, atualizadas: 0, ignoradas: 0, erros: 0 };
}

async function main() {
  console.log("\n🚀 Iniciando importação do Agendor...\n");
  const inicio = Date.now();

  const client = new AgendorClient();

  const resumo = {
    empresas: vazio(),
    pessoas: vazio(),
    oportunidades: vazio(),
  };

  // ── Busca TUDO de uma vez (evita 429) ────────
  console.log("⬇️  Buscando dados no Agendor (uma única vez)...");
  const [orgs, people, deals] = await Promise.all([
    (!apenas || apenas === "empresas" || apenas === "pessoas" || apenas === "negocios")
      ? client.getOrganizations()
      : Promise.resolve([] as AgendorOrganization[]),
    (!apenas || apenas === "pessoas")
      ? client.getPeople()
      : Promise.resolve([]),
    (!apenas || apenas === "negocios")
      ? client.getDeals()
      : Promise.resolve([]),
  ]);

  console.log(`   ${orgs.length} empresa(s), ${people.length} pessoa(s), ${deals.length} negócio(s)\n`);

  // mapa agendorOrgId → empresaId (Villa CRM)
  const orgIdParaEmpresaId = new Map<number, string>();
  // mapa agendorOrgId → dados da org (para resolver empresas de pessoas/deals)
  const orgById = new Map<number, AgendorOrganization>(orgs.map((o) => [o.id, o]));
  // mapa agendorPersonId → pessoaId (Villa CRM)
  const personIdParaPessoaId = new Map<number, string>();

  // ── 1. EMPRESAS ─────────────────────────────
  if (!apenas || apenas === "empresas") {
    console.log("📦 Importando empresas...");

    for (const org of orgs) {
      try {
        const dados = mapOrganizacaoParaEmpresa(org);

        const existentePorCnpj = dados.cnpj
          ? await prisma.empresa.findUnique({ where: { cnpj: dados.cnpj } })
          : null;

        const existente =
          existentePorCnpj ??
          (await prisma.empresa.findFirst({
            where: { razaoSocial: dados.razaoSocial },
          }));

        let empresa;
        if (existente) {
          empresa = await prisma.empresa.update({
            where: { id: existente.id },
            data: dados,
          });
          resumo.empresas.atualizadas++;
          console.log(`   ✏️  Atualizada: ${empresa.razaoSocial}`);
        } else {
          empresa = await prisma.empresa.create({ data: dados });
          resumo.empresas.criadas++;
          console.log(`   ✅ Criada:     ${empresa.razaoSocial}`);
        }

        orgIdParaEmpresaId.set(org.id, empresa.id);
      } catch (err) {
        console.error(`   ❌ Erro empresa ${org.id}:`, err);
        resumo.empresas.erros++;
      }
    }
  }

  // ── 2. PESSOAS ──────────────────────────────
  if (!apenas || apenas === "pessoas") {
    console.log("\n👤 Importando pessoas...");

    for (const person of people) {
      try {
        const agendorOrgId = person.organization?.id;
        if (!agendorOrgId) {
          resumo.pessoas.ignoradas++;
          continue;
        }

        // resolve empresaId — primeiro no mapa em memória
        let empresaId = orgIdParaEmpresaId.get(agendorOrgId);

        // se não está no mapa (importação parcial), busca no banco
        if (!empresaId) {
          const orgAgendor = orgById.get(agendorOrgId);
          if (orgAgendor) {
            const d = mapOrganizacaoParaEmpresa(orgAgendor);
            const emp = d.cnpj
              ? await prisma.empresa.findUnique({ where: { cnpj: d.cnpj } })
              : await prisma.empresa.findFirst({ where: { razaoSocial: d.razaoSocial } });
            if (emp) {
              empresaId = emp.id;
              orgIdParaEmpresaId.set(agendorOrgId, emp.id); // cache para próximos
            }
          }
        }

        if (!empresaId) {
          resumo.pessoas.ignoradas++;
          continue;
        }

        const dados = mapPessoaAgendor(person);

        const existente = dados.email
          ? await prisma.pessoa.findFirst({
              where: { email: dados.email, empresaId },
            })
          : null;

        let pessoa;
        if (existente) {
          pessoa = await prisma.pessoa.update({
            where: { id: existente.id },
            data: dados,
          });
          resumo.pessoas.atualizadas++;
          console.log(`   ✏️  Atualizada: ${pessoa.nome}`);
        } else {
          pessoa = await prisma.pessoa.create({
            data: { ...dados, empresaId },
          });
          resumo.pessoas.criadas++;
          console.log(`   ✅ Criada:     ${pessoa.nome}`);
        }

        personIdParaPessoaId.set(person.id, pessoa.id);
      } catch (err) {
        console.error(`   ❌ Erro pessoa ${person.id}:`, err);
        resumo.pessoas.erros++;
      }
    }
  }

  // ── 3. NEGÓCIOS → OPORTUNIDADES ─────────────
  if (!apenas || apenas === "negocios") {
    console.log("\n💼 Importando negócios...");

    for (const deal of deals) {
      try {
        const agendorOrgId = deal.organization?.id;
        if (!agendorOrgId) {
          resumo.oportunidades.ignoradas++;
          continue;
        }

        let empresaId = orgIdParaEmpresaId.get(agendorOrgId);

        if (!empresaId) {
          const orgAgendor = orgById.get(agendorOrgId);
          if (orgAgendor) {
            const d = mapOrganizacaoParaEmpresa(orgAgendor);
            const emp = d.cnpj
              ? await prisma.empresa.findUnique({ where: { cnpj: d.cnpj } })
              : await prisma.empresa.findFirst({ where: { razaoSocial: d.razaoSocial } });
            if (emp) {
              empresaId = emp.id;
              orgIdParaEmpresaId.set(agendorOrgId, emp.id);
            }
          }
        }

        if (!empresaId) {
          resumo.oportunidades.ignoradas++;
          continue;
        }

        const dados = mapNegocioAgendor(deal);
        const pessoaId = deal.person?.id
          ? (personIdParaPessoaId.get(deal.person.id) ?? null)
          : null;

        const existente = await prisma.oportunidade.findFirst({
          where: { titulo: dados.titulo, empresaId, origem: "Agendor" },
        });

        let oportunidade;
        if (existente) {
          oportunidade = await prisma.oportunidade.update({
            where: { id: existente.id },
            data: { ...dados, pessoaId: pessoaId ?? existente.pessoaId },
          });
          resumo.oportunidades.atualizadas++;
          console.log(`   ✏️  Atualizada: ${oportunidade.titulo}`);
        } else {
          oportunidade = await prisma.oportunidade.create({
            data: { ...dados, empresaId, pessoaId },
          });
          resumo.oportunidades.criadas++;
          console.log(`   ✅ Criada:     ${oportunidade.titulo}`);
        }
      } catch (err) {
        console.error(`   ❌ Erro negócio ${deal.id}:`, err);
        resumo.oportunidades.erros++;
      }
    }
  }

  const duracao = ((Date.now() - inicio) / 1000).toFixed(1);

  console.log("\n─────────────────────────────────────────────");
  console.log("✅ Importação concluída em", duracao, "segundos\n");
  console.log("📊 Resumo:");
  console.log(
    `   Empresas:      ${resumo.empresas.criadas} criadas, ${resumo.empresas.atualizadas} atualizadas, ${resumo.empresas.erros} erros`
  );
  console.log(
    `   Pessoas:       ${resumo.pessoas.criadas} criadas, ${resumo.pessoas.atualizadas} atualizadas, ${resumo.pessoas.ignoradas} ignoradas, ${resumo.pessoas.erros} erros`
  );
  console.log(
    `   Oportunidades: ${resumo.oportunidades.criadas} criadas, ${resumo.oportunidades.atualizadas} atualizadas, ${resumo.oportunidades.ignoradas} ignoradas, ${resumo.oportunidades.erros} erros`
  );
  console.log("─────────────────────────────────────────────\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Erro fatal:", err);
  prisma.$disconnect();
  process.exit(1);
});
