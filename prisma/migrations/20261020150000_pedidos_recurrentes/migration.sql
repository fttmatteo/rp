-- AlterEnum
ALTER TYPE "EstadoPedido" ADD VALUE 'POR_APROBAR';

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "recurrenteId" INTEGER;

-- CreateTable
CREATE TABLE "PedidoRecurrente" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "diasSemana" INTEGER[],
    "desde" DATE NOT NULL,
    "nota" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoPorId" INTEGER NOT NULL,

    CONSTRAINT "PedidoRecurrente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetalleRecurrente" (
    "id" SERIAL NOT NULL,
    "recurrenteId" INTEGER NOT NULL,
    "productoId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "DetalleRecurrente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PedidoRecurrente_activo_idx" ON "PedidoRecurrente"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_recurrenteId_fechaEntrega_key" ON "Pedido"("recurrenteId", "fechaEntrega");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_recurrenteId_fkey" FOREIGN KEY ("recurrenteId") REFERENCES "PedidoRecurrente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoRecurrente" ADD CONSTRAINT "PedidoRecurrente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoRecurrente" ADD CONSTRAINT "PedidoRecurrente_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleRecurrente" ADD CONSTRAINT "DetalleRecurrente_recurrenteId_fkey" FOREIGN KEY ("recurrenteId") REFERENCES "PedidoRecurrente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetalleRecurrente" ADD CONSTRAINT "DetalleRecurrente_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

