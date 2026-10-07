-- El acceso Galponero desaparece: la clasificación, las aves y el inventario los maneja el administrador.
-- Se quita ese acceso a quien lo tenía; quien se queda sin ningún acceso queda inactivo (el administrador puede
-- reactivarlo con otro acceso desde Usuarios). Las sesiones abiertas como galponero se cierran.
UPDATE "Usuario" SET "accesos" = array_remove("accesos", 'GALPONERO');
UPDATE "Usuario" SET "activo" = false WHERE cardinality("accesos") = 0;
DELETE FROM "Sesion" WHERE "operacion" = 'GALPONERO';

-- AlterEnum
BEGIN;
CREATE TYPE "Acceso_new" AS ENUM ('ADMIN', 'VENTAS', 'REPARTIDOR');
ALTER TABLE "Usuario" ALTER COLUMN "accesos" TYPE "Acceso_new"[] USING ("accesos"::text::"Acceso_new"[]);
ALTER TABLE "Sesion" ALTER COLUMN "operacion" TYPE "Acceso_new" USING ("operacion"::text::"Acceso_new");
ALTER TYPE "Acceso" RENAME TO "Acceso_old";
ALTER TYPE "Acceso_new" RENAME TO "Acceso";
DROP TYPE "public"."Acceso_old";
COMMIT;

-- DropIndex
DROP INDEX "Pago_clienteId_idx";

-- CreateIndex
CREATE INDEX "Cliente_activo_nombre_idx" ON "Cliente"("activo", "nombre");

-- CreateIndex
CREATE INDEX "Compra_proveedorId_fecha_idx" ON "Compra"("proveedorId", "fecha");

-- CreateIndex
CREATE INDEX "HistorialPrecio_fecha_idx" ON "HistorialPrecio"("fecha");

-- CreateIndex
CREATE INDEX "Pago_clienteId_fecha_idx" ON "Pago"("clienteId", "fecha");

-- CreateIndex
CREATE INDEX "PagoProveedor_proveedorId_fecha_idx" ON "PagoProveedor"("proveedorId", "fecha");

-- CreateIndex
CREATE INDEX "Pedido_fechaEntrega_idx" ON "Pedido"("fechaEntrega");

-- CreateIndex
CREATE INDEX "Venta_clienteId_fecha_idx" ON "Venta"("clienteId", "fecha");

