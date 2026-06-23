-- REGRA: nunca remover. Apenas acrescentar.
-- Adiciona campo mensagemInicial à tabela Campanha.
-- Usada pelo disparo ativo do João como texto da primeira abordagem.

ALTER TABLE "Campanha" ADD COLUMN "mensagemInicial" TEXT;
