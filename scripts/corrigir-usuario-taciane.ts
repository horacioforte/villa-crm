// ARQUIVO: scripts/corrigir-usuario-taciane.ts
// Corrige o nome do usuário existente "Tarciene" (id cmpv7osai000004k1i3almvf9,
// comercial1@villaempreendimentos.com.br, papel COMERCIAL) para "Taciane". Preserva
// id, email, papel, ativo, filialId e todos os demais campos — só o nome muda.
//
// Idempotente: se o nome já for "Taciane", não faz nenhuma escrita.
//
// Modo padrão: DRY RUN (só relatório, nenhuma escrita). Passe --apply para gravar de fato.
//
// Uso:
//   npx tsx scripts/corrigir-usuario-taciane.ts            (dry run)
//   npx tsx scripts/corrigir-usuario-taciane.ts --apply     (grava)

import "./env";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const APLICAR = process.argv.includes("--apply");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const USUARIO_ID = "cmpv7osai000004k1i3almvf9";
const EMAIL_ESPERADO = "comercial1@villaempreendimentos.com.br";
const NOME_ALVO = "Taciane";

async function main() {
  const relatorio: Record<string, unknown> = { modo: APLICAR ? "APLICAR" : "DRY_RUN" };

  const usuario = await prisma.usuario.findUnique({
    where: { id: USUARIO_ID },
    select: { id: true, nome: true, email: true, papel: true, ativo: true, filialId: true },
  });

  relatorio.usuarioEncontrado = usuario;

  if (!usuario) {
    relatorio.erro = `Usuário ${USUARIO_ID} não encontrado — nenhuma alteração feita.`;
    console.log(JSON.stringify(relatorio, null, 2));
    return;
  }

  if (usuario.email !== EMAIL_ESPERADO) {
    relatorio.erro = `E-mail atual (${usuario.email}) diverge do esperado (${EMAIL_ESPERADO}) — abortado por segurança, nenhuma alteração feita.`;
    console.log(JSON.stringify(relatorio, null, 2));
    return;
  }

  if (usuario.nome === NOME_ALVO) {
    relatorio.jaCorrigido = true;
    relatorio.acao = "nenhuma — nome já é 'Taciane'";
    console.log(JSON.stringify(relatorio, null, 2));
    return;
  }

  relatorio.alteracao = { nome: { de: usuario.nome, para: NOME_ALVO } };
  relatorio.camposPreservados = {
    id: usuario.id,
    email: usuario.email,
    papel: usuario.papel,
    ativo: usuario.ativo,
    filialId: usuario.filialId,
  };

  if (APLICAR) {
    const atualizado = await prisma.usuario.update({
      where: { id: USUARIO_ID },
      data: { nome: NOME_ALVO },
      select: { id: true, nome: true, email: true, papel: true, ativo: true, filialId: true },
    });
    relatorio.usuarioFinal = atualizado;
  }

  console.log(JSON.stringify(relatorio, null, 2));

  if (!APLICAR) {
    console.log("\n[dry run] Nenhuma escrita foi feita. Rode com --apply para gravar.");
  }
}

main().finally(() => prisma.$disconnect());
