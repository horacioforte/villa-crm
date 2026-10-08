// ARQUIVO: lib/base-nacional/acoes.ts
// REGRA: nunca remover. Apenas acrescentar.
// Executor das ações manuais da Base Nacional. Recebe o plano gerado pelas funções puras de
// validacao.ts e grava TUDO numa única transação. Recusa qualquer tabela fora da lista
// TABELAS_PERMITIDAS (só tabelas da Base Nacional) e qualquer operação que não seja create/update.
// Nunca cria Empresa, Pessoa, Dossiê, Carteira, Oportunidade ou Tarefa. Não aciona automações.

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { TABELAS_PERMITIDAS, type Operacao, type TabelaPermitida } from "./validacao";

type Delegate = {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
};

export function novoId(prefixo = "bn"): string {
  return `${prefixo}-${randomUUID()}`;
}

export function conferirPlano(operacoes: Operacao[]): void {
  if (!operacoes.length) throw new Error("Plano vazio.");
  for (const op of operacoes) {
    if (!(TABELAS_PERMITIDAS as readonly string[]).includes(op.tabela)) throw new Error(`Tabela não permitida: ${op.tabela}`);
    if (op.acao !== "create" && op.acao !== "update") throw new Error("Operação não permitida.");
  }
  if (!operacoes.some(o => o.tabela === "ConcreteiraValidacaoHistorico" && o.acao === "create")) {
    throw new Error("Toda alteração precisa gerar histórico.");
  }
}

export async function executarPlano(operacoes: Operacao[]): Promise<void> {
  conferirPlano(operacoes);
  await prisma.$transaction(async tx => {
    const mapa: Record<TabelaPermitida, Delegate> = {
      ConcreteiraCandidata: tx.concreteiraCandidata as unknown as Delegate,
      ConcreteiraCandidataUnidade: tx.concreteiraCandidataUnidade as unknown as Delegate,
      ConcreteiraValidacaoHistorico: tx.concreteiraValidacaoHistorico as unknown as Delegate,
      ConcreteiraEvidencia: tx.concreteiraEvidencia as unknown as Delegate,
      ConcreteiraCandidataContato: tx.concreteiraCandidataContato as unknown as Delegate,
      ConcreteiraCandidataPessoa: tx.concreteiraCandidataPessoa as unknown as Delegate,
      ConcreteiraPotencialEquipamento: tx.concreteiraPotencialEquipamento as unknown as Delegate,
      // v5: a fila usa candidataId como chave; o "id" da operação é o id da candidata.
      ConcreteiraTriagem: {
        create: args => tx.concreteiraTriagem.create(args as never),
        update: args => tx.concreteiraTriagem.update({ where: { candidataId: args.where.id }, data: args.data as never }),
      },
    };
    for (const op of operacoes) {
      const d = mapa[op.tabela];
      if (op.acao === "create") await d.create({ data: op.dados });
      else await d.update({ where: { id: op.id }, data: op.dados });
    }
  });
}
