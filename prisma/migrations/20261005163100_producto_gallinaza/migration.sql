-- Gallinaza como producto de venta. Queda inactiva y sin precio hasta que el
-- administrador elija la unidad y el precio en Precios y la marque "En venta".
INSERT INTO "Producto" ("codigo", "nombre", "tipo", "orden", "precioGeneral", "unidad", "activo")
VALUES ('GALLINAZA', 'Gallinaza', 'GALLINAZA', 7, 0, 'bulto', false)
ON CONFLICT ("codigo") DO NOTHING;
