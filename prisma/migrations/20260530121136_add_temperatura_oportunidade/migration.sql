-- CreateEnum
CREATE TYPE "TemperaturaOportunidade" AS ENUM ('FRIA', 'MEDIA', 'QUENTE');

-- AlterTable
ALTER TABLE "Oportunidade" ADD COLUMN     "temperatura" "TemperaturaOportunidade",
ADD COLUMN     "temperaturaMotivo" TEXT;
