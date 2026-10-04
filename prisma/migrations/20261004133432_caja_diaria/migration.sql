-- CreateEnum
CREATE TYPE "EstadoCaja" AS ENUM ('ABIERTA', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoMovimientoCaja" AS ENUM ('INGRESO', 'EGRESO');

-- AlterTable
-- Los pagos que ya existían quedan en el día (hora de Bogotá) en que se registraron.
ALTER TABLE "Pago" ADD COLUMN     "dia" DATE;
UPDATE "Pago" SET "dia" = ("fecha" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota')::date;
ALTER TABLE "Pago" ALTER COLUMN "dia" SET NOT NULL;

-- CreateTable
CREATE TABLE "Caja" (
    "dia" DATE NOT NULL,
    "estado" "EstadoCaja" NOT NULL DEFAULT 'ABIERTA',
    "base" INTEGER NOT NULL DEFAULT 0,
    "esperado" INTEGER,
    "contado" INTEGER,
    "diferencia" INTEGER,
    "observacion" TEXT,
    "cerradaEn" TIMESTAMP(3),
    "cerradaPorId" INTEGER,

    CONSTRAINT "Caja_pkey" PRIMARY KEY ("dia")
);

-- CreateTable
CREATE TABLE "MovimientoCaja" (
    "id" SERIAL NOT NULL,
    "dia" DATE NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoMovimientoCaja" NOT NULL,
    "concepto" TEXT NOT NULL,
    "valor" INTEGER NOT NULL,
    "medio" "MedioPago" NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "anulado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MovimientoCaja_dia_idx" ON "MovimientoCaja"("dia");

-- CreateIndex
CREATE INDEX "Pago_dia_idx" ON "Pago"("dia");

-- AddForeignKey
ALTER TABLE "Caja" ADD CONSTRAINT "Caja_cerradaPorId_fkey" FOREIGN KEY ("cerradaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_dia_fkey" FOREIGN KEY ("dia") REFERENCES "Caja"("dia") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
