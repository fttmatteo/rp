-- Lo que se le debía a un proveedor antes de usar la app se carga como una compra de tipo «saldo inicial»
-- (sin huevo ni caja). Las compras que ya existen quedan como compras normales.

-- CreateEnum
CREATE TYPE "TipoCompra" AS ENUM ('COMPRA', 'SALDO_INICIAL');

-- AlterTable
ALTER TABLE "Compra" ADD COLUMN     "tipo" "TipoCompra" NOT NULL DEFAULT 'COMPRA';
