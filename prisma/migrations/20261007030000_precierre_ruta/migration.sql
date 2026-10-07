-- AlterEnum
ALTER TYPE "EstadoRuta" ADD VALUE 'PRECERRADA' BEFORE 'LIQUIDADA';

-- AlterTable
ALTER TABLE "Ruta" ADD COLUMN     "precerradaEn" TIMESTAMP(3);
