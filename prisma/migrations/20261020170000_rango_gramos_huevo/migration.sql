-- Rango de peso (gramos por huevo) de cada tipo de huevo, escrito a mano por el administrador.
ALTER TABLE "Producto" ADD COLUMN "gramosMin" INTEGER;
ALTER TABLE "Producto" ADD COLUMN "gramosMax" INTEGER;
