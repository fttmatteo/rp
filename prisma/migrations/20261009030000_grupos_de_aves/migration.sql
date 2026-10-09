-- La base pasa a hablar como la aplicación: lo que se llamaba «lote» es el grupo de aves que entra a un
-- galpón, y su «estado» es la etapa. Solo se renombran tablas, columnas, tipos, índices y llaves, así que
-- no se pierde ningún dato. Se quita el nombre del lote, que ya no se pedía ni se mostraba.

-- Grupos de aves (antes Lote)
ALTER TABLE "Lote" RENAME TO "GrupoAves";
ALTER TABLE "GrupoAves" RENAME CONSTRAINT "Lote_pkey" TO "GrupoAves_pkey";
ALTER SEQUENCE "Lote_id_seq" RENAME TO "GrupoAves_id_seq";
ALTER TABLE "GrupoAves" RENAME CONSTRAINT "Lote_galponId_fkey" TO "GrupoAves_galponId_fkey";
ALTER TYPE "EstadoLote" RENAME TO "EtapaAves";
ALTER TABLE "GrupoAves" RENAME COLUMN "estado" TO "etapa";
ALTER TABLE "GrupoAves" DROP COLUMN "nombre";

-- Novedades de aves (antes NovedadLote)
ALTER TABLE "NovedadLote" RENAME TO "NovedadAves";
ALTER TABLE "NovedadAves" RENAME CONSTRAINT "NovedadLote_pkey" TO "NovedadAves_pkey";
ALTER SEQUENCE "NovedadLote_id_seq" RENAME TO "NovedadAves_id_seq";
ALTER TABLE "NovedadAves" RENAME COLUMN "loteId" TO "grupoId";
ALTER TABLE "NovedadAves" RENAME COLUMN "loteDestinoId" TO "grupoDestinoId";
ALTER TABLE "NovedadAves" RENAME CONSTRAINT "NovedadLote_loteId_fkey" TO "NovedadAves_grupoId_fkey";
ALTER TABLE "NovedadAves" RENAME CONSTRAINT "NovedadLote_loteDestinoId_fkey" TO "NovedadAves_grupoDestinoId_fkey";
ALTER TABLE "NovedadAves" RENAME CONSTRAINT "NovedadLote_usuarioId_fkey" TO "NovedadAves_usuarioId_fkey";
ALTER INDEX "NovedadLote_loteId_idx" RENAME TO "NovedadAves_grupoId_idx";
ALTER INDEX "NovedadLote_loteDestinoId_idx" RENAME TO "NovedadAves_grupoDestinoId_idx";

-- Clasificación: de qué galpón (grupo de aves) salieron los huevos
ALTER TABLE "RegistroClasificacion" RENAME COLUMN "loteId" TO "grupoId";
ALTER TABLE "RegistroClasificacion" RENAME CONSTRAINT "RegistroClasificacion_loteId_fkey" TO "RegistroClasificacion_grupoId_fkey";

-- La auditoría ya registrada sigue apuntando a los mismos registros con el nombre nuevo.
UPDATE "Auditoria" SET "entidad" = 'GrupoAves' WHERE "entidad" = 'Lote';
UPDATE "Auditoria" SET "entidad" = 'NovedadAves' WHERE "entidad" = 'NovedadLote';
