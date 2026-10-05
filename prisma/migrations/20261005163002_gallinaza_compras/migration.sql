-- CreateEnum
CREATE TYPE "FormaPagoCompra" AS ENUM ('CONTADO', 'CREDITO');

-- AlterEnum
ALTER TYPE "TipoMovimiento" ADD VALUE 'COMPRA';

-- AlterEnum
ALTER TYPE "TipoProducto" ADD VALUE 'GALLINAZA';

-- AlterTable
ALTER TABLE "MovimientoCaja" ADD COLUMN     "compraId" INTEGER,
ADD COLUMN     "pagoProveedorId" INTEGER;

-- AlterTable
ALTER TABLE "MovimientoInventario" ADD COLUMN     "compraId" INTEGER;

-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "unidad" TEXT;

-- AlterTable
ALTER TABLE "RegistroClasificacion" ADD COLUMN     "compraId" INTEGER;

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "notas" TEXT,
    "diasCredito" INTEGER NOT NULL DEFAULT 15,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Compra" (
    "id" SERIAL NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dia" DATE NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "clasificada" BOOLEAN NOT NULL,
    "huevos" INTEGER NOT NULL,
    "porClasificar" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "saldo" INTEGER NOT NULL,
    "formaPago" "FormaPagoCompra" NOT NULL,
    "vence" DATE,
    "anulada" BOOLEAN NOT NULL DEFAULT false,
    "nota" TEXT,

    CONSTRAINT "Compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleCompra" (
    "compraId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "DetalleCompra_pkey" PRIMARY KEY ("compraId","productoId")
);

-- CreateTable
CREATE TABLE "PagoProveedor" (
    "id" SERIAL NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dia" DATE NOT NULL,
    "valor" INTEGER NOT NULL,
    "medio" "MedioPago" NOT NULL,
    "referencia" TEXT,
    "usuarioId" INTEGER NOT NULL,
    "anulado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PagoProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AplicacionPagoProveedor" (
    "pagoId" INTEGER NOT NULL,
    "compraId" INTEGER NOT NULL,
    "valor" INTEGER NOT NULL,

    CONSTRAINT "AplicacionPagoProveedor_pkey" PRIMARY KEY ("pagoId","compraId")
);

-- CreateIndex
CREATE INDEX "Compra_proveedorId_saldo_idx" ON "Compra"("proveedorId", "saldo");

-- AddForeignKey
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroClasificacion" ADD CONSTRAINT "RegistroClasificacion_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_pagoProveedorId_fkey" FOREIGN KEY ("pagoProveedorId") REFERENCES "PagoProveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Compra" ADD CONSTRAINT "Compra_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCompra" ADD CONSTRAINT "DetalleCompra_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleCompra" ADD CONSTRAINT "DetalleCompra_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoProveedor" ADD CONSTRAINT "PagoProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagoProveedor" ADD CONSTRAINT "PagoProveedor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacionPagoProveedor" ADD CONSTRAINT "AplicacionPagoProveedor_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "PagoProveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AplicacionPagoProveedor" ADD CONSTRAINT "AplicacionPagoProveedor_compraId_fkey" FOREIGN KEY ("compraId") REFERENCES "Compra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
