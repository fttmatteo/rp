-- En pantalla ya solo se habla de galpones: cada galpón tiene a lo sumo un grupo de aves (lote) activo,
-- y un lote se cierra solo cuando salen todas sus aves. Solo cambia datos, no la estructura.

-- 1. Cierra los lotes activos que ya no tienen aves.
UPDATE "Lote" l SET "activo" = false
WHERE l."activo"
  AND l."cantidadInicial"
    - COALESCE((SELECT SUM(n."cantidad") FROM "NovedadLote" n WHERE n."loteId" = l."id" AND NOT n."anulada"), 0)
    + COALESCE((SELECT SUM(n."cantidad") FROM "NovedadLote" n WHERE n."loteDestinoId" = l."id" AND n."tipo" = 'TRASLADO' AND NOT n."anulada"), 0)
    <= 0;

-- 2. Si un galpón tenía varios lotes activos, el más antiguo se queda y cada uno de los otros pasa
--    a un galpón propio llamado «<galpón> · <lote>», para no perder ni mezclar sus datos.
INSERT INTO "Galpon" ("nombre", "activo")
SELECT g."nombre" || ' · ' || l."nombre", true
FROM "Lote" l JOIN "Galpon" g ON g."id" = l."galponId"
WHERE l."activo"
  AND EXISTS (SELECT 1 FROM "Lote" o WHERE o."galponId" = l."galponId" AND o."activo" AND o."id" < l."id");

UPDATE "Lote" l SET "galponId" = nuevo."id"
FROM "Galpon" g, "Galpon" nuevo
WHERE g."id" = l."galponId"
  AND nuevo."nombre" = g."nombre" || ' · ' || l."nombre"
  AND l."activo"
  AND EXISTS (SELECT 1 FROM "Lote" o WHERE o."galponId" = l."galponId" AND o."activo" AND o."id" < l."id");
