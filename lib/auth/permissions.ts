import type { PapelUsuario } from "@/app/generated/prisma/client";

export type Resource =
  | "empresas"
  | "obras"
  | "contatos"
  | "oportunidades"
  | "propostas"
  | "relatorios"
  | "tarefas"
  | "equipamentos"
  | "auditoria"
  | "usuarios"
  | "agentes"
  | "inteligencia"
  | "bi_executivo"
  | "contratos"
  | "midias_sociais";

export type Action = "read" | "create" | "update" | "delete";

const allActions: Action[] = ["read", "create", "update", "delete"];

export const permissions: Record<PapelUsuario, Record<Resource, Action[]>> = {
  ADMIN: {
    empresas: allActions,
    obras: allActions,
    contatos: allActions,
    oportunidades: allActions,
    propostas: allActions,
    relatorios: ["read"],
    tarefas: allActions,
    equipamentos: allActions,
    auditoria: ["read"],
    usuarios: allActions,
    agentes: allActions,
    // Inteligência: ADMIN pode tudo — assumir dossiê, descartar, pesquisar
    inteligencia: allActions,
    bi_executivo: ["read"],
    contratos: allActions,
    // Mídias Sociais: ADMIN configura conexão/credenciais (sensível, mesmo padrão de "agentes")
    midias_sociais: allActions,
  },
  GERENTE: {
    empresas: allActions,
    obras: allActions,
    contatos: allActions,
    oportunidades: allActions,
    propostas: allActions,
    relatorios: ["read"],
    tarefas: allActions,
    equipamentos: allActions,
    auditoria: ["read"],
    usuarios: ["read"],
    agentes: [],
    // Inteligência: GERENTE (Morgana) pode assumir e descartar dossiês
    inteligencia: ["read", "create", "update", "delete"],
    bi_executivo: ["read"],
    contratos: allActions,
    // Mídias Sociais: GERENTE só visualiza o cockpit — não mexe em conexão/credenciais
    midias_sociais: ["read"],
  },
  COMERCIAL: {
    empresas: ["read", "create", "update"],
    obras: ["read", "create", "update"],
    contatos: ["read", "create", "update"],
    oportunidades: ["read", "create", "update"],
    propostas: ["read", "create", "update"],
    relatorios: ["read"],
    tarefas: ["read", "create", "update"],
    equipamentos: ["read"],
    auditoria: [],
    usuarios: [],
    agentes: [],
    // Inteligência: COMERCIAL só visualiza — NÃO pode assumir nem descartar dossiês
    inteligencia: ["read"],
    bi_executivo: [],
    contratos: ["read", "create"],
    // Mídias Sociais: COMERCIAL vê leads/oportunidades vindos do marketing (relevante ao papel)
    midias_sociais: ["read"],
  },
  OPERACIONAL: {
    empresas: ["read"],
    obras: ["read"],
    contatos: ["read"],
    oportunidades: ["read"],
    propostas: ["read"],
    relatorios: [],
    tarefas: ["read"],
    equipamentos: ["read"],
    auditoria: [],
    usuarios: [],
    agentes: [],
    // Inteligência: OPERACIONAL só visualiza
    inteligencia: ["read"],
    bi_executivo: [],
    contratos: ["read"],
    // Mídias Sociais: fora do escopo operacional deste papel
    midias_sociais: [],
  },
};

export function can(role: PapelUsuario, resource: Resource, action: Action) {
  return permissions[role][resource].includes(action);
}
