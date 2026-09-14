// ARQUIVO: lib/whatsapp/telefone.ts
// REGRA: nunca remover. Apenas acrescentar.
//
// Números de celular brasileiros têm uma ambiguidade conhecida como "nono dígito":
// o WhatsApp/Meta às vezes reporta o mesmo contato com esse dígito extra e às vezes
// sem ele, dependendo de como o número foi registrado na operadora/no aparelho. Isso
// faz duas mensagens do MESMO contato chegarem com formatos de telefone diferentes —
// por exemplo "5581995159223" (com o 9) e "558195159223" (sem o 9) — e, se a busca de
// conversa exigir igualdade exata, cada formato cria uma Conversa separada para a
// mesma pessoa.
//
// variantesTelefoneBR() gera as variações plausíveis (com e sem o nono dígito) de um
// número já normalizado (só dígitos, com o código do país 55 na frente) para USAR EM
// BUSCA. Nunca decide o que é gravado no banco — o valor salvo continua sendo
// exatamente o que foi recebido da Meta/Evolution ou digitado no CRM, sem alteração.
export function variantesTelefoneBR(telefone: string): string[] {
  const digits = telefone.replace(/\D/g, "");
  const variantes = new Set<string>([digits]);

  if (digits.startsWith("55")) {
    const ddd = digits.slice(2, 4);
    const resto = digits.slice(4);

    if (resto.length === 9 && resto.startsWith("9")) {
      // 9 dígitos com o nono dígito -> também tenta a variante de 8 dígitos sem ele
      variantes.add(`55${ddd}${resto.slice(1)}`);
    } else if (resto.length === 8) {
      // 8 dígitos (formato antigo) -> também tenta a variante de 9 dígitos com o "9"
      variantes.add(`55${ddd}9${resto}`);
    }
  }

  return Array.from(variantes);
}
