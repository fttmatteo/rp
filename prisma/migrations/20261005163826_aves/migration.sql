-- CreateEnum
CREATE TYPE "EstadoLote" AS ENUM ('CRIA', 'LEVANTE', 'POSTURA', 'DESCARTE');

-- CreateEnum
CREATE TYPE "TipoNovedad" AS ENUM ('MUERTE', 'DESCARTE', 'VENTA', 'TRASLADO');

-- AlterTable
ALTER TABLE "MovimientoInventario" ADD COLUMN     "novedadId" INTEGER;

-- AlterTable
ALTER TABLE "RegistroClasificacion" ADD COLUMN     "loteId" INTEGER;

-- CreateTable
CREATE TABLE "Galpon" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "capacidad" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Galpon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" SERIAL NOT NULL,
    "galponId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "raza" TEXT,
    "fechaIngreso" DATE NOT NULL,
    "edadIngresoSemanas" INTEGER NOT NULL DEFAULT 0,
    "cantidadInicial" INTEGER NOT NULL,
    "estado" "EstadoLote" NOT NULL DEFAULT 'POSTURA',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NovedadLote" (
    "id" SERIAL NOT NULL,
    "loteId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "TipoNovedad" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "loteDestinoId" INTEGER,
    "nota" TEXT,
    "usuarioId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anulada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "NovedadLote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Galpon_nombre_key" ON "Galpon"("nombre");

-- CreateIndex
CREATE INDEX "NovedadLote_loteId_idx" ON "NovedadLote"("loteId");

-- CreateIndex
CREATE INDEX "NovedadLote_loteDestinoId_idx" ON "NovedadLote"("loteDestinoId");

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_novedadId_fkey" FOREIGN KEY ("novedadId") REFERENCES "NovedadLote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroClasificacion" ADD CONSTRAINT "RegistroClasificacion_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_galponId_fkey" FOREIGN KEY ("galponId") REFERENCES "Galpon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovedadLote" ADD CONSTRAINT "NovedadLote_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovedadLote" ADD CONSTRAINT "NovedadLote_loteDestinoId_fkey" FOREIGN KEY ("loteDestinoId") REFERENCES "Lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovedadLote" ADD CONSTRAINT "NovedadLote_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
