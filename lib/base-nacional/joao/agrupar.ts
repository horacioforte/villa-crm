// ARQUIVO: lib/base-nacional/joao/agrupar.ts
// REGRA: nunca remover. Apenas acrescentar.
// João — agrupa matriz, filiais e grupo econômico para pesquisar cada grupo UMA única vez.
// Regras de ligação (só ligações fortes e verificáveis):
//   - mesma raiz de CNPJ (matriz e filiais já são uma candidata só);
//   - vínculo FORTE já registrado pelo robô (mesmo telefone, e-mail ou domínio próprio, chave pouco compartilhada);
//   - uma empresa é sócia (pessoa jurídica) da outra no QSA da Receita;
//   - mesmo sócio-administrador/administrador (mesmo nome E mesma chave de documento da Receita).
// Função pura.

export type ItemGrupo = { candidataId: string; raiz: string; nome: string; unidadesAtivas: number; ordem: number };
export type Ligacao = { a: string; b: string; motivo: string };
export type Grupo = { chave: string; nome: string; principal: string; candidataIds: string[]; raizes: string[]; motivos: string[]; ordem: number };

export function agruparCandidatas(itens: ItemGrupo[], ligacoes: Ligacao[]): Grupo[] {
  const pai = new Map<string, string>(itens.map(i => [i.candidataId, i.candidataId]));
  const achar = (x: string): string => { let r = x; while (pai.get(r) !== r) r = pai.get(r)!; let y = x; while (pai.get(y) !== r) { const n = pai.get(y)!; pai.set(y, r); y = n; } return r; };
  const motivos = new Map<string, Set<string>>();
  for (const l of ligacoes) {
    if (!pai.has(l.a) || !pai.has(l.b) || l.a === l.b) continue;
    const ra = achar(l.a), rb = achar(l.b);
    if (ra !== rb) pai.set(ra, rb);
  }
  for (const l of ligacoes) {
    if (!pai.has(l.a) || !pai.has(l.b) || l.a === l.b) continue;
    const r = achar(l.a);
    if (!motivos.has(r)) motivos.set(r, new Set());
    motivos.get(r)!.add(l.motivo);
  }
  const porRaiz = new Map<string, ItemGrupo[]>();
  for (const i of itens) { const r = achar(i.candidataId); if (!porRaiz.has(r)) porRaiz.set(r, []); porRaiz.get(r)!.push(i); }
  const grupos: Grupo[] = [];
  for (const [r, membros] of porRaiz) {
    const principal = [...membros].sort((a, b) => b.unidadesAtivas - a.unidadesAtivas || a.ordem - b.ordem || a.raiz.localeCompare(b.raiz))[0];
    const raizes = membros.map(m => m.raiz).sort();
    grupos.push({ chave: `jg-${raizes[0]}`, nome: principal.nome, principal: principal.candidataId, candidataIds: membros.map(m => m.candidataId).sort(),
      raizes, motivos: [...(motivos.get(r) ?? [])].sort(), ordem: Math.min(...membros.map(m => m.ordem)) });
  }
  return grupos.sort((a, b) => a.ordem - b.ordem || a.chave.localeCompare(b.chave));
}
