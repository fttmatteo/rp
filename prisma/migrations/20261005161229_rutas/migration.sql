-- CreateEnum
CREATE TYPE "EstadoRuta" AS ENUM ('ABIERTA', 'LIQUIDADA');

-- AlterEnum
ALTER TYPE "EstadoPedido" ADD VALUE 'NO_ENTREGADO';

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "latitud" DOUBLE PRECISION,
ADD COLUMN     "longitud" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "DetallePedido" ADD COLUMN     "cantidadEntregada" INTEGER;

-- AlterTable
ALTER TABLE "MovimientoCaja" ADD COLUMN     "rutaId" INTEGER;

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "rutaId" INTEGER;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "motivoNoEntrega" TEXT,
ADD COLUMN     "ordenEnRuta" INTEGER,
ADD COLUMN     "rutaId" INTEGER;

-- CreateTable
CREATE TABLE "Ruta" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "repartidorId" INTEGER NOT NULL,
    "estado" "EstadoRuta" NOT NULL DEFAULT 'ABIERTA',
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "efectivoEsperado" INTEGER,
    "efectivoEntregado" INTEGER,
    "diferencia" INTEGER,
    "observacion" TEXT,
    "liquidadaEn" TIMESTAMP(3),
    "liquidadaPorId" INTEGER,

    CONSTRAINT "Ruta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ruta_fecha_repartidorId_key" ON "Ruta"("fecha", "repartidorId");

-- CreateIndex
CREATE INDEX "Pago_rutaId_idx" ON "Pago"("rutaId");

-- CreateIndex
CREATE INDEX "Pedido_rutaId_idx" ON "Pedido"("rutaId");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ruta" ADD CONSTRAINT "Ruta_repartidorId_fkey" FOREIGN KEY ("repartidorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ruta" ADD CONSTRAINT "Ruta_liquidadaPorId_fkey" FOREIGN KEY ("liquidadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_rutaId_fkey" FOREIGN KEY ("rutaId") REFERENCES "Ruta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
