import type { PapelUsuario } from "@/app/generated/prisma/client";

export type Resource =
  | "empresas"
  | "obras"
  | "contatos"
  | "oportunidades"
  | "propostas"
  | "tarefas"
  | "equipamentos"
  | "auditoria"
  | "usuarios";

export type Action = "read" | "create" | "update" | "delete";

const allActions: Action[] = ["read", "create", "update", "delete"];

export const permissions: Record<PapelUsuario, Record<Resource, Action[]>> = {
  ADMIN: {
    empresas: allActions,
    obras: allActions,
    contatos: allActions,
    oportunidades: allActions,
    propostas: allActions,
    tarefas: allActions,
    equipamentos: allActions,
    auditoria: ["read"],
    usuarios: allActions,
  },
  GERENTE: {
    empresas: allActions,
    obras: allActions,
    contatos: allActions,
    oportunidades: allActions,
    propostas: allActions,
    tarefas: allActions,
    equipamentos: allActions,
    auditoria: ["read"],
    usuarios: ["read"],
  },
  COMERCIAL: {
    empresas: ["read", "create", "update"],
    obras: ["read", "create", "update"],
    contatos: ["read", "create", "update"],
    oportunidades: ["read", "create", "update"],
    propostas: ["read", "create", "update"],
    tarefas: ["read", "create", "update"],
    equipamentos: ["read"],
    auditoria: [],
    usuarios: [],
  },
  OPERACIONAL: {
    empresas: ["read"],
    obras: ["read"],
    contatos: ["read"],
    oportunidades: ["read"],
    propostas: ["read"],
    tarefas: ["read"],
    equipamentos: ["read"],
    auditoria: [],
    usuarios: [],
  },
};

export function can(role: PapelUsuario, resource: Resource, action: Action) {
  return permissions[role][resource].includes(action);
}
