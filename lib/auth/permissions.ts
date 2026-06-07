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
  | "agentes";

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
  },
};

export function can(role: PapelUsuario, resource: Resource, action: Action) {
  return permissions[role][resource].includes(action);
}
