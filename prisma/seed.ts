// Datos iniciales: productos con sus precios y el usuario administrador.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const PRODUCTOS = [
  { codigo: "JUMBO", nombre: "Jumbo", tipo: "CUBETA", orden: 1, precioGeneral: 23000, precioClienteSugerido: null },
  { codigo: "AAA", nombre: "AAA", tipo: "CUBETA", orden: 2, precioGeneral: 20000, precioClienteSugerido: null },
  { codigo: "AA", nombre: "AA", tipo: "CUBETA", orden: 3, precioGeneral: 18000, precioClienteSugerido: 17000 },
  { codigo: "A", nombre: "A", tipo: "CUBETA", orden: 4, precioGeneral: 15000, precioClienteSugerido: 13000 },
  { codigo: "B", nombre: "B", tipo: "CUBETA", orden: 5, precioGeneral: 12000, precioClienteSugerido: null },
  { codigo: "GALLINA", nombre: "Gallina", tipo: "GALLINA", orden: 6, precioGeneral: 22000, precioClienteSugerido: 20000 },
] as const;

async function main() {
  for (const p of PRODUCTOS) {
    // Solo se crean; si ya existen no se tocan los precios que haya cambiado el administrador.
    await db.producto.upsert({ where: { codigo: p.codigo }, create: p, update: {} });
  }

  const clave = process.env.SEED_ADMIN_PASSWORD;
  if (!(await db.usuario.findUnique({ where: { usuario: "admin" } }))) {
    if (!clave || clave.length < 8) throw new Error("Define SEED_ADMIN_PASSWORD (mínimo 8 caracteres) para crear el administrador.");
    await db.usuario.create({
      data: { nombre: "Administrador", usuario: "admin", claveHash: await bcrypt.hash(clave, 10), accesos: ["ADMIN"] },
    });
    console.log('Usuario "admin" creado.');
  }
  console.log("Seed listo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
