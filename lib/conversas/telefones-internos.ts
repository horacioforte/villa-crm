// ARQUIVO: lib/conversas/telefones-internos.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// ACRESCENTADO — conversas com o telefone de alguém da equipe (cadastrado em
// Usuario.telefone) são conversas internas (testes, uso do dia a dia com Maria/João
// etc.): não são cliente esperando resposta, então não entram em "aguardando resposta",
// na etiqueta/filtro "Urgente" nem nas bolinhas do menu. A conversa continua existindo e
// aparecendo normalmente na lista — só não vira alerta.
import { prisma } from "@/lib/prisma";
import { variantesTelefoneBR } from "@/lib/whatsapp/telefone";

export async function buscarTelefonesInternos(): Promise<Set<string>> {
  const set = new Set<string>();
  let usuarios: { telefone: string | null }[] = [];
  try {
    usuarios = await prisma.usuario.findMany({
      where: { telefone: { not: null } },
      select: { telefone: true },
    });
  } catch {
    // Best-effort: se falhar, ninguém é tratado como interno (comportamento anterior).
    return set;
  }
  for (const u of usuarios) {
    const digits = (u.telefone ?? "").replace(/\D/g, "");
    if (!digits) continue;
    // Usuario.telefone pode estar sem o 55: guarda as duas formas.
    const comPais = digits.startsWith("55") ? digits : `55${digits}`;
    for (const v of variantesTelefoneBR(comPais)) set.add(v);
  }
  return set;
}

export function ehTelefoneInterno(internos: Set<string>, telefone: string | null | undefined): boolean {
  if (!telefone || internos.size === 0) return false;
  const digits = telefone.replace(/\D/g, "");
  if (!digits) return false;
  return variantesTelefoneBR(digits).some((v) => internos.has(v));
}
