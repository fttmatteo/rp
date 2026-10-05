-- AlterTable
ALTER TABLE "Producto" ADD COLUMN     "existencias" INTEGER NOT NULL DEFAULT 0;

-- Carga inicial a partir de los movimientos ya registrados
UPDATE "Producto" p
SET "existencias" = m.total
FROM (SELECT "productoId", SUM("cantidad")::int AS total FROM "MovimientoInventario" GROUP BY "productoId") m
WHERE m."productoId" = p."id";
