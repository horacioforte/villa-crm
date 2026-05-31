import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function temProximaAcao(tarefas: { status: string }[]): boolean {
  return tarefas.some(
    (tarefa) => tarefa.status === "PENDENTE" || tarefa.status === "EM_ANDAMENTO",
  )
}
