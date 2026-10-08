-- Cliente genérico «Consumidor final» para la venta en el punto a quien no está registrado.
-- La app lo crea la primera vez que se usa (así los datos de ejemplo siguen cargando en una base sin clientes).
ALTER TABLE "Cliente" ADD COLUMN "consumidorFinal" BOOLEAN NOT NULL DEFAULT false;

-- A lo sumo un consumidor final.
CREATE UNIQUE INDEX "Cliente_consumidorFinal_unico" ON "Cliente" ("consumidorFinal") WHERE "consumidorFinal";
